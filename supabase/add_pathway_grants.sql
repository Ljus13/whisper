CREATE TABLE IF NOT EXISTS public.pathway_grants (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pathway_id  uuid        NOT NULL REFERENCES public.skill_pathways(id) ON DELETE CASCADE,
  granted_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, pathway_id)
);

CREATE INDEX IF NOT EXISTS idx_pathway_grants_player ON public.pathway_grants(player_id);

ALTER TABLE public.pathway_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own pathway_grants"
  ON public.pathway_grants FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Admin/DM can view all pathway_grants"
  ON public.pathway_grants FOR SELECT
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can insert pathway_grants"
  ON public.pathway_grants FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can delete pathway_grants"
  ON public.pathway_grants FOR DELETE
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Players can delete own pathway_grants"
  ON public.pathway_grants FOR DELETE
  USING (auth.uid() = player_id);
