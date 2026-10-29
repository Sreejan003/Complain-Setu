import "dotenv/config";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import type { DatabaseSchema } from "./store.js";
import type { ComplainantIdentity } from "../models/confidentiality.js";
import { encryptIdentity, rotateIdentity } from "../security/identityCrypto.js";
import {initializeAuditIntegrity,appendPendingAuditEvents,externalAuditCheckpoint} from "../security/auditChain.js";

const legacyKeys = ["complainantIdentity", "complainantName", "complainantEmail", "complainantPhone", "complainantAddress"];
/** Never guesses identity from narratives, user profiles, or institution contact fields. */
export function maintainIdentitySnapshot(input: DatabaseSchema, apply = false) {
  const snapshot = structuredClone(input); let encryptedLegacy = 0, rotated = 0;
  for (const complaint of snapshot.complaints) {
    const row = complaint as typeof complaint & Record<string, any>;
    const hasLegacy = legacyKeys.some(key => row[key] !== undefined);
    if (hasLegacy) {
      if (row.identityEnvelope) throw new Error("Conflicting legacy and encrypted identity requires explicit operator reconciliation");
      const identity: ComplainantIdentity = row.complainantIdentity ? structuredClone(row.complainantIdentity) : {};
      for (const [legacy, field] of [["complainantName", "name"], ["complainantEmail", "email"], ["complainantPhone", "phone"], ["complainantAddress", "address"]] as const) {
        if (row[legacy] !== undefined) { if (identity[field] !== undefined && identity[field] !== row[legacy]) throw new Error("Conflicting legacy identity requires reconciliation"); identity[field] = row[legacy]; }
      }
      if (!identity || typeof identity !== "object" || Array.isArray(identity) || !Object.keys(identity).length || Object.keys(identity).some(key => !["name", "email", "phone", "address"].includes(key)) || Object.values(identity).some(value => typeof value !== "string" || value.length > 2000)) throw new Error("Unsupported legacy identity shape; no data changed");
      if (apply) { row.identityEnvelope = encryptIdentity(row.id, identity); for (const key of legacyKeys) delete row[key]; }
      encryptedLegacy++;
    } else if (row.identityEnvelope && row.identityEnvelope.keyId !== process.env.IDENTITY_ACTIVE_KEY_ID) {
      if (apply) row.identityEnvelope = rotateIdentity(row.id, row.identityEnvelope); rotated++;
    }
  }
  return { snapshot, encryptedLegacy, rotated, applied: apply };
}

async function main() {
  const apply = process.argv.includes("--apply");
  if (process.argv.includes("--postgres")) {
    process.env.PERSISTENCE_DRIVER = "postgres";
    const { OperationalPostgres } = await import("./operationalPostgres.js"), { store } = await import("./store.js");
    const driver = new OperationalPostgres();
    try {
      const result = await driver.run(() => {
        const result = maintainIdentitySnapshot(store.exportSnapshot(), apply);
        if (apply) store.transaction(() => {
          for (const complaint of result.snapshot.complaints) if (complaint.identityEnvelope) store.saveIdentityEnvelope(complaint.id, complaint.identityEnvelope);
          store.addAuditLog({ userName: "Identity maintenance CLI", action: "IDENTITY_MAINTENANCE", entityType: "SystemOperation", entityId: "identity-maintenance", details: { encryptedLegacy: result.encryptedLegacy, rotated: result.rotated, activeKeyId: process.env.IDENTITY_ACTIVE_KEY_ID } });
        });
        return { applied: result.applied, encryptedLegacy: result.encryptedLegacy, rotated: result.rotated };
      }); console.log(JSON.stringify(result));
    } finally { await driver.close(); }
  } else {
    const argument = (name: string) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
    const source = argument("--json-source"), output = argument("--output");
    if (!source || (apply && !output)) throw new Error("Use --json-source <backup.json> [--apply --output <new-file.json>] or --postgres [--apply]");
    const input = JSON.parse(fs.readFileSync(source, "utf8")) as DatabaseSchema;
    input.auditIntegrity??=initializeAuditIntegrity(input.auditLogs);
    if (!Array.isArray(input.complaints)) throw new Error("Invalid source snapshot");
    const result = maintainIdentitySnapshot(input, apply);
    if (apply) {
      result.snapshot.auditLogs.push({ id: randomUUID(), action: "IDENTITY_MAINTENANCE", entityType: "SystemOperation", entityId: "identity-maintenance", userName: "Identity maintenance CLI", details: { encryptedLegacy: result.encryptedLegacy, rotated: result.rotated }, createdAt: new Date().toISOString() });
      appendPendingAuditEvents(result.snapshot.auditLogs,result.snapshot.auditIntegrity!,externalAuditCheckpoint());
      fs.writeFileSync(output!, JSON.stringify(result.snapshot, null, 2), { flag: "wx", mode: 0o600 });
    }
    console.log(JSON.stringify({ applied: apply, encryptedLegacy: result.encryptedLegacy, rotated: result.rotated, sourcePreserved: true }));
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main().catch(() => { console.error("Identity maintenance failed; no identities, keys or database credentials logged. Reconcile the source shape, keyring and migration state."); process.exitCode = 1; });
