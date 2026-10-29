CREATE TABLE IF NOT EXISTS iicmcs.sla_policy_configurations(id text PRIMARY KEY,version integer NOT NULL UNIQUE CHECK(version>0),document jsonb NOT NULL);
CREATE TRIGGER preserve_sla_configuration BEFORE UPDATE OR DELETE ON iicmcs.sla_policy_configurations FOR EACH ROW EXECUTE FUNCTION iicmcs.preserve_case_family_history();
CREATE TABLE IF NOT EXISTS iicmcs.case_sla_clocks(complaint_id text PRIMARY KEY REFERENCES iicmcs.complaints(id),version integer NOT NULL CHECK(version>0),configuration_version integer NOT NULL REFERENCES iicmcs.sla_policy_configurations(version),deadline date NOT NULL,document jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS sla_clock_deadline_idx ON iicmcs.case_sla_clocks(deadline);
CREATE TABLE IF NOT EXISTS iicmcs.sla_alerts(id text PRIMARY KEY,key text NOT NULL UNIQUE,recipient_id text NOT NULL REFERENCES iicmcs.profiles(id),kind text NOT NULL,document jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS sla_alert_recipient_idx ON iicmcs.sla_alerts(recipient_id,kind);
CREATE TABLE IF NOT EXISTS iicmcs.sla_deliveries(id text PRIMARY KEY,alert_id text NOT NULL REFERENCES iicmcs.sla_alerts(id),recipient_id text NOT NULL REFERENCES iicmcs.profiles(id),channel text NOT NULL CHECK(channel IN ('email','sms')),status text NOT NULL CHECK(status IN ('pending','simulated','disabled','failed')),document jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS sla_delivery_retry_idx ON iicmcs.sla_deliveries(status);
REVOKE ALL ON iicmcs.sla_policy_configurations,iicmcs.case_sla_clocks,iicmcs.sla_alerts,iicmcs.sla_deliveries FROM PUBLIC;
