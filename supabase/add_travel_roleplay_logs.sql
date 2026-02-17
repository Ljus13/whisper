CREATE TABLE IF NOT EXISTS public.travel_roleplay_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_id        uuid        REFERENCES public.map_tokens(id) ON DELETE SET NULL,
  from_map_id     uuid        REFERENCES public.maps(id) ON DELETE SET NULL,
  to_map_id       uuid        REFERENCES public.maps(id) ON DELETE SET NULL,
  from_x          float,
  from_y          float,
  to_x            float,
  to_y            float,
  origin_url      text        NOT NULL,
  destination_url text        NOT NULL,
  move_type       text        NOT NULL DEFAULT 'same_map'
                              CHECK (move_type IN ('same_map', 'cross_map', 'first_entry')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_travel_roleplay_logs_player ON public.travel_roleplay_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_travel_roleplay_logs_created ON public.travel_roleplay_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_travel_roleplay_logs_to_map ON public.travel_roleplay_logs(to_map_id);

ALTER TABLE public.travel_roleplay_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can view own travel roleplay logs" ON public.travel_roleplay_logs;
CREATE POLICY "Players can view own travel roleplay logs"
  ON public.travel_roleplay_logs FOR SELECT
  USING (
    auth.uid() = player_id
    OR public.get_my_role() IN ('admin', 'dm')
  );

DROP POLICY IF EXISTS "Players can insert own travel roleplay logs" ON public.travel_roleplay_logs;
CREATE POLICY "Players can insert own travel roleplay logs"
  ON public.travel_roleplay_logs FOR INSERT
  WITH CHECK (auth.uid() = player_id);
