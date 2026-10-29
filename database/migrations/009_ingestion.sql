CREATE TABLE IF NOT EXISTS iicmcs.import_runs (
  id text PRIMARY KEY,owner_id text NOT NULL REFERENCES iicmcs.profiles(id),batch_key text NOT NULL,
  version integer NOT NULL CHECK(version>0),status text NOT NULL CHECK(status IN ('Preview','Partial','Completed')),
  document jsonb NOT NULL,UNIQUE(owner_id,batch_key)
);
CREATE INDEX IF NOT EXISTS import_run_owner_status_idx ON iicmcs.import_runs(owner_id,status);
CREATE TABLE IF NOT EXISTS iicmcs.import_receipts (
  id text PRIMARY KEY,owner_id text NOT NULL REFERENCES iicmcs.profiles(id),source_channel text NOT NULL,
  reference_key text NOT NULL,intake_id text NOT NULL REFERENCES iicmcs.intake_records(id),
  run_id text NOT NULL REFERENCES iicmcs.import_runs(id),document jsonb NOT NULL,UNIQUE(source_channel,reference_key)
);
CREATE TRIGGER preserve_import_receipt BEFORE UPDATE OR DELETE ON iicmcs.import_receipts FOR EACH ROW EXECUTE FUNCTION iicmcs.preserve_case_family_history();
REVOKE ALL ON iicmcs.import_runs,iicmcs.import_receipts FROM PUBLIC;
