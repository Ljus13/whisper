-- ══════════════════════════════════════════════════════════════
-- Add bg_url (5:4) and logo_url (1:1) columns to skill_pathways
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.skill_pathways
  ADD COLUMN IF NOT EXISTS bg_url   text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS logo_url text DEFAULT NULL;

COMMENT ON COLUMN public.skill_pathways.bg_url   IS 'Background image URL for the pathway card (recommended 5:4 ratio)';
COMMENT ON COLUMN public.skill_pathways.logo_url IS 'Logo/icon image URL for the pathway (recommended 1:1 square)';

-- ══════════════════════════════════════════════════════════════
-- Add skill_usage_logs table for tracking skill activations
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.skill_usage_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id    uuid        NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  spirit_cost integer     NOT NULL DEFAULT 0,
  used_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.skill_usage_logs ENABLE ROW LEVEL SECURITY;

-- Players can see their own logs
CREATE POLICY "Players can view own usage logs"
  ON public.skill_usage_logs FOR SELECT
  USING (auth.uid() = player_id);

-- Admin/DM can view all logs
CREATE POLICY "Admin can view all usage logs"
  ON public.skill_usage_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

-- Players can insert their own logs
CREATE POLICY "Players can log own usage"
  ON public.skill_usage_logs FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE INDEX IF NOT EXISTS idx_skill_usage_player ON public.skill_usage_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_skill_usage_skill  ON public.skill_usage_logs(skill_id);
