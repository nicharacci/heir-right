CREATE TABLE IF NOT EXISTS docprep_estates (
  estate_id text PRIMARY KEY, snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS docprep_cases (
  id uuid PRIMARY KEY, estate_id text NOT NULL REFERENCES docprep_estates(estate_id), state text NOT NULL, revision integer NOT NULL DEFAULT 1,
  blocker text, next_action text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT docprep_case_state CHECK (state IN ('queued','sourcing','review_required','rendering','packet_ready','blocked','failed','cancelled'))
);
CREATE UNIQUE INDEX IF NOT EXISTS docprep_one_active_case_per_estate ON docprep_cases (estate_id) WHERE state NOT IN ('packet_ready','blocked','failed','cancelled');
CREATE TABLE IF NOT EXISTS docprep_events (
  id bigserial PRIMARY KEY, case_id uuid NOT NULL REFERENCES docprep_cases(id), event_type text NOT NULL, state text NOT NULL, detail text NOT NULL,
  actor_email text, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS docprep_steps (
  id text NOT NULL, case_id uuid NOT NULL REFERENCES docprep_cases(id), name text NOT NULL, state text NOT NULL, position integer NOT NULL,
  blocker text, next_action text, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (case_id, id),
  CONSTRAINT docprep_step_state CHECK (state IN ('pending','running','succeeded','review_required','blocked','failed','cancelled'))
);
CREATE TABLE IF NOT EXISTS docprep_idempotency_keys (
  idempotency_key text PRIMARY KEY, fingerprint text NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS docprep_artifacts (
  id uuid PRIMARY KEY, case_id uuid NOT NULL REFERENCES docprep_cases(id), object_key text NOT NULL, object_version text, content_type text NOT NULL,
  bytes bigint NOT NULL, sha256 text NOT NULL, readback_status text NOT NULL, verified_at timestamptz, artifact_url text,
  CONSTRAINT docprep_pdf_artifacts CHECK (content_type = 'application/pdf' AND bytes > 0)
);
CREATE TABLE IF NOT EXISTS docprep_outbox (
  id uuid PRIMARY KEY, case_id uuid NOT NULL REFERENCES docprep_cases(id), topic text NOT NULL, payload jsonb NOT NULL,
  available_at timestamptz NOT NULL DEFAULT now(), claimed_at timestamptz, completed_at timestamptz, attempts integer NOT NULL DEFAULT 0
);
