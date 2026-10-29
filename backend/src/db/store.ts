import type {ReportSchedule,ReportPack,ReportDownload} from "../models/reporting.js";
import { BUREAUS, STATUS_TRANSITIONS, EscalationConfig, DEFAULT_ESCALATION_CONFIG } from "../config/constants.js";
import { requestScope, mayRead, mayViewInstitution, roleOf, effectiveProfile, authorize } from "../security/rbac.js";
import {coordinationAccess} from "../security/coordination.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import {
  WorkflowRequest,
  Profile,
  Institution,
  Complaint,
  OverlapAlert,
  CaseHistory,
  CaseTransfer,
  RelatedCase,
  Notification,
  AuditLog,
  ComplaintDocument
} from "../models/types.js";
import type { IRepository, DatabaseHealthResult } from "./repository.js";
import { generateSeedData, SEED_PROFILES } from "./seedData.js";
import { detectOverlapsForComplaint, evaluateComplaintPair, fuzzyMatchInstitution } from "../services/overlapEngine.js";
import { operationalUnit, persistenceDriver } from "./unitOfWork.js";
import { defaultIntakeConfiguration } from "../config/intake.js";
import type { IntakeConfiguration, IntakeRecord } from "../models/intake.js";
import type { CaseSecurity, IdentityEnvelope, SensitivityConfiguration } from "../models/confidentiality.js";
import { confidentialityAllows } from "../security/confidentiality.js";
import { defaultSensitivityConfiguration, initialCaseSecurity } from "../config/confidentiality.js";
import { analyzeOriginalText } from "../services/unicodeText.js";
import { defaultOverlapSettings } from "../config/overlap.js";
import type { OverlapSettings, OverlapFeedback, InstitutionEntityReference } from "../models/overlapSettings.js";
import type { DetectionResult } from "../models/types.js";
import type { MergeProposal, CaseMerge, MergeReversal } from "../models/caseFamily.js";
import type { ImportRun,ImportReceipt } from "../models/ingestion.js";
import type {AuditIntegrity,AuditCheckpoint} from "../models/auditIntegrity.js";
import type{SlaPolicyConfiguration,CaseSla,SlaAlert,SlaDelivery}from"../models/slaPolicy.js";
import{defaultSlaPolicies}from"../config/slaPolicy.js";
import{initialCaseSla,policyDay,pauseDays,deadlineDaysRemaining,civilDistance}from"../services/slaCalendar.js";
import {initializeAuditIntegrity,appendPendingAuditEvents,verifyAuditIntegrity,externalAuditCheckpoint} from "../security/auditChain.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DatabaseSchema {
  reportSchedules?:ReportSchedule[];reportPacks?:ReportPack[];reportDownloads?:ReportDownload[];
  slaPolicyConfigurations?:SlaPolicyConfiguration[];
  slaAlerts?:SlaAlert[];
  slaDeliveries?:SlaDelivery[];
  auditIntegrity?:AuditIntegrity;
  importRuns?:ImportRun[];
  importReceipts?:ImportReceipt[];
  mergeProposals?: MergeProposal[];
  caseMerges?: CaseMerge[];
  mergeReversals?: MergeReversal[];
  overlapConfigurations?: OverlapSettings[];
  overlapFeedback?: OverlapFeedback[];
  sensitivityConfigurations?: SensitivityConfiguration[];
  intakeConfigurations?: IntakeConfiguration[];
  intakeRecords?: IntakeRecord[];
  coordinationSessions?: import("../models/coordination.js").CoordinationSession[];
  slaConfig?: EscalationConfig;
  workflowRequests?: WorkflowRequest[];
  bureaus?: typeof BUREAUS;
  profiles: Profile[];
  institutions: Institution[];
  complaints: Complaint[];
  overlapAlerts: OverlapAlert[];
  caseHistory: CaseHistory[];
  caseTransfers: CaseTransfer[];
  relatedCases: RelatedCase[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  documents?: ComplaintDocument[];
  meta: {
    lastReset: string;
    version: string;
    dataSource?: string;
    totalInstitutions?: number;
    conflictsRecorded?: number;
  };
}

export class Store implements IRepository {
  public readonly mode: "PostgreSQL" | "Local Persistent JSON Store (ACID)";
  private data: DatabaseSchema;
  private transactionDepth = 0;
  private flush?: (snapshot: DatabaseSchema) => void;
  private lastPersistedSnapshot?:DatabaseSchema;

  constructor(options?: { snapshot: DatabaseSchema; onPersist: (snapshot: DatabaseSchema) => void; mode: "PostgreSQL" }) {
    this.mode = options?.mode || "Local Persistent JSON Store (ACID)";
    this.flush = options?.onPersist;
    this.data = options ? structuredClone(options.snapshot) : this.loadData();
    this.data.auditIntegrity ??= initializeAuditIntegrity(this.data.auditLogs);
    this.lastPersistedSnapshot=structuredClone(this.data);
  }
  /** Infrastructure-only snapshot; never expose this through a route. */
  public exportSnapshot(): DatabaseSchema { return structuredClone(this.data); }
  public getReportingState(){return structuredClone({schedules:this.data.reportSchedules||[],packs:this.data.reportPacks||[],downloads:this.data.reportDownloads||[]});}
  public saveReportSchedule(record:ReportSchedule){this.data.reportSchedules??=[];const index=this.data.reportSchedules.findIndex(row=>row.id===record.id);if(index<0)this.data.reportSchedules.push(structuredClone(record));else this.data.reportSchedules[index]=structuredClone(record);this.persist();}
  public saveReportPack(record:ReportPack){this.data.reportPacks??=[];if(this.data.reportPacks.some(row=>row.key===record.key))throw new Error("Duplicate report period");this.data.reportPacks.push(structuredClone(record));this.persist();}
  public addReportDownload(record:ReportDownload){this.data.reportDownloads??=[];this.data.reportDownloads.push(structuredClone(record));this.persist();}
  public getSlaPolicyConfiguration(){return structuredClone(this.data.slaPolicyConfigurations?.at(-1)||defaultSlaPolicies());}
  public getSlaPolicyHistory(){return structuredClone(this.data.slaPolicyConfigurations||[defaultSlaPolicies()]);}
  public saveSlaPolicyConfiguration(config:SlaPolicyConfiguration){this.data.slaPolicyConfigurations??=[defaultSlaPolicies()];this.data.slaPolicyConfigurations.push(structuredClone(config));this.persist();}
  public saveCaseSla(id:string,clock:CaseSla,deadline:string){const record=this.data.complaints.find(row=>row.id===id);if(!record)throw new Error("Case unavailable");this.data.slaPolicyConfigurations??=[defaultSlaPolicies()];record.sla=structuredClone(clock);record.expectedDisposalDate=deadline;record.slaTargetDays=clock.policy.days;record.updatedAt=new Date().toISOString();this.persist();}
  public getSlaOperations(){return structuredClone({alerts:this.data.slaAlerts||[],deliveries:this.data.slaDeliveries||[]});}
  public saveSlaAlert(record:SlaAlert){this.data.slaAlerts??=[];const index=this.data.slaAlerts.findIndex(row=>row.id===record.id);if(index<0){if(this.data.slaAlerts.some(row=>row.key===record.key))throw new Error("Duplicate SLA alert key");this.data.slaAlerts.push(structuredClone(record));}else this.data.slaAlerts[index]=structuredClone(record);this.persist();}
  public saveSlaDelivery(record:SlaDelivery){this.data.slaDeliveries??=[];const index=this.data.slaDeliveries.findIndex(row=>row.id===record.id);if(index<0)this.data.slaDeliveries.push(structuredClone(record));else this.data.slaDeliveries[index]=structuredClone(record);this.persist();}
  public verifyAudit(external?:AuditCheckpoint){return verifyAuditIntegrity(this.data.auditLogs,this.data.auditIntegrity,external||externalAuditCheckpoint());}
  public createAuditCheckpoint(user:Profile){
    return this.transaction(()=>{const state=this.data.auditIntegrity!;appendPendingAuditEvents(this.data.auditLogs,state,externalAuditCheckpoint());const result=this.verifyAudit();if(!result.valid)throw Object.assign(new Error("Audit verification failed"),{code:result.code});
      const checkpoint:AuditCheckpoint={id:uuidv4(),sequence:state.entries.length,hash:state.entries.at(-1)?.hash||state.genesisHash,genesisHash:state.genesisHash,legacyDigest:state.legacyDigest,createdAt:new Date().toISOString(),createdBy:user.id};
      state.checkpoints.push(checkpoint);this.addAuditLog({userId:user.id,userName:user.fullName,action:"AUDIT_CHECKPOINT_CREATED",entityType:"SystemOperation",entityId:checkpoint.id,details:{sequence:checkpoint.sequence,hash:checkpoint.hash}});return checkpoint;});
  }
  public getImportRecords(){return structuredClone({runs:this.data.importRuns||[],receipts:this.data.importReceipts||[]});}
  public saveImportRun(record:ImportRun){this.data.importRuns??=[];const index=this.data.importRuns.findIndex(row=>row.id===record.id);if(index<0)this.data.importRuns.push(structuredClone(record));else this.data.importRuns[index]=structuredClone(record);this.persist();}
  public appendImportReceipt(record:ImportReceipt){this.data.importReceipts??=[];if(this.data.importReceipts.some(row=>row.sourceChannelId===record.sourceChannelId&&row.referenceKey===record.referenceKey))throw new Error("Import source reference unavailable");this.data.importReceipts.push(structuredClone(record));this.persist();}
  /** Internal family repository; public results must pass CaseFamilyService authorization. */
  public getCaseFamilyRecords() { return structuredClone({ proposals: this.data.mergeProposals || [], merges: this.data.caseMerges || [], reversals: this.data.mergeReversals || [], related: this.data.relatedCases }); }
  public appendMergeProposal(record: MergeProposal) { this.data.mergeProposals ??= []; if (this.data.mergeProposals.some(row => row.id === record.id)) throw new Error("Merge proposal already exists"); this.data.mergeProposals.push(structuredClone(record)); this.persist(); }
  public appendCaseMerge(record: CaseMerge) { this.data.caseMerges ??= []; if (this.data.caseMerges.some(row => row.id === record.id || row.proposalId === record.proposalId)) throw new Error("Merge already recorded"); this.data.caseMerges.push(structuredClone(record)); this.persist(); }
  public appendMergeReversal(record: MergeReversal) { this.data.mergeReversals ??= []; if (this.data.mergeReversals.some(row => row.mergeId === record.mergeId)) throw new Error("Merge reversal already recorded"); this.data.mergeReversals.push(structuredClone(record)); this.persist(); }
  public appendFamilyHistory(complaintId: string, actionType: string, remarks: string, user: Profile, familyMergeId: string) { this.data.caseHistory.push({ id: uuidv4(), complaintId, actionType, remarks, performedBy: user.id, performedByName: user.fullName, createdAt: new Date().toISOString(), familyMergeId }); this.persist(); }
  private historyVisible(history: CaseHistory) {
    if (!requestScope.getStore() || !history.familyMergeId) return true;
    const merge = this.data.caseMerges?.find(row => row.id === history.familyMergeId);
    return !!merge && merge.preservedCaseIds.every(id => !!this.getComplaintById(id));
  }
  public getOverlapSettings() { return structuredClone(this.data.overlapConfigurations?.at(-1) || defaultOverlapSettings()); }
  public getOverlapSettingsHistory() { return structuredClone(this.data.overlapConfigurations || [defaultOverlapSettings()]); }
  public saveOverlapSettings(config: OverlapSettings) {
    this.data.overlapConfigurations ??= [defaultOverlapSettings()]; this.data.overlapConfigurations.push(structuredClone(config)); this.persist();
  }
  public getOverlapFeedback(id: string) { return structuredClone((this.data.overlapFeedback || []).filter(row => row.alertId === id)); }
  public getOverlapCandidates(complaint: Complaint, actor: Profile) {
    return structuredClone(this.data.complaints.filter(row => row.institutionId === complaint.institutionId && (!row.security || row.security.level === "internal" || mayRead(actor, row, this.getComplaintRegion(row)))));
  }
  public saveEntityReferences(id: string, entities: InstitutionEntityReference[]) {
    const complaint = this.data.complaints.find(row => row.id === id); if (!complaint) throw new Error("Case unavailable.");
    complaint.entityReferences = structuredClone(entities); complaint.entityReferencesVersion = (complaint.entityReferencesVersion || 0) + 1; complaint.updatedAt = new Date().toISOString(); this.persist();
  }
  /** Called inside the existing synchronous mutation transaction, after inference and concurrency checks. */
  public recordOverlapCandidates(complaint: Complaint, institution: Institution, detection: DetectionResult) {
    this.data.overlapConfigurations ??= [defaultOverlapSettings()];
    const created: string[] = [];
    for (const candidate of detection.candidateAlerts) {
      const other = candidate.existingComplaint;
      if (other.id === complaint.id || this.data.overlapAlerts.some(row => [row.complaintIdA, row.complaintIdB].includes(other.id) && [row.complaintIdA, row.complaintIdB].includes(complaint.id))) continue;
      let number = this.data.overlapAlerts.length + 1;
      while (this.data.overlapAlerts.some(row => row.alertId === `OVL-2026-${String(number).padStart(4, "0")}`)) number++;
      const now = new Date().toISOString(), assessment = candidate.assessment;
      const alert: OverlapAlert = {
        id: uuidv4(), alertId: `OVL-2026-${String(number).padStart(4, "0")}`, institutionId: institution.id, aictePermanentId: institution.aictePermanentId, institutionName: institution.name,
        complaintIdA: other.id, complaintRefA: other.complaintId, complaintTitleA: other.title, complaintDescA: other.description,
        complaintIdB: complaint.id, complaintRefB: complaint.complaintId, complaintTitleB: complaint.title, complaintDescB: complaint.description,
        bureauA: other.currentBureauId, bureauB: complaint.currentBureauId, categoryA: other.category, categoryB: complaint.category, statusA: other.status, statusB: complaint.status,
        ruleMatchScore: candidate.ruleScore, semanticSimilarityScore: candidate.semanticScore, matchReasons: candidate.reasons, explanation: candidate.explanation, assessment,
        confidenceCategory: assessment?.relationshipCandidate === "possible_duplicate" ? "Possible Duplicate — Review Required" : assessment?.relationshipCandidate === "possible_related" ? "Possible Related Case — Review Required" : "Mandatory Review — Relationship Undetermined",
        detectionMethod: candidate.explanation?.semanticMatch?.engine || "Unavailable", alertStatus: "Pending Review", recommendedAction: candidate.recommendation, createdAt: now, updatedAt: now
      };
      this.data.overlapAlerts.push(alert); complaint.hasOverlapAlert = true;
      const storedOther = this.data.complaints.find(row => row.id === other.id); if (storedOther) storedOther.hasOverlapAlert = true;
      created.push(alert.id);
      this.data.notifications.push({ id: uuidv4(), recipientRole: "Regulation Bureau Officer", title: "Overlap review required", message: "New institution-level review signals are available to authorized officials.", notificationType: "Overlap Alert", referenceId: alert.id, referenceType: "overlap", isRead: false, createdAt: now });
    }
    this.persist(); return created;
  }
  public getSensitivityConfiguration() { return structuredClone(this.data.sensitivityConfigurations?.at(-1) || defaultSensitivityConfiguration()); }
  public saveSensitivityConfiguration(config: SensitivityConfiguration) {
    this.data.sensitivityConfigurations ??= [defaultSensitivityConfiguration()]; this.data.sensitivityConfigurations.push(structuredClone(config)); this.persist();
  }
  public saveCaseSecurity(id: string, security: CaseSecurity) {
    this.data.sensitivityConfigurations ??= [defaultSensitivityConfiguration()];
    const complaint = this.data.complaints.find(item => item.id === id); if (!complaint) throw new Error("Case unavailable.");
    complaint.security = structuredClone(security); complaint.updatedAt = new Date().toISOString(); this.persist();
  }
  public saveIdentityEnvelope(id: string, envelope: IdentityEnvelope) {
    const complaint = this.data.complaints.find(item => item.id === id); if (!complaint) throw new Error("Case unavailable.");
    complaint.identityEnvelope = structuredClone(envelope);
    // Explicit identity writes migrate only the known legacy identity fields, without altering original case narrative.
    for (const key of ["complainantIdentity", "complainantName", "complainantEmail", "complainantPhone", "complainantAddress"]) delete (complaint as any)[key];
    this.persist();
  }
  public saveTextAnalysis(id: string, analysis: import("../models/textAnalysis.js").TextAnalysis) {
    const complaint = this.data.complaints.find(item => item.id === id); if (!complaint) throw new Error("Case unavailable.");
    complaint.textAnalysis = structuredClone(analysis); this.persist();
  }
  public hasVisibleOverlap(id: string) { return this.visibleOverlaps().some(alert => alert.complaintIdA === id || alert.complaintIdB === id); }
  private aggregateCases() {
    const viewer = requestScope.getStore();
    return this.data.complaints.filter(complaint => !viewer || (!complaint.security || complaint.security.level === "internal" ? true : mayRead(viewer, complaint, this.getComplaintRegion(complaint))));
  }
  /** Internal intake repository access. Public access is mediated by IntakeService. */
  public getIntakeConfiguration() { return structuredClone(this.data.intakeConfigurations?.at(-1) || defaultIntakeConfiguration()); }
  public getIntakeConfigurationHistory() { return structuredClone(this.data.intakeConfigurations || [defaultIntakeConfiguration()]); }
  public saveIntakeConfiguration(config: IntakeConfiguration) {
    this.data.intakeConfigurations ??= [defaultIntakeConfiguration()];
    this.data.intakeConfigurations.push(structuredClone(config)); this.persist();
  }
  public getIntakeRecords() { return structuredClone(this.data.intakeRecords || []); }
  public saveIntakeRecord(record: IntakeRecord) {
    this.data.intakeConfigurations ??= [defaultIntakeConfiguration()];
    this.data.intakeRecords ??= [];
    const index = this.data.intakeRecords.findIndex(item => item.id === record.id);
    if (index < 0) this.data.intakeRecords.push(structuredClone(record)); else this.data.intakeRecords[index] = structuredClone(record);
    this.persist(); return structuredClone(record);
  }
  public getInstitutionMasterRecords() { return structuredClone(this.data.institutions); }
  public saveInstitutionMatching(id: string, matching: NonNullable<Institution["matching"]>) {
    const institution = this.data.institutions.find(item => item.id === id);
    if (!institution) throw new Error("Institution not found.");
    institution.matching = structuredClone(matching); institution.updatedAt = new Date().toISOString(); this.persist();
  }

  public getDataDir(): string {
    return process.env.DATA_DIR || path.resolve(__dirname, "../../data");
  }

  public getDbFile(): string {
    return path.join(this.getDataDir(), "db.json");
  }

  public reloadData(): void {
    this.data = this.loadData();
  }

  /** Internal coordination repository access; API access must use CoordinationService. */
  public getCoordinationSessions() {return structuredClone(this.data.coordinationSessions||[]);}
  public saveCoordinationSession(session:import("../models/coordination.js").CoordinationSession) {
    this.data.coordinationSessions??=[];const index=this.data.coordinationSessions.findIndex(s=>s.id===session.id);
    if(index<0)this.data.coordinationSessions.push(structuredClone(session));else this.data.coordinationSessions[index]=structuredClone(session);
    this.persist();
  }
  public getCoordinationSource(id:string) {return this.data.complaints.find(c=>c.id===id);}
  public getCoordinationDocument(id:string) {return this.data.documents?.find(d=>d.id===id);}

  public async healthCheck(): Promise<DatabaseHealthResult> {
    if (this.mode === "PostgreSQL") return { connected: true, mode: "PostgreSQL", details: { authority: "PostgreSQL operational unit of work", totalComplaints: this.data.complaints.length, totalInstitutions: this.data.institutions.length } };
    try {
      const dbFile = this.getDbFile();
      const exists = fs.existsSync(dbFile);
      const stats = exists ? fs.statSync(dbFile) : null;
      return {
        connected: exists,
        mode: "Local Persistent JSON Store (ACID)",
        details: {
          file: dbFile,
          sizeBytes: stats?.size || 0,
          totalComplaints: this.data.complaints.length,
          totalInstitutions: this.data.institutions.length,
          lastReset: this.data.meta.lastReset
        }
      };
    } catch (err: any) {
      return {
        connected: false,
        mode: "Local Persistent JSON Store (ACID)",
        error: err.message
      };
    }
  }

  private loadData(): DatabaseSchema {
    const dataDir = this.getDataDir();
    const dbFile = this.getDbFile();

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (fs.existsSync(dbFile)) {
      try {
        const raw = fs.readFileSync(dbFile, "utf-8");
        const parsed: DatabaseSchema = JSON.parse(raw);
        if (!parsed.documents) {
          parsed.documents = [];
        }
        return parsed;
      } catch (err) {
        throw new Error("Existing database could not be read; refusing to replace historical records.");
      }
    }

    return this.initializeWithSeedData();
  }

  private initializeWithSeedData(): DatabaseSchema {
    if (process.env.USE_TEST_FIXTURES === "true") {
      console.log("[Store] Initializing test database with test fixtures...");
      const seed = generateSeedData();
      const testData: DatabaseSchema = {
        profiles: seed.profiles,
        institutions: seed.institutions,
        complaints: seed.complaints,
        overlapAlerts: seed.overlapAlerts,
        caseHistory: seed.caseHistory,
        caseTransfers: seed.caseTransfers,
        relatedCases: [],
        notifications: seed.notifications,
        auditLogs: [],
        documents: [],
        meta: {
          lastReset: new Date().toISOString(),
          version: "1.0.0-test"
        }
      };
      this.persist(testData);
      return testData;
    }

    console.log("[Store] Initializing operational database with canonical AICTE institutions...");
    let canonicalInstitutions: Institution[] = [];
    const possiblePaths = [
      path.join(this.getDataDir(), "institutions_canonical.json"),
      path.resolve(__dirname, "../../data/institutions_canonical.json"),
      path.resolve(__dirname, "../../../data/institutions_canonical.json")
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        try {
          const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
          const nowIso = new Date().toISOString();
          canonicalInstitutions = raw.map((item: any) => ({
            id: item.id,
            aictePermanentId: item.permanentId,
            permanentId: item.permanentId,
            name: item.name,
            institutionType: item.institutionType || "Engineering",
            address: `${item.city}, ${item.district}, ${item.state}`,
            city: item.city,
            district: item.district,
            state: item.state,
            region: item.region,
            pincode: "Not Available",
            contactEmail: "Not Available",
            contactPhone: "Not Available",
            accreditationStatus: "Not Verified",
            yearEstablished: 0,
            totalComplaintsCount: 0,
            activeComplaintsCount: 0,
            overlapCount: 0,
            sourceType: "PDF_IMPORT",
            sourceFile: "Institute_List.pdf",
            sourcePage: item.sourcePage,
            sourceDocumentDate: "2013-09-18",
            verificationStatus: "UNVERIFIED",
            hasSourceConflict: !!item.hasSourceConflict,
            conflictDetails: item.conflictDetails || null,
            sourcePages: item.sourcePages || [item.sourcePage],
            createdAt: "2013-09-18T00:00:00Z",
            updatedAt: nowIso
          }));
          console.log(`[Store] Loaded ${canonicalInstitutions.length} canonical institutions from ${p}`);
          break;
        } catch (e) {
          console.error(`[Store] Failed to parse canonical file at ${p}:`, e);
        }
      }
    }

    const profiles = SEED_PROFILES.map(p => {
      if (p.role === "Institutional User" && canonicalInstitutions[0]) {
        return {
          ...p,
          institutionId: canonicalInstitutions[0].id,
          institutionName: canonicalInstitutions[0].name
        };
      }
      return { ...p };
    });

    const initialData: DatabaseSchema = {
      profiles,
      institutions: canonicalInstitutions,
      complaints: [],
      overlapAlerts: [],
      caseHistory: [],
      caseTransfers: [],
      relatedCases: [],
      notifications: [],
      auditLogs: [],
      documents: [],
      bureaus: BUREAUS.map(b => ({ ...b })),
      slaConfig: { ...DEFAULT_ESCALATION_CONFIG },
      meta: {
        lastReset: new Date().toISOString(),
        version: "2.0.0",
        dataSource: "Institute_List.pdf",
        totalInstitutions: canonicalInstitutions.length
      }
    };
    this.persist(initialData);
    return initialData;
  }

  private persist(dataToSave?: DatabaseSchema) {
    if (this.transactionDepth) return;
    const snapshot=dataToSave||this.data;
    let temporary:string|undefined;
    try {
      snapshot.auditIntegrity??=initializeAuditIntegrity(snapshot.auditLogs);
      appendPendingAuditEvents(snapshot.auditLogs,snapshot.auditIntegrity,externalAuditCheckpoint());
      if (this.flush) { this.flush(structuredClone(snapshot));this.lastPersistedSnapshot=structuredClone(snapshot);return; }
      fs.mkdirSync(DATA_DIR, { recursive: true });
      temporary=DB_FILE+"."+uuidv4()+".tmp";
      fs.writeFileSync(temporary, JSON.stringify(snapshot, null, 2), "utf-8");
      fs.renameSync(temporary, DB_FILE);
      this.lastPersistedSnapshot=structuredClone(snapshot);
    } catch (error) {
      if (temporary&&fs.existsSync(temporary)) fs.unlinkSync(temporary);
      if(this.lastPersistedSnapshot)this.data=structuredClone(this.lastPersistedSnapshot);
      throw error;
    }
  }

  /** Synchronous local-store unit of work: one atomic file replacement or rollback. */
  public transaction<T>(operation: () => T): T {
    if (this.transactionDepth) return operation();
    const previous = structuredClone(this.data);
    this.transactionDepth++;
    try {
      const result = operation();
      this.transactionDepth--;
      this.persist();
      return result;
    } catch (error) {
      this.transactionDepth = 0;
      this.data = previous;
      throw error;
    }
  }

  public submitWorkflowRequest(complaintId: string, input: {type: WorkflowRequest["type"]; remarks: string; destinationBureauId?: string}, user: Profile) {
    return this.transaction(()=> {
      const complaint=this.getComplaintById(complaintId);
      if (!complaint || !authorize(user,"case.request",complaint,{region:this.getComplaintRegion(complaint)})) throw Object.assign(new Error("Case request access denied."),{status:403});
      if (!["Transfer","Escalation","Disposal","Coordination"].includes(input.type) || typeof input.remarks!=="string" || !input.remarks.trim() || input.remarks.length>5000) throw new Error("A valid request type and remarks are required.");
      if (input.type==="Transfer" && (!input.destinationBureauId || input.destinationBureauId===complaint.currentBureauId || !this.getBureaus().some(b=>b.id===input.destinationBureauId))) throw new Error("Select a different configured destination bureau.");
      if (!this.data.workflowRequests) this.data.workflowRequests=[];
      if (this.data.workflowRequests.some(r=>r.complaintId===complaint.id && r.type===input.type && r.status==="Pending")) throw Object.assign(new Error("This case already has a pending request of this type."),{status:409});
      const request: WorkflowRequest={id:uuidv4(),complaintId:complaint.id,complaintRef:complaint.complaintId,institutionName:complaint.institutionName,bureauId:complaint.currentBureauId,type:input.type,status:"Pending",remarks:input.remarks.trim(),destinationBureauId:input.destinationBureauId,requestedBy:user.id,requestedByName:user.fullName,requestedAt:new Date().toISOString(),caseVersion:complaint.updatedAt,assignedOfficerId:complaint.assignedOfficerId};
      this.data.workflowRequests.push(request);
      this.addCaseHistory({id:uuidv4(),complaintId:complaint.id,actionType:input.type+" Requested",remarks:request.remarks,performedBy:user.id,performedByName:user.fullName,createdAt:request.requestedAt});
      this.addAuditLog({userId:user.id,userName:user.fullName,action:"WORKFLOW_REQUEST_SUBMITTED",entityType:"Complaint",entityId:complaint.id,details:{requestId:request.id,type:request.type}});
      for(const profile of this.getProfiles()) if (profile.id!==user.id && mayRead(profile,complaint,this.getComplaintRegion(complaint)) && ["BUREAU_HEAD","COMPETENT_AUTHORITY"].includes(roleOf(profile.role))) this.addNotification({id:uuidv4(),recipientId:profile.id,title:input.type+" request",message:complaint.complaintId+": "+request.remarks,notificationType:"Status Update",referenceId:complaint.id,referenceType:"complaint",isRead:false,createdAt:request.requestedAt});
      return request;
    });
  }

  public canReviewRequest(user: Profile, request: WorkflowRequest) {
    const complaint=this.getComplaintById(request.complaintId);
    if (!complaint || request.status!=="Pending" || request.requestedBy===user.id) return false;
    const role=roleOf(user.role);
    if (!mayRead(user,complaint,this.getComplaintRegion(complaint)) || !["BUREAU_HEAD","COMPETENT_AUTHORITY"].includes(role)) return false;
    return request.type==="Escalation" ? !!user.permissions?.includes("APPROVE_ESCALATIONS") : request.type==="Coordination" ? role==="COMPETENT_AUTHORITY" || !!user.permissions?.includes("COORDINATE_CROSS_BUREAU") : true;
  }

  public canApproveRequest(user: Profile, request: WorkflowRequest) {
    const complaint=this.getComplaintById(request.complaintId);
    if (!complaint || !this.canReviewRequest(user,request) || request.caseVersion!==complaint.updatedAt) return false;
    const action=request.type==="Disposal"?"case.dispose":request.type==="Escalation"?"case.escalate":request.type==="Transfer"?"transfer.initiate":"overlap.decide";
    return authorize(user,action,complaint,{region:this.getComplaintRegion(complaint)});
  }
  public decideWorkflowRequest(complaintId: string, requestId: string, input: {decision: "Approved" | "Rejected"; remarks: string; caseVersion: string}, user: Profile) {
    return this.transaction(()=>{
      const request=this.data.workflowRequests?.find(r=>r.id===requestId && r.complaintId===complaintId);
      const complaint=this.getComplaintById(complaintId);
      if (!request || !complaint) throw Object.assign(new Error("Request not found in authorized scope."),{status:404});
      if (request.status!=="Pending") throw Object.assign(new Error("Request already decided."),{status:409});
      if (!this.canReviewRequest(user,request)) throw Object.assign(new Error("Supervisory permission and current case scope are required."),{status:403});
      if (!["Approved","Rejected"].includes(input.decision) || typeof input.remarks!=="string" || !input.remarks.trim()) throw new Error("Decision and official remarks are required.");
      if (input.caseVersion!==complaint.updatedAt || (input.decision==="Approved" && (request.caseVersion!==complaint.updatedAt || request.bureauId!==complaint.currentBureauId || request.assignedOfficerId!==complaint.assignedOfficerId))) throw Object.assign(new Error("Case changed since submission. Refresh; reject the stale recommendation or submit a new request."),{status:409});
      if(input.decision==="Approved") {
        if(request.type==="Transfer") request.transferId=this.transferCase(complaint.id,{toBureauId:request.destinationBureauId!,transferReason:input.remarks},user).id;
        if(request.type==="Disposal" || request.type==="Escalation") this.updateComplaintStatus(complaint.id,{status:request.type==="Disposal"?"Disposed":"Escalated",remarks:input.remarks},user);
      }
      request.status=input.decision; request.reviewedBy=user.id; request.reviewedByName=user.fullName; request.decisionRemarks=input.remarks.trim(); request.decidedAt=new Date().toISOString();
      this.addCaseHistory({id:uuidv4(),complaintId:complaint.id,actionType:request.type+" Request "+input.decision,remarks:input.remarks.trim(),performedBy:user.id,performedByName:user.fullName,createdAt:request.decidedAt});
      this.addAuditLog({userId:user.id,userName:user.fullName,action:"WORKFLOW_REQUEST_DECIDED",entityType:"Complaint",entityId:complaint.id,details:{requestId:request.id,decision:input.decision,remarks:input.remarks}});
      this.addNotification({id:uuidv4(),recipientId:request.requestedBy,title:request.type+" request "+input.decision,message:complaint.complaintId+": "+input.remarks,notificationType:"Status Update",referenceId:complaint.id,referenceType:"complaint",isRead:false,createdAt:request.decidedAt});
      return request;
    });
  }

  public getScopedComplaints() { return this.visibleComplaints().map(c => ({...c, hasOverlapAlert: this.hasVisibleOverlap(c.id)})); }
  public getComplaintRegion(complaint: Complaint) { return this.data.institutions.find(i=>i.id===complaint.institutionId)?.region; }
  public getWorkflowRequests(): WorkflowRequest[] {
    const user = requestScope.getStore();
    return (this.data.workflowRequests || []).filter(r=>{
      const c=this.data.complaints.find(c=>c.id===r.complaintId);
      if (user && c && !confidentialityAllows(user, c, "read")) return false;
      if(user && roleOf(user.role)==="CASE_OFFICER") return r.requestedBy===user.id; // Personal receipt only; never grants case access.
      return !!c && (!user || mayRead(user,c,this.getComplaintRegion(c)));
    }).map(r=>({...r}));
  }

  private visibleComplaints(): Complaint[] {
    const user = requestScope.getStore();
    return user ? this.data.complaints.filter(c => mayRead(effectiveProfile(user), c, this.data.institutions.find(i => i.id === c.institutionId)?.region)) : this.data.complaints;
  }
  private visibleOverlaps(): OverlapAlert[] {
    const user = requestScope.getStore();
    if (!user) return this.data.overlapAlerts;
    const ids = new Set(this.visibleComplaints().map(c => c.id));
    return this.data.overlapAlerts.filter(o => {
      const a = this.data.complaints.find(c => c.id === o.complaintIdA), b = this.data.complaints.find(c => c.id === o.complaintIdB);
      const allowed = (complaint: Complaint) => !complaint.security || complaint.security.level === "internal" || mayRead(user, complaint, this.getComplaintRegion(complaint));
      return !!a && !!b && allowed(a) && allowed(b) && (ids.has(o.complaintIdA) || ids.has(o.complaintIdB));
    });
  }
  public getSlaSettings() { return this.data.slaConfig; }
  public saveSlaSettings(config: EscalationConfig) { this.data.slaConfig={...config};this.persist();return {...config}; }
  public getBureaus() { return this.data.bureaus || BUREAUS; }
  public saveBureau(bureau: typeof BUREAUS[number]) {
    if (!this.data.bureaus) this.data.bureaus = BUREAUS.map(b => ({...b}));
    const index = this.data.bureaus.findIndex(b => b.id === bureau.id);
    if (index < 0) this.data.bureaus.push(bureau); else this.data.bureaus[index] = bureau;
    this.persist(); return bureau;
  }
  public saveProfile(profile: Profile): Profile {
    const index = this.data.profiles.findIndex(p => p.id === profile.id);
    if (index < 0) this.data.profiles.push(profile); else this.data.profiles[index] = profile;
    this.persist();
    return profile;
  }

  public resetDemoData(): DatabaseSchema {
    if (this.mode === "PostgreSQL") throw new Error("Demo reset is unavailable for the PostgreSQL operational authority");
    this.data = this.initializeWithSeedData();
    return this.data;
  }

  // ====================================================================
  // PROFILES / AUTH
  // ====================================================================
  public getProfiles(): Profile[] {
    return this.data.profiles;
  }

  public getProfileByEmail(email: string): Profile | undefined {
    return this.data.profiles.find(p => p.email.toLowerCase() === email.toLowerCase());
  }

  public getProfileById(id: string): Profile | undefined {
    return this.data.profiles.find(p => p.id === id);
  }

  // ====================================================================
  // INSTITUTIONS
  // ====================================================================
  // ====================================================================
  // INSTITUTIONS
  // ====================================================================
  public getInstitutions(params: {
    search?: string;
    region?: string;
    state?: string;
    stateOrRegion?: string;
    district?: string;
    city?: string;
    institutionType?: string;
    complaintStatus?: string;
    bureau?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    const viewer=requestScope.getStore();
    let result = this.data.institutions.filter(i=>!viewer || mayViewInstitution(viewer,i)).map(i=>({...i}));
    if(params.institutionType)result=result.filter(i=>i.institutionType===params.institutionType);
    if(params.complaintStatus || params.bureau)result=result.filter(i=>this.aggregateCases().some(c=>c.institutionId===i.id && (!params.complaintStatus || c.status===params.complaintStatus) && (!params.bureau || c.currentBureauId===params.bureau)));

    if (params.search) {
      const terms = params.search.toLowerCase().replace(/[,()\/]/g, " ").split(/\s+/).filter(Boolean);
      result = result.filter(i => {
        const fullText = `${i.name} ${i.aictePermanentId} ${i.permanentId || ""} ${i.city || ""} ${i.district || ""} ${i.state || ""} ${i.region || ""}`.toLowerCase();
        const normalized = `${fullText} ${fullText.replace(/[-\/]/g, " ")}`;
        return terms.every(t => normalized.includes(t));
      });
    }

    // Build O(1) lookup maps for complaints and overlaps
    const complaintsCountMap = new Map<string, number>();
    const activeComplaintsMap = new Map<string, number>();
    const pendingComplaintsMap = new Map<string, number>();
    const bureausMap = new Map<string, Set<string>>();
    const overlapsCountMap = new Map<string, number>();

    if (this.data.complaints.length > 0) {
      for (const c of this.data.complaints) {
        complaintsCountMap.set(c.institutionId, (complaintsCountMap.get(c.institutionId) || 0) + 1);
        if (["Pending", "Under Process", "Escalated"].includes(c.status)) {
          activeComplaintsMap.set(c.institutionId, (activeComplaintsMap.get(c.institutionId) || 0) + 1);
        }
        if (c.status === "Pending") {
          pendingComplaintsMap.set(c.institutionId, (pendingComplaintsMap.get(c.institutionId) || 0) + 1);
        }
        if (c.currentBureauId) {
          let bset = bureausMap.get(c.institutionId);
          if (!bset) {
            bset = new Set();
            bureausMap.set(c.institutionId, bset);
          }
          bset.add(c.currentBureauId);
        }
      }
    }

    if (this.data.overlapAlerts.length > 0) {
      for (const o of this.data.overlapAlerts) {
        overlapsCountMap.set(o.institutionId, (overlapsCountMap.get(o.institutionId) || 0) + 1);
      }
    }

    if (params.complaintStatus || params.bureau) {
      result = result.filter(i =>
        this.data.complaints.some(
          c =>
            c.institutionId === i.id &&
            (!params.complaintStatus || c.status === params.complaintStatus) &&
            (!params.bureau || c.currentBureauId === params.bureau)
        )
      );
    }

    if (params.region) {
      result = result.filter(i => i.region === params.region);
    }

    if (params.state) {
      result = result.filter(i => (i.state || "").toLowerCase() === params.state?.toLowerCase());
    }

    // Refresh dynamic counters for institutions
    result.forEach(inst => {
      const instComplaints = this.aggregateCases().filter(c => c.institutionId === inst.id);
      inst.totalComplaintsCount = instComplaints.length;
      inst.activeComplaintsCount = instComplaints.filter(c =>
        ["Pending", "Under Process", "Escalated"].includes(c.status)
      ).length;
      inst.overlapCount = this.visibleOverlaps().filter(o => o.institutionId === inst.id).length;
      Object.assign(inst,{pendingComplaintsCount:instComplaints.filter(c=>c.status==="Pending").length,handlingBureaus:[...new Set(instComplaints.map(c=>c.currentBureauId))]});
    });

    const sortBy = params.sortBy || "name";
    const sortOrder = params.sortOrder === "desc" ? -1 : 1;

    result.sort((a: any, b: any) => {
      let valA = a[sortBy] ?? "";
      let valB = b[sortBy] ?? "";
      if (sortBy === "totalComplaintsCount") {
        valA = complaintsCountMap.get(a.id) || 0;
        valB = complaintsCountMap.get(b.id) || 0;
      }
      if (valA < valB) return -1 * sortOrder;
      if (valA > valB) return 1 * sortOrder;
      return (a.aictePermanentId || "").localeCompare(b.aictePermanentId || "");
    });

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
    const total = result.length;
    const paginated = result.slice((page - 1) * limit, page * limit).map(inst => {
      const copy = { ...inst };
      copy.totalComplaintsCount = complaintsCountMap.get(inst.id) || 0;
      copy.activeComplaintsCount = activeComplaintsMap.get(inst.id) || 0;
      copy.overlapCount = overlapsCountMap.get(inst.id) || 0;
      copy.pendingComplaintsCount = pendingComplaintsMap.get(inst.id) || 0;
      copy.handlingBureaus = Array.from(bureausMap.get(inst.id) || []);
      return copy;
    });

    return {
      data: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  public getInstitutionOverview(id: string) {
    const institution=this.data.institutions.find(i=>i.id===id || i.aictePermanentId===id);
    const viewer=requestScope.getStore();
    if(!institution || (viewer && !mayViewInstitution(viewer,institution)))return undefined;
    const cases=this.aggregateCases().filter(c=>c.institutionId===institution.id);
    const overlaps=this.visibleOverlaps().filter(o=>o.institutionId===institution.id);
    const count=(status:string)=>cases.filter(c=>c.status===status).length;
    return {
      totalInstitutions: this.data.institutions.length,
      states,
      districts,
      cities,
      institutionTypes: types,
      regions,
      stateRegionPairs
    };
  }

  public searchInstitutions(query: string, limit = 20, stateOrRegion?: string): Institution[] {
    let pool = this.data.institutions;
    if (stateOrRegion && stateOrRegion.trim()) {
      let sor = stateOrRegion.toLowerCase().trim();
      if (sor.startsWith("region:")) sor = sor.replace("region:", "").trim();
      if (sor.startsWith("state:")) sor = sor.replace("state:", "").trim();
      pool = pool.filter(i =>
        (i.state || "").toLowerCase().includes(sor) ||
        (i.region || "").toLowerCase().includes(sor)
      );
    }

    if (!query || !query.trim()) {
      return pool.slice(0, limit).map(inst => ({
        ...inst,
        totalComplaintsCount: this.data.complaints.filter(c => c.institutionId === inst.id).length
      }));
    }
    const q = query.toLowerCase().trim();
    const matches: Institution[] = [];

    // Exact Permanent ID match first
    for (const inst of pool) {
      if (
        (inst.aictePermanentId && inst.aictePermanentId.toLowerCase() === q) ||
        (inst.permanentId && inst.permanentId.toLowerCase() === q)
      ) {
        const complaintsCount = this.data.complaints.filter(c => c.institutionId === inst.id).length;
        matches.push({ ...inst, totalComplaintsCount: complaintsCount });
        break;
      }
    }

    const terms = query.toLowerCase().replace(/[,()\/]/g, " ").split(/\s+/).filter(Boolean);

    // Name / State / Region / City / District / Permanent ID match
    for (const inst of pool) {
      if (matches.length >= limit) break;
      if (matches.some(m => m.id === inst.id)) continue;
      const fullText = `${inst.name} ${inst.aictePermanentId} ${inst.permanentId || ""} ${inst.city || ""} ${inst.district || ""} ${inst.state || ""} ${inst.region || ""}`.toLowerCase();
      const normalized = `${fullText} ${fullText.replace(/[-\/]/g, " ")}`;
      if (terms.every(t => normalized.includes(t))) {
        const complaintsCount = this.data.complaints.filter(c => c.institutionId === inst.id).length;
        matches.push({ ...inst, totalComplaintsCount: complaintsCount });
      }
    }
    return matches;
  }

  public getInstitutionOverview(id: string) {
    const institution = this.data.institutions.find(
      i => i.id === id || i.aictePermanentId === id || i.permanentId === id
    );
    const viewer = requestScope.getStore();
    if (!institution || (viewer && !mayViewInstitution(viewer, institution))) return undefined;
    const cases = this.data.complaints.filter(c => c.institutionId === institution.id);
    const overlaps = this.data.overlapAlerts.filter(o => o.institutionId === institution.id);
    const count = (status: string) => cases.filter(c => c.status === status).length;
    return {
      institution: {
        ...institution,
        totalComplaintsCount: cases.length,
        activeComplaintsCount: cases.filter(c => c.status !== "Disposed").length,
        overlapCount: overlaps.length
      },
      kpis: {
        totalComplaints: cases.length,
        pendingCount: count("Pending"),
        underProcessCount: count("Under Process"),
        resolvedCount: count("Disposed"),
        escalatedCount: count("Escalated"),
        transferredCount: count("Transferred"),
        activeOverlapCount: overlaps.filter(o =>
          ["Pending Review", "Confirmed Related", "Confirmed Duplicate"].includes(o.alertStatus)
        ).length
      },
      bureauInvolvement: [...new Set(cases.map(c => c.currentBureauId))].map(bureau => ({
        bureau,
        total: cases.filter(c => c.currentBureauId === bureau).length,
        pending: cases.filter(c => c.currentBureauId === bureau && c.status === "Pending").length
      })),
      coordination: overlaps.map(o => ({ bureauA: o.bureauA, bureauB: o.bureauB, status: o.alertStatus })),
      visibility: {
        aggregateScope: "institution within authorized region",
        caseScope: "existing case-specific RBAC",
        canReadCases: viewer ? roleOf(viewer.role) !== "SYSTEM_ADMIN" : true
      }
    };
  }

  public getInstitutionById(id: string): Institution | undefined {
    const inst = this.data.institutions.find(
      i => i.id === id || i.aictePermanentId === id || i.permanentId === id
    );
    const viewer = requestScope.getStore();
    if (inst && viewer && !mayViewInstitution(viewer, inst)) return undefined;
    if (inst) {
      const copy = { ...inst };
      const instComplaints = this.visibleComplaints().filter(c => c.institutionId === inst.id);
      copy.totalComplaintsCount = instComplaints.length;
      copy.activeComplaintsCount = instComplaints.filter(c =>
        ["Pending", "Under Process", "Escalated"].includes(c.status)
      ).length;
      copy.overlapCount = this.visibleOverlaps().filter(o => o.institutionId === inst.id).length;
      return copy;
    }
    return undefined;
  }

  public findInstitutionsByFuzzyName(query: string): { institution: Institution; score: number }[] {
    if (!query || query.trim().length === 0) return [];
    const results: { institution: Institution; score: number }[] = [];
    const qClean = query.toLowerCase().trim();

    for (const inst of this.data.institutions.filter(item => !requestScope.getStore() || mayViewInstitution(requestScope.getStore()!, item))) {
      if (inst.aictePermanentId.toLowerCase() === qClean) {
        results.push({ institution: inst, score: 100 });
        continue;
      }
      const matchRes = fuzzyMatchInstitution(query, inst.name);
      if (matchRes.match || matchRes.score >= 40) {
        results.push({ institution: inst, score: matchRes.score });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 25);
  }

  public createInstitution(data: Omit<Institution, "id" | "totalComplaintsCount" | "activeComplaintsCount" | "overlapCount" | "createdAt" | "updatedAt">): Institution {
    const exists = this.data.institutions.some(i => i.aictePermanentId === data.aictePermanentId);
    if (exists) {
      throw new Error(`Institution with AICTE Permanent ID ${data.aictePermanentId} already exists.`);
    }

    const newInst: Institution = {
      ...data,
      id: `inst-${Date.now()}`,
      totalComplaintsCount: 0,
      activeComplaintsCount: 0,
      overlapCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.data.institutions.push(newInst);
    this.persist();
    return newInst;
  }

  // ====================================================================
  // COMPLAINTS
  // ====================================================================
  public getComplaints(params: {
    institutionId?: string;
    aictePermanentId?: string;
    search?: string;
    bureau?: string;
    region?: string;
    category?: string;
    status?: string;
    priority?: string;
    assignedOfficerId?: string;
    isOverdue?: boolean;
    isDueSoon?: boolean;
    hasOverlap?: boolean;
    receivedFrom?: string;
    receivedTo?: string;
    lastActionFrom?: string;
    lastActionTo?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    let result = [...this.visibleComplaints()];

    if (params.institutionId) {
      result = result.filter(c => c.institutionId === params.institutionId || c.aictePermanentId === params.institutionId);
    }

    if (params.aictePermanentId) {
      result = result.filter(c => c.aictePermanentId === params.aictePermanentId);
    }

    if (params.search) {
      const q = params.search.toLowerCase().trim();
      result = result.filter(
        c =>
          c.complaintId.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q)) ||
          c.institutionName.toLowerCase().includes(q) ||
          c.aictePermanentId.toLowerCase().includes(q) ||
          (c.category && c.category.toLowerCase().includes(q))
      );
    }

    if (params.bureau) {
      result = result.filter(c => c.currentBureauId === params.bureau || c.receivingBureauId === params.bureau);
    }

    if (params.category) {
      result = result.filter(c => c.category === params.category);
    }

    if (params.status) {
      result = result.filter(c => c.status === params.status);
    }

    if (params.priority) {
      result = result.filter(c => c.priority === params.priority);
    }

    if (params.assignedOfficerId) {
      result = result.filter(c => c.assignedOfficerId === params.assignedOfficerId);
    }

    if (params.hasOverlap !== undefined) {
      result = result.filter(c => (requestScope.getStore() ? this.hasVisibleOverlap(c.id) : c.hasOverlapAlert) === params.hasOverlap);
    }

    if (params.isOverdue) {
      const today = new Date().toISOString().split("T")[0];
      result = result.filter(
        c => c.status!=="Disposed" && deadlineDaysRemaining(c)<0
      );
    }

    if ((params as any).isDueSoon) {
      const today = new Date().toISOString().split("T")[0];
      const dueSoonTarget = new Date(Date.now() + (this.getSlaSettings()?.approachingDeadlineDays || DEFAULT_ESCALATION_CONFIG.approachingDeadlineDays) * 86400000).toISOString().split("T")[0];
      result = result.filter(
        c => c.status!=="Disposed" && deadlineDaysRemaining(c)>=0 && deadlineDaysRemaining(c)<=(this.getSlaSettings()?.approachingDeadlineDays||DEFAULT_ESCALATION_CONFIG.approachingDeadlineDays)
      );
    }

    // Date-range filters on receivedDate (ISO date string comparison)
    if (params.receivedFrom) {
      result = result.filter(c => c.receivedDate >= params.receivedFrom!);
    }
    if (params.receivedTo) {
      result = result.filter(c => c.receivedDate <= params.receivedTo!);
    }

    // Date-range filters on last action (updatedAt)
    if (params.lastActionFrom) {
      result = result.filter(c => c.updatedAt.split("T")[0] >= params.lastActionFrom!);
    }
    if (params.lastActionTo) {
      result = result.filter(c => c.updatedAt.split("T")[0] <= params.lastActionTo!);
    }

    const sortBy = params.sortBy || "receivedDate";
    const sortOrder = params.sortOrder === "asc" ? 1 : -1;

    const PRIORITY_ORDER: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

    result.sort((a: any, b: any) => {
      if (sortBy === "priority") {
        const pA = PRIORITY_ORDER[a.priority] || 0;
        const pB = PRIORITY_ORDER[b.priority] || 0;
        return (pA - pB) * sortOrder;
      }
      if (a[sortBy] < b[sortBy]) return -1 * sortOrder;
      if (a[sortBy] > b[sortBy]) return 1 * sortOrder;
      return 0;
    });

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
    const total = result.length;
    const paginated = result.slice((page - 1) * limit, page * limit);

    return {
      data: paginated.map(complaint => ({ ...complaint, hasOverlapAlert: this.hasVisibleOverlap(complaint.id) })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  public getComplaintById(id: string): Complaint | undefined {
    return this.visibleComplaints().find(c => c.id === id || c.complaintId === id);
  }

  /**
   * Register a new complaint with integrated Overlap Detection workflow
   */
  public async createComplaint(
    data: {
      institutionId: string;
      category: string;
      title: string;
      description: string;
      receivingBureauId: string;
      assignedOfficerId?: string;
      priority: "Low" | "Medium" | "High" | "Critical";
      expectedDisposalDate?: string;
      metadata?: Complaint["metadata"];
    },
    user: Profile,
    onCreated?: (complaint: Complaint) => void
  ): Promise<{ complaint: Complaint; detectedOverlaps: any[] }> {
    const institution = this.getInstitutionById(data.institutionId);
    if (!institution) {
      throw new Error(`Institution ID "${data.institutionId}" not found. Institution must be registered before filing complaints.`);
    }

    const count = this.data.complaints.length + 101;
    const complaintId = `AICTE/${data.receivingBureauId}/2026/${String(count).padStart(5, "0")}`;
    const today = new Date().toISOString().split("T")[0];

    // Calculate default SLA expected disposal date if not given
    const slaDays = data.priority === "Critical" ? 7 : data.priority === "High" ? 15 : data.priority === "Medium" ? 30 : 45;
    const expDate = data.expectedDisposalDate || new Date(Date.now() + slaDays * 86400000).toISOString().split("T")[0];

    let assignedOfficerName = "";
    if (data.assignedOfficerId) {
      const officer = this.getProfileById(data.assignedOfficerId);
      assignedOfficerName = officer?.fullName || "";
    }

    const newComplaint: Complaint = {
      textAnalysis: analyzeOriginalText(data.title, data.description),
      metadata: data.metadata ? structuredClone(data.metadata) : { recordKind: "complaint", caseTypeId: "grievance", sourceChannelId: "portal", sourceReceivedDate: today,
        provenance: { method: "portal_entry", enteredBy: user.id, enteredAt: new Date().toISOString(), configurationVersion: this.getIntakeConfiguration().version } },
      id: `comp-${uuidv4()}`,
      complaintId,
      institutionId: institution.id,
      aictePermanentId: institution.aictePermanentId,
      institutionName: institution.name,
      category: data.category,
      title: data.title,
      description: data.description,
      receivedDate: today,
      expectedDisposalDate: expDate,
      slaTargetDays: slaDays,
      receivingBureauId: data.receivingBureauId,
      currentBureauId: data.receivingBureauId,
      assignedOfficerId: data.assignedOfficerId,
      assignedOfficerName,
      status: "Pending",
      priority: data.priority,
      hasOverlapAlert: false,
      createdBy: user.id,
      createdByName: user.fullName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    newComplaint.sla=initialCaseSla(this.getSlaPolicyConfiguration(),newComplaint,user.id,new Date(),data.expectedDisposalDate);
    newComplaint.expectedDisposalDate=newComplaint.sla.baseDeadline;newComplaint.slaTargetDays=newComplaint.sla.policy.days;
    // Run Overlap Detection Engine across existing cases of this institution
    newComplaint.security = initialCaseSecurity(newComplaint, this.getSensitivityConfiguration());
    const detectionConfig = this.getOverlapSettings(), detectionCases = this.getOverlapCandidates(newComplaint, user);
    const detectionFingerprint = JSON.stringify([detectionConfig, detectionCases]);
    const detectionResult = await detectOverlapsForComplaint(newComplaint, institution, detectionCases, detectionConfig);

    return this.transaction(()=> {
    if(newComplaint.sla!.configurationVersion!==this.getSlaPolicyConfiguration().version)throw new Error("SLA policy changed during registration; refresh and retry.");
    if (detectionFingerprint !== JSON.stringify([this.getOverlapSettings(), this.getOverlapCandidates(newComplaint, user)])) throw new Error("Overlap inputs changed during registration; refresh and retry.");
    let nextCount=this.data.complaints.length+101;
    while(this.data.complaints.some(c=>c.complaintId===`AICTE/${data.receivingBureauId}/2026/${String(nextCount).padStart(5,"0")}`)) nextCount++;
    newComplaint.complaintId=`AICTE/${data.receivingBureauId}/2026/${String(nextCount).padStart(5,"0")}`;
    onCreated?.(newComplaint);
    newComplaint.security = initialCaseSecurity(newComplaint, this.getSensitivityConfiguration());
    this.data.slaPolicyConfigurations??=[defaultSlaPolicies()];
    this.data.complaints.push(newComplaint);
    this.recordOverlapCandidates(newComplaint, institution, detectionResult);

    // Record initial case history
    this.data.caseHistory.push({
      id: `hist-${Date.now()}`,
      complaintId: newComplaint.id,
      actionType: "Complaint Registered",
      toStatus: "Pending",
      remarks: `Complaint registered in ${newComplaint.receivingBureauId}. ${newComplaint.hasOverlapAlert ? 'Overlap detection engine flagged potential related cases.' : 'No initial cross-bureau conflicts.'}`,
      performedBy: user.id,
      performedByName: user.fullName,
      createdAt: new Date().toISOString()
    });

    // Record audit log
    this.data.auditLogs.push({
      id: uuidv4(),
      userId: user.id,
      userName: user.fullName,
      action: "REGISTER_COMPLAINT",
      entityType: "Complaint",
      entityId: newComplaint.complaintId,
      details: {
        institution: institution.name,
        category: newComplaint.category,
        bureau: newComplaint.receivingBureauId,
        hasOverlapAlert: newComplaint.hasOverlapAlert
      },
      createdAt: new Date().toISOString()
    });

    this.persist();

    return {
      complaint: newComplaint,
      detectedOverlaps: detectionResult.candidateAlerts.map(candidate => {
        if (this.getComplaintById(candidate.existingComplaint.id)) return candidate;
        const existing = candidate.existingComplaint;
        return { ...candidate, reasons: ["Potential institution overlap across bureaus"], explanation: undefined, assessment: undefined,
          existingComplaint: { id: existing.id, complaintId: existing.complaintId, institutionId: existing.institutionId, aictePermanentId: existing.aictePermanentId, institutionName: existing.institutionName, currentBureauId: existing.currentBureauId, status: existing.status, category: existing.category, title: "Restricted related case", description: "" } };
      })
    };
    });
  }

  public updateComplaintStatus(complaintId: string, updates: Parameters<Store["updateComplaintStatusImpl"]>[1], user: Profile) { return this.transaction(()=>this.updateComplaintStatusImpl(complaintId, updates, user)); }

  private updateComplaintStatusImpl(
    complaintId: string,
    updates: {
      status?: "Pending" | "Under Process" | "Disposed" | "Transferred" | "Escalated";
      priority?: "Low" | "Medium" | "High" | "Critical";
      assignedOfficerId?: string;
      remarks: string;
      disposalRemarks?: string;
      nextAction?: string;
      nextActionDate?: string;
    },
    user: Profile
  ): Complaint {
    const comp = this.getComplaintById(complaintId);
    if (!comp) {
      throw new Error(`Complaint ${complaintId} not found`);
    }

    const fromStatus = comp.status;
    let actionType = "Status Update";

    // Validate permitted transitions
    const VALID_TRANSITIONS = STATUS_TRANSITIONS;

    if (updates.status && updates.status !== fromStatus) {
      const allowed = VALID_TRANSITIONS[fromStatus] || [];
      if (!allowed.includes(updates.status)) {
        throw new Error(`Invalid status transition: Cannot transition complaint from "${fromStatus}" to "${updates.status}". Permitted transitions: ${allowed.join(", ")}`);
      }
    }

    if (fromStatus === "Disposed" && updates.status && updates.status !== "Disposed") {
      if (roleOf(user.role) !== "COMPETENT_AUTHORITY") {
        throw new Error("Disposed cases are closed and can only be reopened by a Competent Authority.");
      }
      actionType = "Case Reopened";
    }

    if (updates.nextAction !== undefined) comp.nextAction = updates.nextAction;
    if (updates.nextActionDate !== undefined) comp.nextActionDate = updates.nextActionDate;
    if (updates.status) {
      comp.status = updates.status;
      if (updates.status === "Disposed") {
        comp.disposalDate = new Date().toISOString().split("T")[0];
        comp.disposalRemarks = updates.disposalRemarks || updates.remarks;
        actionType = "Case Disposed";
      } else if (updates.status === "Escalated") {
        actionType = "Case Escalated";
      }
    }

    if (updates.priority) {
      comp.priority = updates.priority;
    }

    if (updates.assignedOfficerId) {
      const officer = this.getProfileById(updates.assignedOfficerId);
      comp.assignedOfficerId = updates.assignedOfficerId;
      comp.assignedOfficerName = officer?.fullName || "";
      actionType = "Officer Assigned";
    }

    comp.updatedAt = new Date(Math.max(Date.now(),Date.parse(comp.updatedAt)+1)).toISOString();

    // Add case history entry
    this.data.caseHistory.push({
      id: `hist-${Date.now()}`,
      complaintId: comp.id,
      actionType,
      fromStatus,
      toStatus: comp.status,
      remarks: updates.remarks,
      performedBy: user.id,
      performedByName: user.fullName,
      createdAt: new Date().toISOString()
    });

    // Add audit log
    this.data.auditLogs.push({
      id: uuidv4(),
      userId: user.id,
      userName: user.fullName,
      action: actionType.toUpperCase().replace(/\s+/g, "_"),
      entityType: "Complaint",
      entityId: comp.complaintId,
      details: { fromStatus, toStatus: comp.status, remarks: updates.remarks, nextAction:updates.nextAction, nextActionDate:updates.nextActionDate },
      createdAt: new Date().toISOString()
    });

    this.persist();
    return comp;
  }

  // ====================================================================
  // CASE TRANSFERS
  // ====================================================================
  public transferCase(complaintId: string, transferData: Parameters<Store["transferCaseImpl"]>[1], user: Profile) { return this.transaction(()=>this.transferCaseImpl(complaintId, transferData, user)); }

  private transferCaseImpl(
    complaintId: string,
    transferData: {
      toBureauId: string;
      toOfficerId?: string;
      transferReason: string;
    },
    user: Profile
  ): CaseTransfer {
    const comp = this.getComplaintById(complaintId);
    if (!comp) throw new Error("Complaint not found");

    if (this.data.caseTransfers.some(t => t.complaintId === comp.id && t.acceptanceStatus === "Pending")) throw new Error("A transfer is already pending.");
    if (!this.getBureaus().some(b => b.id === transferData.toBureauId)) throw new Error("Unknown destination bureau.");
    if (transferData.toOfficerId) {
      const storedOfficer = this.getProfileById(transferData.toOfficerId);
      const officer = storedOfficer ? effectiveProfile(storedOfficer) : undefined;
      if (!officer?.isActive || roleOf(officer.role) !== "CASE_OFFICER" || officer.bureauId !== transferData.toBureauId || (officer.region && officer.region!==this.getComplaintRegion(comp))) throw new Error("Invalid destination officer.");
    }
    if (transferData.toBureauId === comp.currentBureauId) {
      throw new Error(`Cannot transfer case to the same bureau (${transferData.toBureauId}). Destination must be different.`);
    }

    const fromBureau = comp.currentBureauId;
    const fromStatus = comp.status;
    const fromOfficerId = comp.assignedOfficerId;
    const fromOfficerName = comp.assignedOfficerName;

    let toOfficerName = "";
    if (transferData.toOfficerId) {
      const off = this.getProfileById(transferData.toOfficerId);
      toOfficerName = off?.fullName || "";
    }

    const transfer: CaseTransfer = {
      id: `trf-${Date.now()}`,
      complaintId: comp.id,
      complaintRefId: comp.complaintId,
      institutionName: comp.institutionName,
      fromBureauId: fromBureau,
      toBureauId: transferData.toBureauId,
      fromOfficerId,
      fromOfficerName,
      toOfficerId: transferData.toOfficerId,
      toOfficerName,
      transferReason: transferData.transferReason,
      transferredBy: user.id,
      transferredByName: user.fullName,
      transferredAt: new Date().toISOString(),
      sourceCaseVersion: comp.updatedAt,
      sourceStatus: comp.status,
      acceptanceStatus: "Pending"
    };

    this.data.caseTransfers.push(transfer);

    // Case History entry
    this.data.caseHistory.push({
      id: `hist-${Date.now()}`,
      complaintId: comp.id,
      actionType: "Transfer Requested",
      fromStatus,
      toStatus: fromStatus,
      remarks: `Transfer requested from ${fromBureau} to ${transferData.toBureauId}. Reason: ${transferData.transferReason}`,
      performedBy: user.id,
      performedByName: user.fullName,
      createdAt: new Date().toISOString()
    });

    // Notify receiving bureau
    this.data.notifications.push({
      id: `notif-${Date.now()}`,
      recipientRole: transferData.toBureauId === "RB" ? "Regulation Bureau Officer" : "PGRC Officer",
      title: `Case Transferred: ${comp.complaintId}`,
      message: `Case ${comp.complaintId} has been transferred to ${transferData.toBureauId} by ${user.fullName}. Reason: ${transferData.transferReason}`,
      notificationType: "Transfer",
      referenceId: comp.complaintId,
      referenceType: "complaint",
      isRead: false,
      createdAt: new Date().toISOString()
    });

    this.persist();
    return transfer;
  }

  public respondToTransfer(transferId: string, action: "Accepted" | "Rejected", remarks: string, user: Profile) { return this.transaction(()=>this.respondToTransferImpl(transferId, action, remarks, user)); }

  private respondToTransferImpl(
    transferId: string,
    action: "Accepted" | "Rejected",
    remarks: string,
    user: Profile
  ): CaseTransfer {
    const transfer = this.data.caseTransfers.find(t => t.id === transferId);
    if (!transfer) throw new Error("Transfer record not found");

    if (transfer.acceptanceStatus !== "Pending") throw new Error("Transfer already adjudicated.");
    if (roleOf(user.role) !== "COMPETENT_AUTHORITY" && !(roleOf(user.role) === "BUREAU_HEAD" && user.bureauId === transfer.toBureauId)) throw new Error("Receiving bureau authorization required.");
    const comp = this.data.complaints.find(c => c.id === transfer.complaintId);
    if (!comp) throw new Error("Associated complaint record not found");

    if (!authorize(user,"transfer.respond",comp,{region:this.getComplaintRegion(comp),receivingBureauId:transfer.toBureauId,pending:transfer.acceptanceStatus==="Pending"})) throw new Error("Transfer decision not authorized.");
    if (action==="Accepted" && transfer.sourceCaseVersion && transfer.sourceCaseVersion!==comp.updatedAt) throw Object.assign(new Error("Case changed after the transfer request. Refresh and submit a new request."),{status:409});
    if(action==="Accepted") {
      const legacyDestination = !transfer.sourceCaseVersion && comp.currentBureauId===transfer.toBureauId && comp.status==="Transferred";
      if(comp.currentBureauId!==transfer.fromBureauId && !legacyDestination) throw Object.assign(new Error("Current case ownership no longer matches this transfer."),{status:409});
      if(transfer.toOfficerId) {
        const storedOfficer=this.getProfileById(transfer.toOfficerId);
        const officer=storedOfficer?effectiveProfile(storedOfficer):undefined;
        if(!officer?.isActive || roleOf(officer.role)!=="CASE_OFFICER" || officer.bureauId!==transfer.toBureauId || (officer.region && officer.region!==this.getComplaintRegion(comp))) throw new Error("The destination officer is no longer eligible. Reject and submit a corrected request.");
      }
    }
    transfer.acceptanceStatus = action;
    transfer.decisionRemarks = remarks;
    transfer.decidedBy = user.id;
    transfer.decidedByName = user.fullName;
    transfer.decidedAt = new Date().toISOString();

    if (action === "Rejected") {
      // Rejection retains current ownership, assignment and case status.
      this.data.caseHistory.push({
        id: `hist-${Date.now()}`,
        complaintId: comp.id,
        actionType: "Transfer Rejected",
        fromStatus: comp.status,
        toStatus: comp.status,
        remarks: `Transfer to ${transfer.toBureauId} rejected by ${user.fullName}. Remarks: ${remarks}. Case jurisdiction retained by ${transfer.fromBureauId}.`,
        performedBy: user.id,
        performedByName: user.fullName,
        createdAt: new Date().toISOString()
      });

      // Notify the originating bureau
      this.data.notifications.push({
        id: `notif-${Date.now()}`,
        recipientRole: transfer.fromBureauId === "RB" ? "Regulation Bureau Officer" : "PGRC Officer",
        title: `Transfer Rejected: ${comp.complaintId}`,
        message: `Transfer of case ${comp.complaintId} was rejected by ${transfer.toBureauId}. Remarks: ${remarks}`,
        notificationType: "Transfer",
        referenceId: comp.complaintId,
        referenceType: "complaint",
        isRead: false,
        createdAt: new Date().toISOString()
      });
    } else {
      comp.currentBureauId = transfer.toBureauId;
      comp.assignedOfficerId = transfer.toOfficerId;
      comp.assignedOfficerName = transfer.toOfficerName;
      // Accepted: Update status to Under Process in the new bureau
      comp.status = "Under Process";
      comp.updatedAt = new Date().toISOString();

      this.data.caseHistory.push({
        id: `hist-${Date.now()}`,
        complaintId: comp.id,
        actionType: "Transfer Accepted",
        fromStatus: "Transferred",
        toStatus: "Under Process",
        remarks: `Transfer accepted into ${transfer.toBureauId} by ${user.fullName}. Remarks: ${remarks}`,
        performedBy: user.id,
        performedByName: user.fullName,
        createdAt: new Date().toISOString()
      });
    }

    this.persist();
    return transfer;
  }

  public getTransferComplaint(id: string) {
    const user=requestScope.getStore();
    if (user && !this.getTransfers().some(t=>t.complaintId===id)) return undefined;
    return this.data.complaints.find(c=>c.id===id);
  }
  public getTransfers() {
    const user = requestScope.getStore();
    const ids = new Set(this.visibleComplaints().map(c => c.id));
    return this.data.caseTransfers.filter(t => {
      const c=this.data.complaints.find(c=>c.id===t.complaintId);
      if (!c) return false;
      if (!user) return true;
      if (!confidentialityAllows(user, c, "read")) return false;
      const region=this.getComplaintRegion(c);
      if (ids.has(c.id)) return true;
      return ["BUREAU_HEAD","COMPETENT_AUTHORITY"].includes(roleOf(user.role)) && (!user.region || user.region===region) && (roleOf(user.role)==="BUREAU_HEAD" ? !!user.bureauId && [t.fromBureauId,t.toBureauId].includes(user.bureauId) : !user.bureauId || t.toBureauId===user.bureauId);
    }).sort((a,b)=>b.transferredAt.localeCompare(a.transferredAt));
  }

  // ====================================================================
  // CASE HISTORY
  // ====================================================================
  public getCaseHistory(complaintId: string): CaseHistory[] {
    const comp = this.getComplaintById(complaintId);
    if (!comp) return [];
    return this.data.caseHistory
      .filter(h => (h.complaintId === comp.id || h.complaintId === comp.complaintId) && this.historyVisible(h))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public addCaseHistory(history: CaseHistory): CaseHistory {
    this.data.caseHistory.push(history);
    this.persist();
    return history;
  }

  // ====================================================================
  // OVERLAP ALERTS & RELATED CASES
  // ====================================================================
  public getOverlapAlerts(params: {
    bureau?: string;
    alertStatus?: string;
    institutionId?: string;
    page?: number;
    limit?: number;
  }) {
    let result = [...this.visibleOverlaps()];

    if (params.bureau) {
      result = result.filter(o => o.bureauA === params.bureau || o.bureauB === params.bureau);
    }

    if (params.alertStatus) {
      result = result.filter(o => o.alertStatus === params.alertStatus);
    }

    if (params.institutionId) {
      result = result.filter(o => o.institutionId === params.institutionId || o.aictePermanentId === params.institutionId);
    }

    result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
    const total = result.length;
    const paginated = result.slice((page - 1) * limit, page * limit);

    return {
      data: paginated.map(o=> {
        if (!requestScope.getStore()) return o;
        const a = !!this.getComplaintById(o.complaintIdA), b = !!this.getComplaintById(o.complaintIdB);
        return {...o,complaintTitleA:a?o.complaintTitleA:"Restricted related case",complaintDescA:a?o.complaintDescA:"",complaintTitleB:b?o.complaintTitleB:"Restricted related case",complaintDescB:b?o.complaintDescB:"",explanation:a&&b?o.explanation:undefined,assessment:a&&b?o.assessment:undefined,matchReasons:a&&b?o.matchReasons:["Potential institution overlap across bureaus"]};
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  public getOverlapAlertById(id: string): OverlapAlert | undefined {
    return this.visibleOverlaps().find(o => o.id === id || o.alertId === id);
  }

  public reviewOverlapAlert(alertId: string, reviewData: Parameters<Store["reviewOverlapAlertImpl"]>[1], user: Profile) { return this.transaction(()=>this.reviewOverlapAlertImpl(alertId, reviewData, user)); }

  private reviewOverlapAlertImpl(
    alertId: string,
    reviewData: {
      decision: "Confirmed Related" | "Confirmed Duplicate" | "Marked Unrelated" | "Dismissed" | "Resolved";
      remarks: string;
      linkAsRelated?: boolean;
      requestId?: string;
      expectedUpdatedAt?: string;
    },
    user: Profile
  ): OverlapAlert {
    const alert = this.getOverlapAlertById(alertId);
    if (!alert) throw new Error("Overlap alert not found");

    const previous = (this.data.overlapFeedback || []).find(row => row.alertId === alert.id && row.actorId === user.id && reviewData.requestId && row.requestId === reviewData.requestId);
    if (previous) {
      if (previous.decision !== reviewData.decision || previous.reason !== reviewData.remarks || !!previous.linkAsRelated !== !!reviewData.linkAsRelated) throw new Error("Review request ID already used for different feedback.");
      return alert;
    }
    if (reviewData.expectedUpdatedAt && reviewData.expectedUpdatedAt !== alert.updatedAt) throw new Error("Review changed; refresh before deciding.");
    if (alert.reviewedBy === user.id && alert.alertStatus === reviewData.decision && alert.reviewRemarks === reviewData.remarks) return alert;
    this.data.overlapFeedback ??= [];
    this.data.overlapFeedback.push({ id: uuidv4(), alertId: alert.id, actorId: user.id, decision: reviewData.decision, reason: reviewData.remarks, createdAt: new Date().toISOString(), requestId: reviewData.requestId, linkAsRelated: !!reviewData.linkAsRelated, configurationVersion: alert.assessment?.configurationVersion, algorithmVersion: alert.assessment?.algorithmVersion || "legacy-unversioned" });

    alert.alertStatus = reviewData.decision;
    alert.reviewedBy = user.id;
    alert.reviewedByName = user.fullName;
    alert.reviewedAt = new Date().toISOString();
    alert.reviewRemarks = reviewData.remarks;
    alert.updatedAt = new Date().toISOString();

    // If confirmed related or duplicate, link the two cases in related_cases table
    if (reviewData.decision === "Confirmed Related" || reviewData.decision === "Confirmed Duplicate" || reviewData.linkAsRelated) {
      const relationType = reviewData.decision === "Confirmed Duplicate" ? "Duplicate" : "Related";
      
      const alreadyLinked = this.data.relatedCases.some(
        r =>
          (r.complaintIdA === alert.complaintIdA && r.complaintIdB === alert.complaintIdB) ||
          (r.complaintIdA === alert.complaintIdB && r.complaintIdB === alert.complaintIdA)
      );

      if (!alreadyLinked) {
        this.data.relatedCases.push({
          id: `rel-${Date.now()}`,
          complaintIdA: alert.complaintIdA,
          complaintIdB: alert.complaintIdB,
          complaintRefA: alert.complaintRefA,
          complaintRefB: alert.complaintRefB,
          relationshipType: relationType,
          linkedBy: user.id,
          linkedByName: user.fullName,
          notes: reviewData.remarks,
          createdAt: new Date().toISOString()
        });
      }

      // Add Case History entries for both complaints
      this.data.caseHistory.push({
        id: `hist-${Date.now()}-1`,
        complaintId: alert.complaintIdA,
        actionType: "Overlap Confirmed",
        remarks: `Cross-Bureau relationship confirmed with ${alert.complaintRefB}. Decision: ${reviewData.decision}. Officer notes: ${reviewData.remarks}`,
        performedBy: user.id,
        performedByName: user.fullName,
        createdAt: new Date().toISOString()
      });

      this.data.caseHistory.push({
        id: `hist-${Date.now()}-2`,
        complaintId: alert.complaintIdB,
        actionType: "Overlap Confirmed",
        remarks: `Cross-Bureau relationship confirmed with ${alert.complaintRefA}. Decision: ${reviewData.decision}. Officer notes: ${reviewData.remarks}`,
        performedBy: user.id,
        performedByName: user.fullName,
        createdAt: new Date().toISOString()
      });
    } else if (reviewData.decision === "Marked Unrelated") {
      this.data.caseHistory.push({
        id: `hist-${Date.now()}`,
        complaintId: alert.complaintIdB,
        actionType: "Overlap Dismissed",
        remarks: `Potential overlap with ${alert.complaintRefA} marked as unrelated by ${user.fullName}. Rationale: ${reviewData.remarks}`,
        performedBy: user.id,
        performedByName: user.fullName,
        createdAt: new Date().toISOString()
      });
    }

    // Add Audit Log entry for review
    this.data.auditLogs.push({
      id: uuidv4(),
      userId: user.id,
      userName: user.fullName,
      action: "REVIEW_OVERLAP_ALERT",
      entityType: "OverlapAlert",
      entityId: alert.alertId,
      details: {
        decision: reviewData.decision,
        remarks: reviewData.remarks,
        ruleScore: alert.ruleMatchScore,
        semanticScore: alert.semanticSimilarityScore,
        complaintRefA: alert.complaintRefA,
        complaintRefB: alert.complaintRefB,
        detectionMethod: alert.detectionMethod || alert.explanation?.semanticMatch?.engine || "Legacy unversioned detection"
      },
      createdAt: new Date().toISOString()
    });

    this.persist();
    return alert;
  }

  public overrideSlaDeadline(
    complaintId: string,
    newDeadline: string,
    overrideReason: string,
    user: Profile
  ): Complaint {
    const comp = this.getComplaintById(complaintId);
    if (!comp) throw new Error("Complaint not found");

    if (!overrideReason || overrideReason.trim().length < 5) {
      throw new Error("A comprehensive administrative reason (at least 5 characters) is required to override SLA deadlines.");
    }

    const oldDeadline = comp.expectedDisposalDate;
    if(comp.sla){comp.sla.baseDeadline=newDeadline;comp.sla.manualDeadline=true;comp.sla.creditedPauseDays=pauseDays(comp.sla,policyDay(new Date(),comp.sla.policy.timezone));comp.sla.version++;comp.sla.history.push({at:new Date().toISOString(),actorId:user.id,action:"Override",reason:overrideReason,previousDeadline:oldDeadline,deadline:newDeadline,configurationVersion:comp.sla.configurationVersion});}
    comp.expectedDisposalDate = newDeadline;
    comp.updatedAt = new Date().toISOString();

    // Case History
    this.data.caseHistory.push({
      id: `hist-${Date.now()}`,
      complaintId: comp.id,
      actionType: "SLA Deadline Overridden",
      fromStatus: comp.status,
      toStatus: comp.status,
      remarks: `Operational deadline adjusted from ${oldDeadline} to ${newDeadline}. Recorded justification: ${overrideReason}`,
      performedBy: user.id,
      performedByName: user.fullName,
      createdAt: new Date().toISOString()
    });

    // Audit Log
    this.data.auditLogs.push({
      id: uuidv4(),
      userId: user.id,
      userName: user.fullName,
      action: "SLA_DEADLINE_OVERRIDDEN",
      entityType: "Complaint",
      entityId: comp.complaintId,
      details: { previousDeadline: oldDeadline, newDeadline, reason: overrideReason },
      createdAt: new Date().toISOString()
    });

    this.persist();
    return comp;
  }

  public getRelatedCases(complaintId: string): RelatedCase[] {
    const comp = this.getComplaintById(complaintId);
    if (!comp) return [];
    return this.data.relatedCases.filter(
      r => (r.complaintIdA === comp.id || r.complaintIdB === comp.id) && [r.complaintIdA, r.complaintIdB].every(id => {
        const linked = this.data.complaints.find(item => item.id === id), viewer = requestScope.getStore();
        return !!linked && (!viewer || !linked.security || linked.security.level === "internal" || mayRead(viewer, linked, this.getComplaintRegion(linked)));
      })
    );
  }

  // ====================================================================
  // NOTIFICATIONS
  // ====================================================================
  public getNotifications(userRole?: string, userId?: string) {
    const user = requestScope.getStore();
    let result = this.data.notifications.filter(n => {
      if (!user) return true;
      if(n.slaAlertId){const alert=this.data.slaAlerts?.find(row=>row.id===n.slaAlertId);if(!alert||alert.recipientId!==user.id||!alert.caseIds.every(id=>{const record=this.data.complaints.find(row=>row.id===id);return!!record&&mayRead(user,record,this.getComplaintRegion(record));}))return false;}
      if (n.recipientId && n.recipientId !== user.id) return false;
      if(n.referenceType==="coordination"){const s=this.data.coordinationSessions?.find(s=>s.id===n.referenceId);return !!s&&coordinationAccess(effectiveProfile(user),s,this.getCoordinationSource(s.primaryComplaintId)).read;}
      if (n.referenceType === "complaint") return !!this.getComplaintById(n.referenceId || "");
      if (n.referenceType === "transfer") return this.getTransfers().some(t=>t.id===n.referenceId || t.complaintRefId===n.referenceId);
      if (n.referenceType === "overlap") return !!this.getOverlapAlertById(n.referenceId || "");
      return (!n.recipientRole || roleOf(n.recipientRole) === roleOf(user.role)) && (!n.recipientId || n.recipientId === user.id);
    });
    if (userRole && userRole !== "Administrator") {
      result = result.filter(n => !!n.referenceType || !n.recipientRole || roleOf(n.recipientRole || "") === roleOf(userRole || ""));
    }
    if (userId) {
      result = result.map(n => ({
        ...n,
        isRead: Boolean((n.readByUserIds && n.readByUserIds.includes(userId)) || n.isRead)
      }));
    }
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public markNotificationRead(id: string, userId?: string) {
    const notif = this.data.notifications.find(n => n.id === id && this.getNotifications(undefined, userId).some(v => v.id === id));
    if (notif) {
      if (userId) {
        if (!notif.readByUserIds) notif.readByUserIds = [];
        if (!notif.readByUserIds.includes(userId)) notif.readByUserIds.push(userId);
      }
      if (!userId) notif.isRead = true;
      this.persist();
    }
  }

  public markAllNotificationsRead(userRole?: string, userId?: string) {
    const visible = new Set(this.getNotifications(userRole, userId).map(n => n.id));
    this.data.notifications.filter(n => visible.has(n.id)).forEach(n => {
      if (!userRole || !n.recipientRole || n.recipientRole === userRole) {
        if (userId) {
          if (!n.readByUserIds) n.readByUserIds = [];
          if (!n.readByUserIds.includes(userId)) n.readByUserIds.push(userId);
        }
        if (!userId) n.isRead = true;
      }
    });
    this.persist();
  }

  public addNotification(notification: Notification): Notification {
    if (!this.data.notifications) this.data.notifications = [];
    this.data.notifications.unshift(notification);
    this.persist();
    return notification;
  }

  // ====================================================================
  // AUDIT LOGS
  // ====================================================================
  public getAuditLogs() {
    const user = requestScope.getStore();
    return this.data.auditLogs.filter(l => !user || (roleOf(user.role) === "SYSTEM_ADMIN" ? ["Authentication", "Profile", "Bureau", "Configuration", "SystemOperation"].includes(l.entityType) : !!this.getComplaintById(l.entityId))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public getCoordinationHistory(alertId: string) {
    if (!this.getOverlapAlertById(alertId)) return [];
    const viewer=requestScope.getStore();
    return this.data.auditLogs.filter(l=>l.entityType === "OverlapAlert" && l.entityId===alertId && l.action.startsWith("COORDINATION_") && (!viewer || viewer.id===l.userId || (roleOf(viewer.role)==="COMPETENT_AUTHORITY" && !viewer.bureauId) || !!viewer.bureauId && viewer.bureauId===(l.details?.bureauId||this.getProfileById(l.userId||"")?.bureauId))).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  }
  public addAuditLog(log: Omit<AuditLog, "id" | "createdAt">): AuditLog {
    return this.transaction(()=>{
    const entry: AuditLog = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      ...log
    };
    this.data.auditLogs.push(entry);
    this.persist();
    return entry;
    });
  }

  // ====================================================================
  // DASHBOARD ANALYTICS & METRICS
  // ====================================================================
  public getLastAction(complaintId: string) {
    const complaint = this.getComplaintById(complaintId);
    if (!complaint) return undefined;
    return this.data.caseHistory.reduce<CaseHistory | undefined>((latest,h)=> this.historyVisible(h) && [complaint.id,complaint.complaintId].includes(h.complaintId) && (!latest || h.createdAt>latest.createdAt) ? h : latest,undefined);
  }
  public getRoleCounts(until: string, today: string) {
    const cases = this.visibleComplaints();
    return {upcoming:cases.filter(c=>c.status!=="Disposed" && deadlineDaysRemaining(c)>=0 && deadlineDaysRemaining(c)<=civilDistance(today,until)).sort((a,b)=>a.expectedDisposalDate.localeCompare(b.expectedDisposalDate)).slice(0,5),unassigned:cases.filter(c=>!c.assignedOfficerId && c.status!=="Disposed").length,dueSoon:cases.filter(c=>c.status!=="Disposed" && deadlineDaysRemaining(c)>=0 && deadlineDaysRemaining(c)<=civilDistance(today,until)).length,pendingActions:cases.filter(c=>c.status!=="Disposed").length};
  }
  public getDashboardAnalytics() {
    const complaints = this.visibleComplaints();
    const today = new Date().toISOString().split("T")[0];

    const total = complaints.length;
    const pending = complaints.filter(c => c.status === "Pending").length;
    const underProcess = complaints.filter(c => c.status === "Under Process").length;
    const disposed = complaints.filter(c => c.status === "Disposed").length;
    const transferred = complaints.filter(c => c.status === "Transferred").length;
    const escalated = complaints.filter(c => c.status === "Escalated").length;
    const overdue = complaints.filter(
      c => ["Pending", "Under Process", "Escalated", "Transferred"].includes(c.status) && deadlineDaysRemaining(c)<0
    ).length;
    const unresolvedOverlaps = this.visibleOverlaps().filter(o => o.alertStatus === "Pending Review").length;

    // Status distribution
    const statusDistribution = [
      { name: "Pending", count: pending, color: "#f59e0b" },
      { name: "Under Process", count: underProcess, color: "#3b82f6" },
      { name: "Disposed", count: disposed, color: "#10b981" },
      { name: "Transferred", count: transferred, color: "#8b5cf6" },
      { name: "Escalated", count: escalated, color: "#ef4444" }
    ];

    // Bureau-wise workload
    const bureaus = this.getBureaus().map(b=>b.id);
    const bureauWorkload = bureaus.map(b => {
      const bureauComplaints = complaints.filter(c => c.currentBureauId === b);
      return {
        bureau: b,
        total: bureauComplaints.length,
        pending: bureauComplaints.filter(c => c.status === "Pending").length,
        active: bureauComplaints.filter(c => ["Pending", "Under Process", "Escalated"].includes(c.status)).length,
        disposed: bureauComplaints.filter(c => c.status === "Disposed").length
      };
    });

    // Monthly trends (Last 6 months)
    const monthCounts: Record<string, { month: string; filed: number; disposed: number }> = {};
    const monthNames = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
    monthNames.forEach(m => {
      monthCounts[m] = { month: m, filed: 0, disposed: 0 };
    });

    complaints.forEach(c => {
      const d = new Date(c.receivedDate);
      const m = d.toLocaleString("en-US", { month: "short" });
      if (monthCounts[m]) {
        monthCounts[m].filed++;
      }
      if (c.disposalDate) {
        const dd = new Date(c.disposalDate);
        const dm = dd.toLocaleString("en-US", { month: "short" });
        if (monthCounts[dm]) {
          monthCounts[dm].disposed++;
        }
      }
    });

    // Region-wise complaint distribution
    const regionCounts: Record<string, number> = {};
    const instRegionMap = new Map<string, string>();
    for (const inst of this.data.institutions) {
      instRegionMap.set(inst.id, inst.region ? inst.region.split("(")[0].trim() : "Unspecified");
    }
    for (const c of complaints) {
      const reg = instRegionMap.get(c.institutionId) || "Unspecified";
      regionCounts[reg] = (regionCounts[reg] || 0) + 1;
    }

    const regionDistribution = Object.keys(regionCounts).map(k => ({
      region: k,
      count: regionCounts[k]
    }));

    // Case Ageing distribution for active complaints
    const nowTime = new Date().getTime();
    let ageUnder15 = 0;
    let age15To30 = 0;
    let age30To60 = 0;
    let ageOver60 = 0;

    complaints.forEach(c => {
      if (["Pending", "Under Process", "Escalated"].includes(c.status)) {
        const diffDays = Math.floor((nowTime - new Date(c.receivedDate).getTime()) / (1000 * 3600 * 24));
        if (diffDays < 15) ageUnder15++;
        else if (diffDays <= 30) age15To30++;
        else if (diffDays <= 60) age30To60++;
        else ageOver60++;
      }
    });

    const caseAgeing = [
      { range: "< 15 Days", count: ageUnder15, color: "#10b981" },
      { range: "15-30 Days", count: age15To30, color: "#3b82f6" },
      { range: "30-60 Days", count: age30To60, color: "#f59e0b" },
      { range: "> 60 Days", count: ageOver60, color: "#ef4444" }
    ];

    // Recent activity feed (last 10 events)
    const recentActivity = [...this.data.caseHistory]
      .filter(history => this.historyVisible(history) && complaints.some(complaint => [complaint.id, complaint.complaintId].includes(history.complaintId)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8);

    // Critical Alerts (active overdue + critical overlap alerts)
    const criticalAlerts = this.visibleOverlaps()
      .filter(o => o.alertStatus === "Pending Review" && (o.ruleMatchScore > 85 || (o.semanticSimilarityScore || 0) > 80))
      .slice(0, 5);

    return {
      kpi: {
        totalComplaints: total,
        pendingComplaints: pending,
        underProcessComplaints: underProcess,
        disposedComplaints: disposed,
        transferredComplaints: transferred,
        escalatedComplaints: escalated,
        overdueComplaints: overdue,
        unresolvedOverlapAlerts: unresolvedOverlaps,
        disposalRatePercentage: total > 0 ? Math.round((disposed / total) * 100) : 0
      },
      statusDistribution,
      bureauWorkload,
      monthlyTrends: Object.values(monthCounts),
      regionDistribution,
      caseAgeing,
      recentActivity,
      criticalAlerts
    };
  }

  // ====================================================================
  // SUPPORTING DOCUMENTS
  // ====================================================================
  public getDocuments(params: { complaintId?: string; institutionId?: string }): ComplaintDocument[] {
    if (!this.data.documents) {
      this.data.documents = [];
    }
    return this.data.documents.filter(doc => {
      if (requestScope.getStore() && !this.getComplaintById(doc.complaintId)) return false;
      const viewer = requestScope.getStore(), complaint = this.data.complaints.find(item => item.id === doc.complaintId);
      if (viewer && (!complaint || !confidentialityAllows(viewer, complaint, "evidence"))) return false;
      if (params.complaintId && doc.complaintId !== params.complaintId) return false;
      if (params.institutionId && doc.institutionId !== params.institutionId) return false;
      return true;
    });
  }

  public getDocumentById(id: string): ComplaintDocument | undefined {
    if (!this.data.documents) this.data.documents = [];
    return this.getDocuments({}).find(d => d.id === id);
  }

  public addDocument(doc: ComplaintDocument): ComplaintDocument {
    if (!this.data.documents) this.data.documents = [];
    this.data.documents.unshift(doc);
    this.persist();
    return doc;
  }

  public deleteDocument(id: string): boolean {
    if (!this.data.documents) this.data.documents = [];
    const idx = this.data.documents.findIndex(d => d.id === id);
    if (idx !== -1) {
      this.data.documents.splice(idx, 1);
      this.persist();
      return true;
    }
    return false;
  }

  // ====================================================================
  // COMPREHENSIVE PERFORMANCE & STATUTORY REPORTS
  // ====================================================================
  public getPerformanceReport(params?: { period?: string; bureau?: string }) {
    let complaints = [...this.visibleComplaints()];
    const now = new Date();

    if (params?.period === "30d") {
      const cutoff = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
      complaints = complaints.filter(c => c.receivedDate >= cutoff);
    } else if (params?.period === "90d") {
      const cutoff = new Date(now.getTime() - 90 * 86400000).toISOString().split("T")[0];
      complaints = complaints.filter(c => c.receivedDate >= cutoff);
    } else if (params?.period === "current-quarter") {
      const first=new Date(Date.UTC(now.getUTCFullYear(),Math.floor(now.getUTCMonth()/3)*3,1)).toISOString().slice(0,10),last=new Date(Date.UTC(now.getUTCFullYear(),Math.floor(now.getUTCMonth()/3)*3+3,0)).toISOString().slice(0,10);
      complaints = complaints.filter(c => c.receivedDate >= first && c.receivedDate <= last);
    }

    if (params?.bureau) {
      complaints = complaints.filter(c => c.currentBureauId === params.bureau);
    }

    const total = complaints.length;
    const disposed = complaints.filter(c => c.status === "Disposed").length;
    const pending = complaints.filter(c => c.status === "Pending").length;
    const underProcess = complaints.filter(c => c.status === "Under Process").length;
    const escalated = complaints.filter(c => c.status === "Escalated").length;
    const overdue = complaints.filter(
      c => c.status !== "Disposed" && deadlineDaysRemaining(c,now)<0
    ).length;

    // Bureau detailed breakdown
    const bureaus = ["RB", "PGRC", "RO", "AB", "PB"];
    const bureauPerformance = bureaus.map(bId => {
      const bCases = complaints.filter(c => c.currentBureauId === bId);
      const bDisposed = bCases.filter(c => c.status === "Disposed");
      const bOverdue = bCases.filter(
        c => c.status !== "Disposed" && deadlineDaysRemaining(c,now)<0
      ).length;

      let totalDays = 0;
      bDisposed.forEach(c => {
        if (c.disposalDate && c.receivedDate) {
          const days = Math.max(1, Math.round((new Date(c.disposalDate).getTime() - new Date(c.receivedDate).getTime()) / 86400000));
          totalDays += days;
        }
      });
      const avgDisposalDays = bDisposed.length > 0 ? Math.round((totalDays / bDisposed.length) * 10) / 10 : 0;
      const bOverlaps = this.visibleOverlaps().filter(o => o.bureauA === bId || o.bureauB === bId).length;

      return {
        bureau: bId,
        pending: bCases.filter(c=>c.status === "Pending").length,
        underProcess: bCases.filter(c=>c.status === "Under Process").length,
        total: bCases.length,
        disposed: bDisposed.length,
        active: bCases.length - bDisposed.length,
        overdue: bOverdue,
        avgDisposalDays,
        disposalRate: bCases.length > 0 ? Math.round((bDisposed.length / bCases.length) * 100) : 0,
        overlapsCount: bOverlaps
      };
    });

    // Overlap alert breakdown
    const overlapStatusCounts: Record<string, number> = {
      "Pending Review": 0,
      "Confirmed Related": 0,
      "Confirmed Duplicate": 0,
      "Marked Unrelated": 0,
      "Resolved": 0
    };
    this.visibleOverlaps().forEach(o => {
      overlapStatusCounts[o.alertStatus] = (overlapStatusCounts[o.alertStatus] || 0) + 1;
    });

    // Regional breakdown
    const regionMap: Record<string, { total: number; disposed: number; active: number }> = {};
    complaints.forEach(c => {
      const inst = this.getInstitutionById(c.institutionId);
      const reg = inst?.region || "Other";
      if (!regionMap[reg]) regionMap[reg] = { total: 0, disposed: 0, active: 0 };
      regionMap[reg].total++;
      if (c.status === "Disposed") regionMap[reg].disposed++;
      else regionMap[reg].active++;
    });

    const regionalCompliance = Object.entries(regionMap)
      .map(([region, stats]) => ({
        region,
        total: stats.total,
        disposed: stats.disposed,
        active: stats.active,
        complianceRate: stats.total > 0 ? Math.round((stats.disposed / stats.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);

    // Top institutions by complaint volume
    const instComplaintsMap: Record<string, { name: string; permId: string; total: number; active: number; overlapCount: number }> = {};
    complaints.forEach(c => {
      if (!instComplaintsMap[c.institutionId]) {
        instComplaintsMap[c.institutionId] = {
          name: c.institutionName,
          permId: c.aictePermanentId,
          total: 0,
          active: 0,
          overlapCount: this.visibleOverlaps().filter(o => o.institutionId === c.institutionId).length
        };
      }
      instComplaintsMap[c.institutionId].total++;
      if (c.status !== "Disposed") instComplaintsMap[c.institutionId].active++;
    });

    const topInstitutions = Object.values(instComplaintsMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return {
      period: params?.period || "all",
      kpi: {
        totalComplaints: total,
        disposedComplaints: disposed,
        pendingComplaints: pending,
        underProcessComplaints: underProcess,
        escalatedComplaints: escalated,
        overdueComplaints: overdue,
        disposalRatePercentage: total > 0 ? Math.round((disposed / total) * 100) : 0,
        totalOverlapAlerts: this.visibleOverlaps().length,
        unresolvedOverlapAlerts: this.visibleOverlaps().filter(o => o.alertStatus === "Pending Review").length
      },
      bureauPerformance,
      overlapStatusCounts: Object.entries(overlapStatusCounts).map(([status, count]) => ({ status, count })),
      regionalCompliance,
      topInstitutions
    };
  }
}

// Existing synchronous domain methods run on a request-owned PostgreSQL snapshot, or the JSON development store.
// No PostgreSQL request may silently fall back to a process-global JSON instance.
let jsonStore: Store | undefined;
function currentStore(): Store {
  const scoped = operationalUnit.getStore()?.store;
  if (scoped) return scoped;
  if (persistenceDriver() === "postgres") throw new Error("PostgreSQL access requires an operational unit of work");
  return jsonStore ||= new Store();
}
export const store = new Proxy({} as Store, { get(_target, property) { const target = currentStore(), value = Reflect.get(target, property); return typeof value === "function" ? value.bind(target) : value; }, set(_target, property, value) { return Reflect.set(currentStore(), property, value); } });
export const JsonRepository = Store;

