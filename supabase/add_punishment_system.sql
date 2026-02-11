-- ══════════════════════════════════════════════════════════════
-- Punishment (บทลงโทษ) System
-- ══════════════════════════════════════════════════════════════
-- Run AFTER: add_action_quest_system.sql, add_expiration_repeat.sql

-- ─────────────────────────────────────────────
-- 1. Punishments — บทลงโทษ
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.punishments (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text        NOT NULL,
  description             text,
  -- Penalty values (negative effect on player)
  penalty_sanity          int         NOT NULL DEFAULT 0,
  penalty_hp              int         NOT NULL DEFAULT 0,
  penalty_travel          int         NOT NULL DEFAULT 0,
  penalty_spirituality    int         NOT NULL DEFAULT 0,
  penalty_max_sanity      int         NOT NULL DEFAULT 0,
  penalty_max_travel      int         NOT NULL DEFAULT 0,
  penalty_max_spirituality int        NOT NULL DEFAULT 0,
  -- Deadline
  deadline                timestamptz DEFAULT NULL,
  -- Status
  is_active               boolean     NOT NULL DEFAULT true,
  created_by              uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.punishments ENABLE ROW LEVEL SECURITY;

-- Everyone can read punishments
CREATE POLICY "Anyone can view punishments"
  ON public.punishments FOR SELECT
  USING (true);

-- Admin can create
CREATE POLICY "Admin can insert punishments"
  ON public.punishments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

-- Admin can update
CREATE POLICY "Admin can update punishments"
  ON public.punishments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

-- Admin can delete
CREATE POLICY "Admin can delete punishments"
  ON public.punishments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

CREATE INDEX IF NOT EXISTS idx_punishments_active ON public.punishments(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_punishments_created ON public.punishments(created_at DESC);

-- ─────────────────────────────────────────────
-- 2. Punishment Required Tasks — แอคชั่น/ภารกิจที่ต้องทำ
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.punishment_required_tasks (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  punishment_id   uuid        NOT NULL REFERENCES public.punishments(id) ON DELETE CASCADE,
  -- Either an action_code or quest_code (one must be set)
  action_code_id  uuid        REFERENCES public.action_codes(id) ON DELETE CASCADE,
  quest_code_id   uuid        REFERENCES public.quest_codes(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Constraint: must have exactly one of action_code_id or quest_code_id
  CONSTRAINT chk_task_type CHECK (
    (action_code_id IS NOT NULL AND quest_code_id IS NULL) OR
    (action_code_id IS NULL AND quest_code_id IS NOT NULL)
  )
);

ALTER TABLE public.punishment_required_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view punishment required tasks"
  ON public.punishment_required_tasks FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert punishment required tasks"
  ON public.punishment_required_tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

CREATE POLICY "Admin can delete punishment required tasks"
  ON public.punishment_required_tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

CREATE INDEX IF NOT EXISTS idx_prt_punishment ON public.punishment_required_tasks(punishment_id);
CREATE INDEX IF NOT EXISTS idx_prt_action ON public.punishment_required_tasks(action_code_id) WHERE action_code_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prt_quest ON public.punishment_required_tasks(quest_code_id) WHERE quest_code_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- 3. Punishment Assigned Players — ผู้เล่นที่ต้องเข้าร่วม
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.punishment_players (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  punishment_id   uuid        NOT NULL REFERENCES public.punishments(id) ON DELETE CASCADE,
  player_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Has the player completed all required tasks?
  is_completed    boolean     NOT NULL DEFAULT false,
  -- Has the penalty been applied?
  penalty_applied boolean     NOT NULL DEFAULT false,
  -- Mercy request (ขอเทพเมตตา)
  mercy_requested boolean     NOT NULL DEFAULT false,
  mercy_requested_at timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(punishment_id, player_id)
);

ALTER TABLE public.punishment_players ENABLE ROW LEVEL SECURITY;

-- Players see own punishment assignments
CREATE POLICY "Players can view own punishment players"
  ON public.punishment_players FOR SELECT
  USING (auth.uid() = player_id);

-- Admin sees all
CREATE POLICY "Admin can view all punishment players"
  ON public.punishment_players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

-- Admin can insert
CREATE POLICY "Admin can insert punishment players"
  ON public.punishment_players FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

-- Admin can update
CREATE POLICY "Admin can update punishment players"
  ON public.punishment_players FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

-- Players can update own (for mercy request)
CREATE POLICY "Players can update own punishment players"
  ON public.punishment_players FOR UPDATE
  USING (auth.uid() = player_id);

CREATE INDEX IF NOT EXISTS idx_pp_punishment ON public.punishment_players(punishment_id);
CREATE INDEX IF NOT EXISTS idx_pp_player ON public.punishment_players(player_id);
CREATE INDEX IF NOT EXISTS idx_pp_completed ON public.punishment_players(is_completed) WHERE is_completed = false;

-- ─────────────────────────────────────────────
-- 4. Punishment Logs — บันทึกบทลงโทษ
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.punishment_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  punishment_id   uuid        NOT NULL REFERENCES public.punishments(id) ON DELETE CASCADE,
  player_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action          text        NOT NULL, -- 'penalty_applied', 'mercy_granted', 'completed', 'expired'
  details         jsonb       DEFAULT '{}'::jsonb,
  created_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.punishment_logs ENABLE ROW LEVEL SECURITY;

-- Players see own logs
CREATE POLICY "Players can view own punishment logs"
  ON public.punishment_logs FOR SELECT
  USING (auth.uid() = player_id);

-- Admin sees all
CREATE POLICY "Admin can view all punishment logs"
  ON public.punishment_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

-- Admin can insert
CREATE POLICY "Admin can insert punishment logs"
  ON public.punishment_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

-- System inserts (via player updates)
CREATE POLICY "Players can insert own punishment logs"
  ON public.punishment_logs FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE INDEX IF NOT EXISTS idx_pl_punishment ON public.punishment_logs(punishment_id);
CREATE INDEX IF NOT EXISTS idx_pl_player ON public.punishment_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_pl_created ON public.punishment_logs(created_at DESC);
