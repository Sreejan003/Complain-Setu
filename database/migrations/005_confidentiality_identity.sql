CREATE TABLE iicmcs.case_security (
  complaint_id text PRIMARY KEY REFERENCES iicmcs.complaints(id),
  version integer NOT NULL CHECK(version > 0),
  level text NOT NULL CHECK(level IN ('internal','restricted','sealed')),
  review_status text NOT NULL CHECK(review_status IN ('not_flagged','pending','reviewed')),
  document jsonb NOT NULL CHECK(jsonb_typeof(document) = 'object')
);
CREATE INDEX case_security_level_idx ON iicmcs.case_security(level, review_status);
CREATE TABLE iicmcs.case_security_grants (
  complaint_id text NOT NULL REFERENCES iicmcs.case_security(complaint_id),
  profile_id text NOT NULL REFERENCES iicmcs.profiles(id),
  can_read boolean NOT NULL,
  can_evidence boolean NOT NULL,
  can_identity boolean NOT NULL,
  can_manage boolean NOT NULL,
  expires_at timestamptz,
  PRIMARY KEY(complaint_id, profile_id),
  CHECK (can_read OR NOT (can_evidence OR can_identity OR can_manage))
);
CREATE INDEX case_grant_profile_idx ON iicmcs.case_security_grants(profile_id, complaint_id);
CREATE TABLE iicmcs.case_identities (
  complaint_id text PRIMARY KEY REFERENCES iicmcs.complaints(id),
  key_id text NOT NULL,
  envelope jsonb NOT NULL CHECK(envelope->>'algorithm' = 'aes-256-gcm' AND envelope->>'version' = '1')
);
CREATE INDEX case_identity_key_idx ON iicmcs.case_identities(key_id);
CREATE TABLE iicmcs.sensitivity_configurations (
  id text PRIMARY KEY,
  version integer NOT NULL UNIQUE CHECK(version > 0),
  document jsonb NOT NULL CHECK(jsonb_typeof(document) = 'object')
);
REVOKE ALL ON ALL TABLES IN SCHEMA iicmcs FROM PUBLIC;
