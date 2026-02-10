-- ═══════════════════════════════════════════════════════════
-- Religion & Church System — Whisper DND
-- Adds religions, churches (on maps), player religion, and prayer logs
-- ═══════════════════════════════════════════════════════════

-- 1. Religions table
CREATE TABLE IF NOT EXISTS religions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_th    text NOT NULL,          -- ชื่อไทย
  name_en    text NOT NULL,          -- ชื่ออังกฤษ
  deity_th   text,                   -- ชื่อเทพ (ไทย)
  deity_en   text,                   -- ชื่อเทพ (อังกฤษ)
  overview   text,                   -- เกริ่นนำ
  teachings  text,                   -- หลักคำสอน
  bg_url     text,                   -- แบ็คกราวด์
  logo_url   text,                   -- โลโก้ศาสนา
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Add religion_id to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS religion_id uuid REFERENCES religions(id) ON DELETE SET NULL;

-- 3. Churches on maps (placed like tokens)
CREATE TABLE IF NOT EXISTS map_churches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id      uuid NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  religion_id uuid NOT NULL REFERENCES religions(id) ON DELETE CASCADE,
  position_x  float NOT NULL DEFAULT 50,
  position_y  float NOT NULL DEFAULT 50,
  radius      float NOT NULL DEFAULT 10,  -- operating range in % of map
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 4. Prayer logs
CREATE TABLE IF NOT EXISTS prayer_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   uuid NOT NULL REFERENCES auth.users(id),
  church_id   uuid NOT NULL REFERENCES map_churches(id) ON DELETE CASCADE,
  evidence_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  sanity_gained int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 5. RLS policies

ALTER TABLE religions ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_logs ENABLE ROW LEVEL SECURITY;

-- Religions: everyone can read, admin/dm can write
CREATE POLICY "religions_select" ON religions FOR SELECT USING (true);
CREATE POLICY "religions_insert" ON religions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','dm'))
);
CREATE POLICY "religions_update" ON religions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','dm'))
);
CREATE POLICY "religions_delete" ON religions FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','dm'))
);

-- Map churches: everyone can read, admin/dm can write
CREATE POLICY "churches_select" ON map_churches FOR SELECT USING (true);
CREATE POLICY "churches_insert" ON map_churches FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','dm'))
);
CREATE POLICY "churches_update" ON map_churches FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','dm'))
);
CREATE POLICY "churches_delete" ON map_churches FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','dm'))
);

-- Prayer logs: everyone can read, anyone can insert their own
CREATE POLICY "prayer_select" ON prayer_logs FOR SELECT USING (true);
CREATE POLICY "prayer_insert" ON prayer_logs FOR INSERT WITH CHECK (auth.uid() = player_id);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_map_churches_map ON map_churches(map_id);
CREATE INDEX IF NOT EXISTS idx_map_churches_religion ON map_churches(religion_id);
CREATE INDEX IF NOT EXISTS idx_prayer_logs_player ON prayer_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_prayer_logs_created ON prayer_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_religion ON profiles(religion_id);

-- 7. Realtime for churches (so map updates live)
ALTER PUBLICATION supabase_realtime ADD TABLE map_churches;
