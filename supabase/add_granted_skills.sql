-- ══════════════════════════════════════════════════════════════
-- WHISPER DND — Granted Skills System (มอบพลัง)
-- Admin/DM can grant any skill to any player, bypassing
-- pathway/sequence requirements.
-- ══════════════════════════════════════════════════════════════

-- ┌────────────────────────────────────────────────┐
-- │  1. TABLE: granted_skills                      │
-- │  Skills granted to players by admin/DM         │
-- └────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.granted_skills (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id        uuid        NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  granted_by      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  title           text        NOT NULL,
  detail          text,
  -- Reuse policy: 'once' = single use, 'cooldown' = reusable after cooldown, 'unlimited' = no limit
  reuse_policy    text        NOT NULL DEFAULT 'once' CHECK (reuse_policy IN ('once', 'cooldown', 'unlimited')),
  cooldown_minutes int,       -- only used when reuse_policy = 'cooldown'
  -- Possession duration: NULL = forever
  expires_at      timestamptz,
  -- Effects when used (positive = gain, negative = lose)
  effect_hp               int NOT NULL DEFAULT 0,
  effect_sanity           int NOT NULL DEFAULT 0,
  effect_max_sanity       int NOT NULL DEFAULT 0,
  effect_travel           int NOT NULL DEFAULT 0,
  effect_max_travel       int NOT NULL DEFAULT 0,
  effect_spirituality     int NOT NULL DEFAULT 0,
  effect_max_spirituality int NOT NULL DEFAULT 0,
  effect_potion_digest    int NOT NULL DEFAULT 0,
  -- Tracking
  times_used      int         NOT NULL DEFAULT 0,
  last_used_at    timestamptz,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.granted_skills IS 'สกิลที่ถูกมอบพลังจากทีมงาน — ไม่สนเงื่อนไขเส้นทาง/ลำดับ';
CREATE INDEX IF NOT EXISTS idx_granted_skills_player ON public.granted_skills(player_id);
CREATE INDEX IF NOT EXISTS idx_granted_skills_skill ON public.granted_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_granted_skills_granted_by ON public.granted_skills(granted_by);

-- ┌────────────────────────────────────────────────┐
-- │  2. TABLE: granted_skill_logs                  │
-- │  Audit log for all grant actions               │
-- └────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.granted_skill_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  granted_skill_id uuid      REFERENCES public.granted_skills(id) ON DELETE SET NULL,
  player_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id        uuid        NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  granted_by      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  action          text        NOT NULL CHECK (action IN ('grant', 'use', 'expire', 'revoke')),
  title           text        NOT NULL,
  detail          text,
  effects_json    jsonb,      -- snapshot of effects at time of action
  reference_code  text,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.granted_skill_logs IS 'บันทึกประวัติการมอบพลัง/ใช้งาน/หมดอายุ/เพิกถอน';
CREATE INDEX IF NOT EXISTS idx_granted_skill_logs_player ON public.granted_skill_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_granted_skill_logs_granted_by ON public.granted_skill_logs(granted_by);
CREATE INDEX IF NOT EXISTS idx_granted_skill_logs_action ON public.granted_skill_logs(action);

-- ┌────────────────────────────────────────────────┐
-- │  3. updated_at trigger                         │
-- └────────────────────────────────────────────────┘
DROP TRIGGER IF EXISTS set_updated_at_granted_skills ON public.granted_skills;
CREATE TRIGGER set_updated_at_granted_skills
  BEFORE UPDATE ON public.granted_skills
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ┌────────────────────────────────────────────────┐
-- │  4. ROW LEVEL SECURITY                         │
-- └────────────────────────────────────────────────┘

-- granted_skills
ALTER TABLE public.granted_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own granted_skills"
  ON public.granted_skills FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Admin/DM can view all granted_skills"
  ON public.granted_skills FOR SELECT
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can insert granted_skills"
  ON public.granted_skills FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can update granted_skills"
  ON public.granted_skills FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Players can update own granted_skills (use)"
  ON public.granted_skills FOR UPDATE
  USING (auth.uid() = player_id);

CREATE POLICY "Admin/DM can delete granted_skills"
  ON public.granted_skills FOR DELETE
  USING (public.get_my_role() IN ('admin', 'dm'));

-- granted_skill_logs
ALTER TABLE public.granted_skill_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own granted_skill_logs"
  ON public.granted_skill_logs FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Admin/DM can view all granted_skill_logs"
  ON public.granted_skill_logs FOR SELECT
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can insert granted_skill_logs"
  ON public.granted_skill_logs FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Authenticated can insert own granted_skill_logs"
  ON public.granted_skill_logs FOR INSERT
  WITH CHECK (auth.uid() = player_id);

-- ┌────────────────────────────────────────────────┐
-- │  5. Realtime publication                       │
-- └────────────────────────────────────────────────┘
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'granted_skills') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.granted_skills;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'granted_skill_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.granted_skill_logs;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- DONE — Granted Skills System
-- ══════════════════════════════════════════════════════════════
