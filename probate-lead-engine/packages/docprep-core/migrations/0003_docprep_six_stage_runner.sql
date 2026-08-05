ALTER TABLE docprep_events
  ADD COLUMN stage_id text,
  ADD CONSTRAINT docprep_event_stage_id CHECK (
    stage_id IS NULL OR stage_id IN (
      'skip_trace_parse',
      'obituary_search',
      'deed_title_search',
      'tax_receipt_fetch',
      'court_records_search',
      'backstory_generate'
    )
  );

ALTER TABLE docprep_steps
  ADD COLUMN detail text,
  ADD COLUMN evidence_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN started_at timestamptz,
  ADD COLUMN finished_at timestamptz;

DELETE FROM docprep_steps
WHERE id IN ('source-review', 'legal-review');

UPDATE docprep_steps SET position = 6 WHERE id = 'packet-render';
UPDATE docprep_steps SET position = 7 WHERE id = 'artifact-readback';

INSERT INTO docprep_steps (id, case_id, name, state, position, blocker, next_action, started_at, finished_at)
SELECT stage.id, cases.id, stage.name,
  CASE
    WHEN cases.state IN ('rendering', 'packet_ready') THEN 'succeeded'
    WHEN cases.state = 'cancelled' THEN 'cancelled'
    WHEN stage.position = 0 AND cases.state IN ('review_required', 'blocked', 'failed') THEN cases.state
    ELSE 'pending'
  END,
  stage.position,
  CASE WHEN stage.position = 0 AND cases.state IN ('review_required', 'blocked', 'failed') THEN cases.blocker END,
  CASE WHEN stage.position = 0 AND cases.state IN ('review_required', 'blocked', 'failed') THEN cases.next_action END,
  CASE WHEN cases.state IN ('rendering', 'packet_ready') THEN cases.created_at END,
  CASE WHEN cases.state IN ('rendering', 'packet_ready') THEN cases.updated_at END
FROM docprep_cases cases
CROSS JOIN (VALUES
  ('skip_trace_parse', 'Parsing Skip Trace Report', 0),
  ('obituary_search', 'Searching Obituary', 1),
  ('deed_title_search', 'Searching for Deeds or Titles', 2),
  ('tax_receipt_fetch', 'Fetching Tax Receipt', 3),
  ('court_records_search', 'Searching Court Records', 4),
  ('backstory_generate', 'Generating Back Story', 5)
) AS stage(id, name, position)
ON CONFLICT (case_id, id) DO NOTHING;
