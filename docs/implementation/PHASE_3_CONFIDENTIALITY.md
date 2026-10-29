# Phase 3 — Confidentiality and identity protection

Implemented on top of existing roles, Bureau/region/assignment restrictions and coordination membership. No operational migration, external disclosure or production key generation has been performed.

## Access matrix

| Capability | Internal | Restricted / sealed |
| --- | --- | --- |
| Case details | Existing case RBAC | Existing case RBAC plus active explicit read grant |
| Institution aggregates | Existing institution/region aggregate scope | Protected cases included only with full current case RBAC and active read grant |
| Coordination | Existing approved membership and scope | Membership/scope plus active explicit read grant; no automatic primary-case access |
| Evidence | Existing case/evidence or explicit coordination-document scope | Existing evidence/document scope plus explicit evidence grant |
| Identity | Existing case scope plus explicit identity grant | Existing case scope plus explicit read and identity grants |
| Security management | Competent Authority within case scope | Competent Authority within case scope plus explicit read and management grants |
| System administrator | Configuration/users and administrative audit only | No case, identity, evidence or coordination access merely through the administrator role |

Restricted and sealed have the same conservative grant gate here. They are human handling labels, not inferred legal classifications. Grants never replace existing jurisdiction, assignment or document-sharing controls. Expired grants fail closed. The reviewer retains an explicit read/management grant for protected cases; another authorized manager may revoke it later.

The case detail panel supports confidentiality review, explicit grants and independent identity actions. Every identity reveal requires a reason and creates an audit entry. Identity responses use `Cache-Control: no-store`; displayed values clear after one minute or on panel close. General API serialization excludes ciphertext and known legacy identity fields even for identity-authorized viewers. Identity presence is returned only to identity-authorized viewers; grant rosters only to authorized security managers.

Additional gates cover lists/search/direct IDs, institution filters/counts, dashboards/recent activity, CSV, overlap candidates/flags/alerts and related links, transfers, workflow/intake receipts, notifications, evidence, coordination and SSE. Hidden protected counterparts are excluded from similarity/aggregates when the viewer lacks full case access. Existing ordinary cross-Bureau summaries retain their established scope.

## Sensitivity review

Versioned administrator configuration includes ragging, POSH/harassment and SC/ST-related review signals. Signals request human review, not a legal finding or universal handling rule. New flagged cases cannot be disposed until an authorized review is recorded. Investigation and assignment remain available. Historical cases lacking policy metadata retain prior internal RBAC; the panel displays available signals for human assessment without silently imposing a historical legal classification.

Administrator UI: `/admin/confidentiality`, linked from Case Intake Configuration. Configuration API: `/api/case-security/configuration`. Case/identity APIs: `/api/case-security/:id`. Administrators manage signal configuration; scoped Competent Authorities manage case confidentiality.

## Encryption, legacy data and rotation

AES-256-GCM uses random 96-bit nonces, a 128-bit tag and case-bound authenticated additional data. Only separately captured complainant name/email/phone/address fields are encrypted. Keys are externally supplied, never seeded or logged:

- `IDENTITY_KEYS_FILE`: protected secret file mapping stable key IDs to base64-encoded 32-byte keys.
- `IDENTITY_KEYS_JSON`: alternative secret injection when no file is supplied.
- `IDENTITY_ACTIVE_KEY_ID`: active write key; retain old keys during rotation.

Missing/invalid keys, altered ciphertext and wrong-case binding fail closed. Normal case access continues without identity keys; identity operations never fall back to plaintext. Test keys are random and disposable, restricted to the isolated fixture process.

Back up data and restrict the key file to the service/operator account before maintenance. From repository root with the supported database/key configuration:

```powershell
npm run migrate --prefix backend
npm run identity:maintain --prefix backend -- --json-source <backup.json>
npm run identity:maintain --prefix backend -- --json-source <backup.json> --apply --output <new-protected-snapshot.json>
npm run identity:maintain --prefix backend -- --postgres
npm run identity:maintain --prefix backend -- --postgres --apply
```

Dry runs report counts only. JSON application preserves its source and refuses to overwrite an existing output. PostgreSQL application uses the shared operational transaction/lock. Only known legacy identity fields are migrated; conflicts/unsupported shapes fail for operator reconciliation. Profiles, institution contacts and narratives are never guessed to be complainant identities. Prepare legacy JSON before production backfill. An operator explicitly selects the protected replacement snapshot; the tool does not overwrite the operational JSON.

Rotation procedure: add a new random key while retaining old keys, set its active ID, run plan/apply, verify isolated restoration and authorized reads, then retire old keys only after all relevant records and backup-recovery requirements are addressed. Encryption does not erase plaintext backups; access control and retention remain necessary. The running service's access to keys is outside this at-rest protection threat boundary.

Migration `005_confidentiality_identity.sql` adds security, grant, encrypted identity and immutable configuration-history projections with foreign keys/indexes. It deletes no evidence or history. It does not automatically classify legacy cases.

Identity protection does not automatically anonymize arbitrary narrative/evidence text. Officials must use the protected identity fields and classify case/evidence access appropriately; original source content is preserved.

Protected or pending-review case text is kept out of sidecar requests by the overlap engine. In-process comparison remains available. Non-loopback AI is denied unless `AI_EXTERNAL_DATA_APPROVED=true`, must use HTTPS and cannot follow redirects. This is an operator configuration/approval control, not a claim of legal authorization. No external provider was activated.

## Verification

- 24 JSON and 24 native PostgreSQL 18.4 intake/security scenarios passed. PostgreSQL was actually restarted; sealed policy, grants and encrypted envelope survived.
- Existing 33 RBAC scenarios and 23 unit/15 acceptance checks passed. Builds/localization/interface checks passed; lint remains at its original 184 warnings, with none added in the new components.
- Covered AEAD tampering/case binding/random nonces/rotation, missing keys, non-destructive legacy migration, hidden counts/search/CSV/overlap/coordination/documents, independent grants, revocation/expiry gate, human sensitivity review and SSE suppression.
- Browser verified authority sealing, explicit identity grant, encrypted identity save, audited reveal and clearing. Evidence: `evidence/phase3-confidentiality.png`; all records/keys were disposable fixtures.

Early failing fixtures were corrected and rerun: Pending must enter Under Process before Disposed; the security fixture adds one institution; and the SSE test uses the actual application background transaction entry point instead of delivering an authorized event twice through two in-process drivers. An audit regression hiding Authentication entries was fixed while case audit content remained restricted.

Hash-chain verification, shared rate limits, ingestion, graph/report and further intelligence features remain in later phases. They must use these authorization gates and are not claimed here.
