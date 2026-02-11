-- ══════════════════════════════════════════════════════════════
-- Add Archived (Soft Delete) to Action Codes, Quest Codes, Punishments
-- ══════════════════════════════════════════════════════════════
-- Run AFTER: add_action_quest_system.sql, add_punishment_system.sql

-- 1. Add archived column to action_codes
ALTER TABLE public.action_codes
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_action_codes_archived
  ON public.action_codes(archived) WHERE archived = false;

-- 2. Add archived column to quest_codes
ALTER TABLE public.quest_codes
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_quest_codes_archived
  ON public.quest_codes(archived) WHERE archived = false;

-- 3. Add archived column to punishments
ALTER TABLE public.punishments
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_punishments_archived
  ON public.punishments(archived) WHERE archived = false;

-- 4. RLS UPDATE policies (missing from original migration)
--    action_codes and quest_codes only had SELECT + INSERT policies.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'action_codes' AND policyname = 'Admin can update action codes'
  ) THEN
    CREATE POLICY "Admin can update action codes"
      ON public.action_codes FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'dm')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'dm')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'quest_codes' AND policyname = 'Admin can update quest codes'
  ) THEN
    CREATE POLICY "Admin can update quest codes"
      ON public.quest_codes FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'dm')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'dm')
        )
      );
  END IF;
END
$$;
