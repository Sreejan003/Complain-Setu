-- New private operational schema. Existing public/Supabase tables and original IDs are untouched.
CREATE SCHEMA IF NOT EXISTS iicmcs;
REVOKE ALL ON SCHEMA iicmcs FROM PUBLIC;

CREATE TABLE iicmcs.operational_state (
  id smallint PRIMARY KEY CHECK (id = 1), revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE iicmcs.profiles (id text PRIMARY KEY, document jsonb NOT NULL);
CREATE TABLE iicmcs.bureaus (id text PRIMARY KEY, document jsonb NOT NULL);
CREATE TABLE iicmcs.institutions (id text PRIMARY KEY, document jsonb NOT NULL);
CREATE TABLE iicmcs.complaints (
  id text PRIMARY KEY, reference text UNIQUE NOT NULL,
  institution_id text NOT NULL REFERENCES iicmcs.institutions(id),
  bureau_id text NOT NULL REFERENCES iicmcs.bureaus(id), document jsonb NOT NULL
);
CREATE INDEX operational_cases_institution_bureau_idx ON iicmcs.complaints(institution_id, bureau_id);
CREATE TABLE iicmcs.documents (
  id text PRIMARY KEY, complaint_id text NOT NULL REFERENCES iicmcs.complaints(id), document jsonb NOT NULL
);
CREATE TABLE iicmcs.coordination_sessions (
  id text PRIMARY KEY, primary_complaint_id text NOT NULL REFERENCES iicmcs.complaints(id),
  lead_bureau_id text NOT NULL REFERENCES iicmcs.bureaus(id),
  status text NOT NULL CHECK (status IN ('Pending Origin','Pending Target','Active','Findings Submitted','Clarification','Escalated','Completed','Rejected')),
  version integer NOT NULL CHECK (version >= 0), document jsonb NOT NULL
);
CREATE INDEX coordination_case_stage_idx ON iicmcs.coordination_sessions(primary_complaint_id,status);
CREATE TABLE iicmcs.coordination_participants (
  session_id text NOT NULL REFERENCES iicmcs.coordination_sessions(id),
  bureau_id text NOT NULL REFERENCES iicmcs.bureaus(id),
  status text NOT NULL CHECK (status IN ('Awaiting Origin','Pending','Accepted','Rejected','Clarification','Revoked')),
  document jsonb NOT NULL, PRIMARY KEY(session_id,bureau_id)
);
CREATE INDEX coordination_incoming_idx ON iicmcs.coordination_participants(bureau_id,status);
CREATE TABLE iicmcs.coordination_officers (
  session_id text NOT NULL, bureau_id text NOT NULL,
  officer_id text NOT NULL REFERENCES iicmcs.profiles(id), PRIMARY KEY(session_id,bureau_id,officer_id),
  FOREIGN KEY(session_id,bureau_id) REFERENCES iicmcs.coordination_participants(session_id,bureau_id)
);
CREATE INDEX coordination_officer_idx ON iicmcs.coordination_officers(officer_id,session_id);
CREATE TABLE iicmcs.coordination_messages (
  session_id text NOT NULL REFERENCES iicmcs.coordination_sessions(id), id text NOT NULL,
  reply_to text, created_at timestamptz NOT NULL, document jsonb NOT NULL, PRIMARY KEY(session_id,id),
  FOREIGN KEY(session_id,reply_to) REFERENCES iicmcs.coordination_messages(session_id,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX coordination_messages_page_idx ON iicmcs.coordination_messages(session_id,created_at,id);
CREATE TABLE iicmcs.coordination_approvals (
  session_id text NOT NULL REFERENCES iicmcs.coordination_sessions(id), id text NOT NULL,
  created_at timestamptz NOT NULL, document jsonb NOT NULL, PRIMARY KEY(session_id,id)
);
CREATE TABLE iicmcs.coordination_events (
  session_id text NOT NULL REFERENCES iicmcs.coordination_sessions(id), id text NOT NULL,
  created_at timestamptz NOT NULL, document jsonb NOT NULL, PRIMARY KEY(session_id,id)
);
CREATE INDEX coordination_timeline_idx ON iicmcs.coordination_events(session_id,created_at,id);
CREATE TABLE iicmcs.coordination_tasks (
  session_id text NOT NULL REFERENCES iicmcs.coordination_sessions(id), id text NOT NULL,
  assigned_bureau_id text NOT NULL REFERENCES iicmcs.bureaus(id),
  assigned_officer_id text NOT NULL REFERENCES iicmcs.profiles(id),
  status text NOT NULL CHECK(status IN ('Pending','In Progress','Submitted','Accepted','Completed','Rework')),
  due_date date, version integer NOT NULL CHECK(version >= 0), document jsonb NOT NULL, PRIMARY KEY(session_id,id)
);
CREATE INDEX coordination_tasks_responsibility_idx ON iicmcs.coordination_tasks(assigned_officer_id,status,due_date);
CREATE TABLE iicmcs.coordination_document_access (
  session_id text NOT NULL REFERENCES iicmcs.coordination_sessions(id), id text NOT NULL,
  document_id text NOT NULL REFERENCES iicmcs.documents(id), task_id text, revoked_at timestamptz,
  document jsonb NOT NULL, PRIMARY KEY(session_id,id),
  FOREIGN KEY(session_id,task_id) REFERENCES iicmcs.coordination_tasks(session_id,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE iicmcs.coordination_document_scope (
  session_id text NOT NULL, share_id text NOT NULL,
  bureau_id text NOT NULL REFERENCES iicmcs.bureaus(id), PRIMARY KEY(session_id,share_id,bureau_id),
  FOREIGN KEY(session_id,share_id) REFERENCES iicmcs.coordination_document_access(session_id,id)
);
CREATE TABLE iicmcs.coordination_receipts (
  session_id text NOT NULL REFERENCES iicmcs.coordination_sessions(id), actor_id text NOT NULL, request_id text NOT NULL,
  PRIMARY KEY(session_id,actor_id,request_id)
);
-- Payload stays private; NOTIFY contains only this random event ID, never case text.
CREATE TABLE iicmcs.live_outbox (id text PRIMARY KEY, instance_id text NOT NULL, event jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX live_outbox_created_idx ON iicmcs.live_outbox(created_at);
REVOKE ALL ON ALL TABLES IN SCHEMA iicmcs FROM PUBLIC;
