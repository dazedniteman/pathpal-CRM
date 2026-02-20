-- ============================================================
-- PathPal CRM - Phase 2 Migration
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Email open tracking table
CREATE TABLE IF NOT EXISTS email_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interaction_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own tracking" ON email_tracking;
CREATE POLICY "Users manage own tracking" ON email_tracking
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_email_tracking_interaction ON email_tracking(interaction_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_contact ON email_tracking(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_user ON email_tracking(user_id);

-- 2. Add A/B testing columns to email_templates (created in Phase 1)
ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS variant_group TEXT,
  ADD COLUMN IF NOT EXISTS send_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_count INTEGER DEFAULT 0;

-- 3. Add email tracking opt-in to settings
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS email_tracking_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS supabase_project_ref TEXT;

-- 4. Verify Phase 1 tables exist (safe no-ops if already created)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  ai_context TEXT DEFAULT '',
  photo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own products" ON products;
CREATE POLICY "Users manage own products" ON products
  FOR ALL USING (auth.uid()::text = user_id);

CREATE TABLE IF NOT EXISTS contact_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  received_free BOOLEAN DEFAULT FALSE,
  quantity_purchased INTEGER DEFAULT 0,
  received_at TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contact_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own contact_products" ON contact_products;
CREATE POLICY "Users manage own contact_products" ON contact_products
  FOR ALL USING (auth.uid()::text = user_id);

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_type TEXT DEFAULT 'outreach',
  subject TEXT DEFAULT '',
  body TEXT DEFAULT '',
  variant_group TEXT,
  send_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own email_templates" ON email_templates;
CREATE POLICY "Users manage own email_templates" ON email_templates
  FOR ALL USING (auth.uid()::text = user_id);

-- Done! Run migration_phase2.sql successfully.
SELECT 'Phase 2 migration complete' AS status;
