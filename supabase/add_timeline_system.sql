-- ══════════════════════════════════════════════════════
-- TIMELINE SYSTEM — Story Timeline for Events/Campaigns
-- ══════════════════════════════════════════════════════

-- 1. Main Timeline entries (vertical story flow)
CREATE TABLE IF NOT EXISTS timeline_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text,                 -- short summary shown on card
  full_detail   text,                 -- full detail shown on expand
  goal          text,                 -- story goal/objective
  image_url     text,                 -- 5:4 aspect ratio image
  sort_order    int NOT NULL DEFAULT 0,
  started_at    date,                  -- ช่วงวันเริ่มต้น
  ended_at      date,                  -- ช่วงวันสิ้นสุด
  is_published  boolean NOT NULL DEFAULT false, -- publish/hide toggle
  created_by    uuid REFERENCES profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 2. Side Stories (linked to a main timeline entry)
CREATE TABLE IF NOT EXISTS timeline_side_stories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id     uuid NOT NULL REFERENCES timeline_entries(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  full_detail     text,
  goal            text,
  image_url       text,
  position_x      float NOT NULL DEFAULT 0,  -- free drag position X (offset from timeline)
  position_y      float NOT NULL DEFAULT 0,  -- free drag position Y (offset from linked entry)
  sort_order      int NOT NULL DEFAULT 0,
  started_at      date,
  ended_at        date,
  is_published    boolean NOT NULL DEFAULT false,
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 3. Sub Stories (linked to a side story only)
CREATE TABLE IF NOT EXISTS timeline_sub_stories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  side_story_id   uuid NOT NULL REFERENCES timeline_side_stories(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  full_detail     text,
  goal            text,
  image_url       text,
  position_x      float NOT NULL DEFAULT 0,
  position_y      float NOT NULL DEFAULT 0,
  sort_order      int NOT NULL DEFAULT 0,
  started_at      date,
  ended_at        date,
  is_published    boolean NOT NULL DEFAULT false,
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_timeline_entries_sort ON timeline_entries(sort_order);
CREATE INDEX IF NOT EXISTS idx_timeline_side_stories_timeline ON timeline_side_stories(timeline_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_timeline_sub_stories_side ON timeline_sub_stories(side_story_id, sort_order);

-- ── RLS Policies ──
ALTER TABLE timeline_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_side_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_sub_stories ENABLE ROW LEVEL SECURITY;

-- Everyone can read published entries
CREATE POLICY "timeline_entries_read_published" ON timeline_entries
  FOR SELECT USING (
    is_published = true
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

CREATE POLICY "timeline_side_stories_read_published" ON timeline_side_stories
  FOR SELECT USING (
    is_published = true
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

CREATE POLICY "timeline_sub_stories_read_published" ON timeline_sub_stories
  FOR SELECT USING (
    is_published = true
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

-- Only admin/dm can insert
CREATE POLICY "timeline_entries_insert_admin" ON timeline_entries
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

CREATE POLICY "timeline_side_stories_insert_admin" ON timeline_side_stories
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

CREATE POLICY "timeline_sub_stories_insert_admin" ON timeline_sub_stories
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

-- Only admin/dm can update
CREATE POLICY "timeline_entries_update_admin" ON timeline_entries
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

CREATE POLICY "timeline_side_stories_update_admin" ON timeline_side_stories
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

CREATE POLICY "timeline_sub_stories_update_admin" ON timeline_sub_stories
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

-- Only admin/dm can delete
CREATE POLICY "timeline_entries_delete_admin" ON timeline_entries
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

CREATE POLICY "timeline_side_stories_delete_admin" ON timeline_side_stories
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

CREATE POLICY "timeline_sub_stories_delete_admin" ON timeline_sub_stories
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

-- ── Updated_at trigger ──
CREATE OR REPLACE FUNCTION update_timeline_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_timeline_entries_updated
  BEFORE UPDATE ON timeline_entries
  FOR EACH ROW EXECUTE FUNCTION update_timeline_updated_at();

CREATE TRIGGER trg_timeline_side_stories_updated
  BEFORE UPDATE ON timeline_side_stories
  FOR EACH ROW EXECUTE FUNCTION update_timeline_updated_at();

CREATE TRIGGER trg_timeline_sub_stories_updated
  BEFORE UPDATE ON timeline_sub_stories
  FOR EACH ROW EXECUTE FUNCTION update_timeline_updated_at();
