-- ══════════════════════════════════════════════════════
-- TIMELINE: Moderators, Participants & Event Punishments
-- ══════════════════════════════════════════════════════
-- Run AFTER: add_timeline_system.sql, add_punishment_system.sql

-- ─────────────────────────────────────────────
-- 1. Side Story Moderators (ผู้ดำเนินเหตุการณ์ — admin/dm only)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.timeline_side_story_moderators (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  side_story_id   uuid NOT NULL REFERENCES public.timeline_side_stories(id) ON DELETE CASCADE,
  profile_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(side_story_id, profile_id)
);

ALTER TABLE public.timeline_side_story_moderators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeline_side_moderators_read" ON public.timeline_side_story_moderators
  FOR SELECT USING (true);

CREATE POLICY "timeline_side_moderators_insert_admin" ON public.timeline_side_story_moderators
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

CREATE POLICY "timeline_side_moderators_delete_admin" ON public.timeline_side_story_moderators
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

CREATE INDEX IF NOT EXISTS idx_side_moderators_side ON public.timeline_side_story_moderators(side_story_id);

-- ─────────────────────────────────────────────
-- 2. Side Story Participants (ผู้ร่วมเหตุการณ์ — all players)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.timeline_side_story_participants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  side_story_id   uuid NOT NULL REFERENCES public.timeline_side_stories(id) ON DELETE CASCADE,
  profile_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(side_story_id, profile_id)
);

ALTER TABLE public.timeline_side_story_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeline_side_participants_read" ON public.timeline_side_story_participants
  FOR SELECT USING (true);

CREATE POLICY "timeline_side_participants_insert_admin" ON public.timeline_side_story_participants
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

CREATE POLICY "timeline_side_participants_delete_admin" ON public.timeline_side_story_participants
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

CREATE INDEX IF NOT EXISTS idx_side_participants_side ON public.timeline_side_story_participants(side_story_id);

-- ─────────────────────────────────────────────
-- 3. Sub Story Moderators (ผู้ดำเนินเหตุการณ์ — admin/dm only)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.timeline_sub_story_moderators (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_story_id    uuid NOT NULL REFERENCES public.timeline_sub_stories(id) ON DELETE CASCADE,
  profile_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sub_story_id, profile_id)
);

ALTER TABLE public.timeline_sub_story_moderators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeline_sub_moderators_read" ON public.timeline_sub_story_moderators
  FOR SELECT USING (true);

CREATE POLICY "timeline_sub_moderators_insert_admin" ON public.timeline_sub_story_moderators
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

CREATE POLICY "timeline_sub_moderators_delete_admin" ON public.timeline_sub_story_moderators
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

CREATE INDEX IF NOT EXISTS idx_sub_moderators_sub ON public.timeline_sub_story_moderators(sub_story_id);

-- ─────────────────────────────────────────────
-- 4. Sub Story Participants (ผู้ร่วมเหตุการณ์ — all players)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.timeline_sub_story_participants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_story_id    uuid NOT NULL REFERENCES public.timeline_sub_stories(id) ON DELETE CASCADE,
  profile_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sub_story_id, profile_id)
);

ALTER TABLE public.timeline_sub_story_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeline_sub_participants_read" ON public.timeline_sub_story_participants
  FOR SELECT USING (true);

CREATE POLICY "timeline_sub_participants_insert_admin" ON public.timeline_sub_story_participants
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

CREATE POLICY "timeline_sub_participants_delete_admin" ON public.timeline_sub_story_participants
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

CREATE INDEX IF NOT EXISTS idx_sub_participants_sub ON public.timeline_sub_story_participants(sub_story_id);

-- ─────────────────────────────────────────────
-- 5. Side Story → Punishment links (เหตุการณ์ที่มี quest/punishment)
--    ใช้สำหรับสร้าง Event Story node อัตโนมัติ
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.timeline_side_story_punishments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  side_story_id   uuid NOT NULL REFERENCES public.timeline_side_stories(id) ON DELETE CASCADE,
  punishment_id   uuid NOT NULL REFERENCES public.punishments(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(side_story_id, punishment_id)
);

ALTER TABLE public.timeline_side_story_punishments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeline_side_punishments_read" ON public.timeline_side_story_punishments
  FOR SELECT USING (true);

CREATE POLICY "timeline_side_punishments_insert_admin" ON public.timeline_side_story_punishments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

CREATE POLICY "timeline_side_punishments_update_admin" ON public.timeline_side_story_punishments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

CREATE POLICY "timeline_side_punishments_delete_admin" ON public.timeline_side_story_punishments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

CREATE INDEX IF NOT EXISTS idx_side_punishments_side ON public.timeline_side_story_punishments(side_story_id);
CREATE INDEX IF NOT EXISTS idx_side_punishments_punishment ON public.timeline_side_story_punishments(punishment_id);

-- ─────────────────────────────────────────────
-- 6. Event Story position tracking (for drag positioning on canvas)
-- ─────────────────────────────────────────────
ALTER TABLE public.timeline_side_story_punishments
  ADD COLUMN IF NOT EXISTS position_x float NOT NULL DEFAULT 0;
ALTER TABLE public.timeline_side_story_punishments
  ADD COLUMN IF NOT EXISTS position_y float NOT NULL DEFAULT 0;
