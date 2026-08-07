CREATE TABLE IF NOT EXISTS docprep_drive_exports (
  case_id uuid NOT NULL REFERENCES docprep_cases(id) ON DELETE CASCADE,
  artifact_sha256 text NOT NULL,
  state text NOT NULL DEFAULT 'pending',
  name text,
  web_view_link text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  PRIMARY KEY (case_id, artifact_sha256),
  CONSTRAINT docprep_drive_export_state CHECK (state IN ('pending', 'completed')),
  CONSTRAINT docprep_drive_export_sha CHECK (artifact_sha256 ~ '^[a-f0-9]{64}$')
);
