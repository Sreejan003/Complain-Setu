import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import fs from "node:fs";
import type { IdentityEnvelope, ComplainantIdentity } from "../models/confidentiality.js";
export class IdentityCryptoError extends Error {
  constructor() { super("Identity protection is unavailable or the protected record failed verification."); }
}
function keyring() {
  try {
    const encoded = process.env.IDENTITY_KEYS_FILE ? fs.readFileSync(process.env.IDENTITY_KEYS_FILE, "utf8") : process.env.IDENTITY_KEYS_JSON;
    if (!encoded || !process.env.IDENTITY_ACTIVE_KEY_ID) throw new Error();
    const source: unknown = JSON.parse(encoded);
    if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error();
    const keys = new Map<string, Buffer>();
    for (const [id, value] of Object.entries(source)) {
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || typeof value !== "string" || !/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new Error();
      const key = Buffer.from(value, "base64"); if (key.length !== 32) throw new Error(); keys.set(id, key);
    }
    const active = process.env.IDENTITY_ACTIVE_KEY_ID;
    if (!keys.has(active)) throw new Error();
    return { keys, active };
  } catch { throw new IdentityCryptoError(); }
}
function aad(caseId: string) { return Buffer.from("iicmcs:complainant-identity:v1:" + caseId, "utf8"); }
export function identityProtectionAvailable() { try { keyring(); return true; } catch { return false; } }
export function encryptIdentity(caseId: string, identity: ComplainantIdentity): IdentityEnvelope {
  const { keys, active } = keyring(), iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", keys.get(active)!, iv);
  cipher.setAAD(aad(caseId)); const ciphertext = Buffer.concat([cipher.update(JSON.stringify(identity), "utf8"), cipher.final()]);
  return { version: 1, algorithm: "aes-256-gcm", keyId: active, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") };
}
export function decryptIdentity(caseId: string, envelope: IdentityEnvelope): ComplainantIdentity {
  try {
    const { keys } = keyring(), key = keys.get(envelope.keyId);
    if (!key || envelope.version !== 1 || envelope.algorithm !== "aes-256-gcm" || Buffer.from(envelope.iv, "base64").length !== 12 || Buffer.from(envelope.tag, "base64").length !== 16) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64")); decipher.setAAD(aad(caseId)); decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    const result = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]).toString("utf8"));
    if (!result || typeof result !== "object" || Array.isArray(result) || Object.keys(result).some(key => !["name", "email", "phone", "address"].includes(key)) || Object.values(result).some(value => typeof value !== "string" || value.length > 2000)) throw new Error();
    return result;
  } catch { throw new IdentityCryptoError(); }
}
export function rotateIdentity(caseId: string, envelope: IdentityEnvelope) { return encryptIdentity(caseId, decryptIdentity(caseId, envelope)); }
