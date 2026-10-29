CREATE TABLE IF NOT EXISTS iicmcs.report_schedules(id text PRIMARY KEY,owner_id text NOT NULL REFERENCES iicmcs.profiles(id),version integer NOT NULL CHECK(version>0),enabled boolean NOT NULL,document jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS report_schedule_owner_idx ON iicmcs.report_schedules(owner_id,enabled);
CREATE TABLE IF NOT EXISTS iicmcs.report_packs(id text PRIMARY KEY,key text NOT NULL UNIQUE,schedule_id text NOT NULL REFERENCES iicmcs.report_schedules(id),owner_id text NOT NULL REFERENCES iicmcs.profiles(id),document jsonb NOT NULL);
CREATE TRIGGER preserve_report_pack BEFORE UPDATE OR DELETE ON iicmcs.report_packs FOR EACH ROW EXECUTE FUNCTION iicmcs.preserve_case_family_history();
CREATE INDEX IF NOT EXISTS report_pack_owner_idx ON iicmcs.report_packs(owner_id);
CREATE TABLE IF NOT EXISTS iicmcs.report_downloads(id text PRIMARY KEY,pack_id text NOT NULL REFERENCES iicmcs.report_packs(id),actor_id text NOT NULL REFERENCES iicmcs.profiles(id),document jsonb NOT NULL);
CREATE TRIGGER preserve_report_download BEFORE UPDATE OR DELETE ON iicmcs.report_downloads FOR EACH ROW EXECUTE FUNCTION iicmcs.preserve_case_family_history();
CREATE INDEX IF NOT EXISTS report_download_pack_idx ON iicmcs.report_downloads(pack_id);
REVOKE ALL ON iicmcs.report_schedules,iicmcs.report_packs,iicmcs.report_downloads FROM PUBLIC;
