-- ═══════════════════════════════════════════════════════════
-- Maintenance Mode — site_settings table
-- ═══════════════════════════════════════════════════════════

-- Key-value configuration table
CREATE TABLE IF NOT EXISTS site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon / not-logged-in) can read settings
CREATE POLICY "Anyone can read site_settings"
  ON site_settings FOR SELECT
  USING (true);

-- Only DM can insert new settings
CREATE POLICY "DM can insert site_settings"
  ON site_settings FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'dm')
  );

-- Only DM can update settings
CREATE POLICY "DM can update site_settings"
  ON site_settings FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'dm')
  );

-- Seed default maintenance_mode = off
INSERT INTO site_settings (key, value)
VALUES ('maintenance_mode', '{"enabled": false, "web_note": ""}')
ON CONFLICT (key) DO NOTHING;
