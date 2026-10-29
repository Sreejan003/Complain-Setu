# Phase 9 — significant-read audit and tamper-evident history

Completed in the workspace; no deployment, operational backfill or live external anchoring occurred.

## Chain and preservation

The audit scope is the global operational store. Existing audit records and IDs remain intact and form an explicitly unverified legacy baseline, identified by count and deterministic SHA-256 digest. Historical authenticity is not retrospectively established. New records use sequential chain entries containing event ID, event digest, previous hash and entry hash. Canonical JSON sorts object keys recursively and retains array order. Existing direct business-audit writes are covered at persistence, not only new read hooks. New audit IDs use UUIDs.

The event and its chain entry commit with the business mutation. PostgreSQL's existing advisory-locked unit of work serializes concurrent instances. Migration010_audit_integrity.sql adds private immutable legacy anchor, event, sequence and checkpoint projections with FKs, uniqueness and edit/delete rejection. Database head/count/prefix checks detect disagreement with the snapshot; verification also checks committed projection count/head/anchor. New projection entries are appended without re-inserting the old prefix. Full in-memory verification remains linear in history size; the wider operational snapshot remains the Phase1 serialized design, not a claim of unlimited throughput.

JSON remains single-writer development/test storage, using atomic file replacement. It is not a distributed production authority. A failed persist restores the last successful in-memory snapshot, including account permissions, rather than leaving an uncommitted privilege change visible. Existing Store transactions retain rollback behavior. Corruption is reported and writes fail closed; the application does not automatically repair/re-anchor a broken chain.

## Significant access and privacy

Authorized case views, source-language/security views, complaint searches, institution case-profile views, coordination views/paginated content, evidence-download authorization, CSV case exports and import-error exports are audited. Existing status/transfer/coordination/merge/configuration/identity-reveal writes remain audited and chained. New read/export audit metadata contains IDs, action/format, permitted counts or field names, not narrative, identity values, file contents, search text or credentials. Existing official business-audit remarks are preserved rather than rewriting historical records. Downloads are recorded as authorized attempts, not proof that a client received every byte.

Read hooks run only after the existing access checks. A denied case request cannot create a misleading successful view event. The verifier exposes integrity metadata only, without case IDs, titles, raw events or identities. System-administrator status never grants complaint access. Audit-log and integrity-verification reads are not recursively audited.

## Independent checkpoints and supported threat model

GET /api/admin/audit-integrity verifies sequence/order, event digests, links, legacy anchor, internal checkpoints and the PostgreSQL projection where applicable. It reports a safe failure code/sequence. POST /api/admin/audit-integrity/checkpoints atomically stores a checkpoint, chains its creation and returns downloadable JSON. The administrator page is /admin/audit-integrity, linked from Case Intake Configuration.

Internal checkpoints are not an independent trust source. Protect exported copies outside the database and its administrators' rewrite capability. AUDIT_CHECKPOINT_FILE optionally points to a read-only independently managed exported JSON copy; configured unreadable/malformed/mismatching anchors cause failure rather than silent fallback. The application does not claim that a downloaded file is independently protected merely because export succeeded.

Supported detection includes alteration, missing/reordered events, malformed entries, changed legacy baseline, tail truncation relative to a retained checkpoint, and full rewrites inconsistent with an independent anchor. An attacker able to rewrite the entire database, internal checkpoints and every external anchor can evade these checks. A valid hash chain proves consistency with its anchor, not truth of allegations or administrative correctness. Without an independent retained head, a complete coordinated rewrite or some tail truncations cannot be disproved by a self-contained chain alone.

Migration command: npm run migrate --prefix backend against an explicitly configured, backed-up PostgreSQL authority. npm run migrate:plan --prefix backend only lists checksums. Migration010 was executed in disposable native PostgreSQL; no operational migration was performed. Back up snapshots/database and retain independent checkpoints before operational rollout. Identity-maintenance CLI writes now append to an existing chain or preserve a clearly identified legacy baseline before creating a new output file; source backups are not overwritten.

## Executed verification

- Pure canonicalization/chain tests: object-key stability, meaningful array order, legacy anchoring, alteration, deletion, reordering, malformed entries, append refusal and independent checkpoint detection of truncation/full rewrite.
- 17 JSON and17 real PostgreSQL API scenarios passed on the final implementation, including original intake regression, administrator-only verifier, non-recursive reads,12 concurrent authorized views with ordered unique entries, no narrative copied to read audits, denied-read isolation, atomic checkpoint creation/export, failure sequence reporting, independent file-anchor verification, deliberate mismatch rejection, failed privilege-write memory rollback, SQL immutability and actual stop/start persistence.
- Deliberate negative fixtures print Internal Server Error with code CHECKPOINT_MISMATCH; these are expected rejection checks, not unresolved test failures.
- The final database-prefix check initially exposed lexicographic ordering of a text-cast sequence after9. Qualifying the underlying numeric SQL column fixed it; the final17-scenario PostgreSQL rerun passed with numeric ordering and append-only insertion.
- Existing23 unit/15 acceptance,33 RBAC,25 confidentiality and20 JSON import scenarios passed. Backend/frontend builds,23-locale technical checks and interface/navigation checks passed. Lint remains184 pre-existing warnings; git diff --check passed.
- Browser verified actual administrator chain status, explicit unverified-legacy/no-independent-anchor notices, checkpoint export and the subsequent chain-head change. Screenshot:evidence/phase9-audit-verification.png. This used disposable fixtures only; the preview exited successfully after closing its tab.

Important files: models/auditIntegrity.ts, security/auditChain.ts, Store persistence/rollback and append methods, PostgreSQL audit projections, identity maintenance, auditIntegrity route, significant-read/download/export route hooks, migration010, tests/audit_chain_tests.ts and audit_checks.ts, frontend AuditIntegrity page/routes/configuration link,23 locale resources and backend/.env.example.
