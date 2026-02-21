-- ============================================================
-- PathPal CRM - Phase 5 Migration: Fan Score + Gemini API Key
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Fan / enthusiasm score for partner and customer contacts (1-5 stars)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS fan_score INTEGER CHECK (fan_score BETWEEN 1 AND 5);

-- 2. Gemini API key in settings (stored encrypted at rest by Supabase)
--    Note: the app also stores this in localStorage as a fallback.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;

-- 3. Last sync timestamps in settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS last_gmail_sync_at TIMESTAMPTZ;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS last_bulk_sync_at TIMESTAMPTZ;

-- Done!
SELECT 'Phase 5 migration complete' AS status;
