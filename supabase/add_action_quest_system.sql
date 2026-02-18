-- ══════════════════════════════════════════════════════════════
-- Action & Quest System + pg_cron auto-approve sleep requests
-- ══════════════════════════════════════════════════════════════
-- RUN THIS FILE FIRST, then run add_action_quest_cron.sql separately

-- ─────────────────────────────────────────────
-- 1. pg_cron: Auto-approve expired sleep requests at midnight
-- ─────────────────────────────────────────────

-- Enable pg_cron extension (Supabase already has it, just enable)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function: auto-approve all pending sleep requests from before today
CREATE OR REPLACE FUNCTION public.auto_approve_expired_sleep_requests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT sr.id, sr.player_id, p.max_spirituality
    FROM public.sleep_requests sr
    JOIN public.profiles p ON p.id = sr.player_id
    WHERE sr.status = 'pending'
      AND sr.created_at < date_trunc('day', now())
  LOOP
    -- Approve the request
    UPDATE public.sleep_requests
    SET status = 'approved',
        reviewed_at = now()
    WHERE id = rec.id;

    -- Reset spirituality to max
    UPDATE public.profiles
    SET spirituality = rec.max_spirituality,
        updated_at = now()
    WHERE id = rec.player_id;
  END LOOP;
END;
$$;


-- ─────────────────────────────────────────────
-- 2. Action Codes — admin generates codes for actions
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.action_codes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  code        text        NOT NULL UNIQUE,
  created_by  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.action_codes ENABLE ROW LEVEL SECURITY;

-- Everyone can read action codes (players need to validate code on submit)
DROP POLICY IF EXISTS "Anyone can view action codes" ON public.action_codes;
CREATE POLICY "Anyone can view action codes"
  ON public.action_codes FOR SELECT
  USING (true);

-- Only admin/DM can create action codes
DROP POLICY IF EXISTS "Admin can insert action codes" ON public.action_codes;
CREATE POLICY "Admin can insert action codes"
  ON public.action_codes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

CREATE INDEX IF NOT EXISTS idx_action_codes_code ON public.action_codes(code);
CREATE INDEX IF NOT EXISTS idx_action_codes_created ON public.action_codes(created_at DESC);


-- ─────────────────────────────────────────────
-- 3. Quest Codes — admin generates codes for quests
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.quest_codes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  code        text        NOT NULL UNIQUE,
  created_by  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quest_codes ENABLE ROW LEVEL SECURITY;

-- Everyone can read quest codes
DROP POLICY IF EXISTS "Anyone can view quest codes" ON public.quest_codes;
CREATE POLICY "Anyone can view quest codes"
  ON public.quest_codes FOR SELECT
  USING (true);

-- Only admin/DM can create quest codes
DROP POLICY IF EXISTS "Admin can insert quest codes" ON public.quest_codes;
CREATE POLICY "Admin can insert quest codes"
  ON public.quest_codes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

CREATE INDEX IF NOT EXISTS idx_quest_codes_code ON public.quest_codes(code);
CREATE INDEX IF NOT EXISTS idx_quest_codes_created ON public.quest_codes(created_at DESC);


-- ─────────────────────────────────────────────
-- 4. Action Submissions — players submit actions
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.action_submissions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_code_id   uuid        NOT NULL REFERENCES public.action_codes(id) ON DELETE CASCADE,
  evidence_urls    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  status           text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.action_submissions ENABLE ROW LEVEL SECURITY;

-- Players see own submissions
DROP POLICY IF EXISTS "Players can view own action submissions" ON public.action_submissions;
CREATE POLICY "Players can view own action submissions"
  ON public.action_submissions FOR SELECT
  USING (auth.uid() = player_id);

-- Admin sees all
DROP POLICY IF EXISTS "Admin can view all action submissions" ON public.action_submissions;
CREATE POLICY "Admin can view all action submissions"
  ON public.action_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

-- NOTE: "Players can view group action submissions" policy is created in
-- add_punishment_system.sql (after punishment tables exist)

-- Players can insert own
DROP POLICY IF EXISTS "Players can insert own action submissions" ON public.action_submissions;
CREATE POLICY "Players can insert own action submissions"
  ON public.action_submissions FOR INSERT
  WITH CHECK (auth.uid() = player_id);

-- Admin can update (approve/reject)
DROP POLICY IF EXISTS "Admin can update action submissions" ON public.action_submissions;
CREATE POLICY "Admin can update action submissions"
  ON public.action_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

CREATE INDEX IF NOT EXISTS idx_action_sub_player ON public.action_submissions(player_id);
CREATE INDEX IF NOT EXISTS idx_action_sub_code ON public.action_submissions(action_code_id);
CREATE INDEX IF NOT EXISTS idx_action_sub_status ON public.action_submissions(status);
CREATE INDEX IF NOT EXISTS idx_action_sub_created ON public.action_submissions(created_at DESC);
ALTER TABLE public.action_submissions REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'action_submissions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.action_submissions;
  END IF;
END $$;


-- ─────────────────────────────────────────────
-- 5. Quest Submissions — players submit quests
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.quest_submissions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quest_code_id    uuid        NOT NULL REFERENCES public.quest_codes(id) ON DELETE CASCADE,
  evidence_urls    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  status           text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quest_submissions ENABLE ROW LEVEL SECURITY;

-- Players see own submissions
DROP POLICY IF EXISTS "Players can view own quest submissions" ON public.quest_submissions;
CREATE POLICY "Players can view own quest submissions"
  ON public.quest_submissions FOR SELECT
  USING (auth.uid() = player_id);

-- Admin sees all
DROP POLICY IF EXISTS "Admin can view all quest submissions" ON public.quest_submissions;
CREATE POLICY "Admin can view all quest submissions"
  ON public.quest_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

-- NOTE: "Players can view group quest submissions" policy is created in
-- add_punishment_system.sql (after punishment tables exist)

-- Players can insert own
DROP POLICY IF EXISTS "Players can insert own quest submissions" ON public.quest_submissions;
CREATE POLICY "Players can insert own quest submissions"
  ON public.quest_submissions FOR INSERT
  WITH CHECK (auth.uid() = player_id);

-- Admin can update (approve/reject)
DROP POLICY IF EXISTS "Admin can update quest submissions" ON public.quest_submissions;
CREATE POLICY "Admin can update quest submissions"
  ON public.quest_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

CREATE INDEX IF NOT EXISTS idx_quest_sub_player ON public.quest_submissions(player_id);
CREATE INDEX IF NOT EXISTS idx_quest_sub_code ON public.quest_submissions(quest_code_id);
CREATE INDEX IF NOT EXISTS idx_quest_sub_status ON public.quest_submissions(status);
CREATE INDEX IF NOT EXISTS idx_quest_sub_created ON public.quest_submissions(created_at DESC);
ALTER TABLE public.quest_submissions REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'quest_submissions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quest_submissions;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.roleplay_submissions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  submitted_date date        NOT NULL DEFAULT (now()::date),
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roleplay_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can view own roleplay submissions" ON public.roleplay_submissions;
CREATE POLICY "Players can view own roleplay submissions"
  ON public.roleplay_submissions FOR SELECT
  USING (auth.uid() = player_id);

DROP POLICY IF EXISTS "Admin can view all roleplay submissions" ON public.roleplay_submissions;
CREATE POLICY "Admin can view all roleplay submissions"
  ON public.roleplay_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

DROP POLICY IF EXISTS "Players can insert own roleplay submissions" ON public.roleplay_submissions;
CREATE POLICY "Players can insert own roleplay submissions"
  ON public.roleplay_submissions FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE INDEX IF NOT EXISTS idx_roleplay_sub_player ON public.roleplay_submissions(player_id);
CREATE INDEX IF NOT EXISTS idx_roleplay_sub_created ON public.roleplay_submissions(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_roleplay_sub_day ON public.roleplay_submissions(player_id, submitted_date);

CREATE TABLE IF NOT EXISTS public.roleplay_links (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid        NOT NULL REFERENCES public.roleplay_submissions(id) ON DELETE CASCADE,
  url           text        NOT NULL,
  digest_level  text        NOT NULL DEFAULT 'pending' CHECK (digest_level IN ('pending', 'none', 'low', 'medium', 'high')),
  digest_percent int        NOT NULL DEFAULT 0,
  digest_note   text,
  reviewed_by   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roleplay_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can view own roleplay links" ON public.roleplay_links;
CREATE POLICY "Players can view own roleplay links"
  ON public.roleplay_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.roleplay_submissions rs
      WHERE rs.id = submission_id AND rs.player_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

DROP POLICY IF EXISTS "Players can insert own roleplay links" ON public.roleplay_links;
CREATE POLICY "Players can insert own roleplay links"
  ON public.roleplay_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.roleplay_submissions rs
      WHERE rs.id = submission_id AND rs.player_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin can update roleplay links" ON public.roleplay_links;
CREATE POLICY "Admin can update roleplay links"
  ON public.roleplay_links FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

CREATE INDEX IF NOT EXISTS idx_roleplay_links_submission ON public.roleplay_links(submission_id);
CREATE INDEX IF NOT EXISTS idx_roleplay_links_created ON public.roleplay_links(created_at DESC);

ALTER TABLE public.roleplay_submissions REPLICA IDENTITY FULL;
ALTER TABLE public.roleplay_links REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'roleplay_submissions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.roleplay_submissions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'roleplay_links') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.roleplay_links;
  END IF;
END $$;
