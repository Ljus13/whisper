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
  event_mode              text        NOT NULL DEFAULT 'solo' CHECK (event_mode IN ('solo', 'group')),
  group_mode              text        NOT NULL DEFAULT 'all' CHECK (group_mode IN ('all', 'shared')),
  primary_submitter_id    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
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

-- If table already existed, add new columns
ALTER TABLE public.punishments ADD COLUMN IF NOT EXISTS event_mode text NOT NULL DEFAULT 'solo';
ALTER TABLE public.punishments ADD COLUMN IF NOT EXISTS group_mode text NOT NULL DEFAULT 'all';
ALTER TABLE public.punishments ADD COLUMN IF NOT EXISTS primary_submitter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add CHECK constraints if they don't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'punishments_event_mode_check'
  ) THEN
    ALTER TABLE public.punishments ADD CONSTRAINT punishments_event_mode_check CHECK (event_mode IN ('solo', 'group'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'punishments_group_mode_check'
  ) THEN
    ALTER TABLE public.punishments ADD CONSTRAINT punishments_group_mode_check CHECK (group_mode IN ('all', 'shared'));
  END IF;
END $$;

ALTER TABLE public.punishments ENABLE ROW LEVEL SECURITY;

-- Everyone can read punishments
DROP POLICY IF EXISTS "Anyone can view punishments" ON public.punishments;
CREATE POLICY "Anyone can view punishments"
  ON public.punishments FOR SELECT
  USING (true);

-- Admin can create
DROP POLICY IF EXISTS "Admin can insert punishments" ON public.punishments;
CREATE POLICY "Admin can insert punishments"
  ON public.punishments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

-- Admin can update
DROP POLICY IF EXISTS "Admin can update punishments" ON public.punishments;
CREATE POLICY "Admin can update punishments"
  ON public.punishments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

-- Admin can delete
DROP POLICY IF EXISTS "Admin can delete punishments" ON public.punishments;
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

DROP POLICY IF EXISTS "Anyone can view punishment required tasks" ON public.punishment_required_tasks;
CREATE POLICY "Anyone can view punishment required tasks"
  ON public.punishment_required_tasks FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin can insert punishment required tasks" ON public.punishment_required_tasks;
CREATE POLICY "Admin can insert punishment required tasks"
  ON public.punishment_required_tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

DROP POLICY IF EXISTS "Admin can delete punishment required tasks" ON public.punishment_required_tasks;
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

-- Helper function: check if user belongs to a punishment (bypasses RLS to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_player_in_punishment(p_punishment_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.punishment_players
    WHERE punishment_id = p_punishment_id AND player_id = p_user_id
  );
$$;

-- Players see own punishment assignments
DROP POLICY IF EXISTS "Players can view own punishment players" ON public.punishment_players;
CREATE POLICY "Players can view own punishment players"
  ON public.punishment_players FOR SELECT
  USING (auth.uid() = player_id);

-- Admin sees all
DROP POLICY IF EXISTS "Admin can view all punishment players" ON public.punishment_players;
CREATE POLICY "Admin can view all punishment players"
  ON public.punishment_players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

-- Players can see other players in the same punishment (uses SECURITY DEFINER function to avoid recursion)
DROP POLICY IF EXISTS "Players can view punishment players in same punishment" ON public.punishment_players;
CREATE POLICY "Players can view punishment players in same punishment"
  ON public.punishment_players FOR SELECT
  USING (public.is_player_in_punishment(punishment_id, auth.uid()));

-- Admin can insert
DROP POLICY IF EXISTS "Admin can insert punishment players" ON public.punishment_players;
CREATE POLICY "Admin can insert punishment players"
  ON public.punishment_players FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

-- Admin can update
DROP POLICY IF EXISTS "Admin can update punishment players" ON public.punishment_players;
CREATE POLICY "Admin can update punishment players"
  ON public.punishment_players FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

-- Players can update own (for mercy request)
DROP POLICY IF EXISTS "Players can update own punishment players" ON public.punishment_players;
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
DROP POLICY IF EXISTS "Players can view own punishment logs" ON public.punishment_logs;
CREATE POLICY "Players can view own punishment logs"
  ON public.punishment_logs FOR SELECT
  USING (auth.uid() = player_id);

-- Admin sees all
DROP POLICY IF EXISTS "Admin can view all punishment logs" ON public.punishment_logs;
CREATE POLICY "Admin can view all punishment logs"
  ON public.punishment_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

-- Admin can insert
DROP POLICY IF EXISTS "Admin can insert punishment logs" ON public.punishment_logs;
CREATE POLICY "Admin can insert punishment logs"
  ON public.punishment_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

-- System inserts (via player updates)
DROP POLICY IF EXISTS "Players can insert own punishment logs" ON public.punishment_logs;
CREATE POLICY "Players can insert own punishment logs"
  ON public.punishment_logs FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE INDEX IF NOT EXISTS idx_pl_punishment ON public.punishment_logs(punishment_id);
CREATE INDEX IF NOT EXISTS idx_pl_player ON public.punishment_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_pl_created ON public.punishment_logs(created_at DESC);

ALTER TABLE public.punishments REPLICA IDENTITY FULL;
ALTER TABLE public.punishment_players REPLICA IDENTITY FULL;
ALTER TABLE public.punishment_required_tasks REPLICA IDENTITY FULL;
ALTER TABLE public.punishment_logs REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'punishments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.punishments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'punishment_players') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.punishment_players;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'punishment_required_tasks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.punishment_required_tasks;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'punishment_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.punishment_logs;
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 5. RPC: Check punishment task completion (bypasses RLS)
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_punishment_task_completion(
  p_punishment_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_event_mode text;
  v_group_mode text;
  v_created_at timestamptz;
  v_task record;
  v_total int := 0;
  v_done int := 0;
  v_assigned_ids uuid[];
BEGIN
  -- Get punishment info
  SELECT event_mode, group_mode, created_at INTO v_event_mode, v_group_mode, v_created_at
  FROM public.punishments WHERE id = p_punishment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allCompleted', false, 'done', 0, 'total', 0);
  END IF;

  -- Get assigned player IDs
  SELECT array_agg(player_id) INTO v_assigned_ids
  FROM public.punishment_players WHERE punishment_id = p_punishment_id;

  IF v_assigned_ids IS NULL THEN
    RETURN jsonb_build_object('allCompleted', false, 'done', 0, 'total', 0);
  END IF;

  -- Check each required task
  FOR v_task IN
    SELECT action_code_id, quest_code_id
    FROM public.punishment_required_tasks
    WHERE punishment_id = p_punishment_id
  LOOP
    v_total := v_total + 1;

    IF v_event_mode = 'group' AND v_group_mode = 'shared' THEN
      -- Shared: any assigned player's approved submission counts
      IF v_task.action_code_id IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM public.action_submissions
          WHERE action_code_id = v_task.action_code_id
            AND player_id = ANY(v_assigned_ids)
            AND status = 'approved'
            AND created_at >= v_created_at
        ) THEN
          v_done := v_done + 1;
        END IF;
      ELSIF v_task.quest_code_id IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM public.quest_submissions
          WHERE quest_code_id = v_task.quest_code_id
            AND player_id = ANY(v_assigned_ids)
            AND status = 'approved'
            AND created_at >= v_created_at
        ) THEN
          v_done := v_done + 1;
        END IF;
      END IF;
    ELSE
      -- Solo / group-all: only the specific user's submissions count
      IF v_task.action_code_id IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM public.action_submissions
          WHERE action_code_id = v_task.action_code_id
            AND player_id = p_user_id
            AND status = 'approved'
            AND created_at >= v_created_at
        ) THEN
          v_done := v_done + 1;
        END IF;
      ELSIF v_task.quest_code_id IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM public.quest_submissions
          WHERE quest_code_id = v_task.quest_code_id
            AND player_id = p_user_id
            AND status = 'approved'
            AND created_at >= v_created_at
        ) THEN
          v_done := v_done + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('allCompleted', v_done >= v_total AND v_total > 0, 'done', v_done, 'total', v_total);
END;
$$;

-- ─────────────────────────────────────────────
-- 5b. RPC: Complete shared punishment for all players (bypasses RLS)
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.complete_shared_punishment(
  p_punishment_id uuid,
  p_submitted_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_affected int;
  v_player_ids uuid[];
BEGIN
  UPDATE public.punishment_players
  SET mercy_requested = true,
      mercy_requested_at = v_now,
      is_completed = true,
      completed_at = v_now
  WHERE punishment_id = p_punishment_id
    AND mercy_requested = false;

  GET DIAGNOSTICS v_affected = ROW_COUNT;

  UPDATE public.punishments
  SET primary_submitter_id = p_submitted_by
  WHERE id = p_punishment_id
    AND primary_submitter_id IS NULL;

  SELECT array_agg(player_id) INTO v_player_ids
  FROM public.punishment_players
  WHERE punishment_id = p_punishment_id;

  IF v_player_ids IS NOT NULL THEN
    INSERT INTO public.punishment_logs (punishment_id, player_id, action, details, created_by)
    SELECT p_punishment_id, unnest(v_player_ids), 'mercy_requested',
           jsonb_build_object('mode', 'group_shared', 'primary_submitter_id', p_submitted_by),
           p_submitted_by;
  END IF;

  RETURN jsonb_build_object('success', true, 'updated', v_affected);
END;
$$;

-- ─────────────────────────────────────────────
-- 6. Group-view policies for action/quest submissions
--    (created here because they reference punishment tables)
-- ─────────────────────────────────────────────

-- Helper function: check if user is in any punishment that requires a given action_code
CREATE OR REPLACE FUNCTION public.is_player_in_punishment_for_action(p_action_code_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.punishment_required_tasks prt
    JOIN public.punishment_players pp ON pp.punishment_id = prt.punishment_id
    WHERE prt.action_code_id = p_action_code_id AND pp.player_id = p_user_id
  );
$$;

-- Helper function: check if user is in any punishment that requires a given quest_code
CREATE OR REPLACE FUNCTION public.is_player_in_punishment_for_quest(p_quest_code_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.punishment_required_tasks prt
    JOIN public.punishment_players pp ON pp.punishment_id = prt.punishment_id
    WHERE prt.quest_code_id = p_quest_code_id AND pp.player_id = p_user_id
  );
$$;

DROP POLICY IF EXISTS "Players can view group action submissions" ON public.action_submissions;
CREATE POLICY "Players can view group action submissions"
  ON public.action_submissions FOR SELECT
  USING (public.is_player_in_punishment_for_action(action_code_id, auth.uid()));

DROP POLICY IF EXISTS "Players can view group quest submissions" ON public.quest_submissions;
CREATE POLICY "Players can view group quest submissions"
  ON public.quest_submissions FOR SELECT
  USING (public.is_player_in_punishment_for_quest(quest_code_id, auth.uid()));
