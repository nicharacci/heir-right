PRAGMA foreign_keys = ON;

CREATE TABLE s46_batches (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  file_count INTEGER NOT NULL,
  byte_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE s46_cases (
  id TEXT PRIMARY KEY,
  batch_id TEXT REFERENCES s46_batches(id),
  created_at TEXT NOT NULL
);

CREATE TABLE s46_source_versions (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES s46_cases(id),
  provider TEXT NOT NULL CHECK(provider IN ('manual_pdf','idi_api')),
  object_key TEXT NOT NULL UNIQUE,
  sanitized_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_count INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  page_count INTEGER NOT NULL,
  original_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE s46_jobs (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES s46_cases(id),
  batch_id TEXT REFERENCES s46_batches(id),
  batch_order INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  source_version_id TEXT NOT NULL REFERENCES s46_source_versions(id),
  artifact_id TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  mapping_receipt_json TEXT,
  private_mapping_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE s46_source_checks (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES s46_jobs(id),
  source_name TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('found','checked_not_found','unattempted','unconfigured','blocked','provider_failed','identity_mismatch','conflict','retry_exhausted')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  safe_detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  finished_at TEXT,
  UNIQUE(job_id, source_name)
);

CREATE TABLE s46_source_observations (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES s46_jobs(id),
  source_name TEXT NOT NULL,
  field_key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  page_number INTEGER,
  source_url TEXT,
  private_excerpt TEXT NOT NULL,
  evidence_sha256 TEXT NOT NULL,
  retrieved_at TEXT NOT NULL
);

CREATE TABLE s46_field_receipts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES s46_jobs(id),
  field_key TEXT NOT NULL,
  populated INTEGER NOT NULL CHECK(populated IN (0,1)),
  evidence_source TEXT,
  evidence_page INTEGER,
  blank_reason TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(job_id, field_key)
);

CREATE TABLE s46_artifacts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE REFERENCES s46_jobs(id),
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  byte_count INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE s46_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES s46_jobs(id),
  event_type TEXT NOT NULL,
  safe_detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX idx_s46_jobs_case ON s46_jobs(case_id);
CREATE INDEX idx_s46_jobs_batch_order ON s46_jobs(batch_id, batch_order);
CREATE INDEX idx_s46_jobs_status ON s46_jobs(status);
CREATE UNIQUE INDEX idx_s46_jobs_idempotency ON s46_jobs(idempotency_key);
CREATE INDEX idx_s46_sources_case ON s46_source_versions(case_id, original_order);
CREATE INDEX idx_s46_checks_job ON s46_source_checks(job_id, source_name);
CREATE INDEX idx_s46_observations_job_field ON s46_source_observations(job_id, field_key);
CREATE INDEX idx_s46_receipts_job ON s46_field_receipts(job_id, field_key);
CREATE INDEX idx_s46_events_replay ON s46_events(job_id, id);
