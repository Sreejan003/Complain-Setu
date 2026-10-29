CREATE TABLE IF NOT EXISTS iicmcs.merge_proposals (
  id text PRIMARY KEY,source_id text NOT NULL REFERENCES iicmcs.complaints(id),canonical_id text NOT NULL REFERENCES iicmcs.complaints(id),
  actor_id text NOT NULL REFERENCES iicmcs.profiles(id),request_id text NOT NULL,document jsonb NOT NULL,
  UNIQUE(actor_id,request_id),CHECK(source_id<>canonical_id)
);
CREATE TABLE IF NOT EXISTS iicmcs.case_merges (
  id text PRIMARY KEY,proposal_id text NOT NULL UNIQUE REFERENCES iicmcs.merge_proposals(id),source_id text NOT NULL REFERENCES iicmcs.complaints(id),
  canonical_id text NOT NULL REFERENCES iicmcs.complaints(id),actor_id text NOT NULL REFERENCES iicmcs.profiles(id),document jsonb NOT NULL,CHECK(source_id<>canonical_id)
);
CREATE TABLE IF NOT EXISTS iicmcs.merge_reversals (
  id text PRIMARY KEY,merge_id text NOT NULL UNIQUE REFERENCES iicmcs.case_merges(id),actor_id text NOT NULL REFERENCES iicmcs.profiles(id),
  request_id text NOT NULL,document jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS iicmcs.case_merge_active (
  source_id text PRIMARY KEY REFERENCES iicmcs.complaints(id),canonical_id text NOT NULL REFERENCES iicmcs.complaints(id),
  merge_id text NOT NULL UNIQUE REFERENCES iicmcs.case_merges(id),CHECK(source_id<>canonical_id)
);
CREATE INDEX IF NOT EXISTS case_merge_canonical_idx ON iicmcs.case_merge_active(canonical_id);
CREATE OR REPLACE FUNCTION iicmcs.prevent_merge_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (WITH RECURSIVE ancestors(id) AS (
    SELECT NEW.canonical_id UNION SELECT edge.canonical_id FROM iicmcs.case_merge_active edge JOIN ancestors ON edge.source_id=ancestors.id
  ) SELECT 1 FROM ancestors WHERE id=NEW.source_id) THEN RAISE EXCEPTION 'Case merge cycle rejected'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER prevent_merge_cycle BEFORE INSERT OR UPDATE ON iicmcs.case_merge_active FOR EACH ROW EXECUTE FUNCTION iicmcs.prevent_merge_cycle();
CREATE OR REPLACE FUNCTION iicmcs.preserve_case_family_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Case family history is immutable'; END IF;
  IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Case family history is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER preserve_merge_proposal BEFORE UPDATE OR DELETE ON iicmcs.merge_proposals FOR EACH ROW EXECUTE FUNCTION iicmcs.preserve_case_family_history();
CREATE TRIGGER preserve_case_merge BEFORE UPDATE OR DELETE ON iicmcs.case_merges FOR EACH ROW EXECUTE FUNCTION iicmcs.preserve_case_family_history();
CREATE TRIGGER preserve_merge_reversal BEFORE UPDATE OR DELETE ON iicmcs.merge_reversals FOR EACH ROW EXECUTE FUNCTION iicmcs.preserve_case_family_history();
REVOKE ALL ON iicmcs.merge_proposals,iicmcs.case_merges,iicmcs.merge_reversals,iicmcs.case_merge_active FROM PUBLIC;
