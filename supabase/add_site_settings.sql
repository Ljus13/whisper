-- ══════════════════════════════════════════════════════════════
-- WHISPER DND — Site Settings (Offline / Maintenance Mode)
-- Run this in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ┌────────────────────────────────────────────┐
-- │  1. TABLE: site_settings (singleton row)   │
-- └────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.site_settings (
  id         text        PRIMARY KEY DEFAULT 'main',
  is_offline boolean     NOT NULL DEFAULT false,
  offline_reason text,
  offline_by uuid,
  offline_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_offline_by_fkey FOREIGN KEY (offline_by) REFERENCES auth.users(id)
);

-- Insert the singleton row
INSERT INTO public.site_settings (id) VALUES ('main') ON CONFLICT (id) DO NOTHING;

-- ┌────────────────────────────────────────────┐
-- │  2. RLS: site_settings                     │
-- └────────────────────────────────────────────┘
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Everyone (including anon) can read site settings — needed by middleware & login page
DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;
CREATE POLICY "Anyone can read site settings"
  ON public.site_settings FOR SELECT
  USING (true);

-- Only DM can toggle offline mode
DROP POLICY IF EXISTS "DM can update site settings" ON public.site_settings;
CREATE POLICY "DM can update site settings"
  ON public.site_settings FOR UPDATE
  USING (
    public.get_my_role() = 'dm'
  );

-- No insert/delete from clients (singleton row managed by migration)
DROP POLICY IF EXISTS "No direct insert site settings" ON public.site_settings;
CREATE POLICY "No direct insert site settings"
  ON public.site_settings FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS "No direct delete site settings" ON public.site_settings;
CREATE POLICY "No direct delete site settings"
  ON public.site_settings FOR DELETE
  USING (false);
