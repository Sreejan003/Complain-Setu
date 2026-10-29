import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { Store } from "../db/store.js";
import { encryptIdentity, decryptIdentity, rotateIdentity } from "../security/identityCrypto.js";
import { maintainIdentitySnapshot } from "../db/identityMaintenance.js";
import { confidentialityAllows } from "../security/confidentiality.js";
import { querySemanticService } from "../services/overlapEngine.js";
type Result = { status: number; body: any };
export async function runSecurityChecks(context: {
  request: (actor: string, path: string, method?: string, body?: unknown) => Promise<Result>;
  check: (name: string, operation: () => Promise<void>) => Promise<void>;
  work: <T>(operation: () => Promise<T> | T) => Promise<T>;
  store: Store; base: string; tokens: Record<string, string>;
}) {
  const { request, check, work, store, base, tokens } = context;
  const previousKeys = process.env.IDENTITY_KEYS_JSON, previousActive = process.env.IDENTITY_ACTIVE_KEY_ID, previousFile = process.env.IDENTITY_KEYS_FILE;
  delete process.env.IDENTITY_KEYS_FILE;
  const key1 = randomBytes(32).toString("base64"), key2 = randomBytes(32).toString("base64");
  process.env.IDENTITY_KEYS_JSON = JSON.stringify({ fixture_v1: key1 }); process.env.IDENTITY_ACTIVE_KEY_ID = "fixture_v1";
  const raw = (actor: string, route: string) => fetch(base + route, { headers: { Authorization: `Bearer ${tokens[actor]}` } });
  try {
    await check("AEAD protects integrity, uses random nonces, binds the case ID and supports explicit key rotation", async () => {
      const identity = { name: "SYNTHETIC_IDENTITY_TOKEN", email: "synthetic@example.test", phone: "0000000000" };
      const one = encryptIdentity("case-a", identity), two = encryptIdentity("case-a", identity);
      assert.notEqual(one.iv, two.iv); assert.ok(!JSON.stringify(one).includes(identity.name)); assert.deepEqual(decryptIdentity("case-a", one), identity);
      assert.throws(() => decryptIdentity("case-b", one)); assert.throws(() => decryptIdentity("case-a", { ...one, ciphertext: Buffer.from("tampered").toString("base64") }));
      process.env.IDENTITY_KEYS_JSON = JSON.stringify({ fixture_v1: key1, fixture_v2: key2 }); process.env.IDENTITY_ACTIVE_KEY_ID = "fixture_v2";
      const rotated = rotateIdentity("case-a", one); assert.equal(rotated.keyId, "fixture_v2"); assert.deepEqual(decryptIdentity("case-a", rotated), identity); assert.deepEqual(decryptIdentity("case-a", one), identity);
      process.env.IDENTITY_KEYS_JSON = JSON.stringify({ fixture_v2: key2 }); assert.throws(() => decryptIdentity("case-a", one)); assert.deepEqual(decryptIdentity("case-a", rotated), identity);
    });
    const institution = await request("head", "institutions", "POST", { aictePermanentId: "SECURITY-TEST-ONLY", name: "Disposable Security Institution", institutionType: "Engineering", address: "Fixture only", city: "Test", state: "North State", region: "North" }); assert.equal(institution.status, 201);
    const payload = { institutionId: institution.body.id, category: "Faculty Shortage / Irregularities", title: "Visible companion", description: "Synthetic faculty shortage verification", receivingBureauId: "RB", assignedOfficerId: "officer", priority: "Medium" };
    const publicCase = (await request("head", "complaints", "POST", payload)).body.complaint;
    const secret = (await request("head", "complaints", "POST", { ...payload, title: "SEALED_SECURITY_FIXTURE", description: "SEALED_NARRATIVE_TOKEN Synthetic faculty shortage verification" })).body.complaint;
    assert.ok(publicCase?.id && secret?.id);
    const form = new FormData(); form.set("file", new Blob(["%PDF-1.4\n%%EOF"], { type: "application/pdf" }), "private-fixture.pdf");
    const uploaded = await fetch(base + `complaints/${secret.id}/documents`, { method: "POST", headers: { Authorization: `Bearer ${tokens.head}` }, body: form }); assert.equal(uploaded.status, 201); const document = await uploaded.json() as any;
    const coordination = await request("officer", "coordination", "POST", { complaintId: secret.id, targetBureaus: ["PGRC"], reason: "Synthetic coordination scope test", assistance: "Verification" }); assert.equal(coordination.status, 200);
    const sessionId = coordination.body.id;
    async function action(actor: string, action: string, extra = {}) { const view = await request(actor, `coordination/${sessionId}`); return request(actor, `coordination/${sessionId}/actions/${action}`, "POST", { version: view.body.version, requestId: randomUUID(), remarks: "Synthetic independent decision", ...extra }); }
    assert.equal((await action("head", "originDecision", { decision: "Approved" })).status, 200); assert.equal((await action("target", "targetDecision", { bureauId: "PGRC", decision: "Accepted" })).status, 200);
    const countsBefore = (await request("head", `institutions/${institution.body.id}/dashboard-metrics`)).body.kpis.totalComplaints;
    let policy = (await request("authority", `case-security/${secret.id}`)).body;
    await check("Only scoped Competent Authorities can seal cases; stale versions cannot overwrite policy", async () => {
      assert.equal((await request("head", `case-security/${secret.id}`, "PUT", { version: policy.version, level: "sealed", grants: [], reason: "Test-only seal" })).status, 403);
      const changed = await request("authority", `case-security/${secret.id}`, "PUT", { version: policy.version, level: "sealed", grants: [], reason: "Test-only seal, no legal classification asserted" }); assert.equal(changed.status, 200); assert.equal(changed.body.capabilities.manage, true); assert.equal(changed.body.capabilities.evidence, false); policy = changed.body;
      assert.equal((await request("authority", `case-security/${secret.id}`, "PUT", { version: policy.version - 1, level: "internal", grants: [], reason: "Must reject stale review" })).status, 409);
    });
    await check("Sealed direct IDs, list/search, role/dashboard totals, history and institution aggregates do not disclose the case", async () => {
      const hidden = await request("officer", `complaints/${secret.id}`), missing = await request("officer", "complaints/nonexistent-fixture"); assert.equal(hidden.status, 404); assert.deepEqual(hidden, missing);
      for (const route of ["complaints?limit=100", "complaints?search=SEALED_NARRATIVE_TOKEN", "analytics/dashboard", "analytics/role-dashboard", "analytics/performance-report", `institutions/${institution.body.id}`, `institutions/${institution.body.id}/dashboard-metrics`, "institutions?limit=100", "notifications", "transfers", "intake"]) {
        const response = await request("head", route); assert.equal(response.status, 200, route); const content = JSON.stringify(response.body);
        assert.ok(!content.includes("SEALED_SECURITY_FIXTURE") && !content.includes("SEALED_NARRATIVE_TOKEN") && !content.includes(secret.id), "Sealed disclosure through " + route);
      }
      assert.equal((await request("head", `institutions/${institution.body.id}/dashboard-metrics`)).body.kpis.totalComplaints, countsBefore - 1);
      assert.equal((await request("head", `complaints/${secret.id}/history`)).status, 404);
    });
    await check("Overlap flags, candidate comparisons, related metadata and CSV exclude hidden sealed records", async () => {
      const visible = await request("officer", `complaints/${publicCase.id}`); assert.equal(visible.body.complaint.hasOverlapAlert, false); assert.equal(visible.body.overlapAlerts.length, 0);
      assert.equal((await request("officer", `complaints?institutionId=${institution.body.id}&hasOverlap=true`)).body.pagination.total, 0);
      const preview = await request("officer", "complaints/check-overlap", "POST", { ...payload, title: "Fresh synthetic check" }); assert.equal(preview.status, 200); assert.ok(!JSON.stringify(preview.body).includes(secret.id));
      const csv = await raw("head", "analytics/export-csv"); assert.equal(csv.status, 200); assert.ok(!(await csv.text()).includes(secret.complaintId));
      const overlap = await request("head", `overlaps?institutionId=${institution.body.id}`); assert.equal(overlap.body.pagination.total, 0);
    });
    await check("Coordination membership and shared document routes cannot override a sealed grant", async () => {
      assert.equal((await request("target", `coordination/${sessionId}`)).status, 404);
      assert.ok(!(await request("target", "coordination")).body.data.some((row: any) => row.id === sessionId));
      assert.equal((await raw("head", `complaints/${secret.id}/documents/${document.id}/download`)).status, 404);
      assert.equal((await request("head", `institutions/${institution.body.id}/documents`)).body.some((row: any) => row.id === document.id), false);
    });
    const grants = () => [{ profileId: "head", read: true, evidence: false, identity: false, manage: false }, { profileId: "officer", read: true, evidence: false, identity: false, manage: false }, { profileId: "target", read: true, evidence: false, identity: false, manage: false }, { profileId: "authority", read: true, evidence: false, identity: true, manage: true }];
    await check("Explicit read grants restore only existing case/membership scope, with evidence and identity independent", async () => {
      const changed = await request("authority", `case-security/${secret.id}`, "PUT", { version: policy.version, level: "sealed", grants: grants(), reason: "Explicit test-only case-read and authority identity grants" }); assert.equal(changed.status, 200); policy = changed.body;
      assert.equal((await request("officer", `complaints/${secret.id}`)).status, 200); assert.equal((await request("target", `complaints/${secret.id}`)).status, 404); assert.equal((await request("target", `coordination/${sessionId}`)).status, 200);
      assert.equal((await raw("head", `complaints/${secret.id}/documents/${document.id}/download`)).status, 404);
      assert.equal((await request("head", `case-security/${secret.id}/identity/reveal`, "POST", { reason: "Forbidden independent identity read" })).status, 403);
      assert.equal((await request("authority", `case-security/${secret.id}/identity`, "PUT", { reason: "Protect synthetic fixture identity", identity: { name: "SYNTHETIC_IDENTITY_TOKEN", email: "identity@example.test" } })).status, 200);
      const reveal = await request("authority", `case-security/${secret.id}/identity/reveal`, "POST", { reason: "Authorized synthetic test verification" }); assert.equal(reveal.status, 200); assert.equal(reveal.body.identity.name, "SYNTHETIC_IDENTITY_TOKEN");
    });
    await check("General responses never expose identity plaintext, ciphertext, key IDs or security grant rosters", async () => {
      for (const route of [`complaints/${secret.id}`, "complaints?limit=100", "analytics/role-dashboard", `institutions/${institution.body.id}`]) {
        const response = await request("authority", route), content = JSON.stringify(response.body); assert.equal(response.status, 200);
        assert.ok(!content.includes("SYNTHETIC_IDENTITY_TOKEN") && !content.includes("identityEnvelope") && !content.includes("ciphertext") && !content.includes("fixture_v2") && !content.includes('"grants"'), route);
      }
      const stored = await work(() => store.exportSnapshot()); const complaint = stored.complaints.find(row => row.id === secret.id)!; assert.ok(complaint.identityEnvelope); assert.ok(!JSON.stringify(complaint).includes("SYNTHETIC_IDENTITY_TOKEN"));
      const audits = stored.auditLogs.filter(row => row.entityId === secret.id); assert.ok(audits.some(row => row.action === "COMPLAINANT_IDENTITY_REVEALED")); assert.ok(!JSON.stringify(audits).includes("identity@example.test"));
    });
    await check("Explicit evidence grants permit download without granting identity access", async () => {
      const next = grants().map(grant => grant.profileId === "head" ? { ...grant, evidence: true } : grant);
      const changed = await request("authority", `case-security/${secret.id}`, "PUT", { version: policy.version, level: "restricted", grants: next, reason: "Independent synthetic evidence authorization" }); assert.equal(changed.status, 200); policy = changed.body;
      const download = await raw("head", `complaints/${secret.id}/documents/${document.id}/download`); assert.equal(download.status, 200); await download.arrayBuffer();
      assert.equal((await request("head", `case-security/${secret.id}/identity/reveal`, "POST", { reason: "Still unauthorized identity action" })).status, 403);
    });
    await check("Expired/revoked grants fail closed and missing keys do not fall back to plaintext", async () => {
      const fixture = await work(() => store.getCoordinationSource(secret.id)!); assert.equal(confidentialityAllows({ id: "head", isActive: true } as any, { security: { ...fixture.security!, grants: [{ profileId: "head", read: true, evidence: true, identity: true, manage: false, expiresAt: "2000-01-01T00:00:00.000Z" }] } }, "read"), false);
      delete process.env.IDENTITY_KEYS_JSON;
      assert.equal((await request("authority", `case-security/${secret.id}/identity/reveal`, "POST", { reason: "Missing key must fail closed" })).status, 503);
      assert.equal((await request("authority", `complaints/${secret.id}`)).status, 200);
      process.env.IDENTITY_KEYS_JSON = JSON.stringify({ fixture_v2: key2 });
      const changed = await request("authority", `case-security/${secret.id}`, "PUT", { version: policy.version, level: "sealed", grants: [], reason: "Revoke synthetic recipients" }); assert.equal(changed.status, 200); policy = changed.body;
      assert.equal((await request("head", `complaints/${secret.id}`)).status, 404); assert.equal((await request("target", `coordination/${sessionId}`)).status, 404);
    });
    await check("Live streams deliver authorized case events and suppress newly sealed case events", async () => {
      const controller = new AbortController();
      const response = await fetch(base + "complaints/stream/live", { headers: { Authorization: `Bearer ${tokens.officer}` }, signal: controller.signal });
      assert.equal(response.status, 200); const reader = response.body!.getReader(), decode = new TextDecoder();
      try {
        const opening = await reader.read(); assert.ok(decode.decode(opening.value).includes("CONNECTED"));
        const { broadcastCaseEvent } = await import("../routes/complaints.js");
        const { runOperationalWork } = await import("../db/operationalPostgres.js");
        await runOperationalWork(() => broadcastCaseEvent({ type: "CASE_UPDATED", complaintId: publicCase.id }));
        const visible = await Promise.race([reader.read().then(result => decode.decode(result.value)), new Promise<string>(resolve => setTimeout(() => resolve("timeout"), 2000))]); assert.ok(visible.includes(publicCase.id));
        await runOperationalWork(() => broadcastCaseEvent({ type: "CASE_UPDATED", complaintId: publicCase.id, hasOverlapAlert: true }));
        const scopedFlag = await reader.read(); assert.equal(JSON.parse(decode.decode(scopedFlag.value).replace(/^data:\s*/, "").trim()).hasOverlapAlert, false, "A public event must not reveal an overlap visible only through a sealed counterpart");
        await runOperationalWork(() => broadcastCaseEvent({ type: "CASE_UPDATED", complaintId: secret.id }));
        const hidden = await Promise.race([reader.read().then(result => decode.decode(result.value)).catch(() => "closed"), new Promise<string>(resolve => setTimeout(() => resolve("no-disclosure"), 120))]); assert.equal(hidden, "no-disclosure");
      } finally { controller.abort(); await reader.cancel().catch(() => {}); }
    });
    await check("Sensitivity signals are configurable human-review flags, and prevent disposal before review", async () => {
      const flagged = await request("head", "complaints", "POST", { ...payload, category: "Harassment & Grievance Redressal Failure", title: "Synthetic review signal" }); assert.equal(flagged.status, 201); assert.equal(flagged.body.complaint.security.reviewStatus, "pending");
      const id = flagged.body.complaint.id;
      assert.equal((await request("head", `complaints/${id}/status`, "PATCH", { status: "Under Process", remarks: "Start the existing investigation workflow" })).status, 200);
      assert.equal((await request("head", `complaints/${id}/status`, "PATCH", { status: "Disposed", remarks: "Must require sensitivity review" })).status, 403);
      const review = (await request("authority", `case-security/${id}`)).body; assert.ok(review.sensitivitySignals.includes("posh_review"));
      assert.equal((await request("authority", `case-security/${id}`, "PUT", { version: review.version, level: "internal", grants: [], reason: "Synthetic authorized sensitivity review, not a legal finding" })).status, 200);
      assert.equal((await request("head", `complaints/${id}/status`, "PATCH", { status: "Disposed", remarks: "Authorized disposition after recorded human review" })).status, 200);
      assert.equal((await request("head", "case-security/configuration")).status, 403); const config = (await request("admin", "case-security/configuration")).body;
      const changed = await request("admin", "case-security/configuration", "PUT", { ...config, reason: "Test-only signal version", signals: config.signals }); assert.equal(changed.status, 200); assert.equal(changed.body.version, config.version + 1);
    });
    await check("Legacy identity migration is explicit and non-destructive; approved local processing remains separate", async () => {
      const source = await work(() => store.exportSnapshot()), sample = structuredClone(source); const row = sample.complaints.find(row => row.id === publicCase.id)! as any;
      row.complainantName = "SYNTHETIC_LEGACY_IDENTITY"; row.complainantEmail = "legacy@example.test";
      const original = JSON.stringify(sample), plan = maintainIdentitySnapshot(sample); assert.equal(plan.applied, false); assert.equal(JSON.stringify(sample), original); assert.equal(plan.encryptedLegacy, 1);
      const protectedData = maintainIdentitySnapshot(sample, true); assert.ok(!JSON.stringify(protectedData.snapshot).includes("SYNTHETIC_LEGACY_IDENTITY")); assert.ok(JSON.stringify(sample).includes("SYNTHETIC_LEGACY_IDENTITY"));
      const migrated = protectedData.snapshot.complaints.find(row => row.id === publicCase.id)!; assert.equal(decryptIdentity(migrated.id, migrated.identityEnvelope!).name, "SYNTHETIC_LEGACY_IDENTITY");
      const originalUrl = process.env.AI_SERVICE_URL, approved = process.env.AI_EXTERNAL_DATA_APPROVED; process.env.AI_SERVICE_URL = "https://unapproved.example.test"; delete process.env.AI_EXTERNAL_DATA_APPROVED;
      try { assert.equal(await querySemanticService("synthetic", "fixture"), null); } finally { if (originalUrl === undefined) delete process.env.AI_SERVICE_URL; else process.env.AI_SERVICE_URL = originalUrl; if (approved === undefined) delete process.env.AI_EXTERNAL_DATA_APPROVED; else process.env.AI_EXTERNAL_DATA_APPROVED = approved; }
    });
    await check("Registration overlap summaries cannot disclose another Bureau's source provenance or language text", async () => {
      await work(() => store.transaction(() => {
        const complaint = store.getCoordinationSource(publicCase.id)!; complaint.metadata!.provenance.sourceNote = "PRIVATE_METADATA_FIXTURE";
        store.addAuditLog({ action: "SYNTHETIC_FIXTURE_PREPARATION", entityType: "Complaint", entityId: complaint.id, details: {} });
      }));
      const created = await request("target", "complaints", "POST", { ...payload, receivingBureauId: "PGRC", assignedOfficerId: undefined, title: "Cross-Bureau summary boundary fixture" }); assert.equal(created.status, 201);
      const summary = created.body.detectedOverlaps.find((candidate: any) => candidate.existingComplaint.id === publicCase.id); assert.ok(summary);
      assert.equal(summary.existingComplaint.metadata, undefined); assert.equal(summary.existingComplaint.textAnalysis, undefined); assert.equal(summary.explanation, undefined); assert.ok(!JSON.stringify(created.body).includes("PRIVATE_METADATA_FIXTURE"));
    });
  } finally {
    for (const [key, value] of [["IDENTITY_KEYS_JSON", previousKeys], ["IDENTITY_ACTIVE_KEY_ID", previousActive], ["IDENTITY_KEYS_FILE", previousFile]]) { if (value === undefined) delete process.env[key!]; else process.env[key!] = value; }
  }
}
