-- ══════════════════════════════════════════════════════════════════
-- STORY STATUS — เพิ่ม status ให้ Timeline / Side Story / Sub Story
-- สถานะ: null = ไม่ระบุ | 'running' = กำลังดำเนิน | 'end' = จบแล้ว | 'failed' = ล้มเหลว
-- ══════════════════════════════════════════════════════════════════

-- 1. Main Timeline Entries
ALTER TABLE timeline_entries
  ADD COLUMN IF NOT EXISTS status text
  CONSTRAINT timeline_entries_status_check CHECK (status IN ('running', 'end', 'failed'));

-- 2. Side Stories
ALTER TABLE timeline_side_stories
  ADD COLUMN IF NOT EXISTS status text
  CONSTRAINT timeline_side_stories_status_check CHECK (status IN ('running', 'end', 'failed'));

-- 3. Sub Stories
ALTER TABLE timeline_sub_stories
  ADD COLUMN IF NOT EXISTS status text
  CONSTRAINT timeline_sub_stories_status_check CHECK (status IN ('running', 'end', 'failed'));

-- ── Indexes for filtering by status ──
CREATE INDEX IF NOT EXISTS idx_timeline_entries_status       ON timeline_entries(status)       WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_timeline_side_stories_status  ON timeline_side_stories(status)  WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_timeline_sub_stories_status   ON timeline_sub_stories(status)   WHERE status IS NOT NULL;
