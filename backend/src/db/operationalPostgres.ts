import pg from "pg";
import { randomUUID, createHash } from "node:crypto";
import type { RequestHandler } from "express";
import { Store, DatabaseSchema } from "./store.js";
import { BUREAUS } from "../config/constants.js";
import { operationalUnit, OperationalUnit, LiveEvent, persistenceDriver } from "./unitOfWork.js";
import { postgresConfig } from "./postgresConfig.js";
import { normalizedIdentifier, normalizedName } from "../services/institutionResolution.js";
import {initializeAuditIntegrity,appendPendingAuditEvents,externalAuditCheckpoint} from "../security/auditChain.js";

type QueryClient = Pick<pg.PoolClient,"query">;
const eventTypes = new Set(["CASE_CREATED","CASE_REGISTERED","CASE_UPDATED","CASE_TRANSFERRED","TRANSFER_ACCEPTED","TRANSFER_REJECTED","COORDINATION_UPDATED"]);
export function emptyOperationalSnapshot(): DatabaseSchema { return {profiles:[],institutions:[],complaints:[],overlapAlerts:[],caseHistory:[],caseTransfers:[],relatedCases:[],notifications:[],auditLogs:[],documents:[],coordinationSessions:[],bureaus:structuredClone(BUREAUS),meta:{version:"1.0.0",lastReset:new Date().toISOString()}}; }
export function validateSnapshot(value: unknown): asserts value is DatabaseSchema {
  if (!value || typeof value !== "object") throw new Error("Operational snapshot must be an object");
  const data = value as DatabaseSchema;
  for (const key of ["profiles","institutions","complaints","overlapAlerts","caseHistory","caseTransfers","relatedCases","notifications","auditLogs"] as const) {
    if (!Array.isArray(data[key])) throw new Error(`Operational snapshot missing collection: ${key}`);
    const ids = data[key].map(item=>item.id); if(ids.some(id=>typeof id!=="string"||!id)||new Set(ids).size!==ids.length) throw new Error(`Invalid or duplicated IDs in ${key}`);
  }
  if (!data.meta || typeof data.meta.version !== "string") throw new Error("Operational snapshot metadata is missing");
}

/** PostgreSQL is the sole durable authority. The existing Store is the transaction-local domain implementation. */
export class OperationalPostgres {
  readonly pool: pg.Pool;
  readonly instanceId = randomUUID();
  private listener?: pg.PoolClient;
  constructor(config = postgresConfig()) { this.pool = new pg.Pool(config); this.pool.on("error",()=>console.error("PostgreSQL pool connection unavailable")); }
  private async lock(client: pg.PoolClient) {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='30s'; SET LOCAL idle_in_transaction_session_timeout='45s'");
    await client.query("SELECT pg_advisory_xact_lock(26264,2)");
  }
  private async begin() {
    const client = await this.pool.connect();
    try {
      await this.lock(client);
      const result = await client.query("SELECT revision::text,payload FROM iicmcs.operational_state WHERE id=1 FOR UPDATE");
      if (!result.rows.length) throw new Error("PostgreSQL is not initialized; run the explicit operational backfill/bootstrap command");
      validateSnapshot(result.rows[0].payload);
      const unit: OperationalUnit = { store: undefined as unknown as Store, dirty:false, events:[], rollback:[], commit:[] };
      unit.store = new Store({snapshot:result.rows[0].payload,onPersist:()=>{unit.dirty=true;},mode:"PostgreSQL"});
      return {client,unit,revision:result.rows[0].revision as string};
    } catch(error) { await client.query("ROLLBACK").catch(()=>{}); client.release(); throw error; }
  }
  private async immutable(client: QueryClient, table: "coordination_messages"|"coordination_approvals"|"coordination_events", sessionId:string, record:any) {
    const message = table === "coordination_messages";
    const result = await client.query(`INSERT INTO iicmcs.${table}(session_id,id,created_at,document${message?",reply_to":""}) VALUES($1,$2,$3,$4${message?",$5":""}) ON CONFLICT(session_id,id) DO UPDATE SET document=EXCLUDED.document WHERE iicmcs.${table}.document=EXCLUDED.document RETURNING id`,[sessionId,record.id,record.createdAt,JSON.stringify(record),...(message?[record.replyTo||null]:[])]);
    if(result.rowCount!==1) throw new Error("An existing official coordination record cannot be modified");
  }
  private async project(client: QueryClient,data:DatabaseSchema) {
    const auditState=data.auditIntegrity??=initializeAuditIntegrity(data.auditLogs);appendPendingAuditEvents(data.auditLogs,auditState,externalAuditCheckpoint());
    const prior=(await client.query("SELECT sequence::text,hash,(SELECT count(*)::text FROM iicmcs.audit_chain_entries) AS count FROM iicmcs.audit_chain_entries ORDER BY iicmcs.audit_chain_entries.sequence DESC LIMIT 1")).rows[0];
    if(prior&&(Number(prior.count)!==Number(prior.sequence)||Number(prior.sequence)>auditState.entries.length||auditState.entries[Number(prior.sequence)-1]?.hash!==prior.hash))throw new Error("Audit snapshot disagrees with its append-only database projection");
    const anchor={schema:auditState.schema,scope:auditState.scope,legacyCount:auditState.legacyCount,legacyDigest:auditState.legacyDigest,genesisHash:auditState.genesisHash};
    const anchored=await client.query("INSERT INTO iicmcs.audit_legacy_anchor(id,document) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document WHERE iicmcs.audit_legacy_anchor.document=EXCLUDED.document RETURNING id",[JSON.stringify(anchor)]);if(anchored.rowCount!==1)throw new Error("Audit legacy anchor cannot change");
    for(const entry of auditState.entries.filter(row=>row.sequence>Number(prior?.sequence||0))){const event=data.auditLogs[auditState.legacyCount+entry.sequence-1];const saved=await client.query("INSERT INTO iicmcs.audit_events(id,document) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document WHERE iicmcs.audit_events.document=EXCLUDED.document RETURNING id",[event.id,JSON.stringify(event)]);if(saved.rowCount!==1)throw new Error("Audit event cannot change");
      const linked=await client.query("INSERT INTO iicmcs.audit_chain_entries(sequence,audit_id,hash,previous_hash,document) VALUES($1,$2,$3,$4,$5) ON CONFLICT(sequence) DO UPDATE SET document=EXCLUDED.document WHERE iicmcs.audit_chain_entries.document=EXCLUDED.document RETURNING sequence",[entry.sequence,entry.auditId,entry.hash,entry.previousHash,JSON.stringify(entry)]);if(linked.rowCount!==1)throw new Error("Audit chain cannot change");}
    for(const checkpoint of auditState.checkpoints){const result=await client.query("INSERT INTO iicmcs.audit_checkpoints(id,sequence,document) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document WHERE iicmcs.audit_checkpoints.document=EXCLUDED.document RETURNING id",[checkpoint.id,checkpoint.sequence,JSON.stringify(checkpoint)]);if(result.rowCount!==1)throw new Error("Audit checkpoint cannot change");}
    for(const [table,rows] of [["profiles",data.profiles],["bureaus",data.bureaus||BUREAUS],["institutions",data.institutions]] as const) {
      await client.query(`INSERT INTO iicmcs.${table}(id,document) SELECT item->>'id',item FROM jsonb_array_elements($1::jsonb) item ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document`,[JSON.stringify(rows)]);
    }
    await client.query("INSERT INTO iicmcs.complaints(id,reference,institution_id,bureau_id,document) SELECT item->>'id',item->>'complaintId',item->>'institutionId',item->>'currentBureauId',item FROM jsonb_array_elements($1::jsonb) item ON CONFLICT(id) DO UPDATE SET institution_id=EXCLUDED.institution_id,bureau_id=EXCLUDED.bureau_id,document=EXCLUDED.document",[JSON.stringify(data.complaints)]);
    for(const row of data.reportSchedules||[])await client.query("INSERT INTO iicmcs.report_schedules(id,owner_id,version,enabled,document) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET version=EXCLUDED.version,enabled=EXCLUDED.enabled,document=EXCLUDED.document",[row.id,row.ownerId,row.version,row.enabled,JSON.stringify(row)]);
    for(const row of data.reportPacks||[]){const saved=await client.query("INSERT INTO iicmcs.report_packs(id,key,schedule_id,owner_id,document) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document WHERE iicmcs.report_packs.document=EXCLUDED.document RETURNING id",[row.id,row.key,row.scheduleId,row.ownerId,JSON.stringify(row)]);if(saved.rowCount!==1)throw new Error("Report pack history cannot change");}
    for(const row of data.reportDownloads||[]){const saved=await client.query("INSERT INTO iicmcs.report_downloads(id,pack_id,actor_id,document) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document WHERE iicmcs.report_downloads.document=EXCLUDED.document RETURNING id",[row.id,row.packId,row.actorId,JSON.stringify(row)]);if(saved.rowCount!==1)throw new Error("Report download history cannot change");}
    for(const config of data.slaPolicyConfigurations||[]){const result=await client.query("INSERT INTO iicmcs.sla_policy_configurations(id,version,document) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document WHERE iicmcs.sla_policy_configurations.document=EXCLUDED.document RETURNING id",[config.id,config.version,JSON.stringify(config)]);if(result.rowCount!==1)throw new Error("SLA configuration history cannot change");}
    for(const record of data.complaints)if(record.sla)await client.query("INSERT INTO iicmcs.case_sla_clocks(complaint_id,version,configuration_version,deadline,document) VALUES($1,$2,$3,$4,$5) ON CONFLICT(complaint_id) DO UPDATE SET version=EXCLUDED.version,configuration_version=EXCLUDED.configuration_version,deadline=EXCLUDED.deadline,document=EXCLUDED.document",[record.id,record.sla.version,record.sla.configurationVersion,record.expectedDisposalDate,JSON.stringify(record.sla)]);
    for(const alert of data.slaAlerts||[])await client.query("INSERT INTO iicmcs.sla_alerts(id,key,recipient_id,kind,document) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document",[alert.id,alert.key,alert.recipientId,alert.kind,JSON.stringify(alert)]);
    for(const delivery of data.slaDeliveries||[])await client.query("INSERT INTO iicmcs.sla_deliveries(id,alert_id,recipient_id,channel,status,document) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,document=EXCLUDED.document",[delivery.id,delivery.alertId,delivery.recipientId,delivery.channel,delivery.status,JSON.stringify(delivery)]);
    await client.query("INSERT INTO iicmcs.documents(id,complaint_id,document) SELECT item->>'id',item->>'complaintId',item FROM jsonb_array_elements($1::jsonb) item ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document",[JSON.stringify(data.documents||[])]);
    for (const [table, rows] of [["merge_proposals",data.mergeProposals||[]],["case_merges",data.caseMerges||[]],["merge_reversals",data.mergeReversals||[]]] as const) for (const record of rows) {
      const result = table === "merge_proposals" ? await client.query("INSERT INTO iicmcs.merge_proposals(id,source_id,canonical_id,actor_id,request_id,document) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document WHERE iicmcs.merge_proposals.document=EXCLUDED.document RETURNING id",[record.id,(record as any).sourceId,(record as any).canonicalId,record.actorId,(record as any).requestId,JSON.stringify(record)])
        : table === "case_merges" ? await client.query("INSERT INTO iicmcs.case_merges(id,proposal_id,source_id,canonical_id,actor_id,document) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document WHERE iicmcs.case_merges.document=EXCLUDED.document RETURNING id",[record.id,(record as any).proposalId,(record as any).sourceId,(record as any).canonicalId,record.actorId,JSON.stringify(record)])
        : await client.query("INSERT INTO iicmcs.merge_reversals(id,merge_id,actor_id,request_id,document) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document WHERE iicmcs.merge_reversals.document=EXCLUDED.document RETURNING id",[record.id,(record as any).mergeId,record.actorId,(record as any).requestId,JSON.stringify(record)]);
      if (result.rowCount !== 1) throw new Error("Case family history cannot be modified");
    }
    await client.query("DELETE FROM iicmcs.case_merge_active");
    for (const merge of (data.caseMerges || []).filter(row=>!(data.mergeReversals||[]).some(reversal=>reversal.mergeId===row.id))) await client.query("INSERT INTO iicmcs.case_merge_active(source_id,canonical_id,merge_id) VALUES($1,$2,$3)",[merge.sourceId,merge.canonicalId,merge.id]);
    for (const config of data.overlapConfigurations || []) {
      const result = await client.query("INSERT INTO iicmcs.overlap_configurations(id,version,document) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document WHERE iicmcs.overlap_configurations.document=EXCLUDED.document RETURNING id", [config.id, config.version, JSON.stringify(config)]);
      if (result.rowCount !== 1) throw new Error("Existing overlap configuration history cannot be modified");
    }
    for (const complaint of data.complaints) if (complaint.entityReferencesVersion) await client.query("INSERT INTO iicmcs.case_entity_references(complaint_id,version,document) VALUES($1,$2,$3) ON CONFLICT(complaint_id) DO UPDATE SET version=EXCLUDED.version,document=EXCLUDED.document", [complaint.id, complaint.entityReferencesVersion, JSON.stringify(complaint.entityReferences || [])]);
    for (const alert of data.overlapAlerts) {
      await client.query("INSERT INTO iicmcs.overlap_alerts(id,alert_reference,institution_id,case_a,case_b,status,document) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,document=EXCLUDED.document", [alert.id,alert.alertId,alert.institutionId,alert.complaintIdA,alert.complaintIdB,alert.alertStatus,JSON.stringify(alert)]);
      const [a, b] = [alert.complaintIdA, alert.complaintIdB].sort();
      // Legacy orphans/self-pairs are retained in the source snapshot for explicit review, not silently repaired.
      if (a !== b && data.complaints.some(row => row.id === a) && data.complaints.some(row => row.id === b)) await client.query("INSERT INTO iicmcs.overlap_pair_receipts(case_a,case_b,first_alert_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [a,b,alert.id]);
    }
    for (const feedback of data.overlapFeedback || []) {
      const result = await client.query("INSERT INTO iicmcs.overlap_feedback(id,alert_id,actor_id,request_id,document) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document WHERE iicmcs.overlap_feedback.document=EXCLUDED.document RETURNING id", [feedback.id, feedback.alertId, feedback.actorId, feedback.requestId || null, JSON.stringify(feedback)]);
      if (result.rowCount !== 1) throw new Error("Existing overlap feedback cannot be modified");
    }
    for (const config of data.sensitivityConfigurations || []) {
      const result = await client.query("INSERT INTO iicmcs.sensitivity_configurations(id,version,document) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document WHERE iicmcs.sensitivity_configurations.document=EXCLUDED.document RETURNING id", [config.id, config.version, JSON.stringify(config)]);
      if (result.rowCount !== 1) throw new Error("Existing sensitivity configuration history cannot be modified");
    }
    for (const complaint of data.complaints) {
      if (complaint.textAnalysis) {
        const analysis = complaint.textAnalysis;
        await client.query("INSERT INTO iicmcs.case_text_analysis(complaint_id,source_hash,preprocessing_version,language_code,translation_status,document) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(complaint_id) DO UPDATE SET source_hash=EXCLUDED.source_hash,preprocessing_version=EXCLUDED.preprocessing_version,language_code=EXCLUDED.language_code,translation_status=EXCLUDED.translation_status,document=EXCLUDED.document", [complaint.id, analysis.sourceHash, analysis.preprocessingVersion, analysis.language.code, analysis.translation.status, JSON.stringify(analysis)]);
      }
      if (complaint.security) {
        const security = complaint.security;
        await client.query("INSERT INTO iicmcs.case_security(complaint_id,version,level,review_status,document) VALUES($1,$2,$3,$4,$5) ON CONFLICT(complaint_id) DO UPDATE SET version=EXCLUDED.version,level=EXCLUDED.level,review_status=EXCLUDED.review_status,document=EXCLUDED.document", [complaint.id, security.version, security.level, security.reviewStatus, JSON.stringify(security)]);
        await client.query("DELETE FROM iicmcs.case_security_grants WHERE complaint_id=$1", [complaint.id]);
        for (const grant of security.grants) await client.query("INSERT INTO iicmcs.case_security_grants(complaint_id,profile_id,can_read,can_evidence,can_identity,can_manage,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)", [complaint.id, grant.profileId, grant.read, grant.evidence, grant.identity, grant.manage, grant.expiresAt || null]);
      }
      if (complaint.identityEnvelope) await client.query("INSERT INTO iicmcs.case_identities(complaint_id,key_id,envelope) VALUES($1,$2,$3) ON CONFLICT(complaint_id) DO UPDATE SET key_id=EXCLUDED.key_id,envelope=EXCLUDED.envelope", [complaint.id, complaint.identityEnvelope.keyId, JSON.stringify(complaint.identityEnvelope)]);
    }
    for (const config of data.intakeConfigurations || []) {
      const result = await client.query("INSERT INTO iicmcs.intake_configurations(id,version,changed_by,changed_at,document) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document WHERE iicmcs.intake_configurations.document=EXCLUDED.document RETURNING id", [config.id, config.version, config.changedBy, config.changedAt, JSON.stringify(config)]);
      if (result.rowCount !== 1) throw new Error("Existing intake configuration history cannot be modified");
    }
    for (const record of data.intakeRecords || []) await client.query("INSERT INTO iicmcs.intake_records(id,version,status,bureau_id,institution_id,created_by,complaint_id,document) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET version=EXCLUDED.version,status=EXCLUDED.status,institution_id=EXCLUDED.institution_id,complaint_id=EXCLUDED.complaint_id,document=EXCLUDED.document", [record.id, record.version, record.status, record.bureauId, record.institutionId || null, record.createdBy, record.complaintId || null, JSON.stringify(record)]);
    for(const run of data.importRuns||[])await client.query("INSERT INTO iicmcs.import_runs(id,owner_id,batch_key,version,status,document) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET version=EXCLUDED.version,status=EXCLUDED.status,document=EXCLUDED.document",[run.id,run.ownerId,run.batchKey,run.version,run.status,JSON.stringify(run)]);
    for(const receipt of data.importReceipts||[]){const result=await client.query("INSERT INTO iicmcs.import_receipts(id,owner_id,source_channel,reference_key,intake_id,run_id,document) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document WHERE iicmcs.import_receipts.document=EXCLUDED.document RETURNING id",[receipt.id,receipt.ownerId,receipt.sourceChannelId,receipt.referenceKey,receipt.intakeId,receipt.runId,JSON.stringify(receipt)]);if(result.rowCount!==1)throw new Error("Import receipts cannot be changed");}
    await client.query("DELETE FROM iicmcs.institution_identifiers; DELETE FROM iicmcs.institution_aliases");
    for (const institution of data.institutions) {
      for (const identifier of [{ namespace: "AICTE", value: institution.aictePermanentId }, ...(institution.matching?.identifiers || [])]) await client.query("INSERT INTO iicmcs.institution_identifiers(namespace,value,institution_id) VALUES($1,$2,$3)", [normalizedIdentifier(identifier.namespace), normalizedIdentifier(identifier.value), institution.id]);
      for (const alias of institution.matching?.aliases || []) await client.query("INSERT INTO iicmcs.institution_aliases(institution_id,normalized_name,original_name) VALUES($1,$2,$3)", [institution.id, normalizedName(alias), alias]);
    }
    for(const session of data.coordinationSessions||[]) {
      const {participants,messages,approvals,events,tasks,documents,receipts,...metadata}=session;
      await client.query("INSERT INTO iicmcs.coordination_sessions(id,primary_complaint_id,lead_bureau_id,status,version,document) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,version=EXCLUDED.version,document=EXCLUDED.document",[session.id,session.primaryComplaintId,session.leadBureauId,session.status,session.version,JSON.stringify(metadata)]);
      await client.query("DELETE FROM iicmcs.coordination_officers WHERE session_id=$1",[session.id]);
      for(const participant of participants) {
        await client.query("INSERT INTO iicmcs.coordination_participants(session_id,bureau_id,status,document) VALUES($1,$2,$3,$4) ON CONFLICT(session_id,bureau_id) DO UPDATE SET status=EXCLUDED.status,document=EXCLUDED.document",[session.id,participant.bureauId,participant.status,JSON.stringify(participant)]);
        for(const id of participant.officerIds) await client.query("INSERT INTO iicmcs.coordination_officers(session_id,bureau_id,officer_id) VALUES($1,$2,$3)",[session.id,participant.bureauId,id]);
      }
      for(const row of messages) await this.immutable(client,"coordination_messages",session.id,row);
      for(const row of approvals) await this.immutable(client,"coordination_approvals",session.id,row);
      for(const row of events) await this.immutable(client,"coordination_events",session.id,row);
      for(const task of tasks) await client.query("INSERT INTO iicmcs.coordination_tasks(session_id,id,assigned_bureau_id,assigned_officer_id,status,due_date,version,document) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(session_id,id) DO UPDATE SET assigned_bureau_id=EXCLUDED.assigned_bureau_id,assigned_officer_id=EXCLUDED.assigned_officer_id,status=EXCLUDED.status,due_date=EXCLUDED.due_date,version=EXCLUDED.version,document=EXCLUDED.document",[session.id,task.id,task.assignedBureauId,task.assignedOfficerId,task.status,task.dueDate||null,task.version,JSON.stringify(task)]);
      for(const share of documents) {
        await client.query("INSERT INTO iicmcs.coordination_document_access(session_id,id,document_id,task_id,revoked_at,document) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(session_id,id) DO UPDATE SET revoked_at=EXCLUDED.revoked_at,document=EXCLUDED.document",[session.id,share.id,share.documentId,share.taskId||null,share.revokedAt||null,JSON.stringify(share)]);
        await client.query("DELETE FROM iicmcs.coordination_document_scope WHERE session_id=$1 AND share_id=$2",[session.id,share.id]);
        for(const bureau of share.sharingBureaus) await client.query("INSERT INTO iicmcs.coordination_document_scope(session_id,share_id,bureau_id) VALUES($1,$2,$3)",[session.id,share.id,bureau]);
      }
      for(const receipt of receipts) await client.query("INSERT INTO iicmcs.coordination_receipts(session_id,actor_id,request_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[session.id,receipt.actorId,receipt.id]);
    }
  }
  private async commit(work:Awaited<ReturnType<OperationalPostgres["begin"]>>) {
    const {client,unit,revision}=work;
    if(unit.dirty) {
      const snapshot=unit.store.exportSnapshot(); validateSnapshot(snapshot); await this.project(client,snapshot);
      const result=await client.query("UPDATE iicmcs.operational_state SET payload=$1,revision=revision+1,updated_at=now() WHERE id=1 AND revision=$2::bigint",[JSON.stringify(snapshot),revision]);
      if(result.rowCount!==1)throw new Error("Operational revision conflict");
    }
    for(const {event} of unit.events){const id=randomUUID();await client.query("INSERT INTO iicmcs.live_outbox(id,instance_id,event) VALUES($1,$2,$3)",[id,this.instanceId,JSON.stringify(event)]);await client.query("SELECT pg_notify('iicmcs_events',$1)",[id]);}
    await client.query("COMMIT");
    for(const operation of unit.commit)try{operation();}catch{console.warn("Post-commit storage cleanup is pending");}
    for(const {deliver} of unit.events)try{operationalUnit.run(unit,deliver);}catch{console.warn("A committed live update could not be delivered; clients retain polling fallback");}
  }
  private async rollback(work:Awaited<ReturnType<OperationalPostgres["begin"]>>) { await work.client.query("ROLLBACK").catch(()=>{}); for(const cleanup of work.unit.rollback)try{cleanup();}catch{console.warn("A temporary upload needs cleanup after transaction rollback");} }
  async run<T>(operation:()=>Promise<T>|T) {
    if(operationalUnit.getStore())return operation();
    const work=await this.begin();
    try{const result=await operationalUnit.run(work.unit,operation);await this.commit(work);return result;}catch(error){await this.rollback(work);throw error;}finally{work.client.release();}
  }
  /** Explicit, one-time import. It never overwrites an initialized PostgreSQL authority. */
  async importSnapshot(snapshot:DatabaseSchema) {
    validateSnapshot(snapshot);const client=await this.pool.connect();
    try{await this.lock(client);const existing=await client.query("SELECT 1 FROM iicmcs.operational_state WHERE id=1");if(existing.rows.length)throw new Error("PostgreSQL already contains operational data; import refused");await this.project(client,snapshot);await client.query("INSERT INTO iicmcs.operational_state(id,payload) VALUES(1,$1)",[JSON.stringify(snapshot)]);await client.query("COMMIT");return {imported:true,sha256:createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),cases:snapshot.complaints.length,coordinationSessions:snapshot.coordinationSessions?.length||0};}catch(error){await client.query("ROLLBACK").catch(()=>{});throw error;}finally{client.release();}
  }
  async verifyReady() { const client=await this.pool.connect();try{const row=await client.query("SELECT payload FROM iicmcs.operational_state WHERE id=1");if(!row.rows.length)throw new Error("PostgreSQL operational data is uninitialized; explicit backfill/bootstrap is required");validateSnapshot(row.rows[0].payload);}finally{client.release();} }
  async listen(deliver:(event:LiveEvent)=>void) {
    this.listener=await this.pool.connect();
    this.listener.on("error",()=>console.error("PostgreSQL live listener unavailable; clients retain polling fallback"));
    this.listener.on("notification",message=>{const id=message.payload;if(!id||!/^[0-9a-f-]{36}$/.test(id))return;void this.run(async()=>{const result=await this.pool.query("SELECT instance_id,event FROM iicmcs.live_outbox WHERE id=$1",[id]);const row=result.rows[0];if(row&&row.instance_id!==this.instanceId&&eventTypes.has(row.event?.type))deliver(row.event);}).catch(()=>console.error("PostgreSQL live update refresh unavailable"));});
    await this.listener.query("LISTEN iicmcs_events");
  }
  readonly middleware:RequestHandler=async(req,res,next)=>{
    let work:Awaited<ReturnType<OperationalPostgres["begin"]>>;
    try{work=await this.begin();}catch{res.status(503).json({error:"Operational storage is unavailable.",code:"STORAGE_UNAVAILABLE"});return;}
    if(req.path==="/api/complaints/stream/live"){
      await work.client.query("COMMIT");work.client.release();
      work.unit.store=new Store({snapshot:work.unit.store.exportSnapshot(),onPersist:()=>{throw new Error("SSE connection snapshots are read-only");},mode:"PostgreSQL"});
      operationalUnit.run(work.unit,next);return;
    }
    const nativeEnd=res.end.bind(res),nativeWrite=res.write.bind(res);let ended=false,bytes=0;const chunks:Buffer[]=[];
    const capture=(chunk:any,encoding?:any)=>{if(chunk===undefined||chunk===null)return;const buffer=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk,typeof encoding==="string"?encoding as BufferEncoding:undefined);bytes+=buffer.length;if(bytes>32*1024*1024)throw new Error("Buffered response exceeds its safe transaction limit");chunks.push(buffer);};
    (res as any).write=(chunk:any,encoding?:any,callback?:any)=>{capture(chunk,encoding);if(typeof encoding==="function")encoding();else callback?.();return true;};
    (res as any).end=(chunk?:any,encoding?:any,callback?:any)=>{if(ended)return res;ended=true;try{capture(chunk,encoding);}catch{res.statusCode=500;chunks.length=0;}
      void(async()=>{try{if(res.statusCode>=400)await this.rollback(work);else await this.commit(work);res.write=nativeWrite;res.end=nativeEnd;nativeEnd(Buffer.concat(chunks),typeof encoding==="function"?encoding:callback);}catch{await this.rollback(work);res.removeHeader("Content-Length");res.removeHeader("Content-Disposition");res.setHeader("Content-Type","application/json");res.statusCode=503;nativeEnd(JSON.stringify({error:"The transaction could not be committed. Retry after refreshing.",code:"STORAGE_UNAVAILABLE"}));}finally{work.client.release();}})();return res;};
    res.once("close",()=>{if(!ended){ended=true;void this.rollback(work).finally(()=>work.client.release());}});
    operationalUnit.run(work.unit,next);
  };
  async close(){if(this.listener){await this.listener.query("UNLISTEN *").catch(()=>{});this.listener.release();this.listener=undefined;}await this.pool.end();}
  async verifyAuditProjection(data:DatabaseSchema){
    const result=await this.pool.query("SELECT (SELECT document FROM iicmcs.audit_legacy_anchor WHERE id=1) AS anchor,(SELECT count(*)::text FROM iicmcs.audit_chain_entries) AS count,(SELECT hash FROM iicmcs.audit_chain_entries ORDER BY sequence DESC LIMIT 1) AS head"),row=result.rows[0],state=data.auditIntegrity;
    return !!state&&row.anchor?.genesisHash===state.genesisHash&&row.anchor?.legacyDigest===state.legacyDigest&&Number(row.count)===state.entries.length&&(!state.entries.length||row.head===state.entries.at(-1)?.hash);
  }
}
let active:OperationalPostgres|undefined;
export async function verifyOperationalAuditProjection(data:DatabaseSchema){return active?active.verifyAuditProjection(data):undefined;}
export async function initializeOperationalPersistence(deliver:(event:LiveEvent)=>void){if(persistenceDriver()==="json"){if(process.env.NODE_ENV==="production")throw new Error("Production requires PostgreSQL; JSON is development/test storage only");return;}active=new OperationalPostgres();await active.verifyReady();await active.listen(deliver);}
export const operationalMiddleware:RequestHandler=(req,res,next)=>active?active.middleware(req,res,next):next();
export async function runOperationalWork<T>(operation:()=>Promise<T>|T){return active?active.run(operation):operation();}
export async function closeOperationalPersistence(){await active?.close();active=undefined;}
