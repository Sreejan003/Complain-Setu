import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { DatabaseSchema } from "../db/store.js";
import type { Institution, Profile } from "../models/types.js";

const postgres = process.argv.includes("--postgres"), ui = process.env.INTAKE_UI_SERVER === "true";
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "setu-intake-api-"));
process.env.DATA_DIR = directory; process.env.NODE_ENV = "test"; process.env.PERSISTENCE_DRIVER = postgres ? "postgres" : "json"; process.env.PORT = ui ? process.env.INTAKE_UI_PORT || "52918" : "0";
if (ui) process.env.CORS_ORIGIN = `http://127.0.0.1:${process.env.PORT}`;
process.env.AI_SERVICE_URL = "http://127.0.0.1:1";
const operationalFile = path.resolve("data/db.json"), originalDigest = fs.existsSync(operationalFile) ? createHash("sha256").update(fs.readFileSync(operationalFile)).digest("hex") : undefined;
const { emptyOperationalSnapshot, OperationalPostgres, closeOperationalPersistence } = await import("../db/operationalPostgres.js");
const { store } = await import("../db/store.js");
const snapshot: DatabaseSchema = emptyOperationalSnapshot(), now = new Date().toISOString(), password = "DisposableIntakeOnly!2026";
for (const [id, role, bureauId, region] of [
  ["admin", "SYSTEM_ADMIN"], ["authority", "COMPETENT_AUTHORITY"], ["head", "BUREAU_HEAD", "RB"], ["officer", "CASE_OFFICER", "RB"],
  ["peer", "CASE_OFFICER", "RB"], ["target", "BUREAU_HEAD", "PGRC"], ["regional", "BUREAU_HEAD", "RB", "North"], ["institution-user", "Institutional User"]
] as const) snapshot.profiles.push({ id, role, bureauId, region, institutionId: id === "institution-user" ? "north" : undefined, fullName: id, email: `${id}@example.test`, passwordHash: bcrypt.hashSync(password, 4), isActive: true, createdAt: now, updatedAt: now } as Profile);
function institution(id: string, city: string, region: string, extra = {}): Institution {
  return { id, aictePermanentId: "TEST-" + id.toUpperCase(), name: "National Technical Institute", city, state: region + " State", region, institutionType: "Engineering", address: "Disposable fixture", pincode: "000000", contactEmail: "test@example.test", contactPhone: "", accreditationStatus: "Test only", yearEstablished: 2000, totalComplaintsCount: 0, activeComplaintsCount: 0, overlapCount: 0, createdAt: now, updatedAt: now, ...extra };
}
snapshot.institutions.push(institution("north", "Delhi", "North", { matching: { aliases: ["राष्ट्रीय तकनीकी संस्थान", "રાષ્ટ્રીય તકનીકી સંસ્થા", "தேசிய தொழில்நுட்ப நிறுவனம்", "జాతీయ సాంకేతిక సంస్థ", "জাতীয় প্রযুক্তি প্রতিষ্ঠান", "ರಾಷ್ಟ್ರೀಯ ತಾಂತ್ರಿಕ ಸಂಸ್ಥೆ"], identifiers: [{ namespace: "AISHE", value: "C-123" }], version: 1 } }), institution("south", "Chennai", "South"));
if(process.argv.includes("--reports"))snapshot.institutions[1].region="";
if(process.argv.includes("--sla")||process.argv.includes("--reports"))snapshot.complaints.push({id:"sla-legacy-fixture",complaintId:"TEST/SLA/LEGACY",institutionId:"north",aictePermanentId:"TEST-NORTH",institutionName:"National Technical Institute",category:"Faculty Shortage / Irregularities",title:"SLA_LEGACY_RETAINED",description:"Disposable legacy clock fixture",receivedDate:now.slice(0,10),expectedDisposalDate:"2027-01-01",receivingBureauId:"RB",currentBureauId:"RB",assignedOfficerId:"officer",status:"Under Process",priority:"Medium",hasOverlapAlert:false,createdAt:now,updatedAt:now});
if (ui) {
  process.env.IDENTITY_KEYS_JSON = JSON.stringify({ disposable_ui: randomBytes(32).toString("base64") }); process.env.IDENTITY_ACTIVE_KEY_ID = "disposable_ui";
  snapshot.complaints.push({ id: "security-ui", complaintId: "TEST/UI/SECURITY-001", institutionId: "north", aictePermanentId: "TEST-NORTH", institutionName: "National Technical Institute", category: "Harassment & Grievance Redressal Failure", title: "Disposable confidentiality review fixture", description: "Synthetic browser test only — हिन्दी தமிழ் ગુજરાતી తెలుగు বাংলা ಕನ್ನಡ", receivedDate: now.slice(0, 10), expectedDisposalDate: "2099-01-01", receivingBureauId: "RB", currentBureauId: "RB", assignedOfficerId: "officer", status: "Under Process", priority: "Medium", hasOverlapAlert: false, createdAt: now, updatedAt: now, security: { version: 1, level: "internal", grants: [], sensitivitySignals: ["posh_review"], reviewStatus: "pending" } });
  snapshot.complaints.push({ ...structuredClone(snapshot.complaints[0]), id: "overlap-ui", complaintId: "TEST/UI/OVERLAP-002", title: "Disposable mandatory review fixture", description: "Synthetic unrelated matter for review-rule demonstration only.", receivingBureauId: "PGRC", currentBureauId: "PGRC", assignedOfficerId: undefined });
}
let runtime: Awaited<ReturnType<typeof import("./postgres_runtime.js")["isolatedPostgres"]>> | undefined;
let driver: InstanceType<typeof OperationalPostgres> | undefined, server: import("node:http").Server | undefined;
let base = "", passed = 0; const tokens: Record<string, string> = {};
async function request(actor: string, route: string, method = "GET", body?: unknown) {
  const response = await fetch(base + route, { method, headers: { "Content-Type": "application/json", ...(tokens[actor] ? { Authorization: `Bearer ${tokens[actor]}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() as any };
}
async function check(name: string, operation: () => Promise<void>) { await operation(); passed++; console.log("PASS " + name); }
const draft = (overrides = {}) => ({ recordKind: "complaint", caseTypeId: "grievance", category: "Faculty Shortage / Irregularities", sourceChannelId: "manual", sourceReceivedDate: "2026-08-01", bureauId: "RB", institutionText: "National Technical Institute", title: "Synthetic faculty record", description: "हिन्दी ગુજરાતી தமிழ் తెలుగు বাংলা ಕನ್ನಡ — original fixture narrative", priority: "Medium", programme: "B.Tech", ...overrides });
async function createAndResolve(actor = "officer", overrides = {}) {
  const created = await request(actor, "intake", "POST", draft(overrides)); assert.equal(created.status, 201);
  const resolved = await request(actor, `intake/${created.body.id}/resolve`, "POST", { version: 1, institutionId: "north", reason: "Explicit source location and identifier verified" }); assert.equal(resolved.status, 200);
  return resolved.body;
}
try {
  if (postgres) {
    runtime = await (await import("./postgres_runtime.js")).isolatedPostgres(); process.env.DATABASE_URL = runtime.connectionString; process.env.DATABASE_SSL = "false";
    driver = new OperationalPostgres((await import("../db/postgresConfig.js")).postgresConfig(runtime.connectionString));
    await (await import("../db/migrate.js")).runMigrations(driver.pool); await driver.importSnapshot(snapshot);
    fs.writeFileSync(path.join(directory, "db.json"), "PostgreSQL must never read or alter this JSON sentinel");
  } else fs.writeFileSync(path.join(directory, "db.json"), JSON.stringify(snapshot));
  const application = await import("../server.js"); server = application.server;
  if (!server.listening) await new Promise<void>(resolve => server!.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}/api/`;
  for (const profile of snapshot.profiles) { const login = await request("", "auth/login", "POST", { email: profile.email, password }); assert.equal(login.status, 200); tokens[profile.id] = login.body.token; }
  if (ui) {
    const { default: express } = await import("express"); application.default.use(express.static(path.resolve("../frontend/dist"))); application.default.get("*", (_req, res) => res.sendFile(path.resolve("../frontend/dist/index.html")));
    console.log(`ISOLATED_INTAKE_UI_READY http://127.0.0.1:${process.env.PORT}/login`);
    await new Promise<void>(resolve => { process.once("SIGINT", () => resolve()); process.once("SIGTERM", () => resolve()); process.stdin.setEncoding("utf8"); process.stdin.on("data", chunk => { if (String(chunk).trim() === "stop") resolve(); }); });
  } else {
    await check("Intake/configuration authorization preserves administration and registration separation", async () => {
      assert.equal((await request("", "intake")).status, 401); assert.equal((await request("admin", "intake")).status, 403); assert.equal((await request("institution-user", "intake")).status, 403);
      assert.equal((await request("officer", "intake/configuration/history")).status, 403); assert.equal((await request("officer", "intake/configuration", "PUT", {})).status, 403);
      assert.equal((await request("officer", "complaints", "POST", { ...draft(), institutionId: "north", receivingBureauId: "RB" })).status, 403);
    });
    await check("Exact identifier precedence, unknown identifier refusal and ambiguous same-name locations", async () => {
      const ambiguous = await request("officer", "intake/institutions/resolve", "POST", { text: "National Technical Institute" }); assert.equal(ambiguous.body.ambiguous, true); assert.equal(ambiguous.body.candidates.length, 2); assert.equal(ambiguous.body.requiresHumanSelection, true);
      const ranked = await request("officer", "intake/institutions/resolve", "POST", { text: "National Technical Institute", locationHint: "Chennai" }); assert.equal(ranked.body.candidates[0].id, "south");
      const exact = await request("officer", "intake/institutions/resolve", "POST", { text: "Incorrect source name", identifier: { namespace: "aishe", value: "c-123" } }); assert.equal(exact.body.candidates.length, 1); assert.equal(exact.body.candidates[0].confidence, "exact_identifier");
      const unknown = await request("officer", "intake/institutions/resolve", "POST", { text: "National Technical Institute", identifier: { namespace: "AICTE", value: "missing" } }); assert.deepEqual(unknown.body.candidates, []);
    });
    await check("Hindi, Gujarati, Tamil, Telugu, Bengali and Kannada aliases resolve without changing originals", async () => {
      for (const text of snapshot.institutions[0].matching!.aliases) { const result = await request("officer", "intake/institutions/resolve", "POST", { text }); assert.equal(result.body.candidates[0].id, "north"); assert.ok(result.body.candidates[0].reasons.includes("exact_name_or_alias")); }
      const result = await request("officer", "intake", "POST", draft()); assert.equal(result.body.description, draft().description); assert.equal(result.body.status, "NeedsInstitutionResolution"); assert.equal(result.body.institutionId, undefined);
      assert.equal((await request("head", `intake/${result.body.id}/register`, "POST", { version: 1 })).status, 409);
    });
    await check("Region and Bureau restrictions apply before ranking and draft access", async () => {
      const result = await request("regional", "intake/institutions/resolve", "POST", { text: "National Technical Institute" }); assert.deepEqual(result.body.candidates.map((item: any) => item.id), ["north"]); assert.ok(!JSON.stringify(result.body).includes("Chennai"));
      assert.equal((await request("officer", "intake", "POST", draft({ bureauId: "PGRC" }))).status, 403);
      const created = await request("regional", "intake", "POST", draft()); assert.equal((await request("regional", `intake/${created.body.id}/resolve`, "POST", { version: 1, institutionId: "south", reason: "Must fail" })).status, 404);
      assert.equal((await request("target", `intake/${created.body.id}/resolve`, "POST", { version: 1, institutionId: "north", reason: "Must fail" })).status, 404);
    });
    await check("Draft conversion keeps original source metadata and requires current human resolution and supervisor", async () => {
      const record = await createAndResolve("officer", { sourceChannelId: "letter", externalReference: " LTR / １２３ ", sourceNote: "Manual fixture entry, no connected mail system" });
      assert.equal((await request("officer", `intake/${record.id}/register`, "POST", { version: record.version })).status, 403);
      assert.equal((await request("peer", "intake")).body.some((item: any) => item.id === record.id), false);
      const registered = await request("head", `intake/${record.id}/register`, "POST", { version: record.version }); assert.equal(registered.status, 201);
      assert.equal(registered.body.complaint.metadata.externalReference, " LTR / １２３ "); assert.equal(registered.body.complaint.metadata.normalizedExternalReference, "LTR / 123"); assert.equal(registered.body.complaint.metadata.sourceReceivedDate, "2026-08-01"); assert.equal(registered.body.complaint.metadata.programme, "B.Tech");
      assert.equal(registered.body.complaint.description, draft().description); assert.equal(registered.body.complaint.metadata.provenance.originalInstitutionText, draft().institutionText);
      const own = (await request("officer", "intake")).body.find((item: any) => item.id === record.id); assert.equal(own.status, "Registered"); assert.equal(own.complaintId, undefined); assert.equal((await request("officer", `complaints/${registered.body.complaint.id}`)).status, 404);
    });
    await check("Source references normalize within a source; different channels retain independent references", async () => {
      const same = await createAndResolve("officer", { sourceChannelId: "letter", externalReference: "ltr / 123" }); assert.equal((await request("head", `intake/${same.id}/register`, "POST", { version: same.version })).status, 409);
      const different = await createAndResolve("officer", { sourceChannelId: "email", externalReference: "ltr / 123" }); assert.equal((await request("head", `intake/${different.id}/register`, "POST", { version: different.version })).status, 201);
    });
    await check("All non-default case types remain in review without a complaint clock or silent registration", async () => {
      const before = (await request("head", "complaints?limit=100")).body.pagination.total;
      for (const caseTypeId of ["ragging", "norms_violation", "court", "rti", "parliament", "vip_ministry"]) { const record = await createAndResolve("officer", { caseTypeId, recordKind: "other_case" }); assert.equal(record.status, "NeedsLifecycleReview"); assert.equal((await request("head", `intake/${record.id}/register`, "POST", { version: record.version })).status, 409); }
      assert.equal((await request("head", "complaints?limit=100")).body.pagination.total, before);
    });
    await check("Simultaneous registration is atomic and stale resolution versions are rejected", async () => {
      const record = await createAndResolve();
      assert.equal((await request("officer", `intake/${record.id}/resolve`, "POST", { version: 1, institutionId: "north", reason: "Stale" })).status, 409);
      const results = await Promise.all([request("head", `intake/${record.id}/register`, "POST", { version: record.version }), request("head", `intake/${record.id}/register`, "POST", { version: record.version })]); assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
    });
    await check("Configuration versions preserve historical IDs and cannot enable external connections", async () => {
      const current = (await request("admin", "intake/configuration")).body;
      assert.equal((await request("admin", "intake/configuration", "PUT", { ...current, reason: "Forbidden connector", channels: current.channels.map((channel: any) => channel.id === "cpgrams" ? { ...channel, connection: "internal_entry" } : channel) })).status, 400);
      assert.equal((await request("admin", "intake/configuration", "PUT", { ...current, reason: "Remove historical ID", caseTypes: current.caseTypes.filter((type: any) => type.id !== "court") })).status, 400);
      const saved = await request("admin", "intake/configuration", "PUT", { ...current, reason: "Test-only type metadata", caseTypes: [...current.caseTypes, { id: "custom_review", label: "Custom review", enabled: true, lifecycle: "review_required" }] }); assert.equal(saved.status, 200); assert.equal(saved.body.version, 2);
      assert.equal((await request("admin", "intake/configuration", "PUT", { ...current, reason: "Stale save" })).status, 409);
      assert.equal((await request("admin", "intake/configuration/history")).body.length, 2); assert.equal((await request("head", "intake/configuration")).body.version, 2);
    });
    await check("Alias/identifier changes require supervisors, versions, uniqueness and attribution", async () => {
      const body = { version: 0, reason: "Source alias verified", aliases: ["南方工学院"], identifiers: [{ namespace: "AISHE", value: "C-123" }] };
      assert.equal((await request("officer", "intake/institutions/south/matching", "PUT", body)).status, 403);
      assert.equal((await request("head", "intake/institutions/south/matching", "PUT", body)).status, 409);
      const result = await request("head", "intake/institutions/south/matching", "PUT", { ...body, identifiers: [{ namespace: "AISHE", value: "C-456" }] }); assert.equal(result.status, 200); assert.equal(result.body.version, 1);
      assert.equal((await request("head", "intake/institutions/south/matching", "PUT", body)).status, 409);
      const matched = await request("head", "intake/institutions/resolve", "POST", { text: "南方工学院" }); assert.equal(matched.body.candidates[0].id, "south");
    });
    await check("Malformed dates, oversized fields and unknown classification are rejected", async () => {
      for (const invalid of [{ sourceReceivedDate: "2026-02-30" }, { description: "x".repeat(20001) }, { caseTypeId: "unknown" }, { recordKind: "unknown" }, { category: "unknown" }]) assert.equal((await request("officer", "intake", "POST", draft(invalid))).status, 400);
    });
    if (process.argv.includes("--security")) await (await import("./security_checks.js")).runSecurityChecks({ request, check, work: async operation => driver ? driver.run(operation) : operation(), store, base, tokens });
    if (process.argv.includes("--language")) await (await import("./language_checks.js")).runLanguageChecks({ request, check });
    if (process.argv.includes("--overlap")) await (await import("./overlap_review_checks.js")).runOverlapChecks({ request, check, work: async operation => driver ? driver.run(operation) : operation(), store });
    if (process.argv.includes("--family")) await (await import("./case_family_checks.js")).runCaseFamilyChecks({ request, check, work: async operation => driver ? driver.run(operation) : operation(), store,base,tokens });
    if (process.argv.includes("--imports")) await (await import("./import_checks.js")).runImportChecks({request,check,work:async operation=>driver?driver.run(operation):operation(),store,base,tokens});
    if(process.argv.includes("--reports"))await(await import("./reporting_checks.js")).runReportingChecks({request,check,work:async operation=>driver?driver.run(operation):operation(),store,base,tokens});
    if(process.argv.includes("--sla"))await(await import("./sla_checks.js")).runSlaChecks({request,check,work:async operation=>driver?driver.run(operation):operation(),store});
    if(process.argv.includes("--audit"))await(await import("./audit_checks.js")).runAuditChecks({request,check,work:async operation=>driver?driver.run(operation):operation(),store});
    await check("Persisted intake, aliases, provenance and configuration survive reload/restart", async () => {
      if (postgres) {
        if(process.argv.includes("--reports")){const projected=await driver!.pool.query("SELECT (SELECT count(*) FROM iicmcs.report_schedules) AS schedules,(SELECT count(*) FROM iicmcs.report_packs) AS packs,(SELECT count(*) FROM iicmcs.report_downloads) AS downloads");assert.equal(Number(projected.rows[0].schedules),2);assert.ok(Number(projected.rows[0].packs)>=3);assert.equal(Number(projected.rows[0].downloads),1);await assert.rejects(driver!.pool.query("DELETE FROM iicmcs.report_packs"),/immutable/);await assert.rejects(driver!.pool.query("DELETE FROM iicmcs.report_downloads"),/immutable/);}
        if(process.argv.includes("--sla")){const projected=await driver!.pool.query("SELECT (SELECT count(*) FROM iicmcs.sla_policy_configurations) AS configurations,(SELECT count(*) FROM iicmcs.case_sla_clocks) AS clocks,(SELECT count(*) FROM iicmcs.sla_alerts) AS alerts");assert.equal(Number(projected.rows[0].configurations),3);assert.ok(Number(projected.rows[0].clocks)>4);assert.ok(Number(projected.rows[0].alerts)>4);await assert.rejects(driver!.pool.query("DELETE FROM iicmcs.sla_policy_configurations"),/immutable/);}
        if(process.argv.includes("--audit")){const projected=await driver!.pool.query("SELECT (SELECT count(*) FROM iicmcs.audit_chain_entries) AS entries,(SELECT count(*) FROM iicmcs.audit_checkpoints) AS checkpoints");assert.ok(Number(projected.rows[0].entries)>20);assert.equal(Number(projected.rows[0].checkpoints),1);await assert.rejects(driver!.pool.query("DELETE FROM iicmcs.audit_chain_entries"),/immutable/);await assert.rejects(driver!.pool.query("UPDATE iicmcs.audit_legacy_anchor SET document='{}'::jsonb"),/immutable/);}
        if(process.argv.includes("--imports")){const projected=await driver!.pool.query("SELECT (SELECT count(*) FROM iicmcs.import_runs) AS runs,(SELECT count(*) FROM iicmcs.import_receipts) AS receipts");assert.ok(Number(projected.rows[0].runs)>=6);assert.equal(Number(projected.rows[0].receipts),5);await assert.rejects(driver!.pool.query("DELETE FROM iicmcs.import_receipts"),/immutable/);}
        if (process.argv.includes("--family")) {
          const projected=await driver!.pool.query("SELECT (SELECT count(*) FROM iicmcs.case_merges) AS merges,(SELECT count(*) FROM iicmcs.merge_reversals) AS reversals,(SELECT count(*) FROM iicmcs.case_merge_active) AS active");assert.equal(Number(projected.rows[0].merges),3);assert.equal(Number(projected.rows[0].reversals),2);assert.equal(Number(projected.rows[0].active),1);
          await assert.rejects(driver!.pool.query("DELETE FROM iicmcs.case_merges"),/immutable/);
          const active=(await driver!.pool.query("SELECT * FROM iicmcs.case_merge_active LIMIT 1")).rows[0];
          await assert.rejects(driver!.pool.query("INSERT INTO iicmcs.case_merge_active(source_id,canonical_id,merge_id) VALUES($1,$2,$3)",[active.canonical_id,active.source_id,active.merge_id]),/cycle/);
        }
        if (process.argv.includes("--overlap")) {
          const projections = await driver!.pool.query("SELECT (SELECT count(*) FROM iicmcs.overlap_configurations) AS configurations,(SELECT count(*) FROM iicmcs.overlap_feedback) AS feedback,(SELECT count(*) FROM iicmcs.case_entity_references) AS entities");
          assert.equal(Number(projections.rows[0].configurations),3); assert.equal(Number(projections.rows[0].feedback),1); assert.equal(Number(projections.rows[0].entities),1);
          await assert.rejects(driver!.pool.query("UPDATE iicmcs.overlap_feedback SET document='{}'::jsonb"), /immutable/);
          await assert.rejects(driver!.pool.query("DELETE FROM iicmcs.overlap_configurations"), /immutable/);
          const receipt = (await driver!.pool.query("SELECT * FROM iicmcs.overlap_pair_receipts LIMIT 1")).rows[0]; assert.ok(receipt);
          await assert.rejects(driver!.pool.query("INSERT INTO iicmcs.overlap_pair_receipts(case_a,case_b,first_alert_id) VALUES($1,$2,$3)",[receipt.case_a,receipt.case_b,receipt.first_alert_id]), /duplicate key/);
        }
        const rows = await driver!.pool.query("SELECT (SELECT count(*) FROM iicmcs.intake_records) AS intake,(SELECT count(*) FROM iicmcs.intake_configurations) AS config,(SELECT count(*) FROM iicmcs.institution_identifiers) AS identifiers"); assert.ok(Number(rows.rows[0].intake) > 6); assert.equal(Number(rows.rows[0].config), 2); assert.equal(Number(rows.rows[0].identifiers), process.argv.includes("--security")||process.argv.includes("--reports") ? 5 : 4);
        await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; await closeOperationalPersistence(); await driver!.close();
        await runtime!.cluster.stop(); await runtime!.cluster.start(); driver = new OperationalPostgres((await import("../db/postgresConfig.js")).postgresConfig(runtime!.connectionString));
        await driver.run(() => {
          const data = store.exportSnapshot(); assert.equal(data.intakeConfigurations?.length, 2); assert.ok(data.intakeRecords?.some(record => record.status === "Registered"));
          if (process.argv.includes("--security")) { const protectedCase = data.complaints.find(row => row.title === "SEALED_SECURITY_FIXTURE")!; assert.equal(protectedCase.security?.level, "sealed"); assert.equal(protectedCase.identityEnvelope?.keyId, "fixture_v2"); assert.ok(protectedCase.security?.grants.some(grant => grant.profileId === "authority" && grant.manage)); assert.ok(!JSON.stringify(protectedCase).includes("SYNTHETIC_IDENTITY_TOKEN")); }
          if (process.argv.includes("--language")) { const annotated = data.complaints.find(row => row.title === "Original multilingual fixture")!; assert.equal(annotated.textAnalysis?.language.code, "hi"); assert.equal(annotated.textAnalysis?.translation.status, "reviewed"); assert.equal(annotated.textAnalysis?.translation.reviewedBy, "authority"); }
          if (process.argv.includes("--overlap")) { assert.equal(data.overlapConfigurations?.length,3); assert.equal(data.overlapConfigurations?.at(-1)?.rollbackOf,1); assert.equal(data.overlapFeedback?.length,1); assert.equal(data.overlapFeedback?.[0].decision,"Marked Unrelated"); const annotated=data.complaints.find(row=>row.title==="OVERLAP_REVIEW_FIXTURE ocean")!; assert.equal(annotated.entityReferences?.[0].value,"CSE"); assert.equal(annotated.entityReferencesVersion,1); }
          if (process.argv.includes("--family")) { assert.equal(data.caseMerges?.length,3);assert.equal(data.mergeReversals?.length,2);assert.ok(data.mergeProposals!.length>=4);assert.ok(data.coordinationSessions?.some(session=>session.tasks.some(task=>task.title==="Unresolved original source verification"&&task.status==="Pending")));assert.ok(data.documents?.some(document=>document.originalName==="family-evidence.pdf")); }
          if(process.argv.includes("--imports")){assert.equal(data.importReceipts?.length,5);assert.ok(data.importRuns?.some(run=>run.status==="Partial"));assert.ok(data.intakeRecords?.some(record=>record.metadata.provenance.method==="email_simulation"));}
          if(process.argv.includes("--reports")){assert.equal(data.reportSchedules?.length,2);assert.ok(data.reportPacks!.length>=3);assert.equal(data.reportDownloads?.length,1);}
          if(process.argv.includes("--sla")){assert.equal(data.slaPolicyConfigurations?.length,3);assert.ok(data.slaAlerts!.length>4);assert.ok(data.slaDeliveries!.some(row=>row.status==="failed"&&row.attempts===3));assert.equal(data.complaints.find(row=>row.id==="sla-legacy-fixture")?.sla?.configurationVersion,2);}
          if(process.argv.includes("--audit")){assert.equal(store.verifyAudit().valid,true);assert.equal(data.auditIntegrity?.checkpoints.length,1);assert.ok(data.auditIntegrity!.entries.length>20);}
        });
      } else { const reloaded = JSON.parse(fs.readFileSync(path.join(directory, "db.json"), "utf8")); assert.equal(reloaded.intakeConfigurations.length, 2); assert.ok(reloaded.intakeRecords.some((record: any) => record.status === "Registered")); assert.equal(reloaded.institutions[1].matching.aliases[0], "南方工学院"); }
    });
    console.log(`${passed} ${postgres ? "real PostgreSQL" : "JSON"} intake integration scenarios passed; operational data untouched.`);
  }
} finally {
  if (server) await new Promise<void>(resolve => { server!.close(() => resolve()); if(ui)server!.closeAllConnections(); });
  if(ui)process.stdin.pause();
  await closeOperationalPersistence(); await driver?.close(); await runtime?.stop();
  const unchanged = !originalDigest || createHash("sha256").update(fs.readFileSync(operationalFile)).digest("hex") === originalDigest;
  const target = path.resolve(directory); if (path.dirname(target) === path.resolve(os.tmpdir()) && path.basename(target).startsWith("setu-intake-api-")) fs.rmSync(target, { recursive: true, force: true });
  assert.ok(unchanged, "Operational JSON changed while this isolated fixture was running; investigate concurrent writers without resetting data.");
}
