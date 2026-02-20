-- ============================================================
-- PathPal CRM - Phase 3 Migration: Follow-up Sequences
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. sequences table
-- steps is a JSONB array of SequenceStep objects:
-- [{ id, day_offset, action_type, description, template_id?, task_title?, note_text? }]
CREATE TABLE IF NOT EXISTS sequences (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT DEFAULT '',
  trigger_stage TEXT,                             -- nullable; pipeline stage that auto-enrolls
  is_active     BOOLEAN DEFAULT TRUE,
  steps         JSONB DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own sequences" ON sequences;
CREATE POLICY "Users manage own sequences" ON sequences
  FOR ALL USING (auth.uid()::text = user_id);

CREATE INDEX IF NOT EXISTS idx_sequences_user    ON sequences(user_id);
CREATE INDEX IF NOT EXISTS idx_sequences_trigger ON sequences(trigger_stage)
  WHERE trigger_stage IS NOT NULL;

-- 2. contact_sequences table
-- Tracks which contacts are enrolled in which sequences and their progress.
-- completed_step_ids is a JSONB array of step id strings.
-- status: 'active' | 'completed' | 'unenrolled'
CREATE TABLE IF NOT EXISTS contact_sequences (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL,
  contact_id          TEXT NOT NULL,
  sequence_id         TEXT NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  enrolled_at         TIMESTAMPTZ DEFAULT NOW(),
  completed_step_ids  JSONB DEFAULT '[]'::jsonb,
  status              TEXT DEFAULT 'active',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contact_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own contact_sequences" ON contact_sequences;
CREATE POLICY "Users manage own contact_sequences" ON contact_sequences
  FOR ALL USING (auth.uid()::text = user_id);

CREATE INDEX IF NOT EXISTS idx_contact_sequences_user    ON contact_sequences(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_sequences_contact ON contact_sequences(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_sequences_seq     ON contact_sequences(sequence_id);
CREATE INDEX IF NOT EXISTS idx_contact_sequences_status  ON contact_sequences(status)
  WHERE status = 'active';

-- Done!
SELECT 'Phase 3 migration complete' AS status;
