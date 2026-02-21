-- ============================================================
-- PathPal CRM - Phase 4 Migration: Additional Fields
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Additional email addresses per contact
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS additional_emails JSONB DEFAULT '[]'::jsonb;

-- 2. Stop follow-up flag (pause without deleting)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS stop_follow_up BOOLEAN DEFAULT false;

-- Done!
SELECT 'Phase 4 migration complete' AS status;
