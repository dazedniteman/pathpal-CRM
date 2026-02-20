-- ============================================================
-- PathPal CRM - Phase 1 Migration
-- Run this in Supabase Dashboard → SQL Editor
-- https://supabase.com/dashboard/project/hijhiubrqrbbxlghmxmm/sql/new
-- ============================================================

-- 1. Add new columns to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contact_type TEXT DEFAULT 'instructor';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS rich_notes TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS health_score INTEGER;

-- 2. Add new columns to settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS default_ai_model TEXT DEFAULT 'gemini-flash';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS gemini_model TEXT DEFAULT 'gemini-3-flash-preview';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS gmail_ignore_list JSONB DEFAULT '[]'::jsonb;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS newsletter_auto_filter BOOLEAN DEFAULT true;

-- 3. Create products table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  ai_context TEXT,
  photo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create contact_products table (which product each contact has)
CREATE TABLE IF NOT EXISTS contact_products (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  received_free BOOLEAN DEFAULT true,
  quantity_purchased INTEGER DEFAULT 0,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create projects table (reusable project goals)
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  goal TEXT,
  follow_up_frequency_days INTEGER DEFAULT 7,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create contact_projects table (assign projects to contacts)
CREATE TABLE IF NOT EXISTS contact_projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  template_type TEXT,
  subject TEXT,
  body TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create asset_library table (photos and links)
CREATE TABLE IF NOT EXISTS asset_library (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Enable Row Level Security on all new tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_library ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS policies (users can only see their own data)
DO $$
BEGIN
  -- Products
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Users manage own products') THEN
    CREATE POLICY "Users manage own products" ON products FOR ALL USING (auth.uid()::text = user_id);
  END IF;

  -- Contact Products
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contact_products' AND policyname = 'Users manage own contact_products') THEN
    CREATE POLICY "Users manage own contact_products" ON contact_products FOR ALL USING (auth.uid()::text = user_id);
  END IF;

  -- Projects
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Users manage own projects') THEN
    CREATE POLICY "Users manage own projects" ON projects FOR ALL USING (auth.uid()::text = user_id);
  END IF;

  -- Contact Projects
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contact_projects' AND policyname = 'Users manage own contact_projects') THEN
    CREATE POLICY "Users manage own contact_projects" ON contact_projects FOR ALL USING (auth.uid()::text = user_id);
  END IF;

  -- Email Templates
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_templates' AND policyname = 'Users manage own email_templates') THEN
    CREATE POLICY "Users manage own email_templates" ON email_templates FOR ALL USING (auth.uid()::text = user_id);
  END IF;

  -- Asset Library
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asset_library' AND policyname = 'Users manage own asset_library') THEN
    CREATE POLICY "Users manage own asset_library" ON asset_library FOR ALL USING (auth.uid()::text = user_id);
  END IF;
END $$;

-- Done! Verify with:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'contacts' ORDER BY ordinal_position;
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
