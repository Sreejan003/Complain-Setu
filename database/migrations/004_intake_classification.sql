-- Additive operational intake and source metadata. Existing case IDs and histories are untouched.
CREATE TABLE iicmcs.intake_configurations (
  id text PRIMARY KEY,
  version integer NOT NULL UNIQUE CHECK (version > 0),
  changed_by text NOT NULL,
  changed_at timestamptz NOT NULL,
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object')
);
CREATE TABLE iicmcs.intake_records (
  id text PRIMARY KEY,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('NeedsInstitutionResolution','NeedsLifecycleReview','Ready','Registered')),
  bureau_id text NOT NULL REFERENCES iicmcs.bureaus(id),
  institution_id text REFERENCES iicmcs.institutions(id),
  created_by text NOT NULL REFERENCES iicmcs.profiles(id),
  complaint_id text UNIQUE REFERENCES iicmcs.complaints(id),
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  CHECK ((status = 'Registered') = (complaint_id IS NOT NULL))
);
CREATE INDEX intake_scope_status_idx ON iicmcs.intake_records(bureau_id, status, created_by);
CREATE TABLE iicmcs.institution_identifiers (
  namespace text NOT NULL,
  value text NOT NULL,
  institution_id text NOT NULL REFERENCES iicmcs.institutions(id),
  PRIMARY KEY(namespace, value)
);
CREATE INDEX institution_identifier_owner_idx ON iicmcs.institution_identifiers(institution_id);
CREATE TABLE iicmcs.institution_aliases (
  institution_id text NOT NULL REFERENCES iicmcs.institutions(id),
  normalized_name text NOT NULL,
  original_name text NOT NULL,
  PRIMARY KEY(institution_id, normalized_name)
);
-- Reference namespaces belong to source channels, never a globally ambiguous free-text reference.
CREATE UNIQUE INDEX complaint_source_reference_unique ON iicmcs.complaints (
  (document #>> '{metadata,sourceChannelId}'),
  (document #>> '{metadata,normalizedExternalReference}')
) WHERE COALESCE(document #>> '{metadata,normalizedExternalReference}', '') <> '';
CREATE INDEX complaint_classification_idx ON iicmcs.complaints (
  (document #>> '{metadata,recordKind}'),
  (document #>> '{metadata,caseTypeId}'),
  (document #>> '{metadata,sourceChannelId}')
);
REVOKE ALL ON ALL TABLES IN SCHEMA iicmcs FROM PUBLIC;
