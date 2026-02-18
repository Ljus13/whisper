-- ══════════════════════════════════════════════════════════════
-- Sleep Requests table — players submit nightly rest requests
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sleep_requests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  meal_url    text        NOT NULL,
  sleep_url   text        NOT NULL,
  status      text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sleep_requests ENABLE ROW LEVEL SECURITY;

-- Players can view their own requests
CREATE POLICY "Players can view own sleep requests"
  ON public.sleep_requests FOR SELECT
  USING (auth.uid() = player_id);

-- Admin/DM can view all requests
CREATE POLICY "Admin can view all sleep requests"
  ON public.sleep_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

-- Players can insert their own requests
CREATE POLICY "Players can insert own sleep requests"
  ON public.sleep_requests FOR INSERT
  WITH CHECK (auth.uid() = player_id);

-- Admin/DM can update any request (approve/reject)
CREATE POLICY "Admin can update sleep requests"
  ON public.sleep_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sleep_requests_player ON public.sleep_requests(player_id);
CREATE INDEX IF NOT EXISTS idx_sleep_requests_status ON public.sleep_requests(status);
CREATE INDEX IF NOT EXISTS idx_sleep_requests_created ON public.sleep_requests(created_at DESC);

-- Realtime
ALTER TABLE public.sleep_requests REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'sleep_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sleep_requests;
  END IF;
END $$;
