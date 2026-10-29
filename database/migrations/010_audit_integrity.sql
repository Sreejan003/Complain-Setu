CREATE TABLE IF NOT EXISTS iicmcs.audit_legacy_anchor(id integer PRIMARY KEY CHECK(id=1),document jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS iicmcs.audit_events(id text PRIMARY KEY,document jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS iicmcs.audit_chain_entries(sequence bigint PRIMARY KEY CHECK(sequence>0),audit_id text NOT NULL UNIQUE REFERENCES iicmcs.audit_events(id),hash text NOT NULL CHECK(hash~'^[a-f0-9]{64}$'),previous_hash text NOT NULL CHECK(previous_hash~'^[a-f0-9]{64}$'),document jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS iicmcs.audit_checkpoints(id text PRIMARY KEY,sequence bigint NOT NULL CHECK(sequence>=0),document jsonb NOT NULL);
CREATE OR REPLACE FUNCTION iicmcs.preserve_audit_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Audit history is immutable'; END IF;
  IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Audit history is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER preserve_audit_anchor BEFORE UPDATE OR DELETE ON iicmcs.audit_legacy_anchor FOR EACH ROW EXECUTE FUNCTION iicmcs.preserve_audit_history();
CREATE TRIGGER preserve_audit_event BEFORE UPDATE OR DELETE ON iicmcs.audit_events FOR EACH ROW EXECUTE FUNCTION iicmcs.preserve_audit_history();
CREATE TRIGGER preserve_audit_entry BEFORE UPDATE OR DELETE ON iicmcs.audit_chain_entries FOR EACH ROW EXECUTE FUNCTION iicmcs.preserve_audit_history();
CREATE TRIGGER preserve_audit_checkpoint BEFORE UPDATE OR DELETE ON iicmcs.audit_checkpoints FOR EACH ROW EXECUTE FUNCTION iicmcs.preserve_audit_history();
REVOKE ALL ON iicmcs.audit_legacy_anchor,iicmcs.audit_events,iicmcs.audit_chain_entries,iicmcs.audit_checkpoints FROM PUBLIC;
