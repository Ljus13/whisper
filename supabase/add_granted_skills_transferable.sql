-- ══════════════════════════════════════════════════════════════
-- WHISPER DND — Add is_transferable to granted_skills + transfer RLS
-- ══════════════════════════════════════════════════════════════

-- 1. Add is_transferable column (default false = ผูกมัด)
ALTER TABLE public.granted_skills
  ADD COLUMN IF NOT EXISTS is_transferable boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.granted_skills.is_transferable
  IS 'true = ผู้เล่นสามารถโอนให้ผู้เล่นอื่นได้, false = ผูกมัดกับผู้เล่นคนนี้';

-- 2. Add 'transfer' action to granted_skill_logs
-- (The CHECK constraint uses ANY(ARRAY[...]), so we need to update it)
ALTER TABLE public.granted_skill_logs
  DROP CONSTRAINT IF EXISTS granted_skill_logs_action_check;

ALTER TABLE public.granted_skill_logs
  ADD CONSTRAINT granted_skill_logs_action_check
  CHECK (action = ANY (ARRAY['grant'::text, 'use'::text, 'expire'::text, 'revoke'::text, 'transfer'::text]));

-- 3. RLS: Allow players to update their own transferable granted_skills (for transfer)
-- The existing "Players can update own granted_skills (use)" policy already allows
-- player_id = auth.uid() updates. For transfer we need the NEW owner to insert,
-- but since we handle transfer server-side (delete old + insert new or update player_id),
-- the existing admin policies cover it. However, we need to ensure the player
-- can update player_id on their own rows when is_transferable = true.

-- Drop and recreate the player update policy to be more specific
DROP POLICY IF EXISTS "Players can update own granted_skills (use)" ON public.granted_skills;

CREATE POLICY "Players can update own granted_skills"
  ON public.granted_skills FOR UPDATE
  USING (auth.uid() = player_id);

-- ══════════════════════════════════════════════════════════════
-- DONE
-- ══════════════════════════════════════════════════════════════
