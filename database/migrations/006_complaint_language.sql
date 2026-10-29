CREATE TABLE iicmcs.case_text_analysis (
  complaint_id text PRIMARY KEY REFERENCES iicmcs.complaints(id),
  source_hash text NOT NULL CHECK(length(source_hash) = 64),
  preprocessing_version text NOT NULL,
  language_code text NOT NULL,
  translation_status text NOT NULL CHECK(translation_status IN ('not_requested','draft','reviewed','unavailable')),
  document jsonb NOT NULL CHECK(jsonb_typeof(document) = 'object')
);
CREATE INDEX case_language_idx ON iicmcs.case_text_analysis(language_code, translation_status);
REVOKE ALL ON iicmcs.case_text_analysis FROM PUBLIC;
