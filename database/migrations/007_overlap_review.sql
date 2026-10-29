-- Additive signals-v2 configuration, explicit entity codes and immutable reviewer feedback.
CREATE TABLE IF NOT EXISTS iicmcs.overlap_configurations (
  id text PRIMARY KEY, version integer NOT NULL UNIQUE CHECK(version > 0), document jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS iicmcs.case_entity_references (
  complaint_id text PRIMARY KEY REFERENCES iicmcs.complaints(id), version integer NOT NULL CHECK(version > 0), document jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS iicmcs.overlap_alerts (
  id text PRIMARY KEY, alert_reference text NOT NULL, institution_id text NOT NULL REFERENCES iicmcs.institutions(id),
  case_a text NOT NULL, case_b text NOT NULL, status text NOT NULL, document jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS overlap_alerts_institution_status_idx ON iicmcs.overlap_alerts(institution_id,status);
-- Existing alert IDs and historical duplicate pairs remain in the operational snapshot.
-- One canonical pair receipt per pair prevents new duplicate work; no legacy alert is deleted.
CREATE TABLE IF NOT EXISTS iicmcs.overlap_pair_receipts (
  case_a text NOT NULL REFERENCES iicmcs.complaints(id), case_b text NOT NULL REFERENCES iicmcs.complaints(id),
  first_alert_id text NOT NULL REFERENCES iicmcs.overlap_alerts(id), PRIMARY KEY(case_a,case_b), CHECK(case_a < case_b)
);
CREATE TABLE IF NOT EXISTS iicmcs.overlap_feedback (
  id text PRIMARY KEY, alert_id text NOT NULL REFERENCES iicmcs.overlap_alerts(id), actor_id text NOT NULL REFERENCES iicmcs.profiles(id),
  request_id text, document jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS overlap_feedback_alert_idx ON iicmcs.overlap_feedback(alert_id);
CREATE UNIQUE INDEX IF NOT EXISTS overlap_feedback_retry_idx ON iicmcs.overlap_feedback(alert_id,actor_id,request_id) WHERE request_id IS NOT NULL;
CREATE OR REPLACE FUNCTION iicmcs.preserve_overlap_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Overlap history is immutable'; END IF;
  IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Overlap history is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER preserve_overlap_configuration BEFORE UPDATE OR DELETE ON iicmcs.overlap_configurations FOR EACH ROW EXECUTE FUNCTION iicmcs.preserve_overlap_history();
CREATE TRIGGER preserve_overlap_feedback BEFORE UPDATE OR DELETE ON iicmcs.overlap_feedback FOR EACH ROW EXECUTE FUNCTION iicmcs.preserve_overlap_history();
REVOKE ALL ON iicmcs.overlap_configurations,iicmcs.case_entity_references,iicmcs.overlap_alerts,iicmcs.overlap_pair_receipts,iicmcs.overlap_feedback FROM PUBLIC;
