-- ══════════════════════════════════════════════════════════════
-- Add Rest Points to Maps (จุดพักผ่อน / ที่นอนหลับ)
-- ══════════════════════════════════════════════════════════════
-- Run AFTER: add_maps.sql, add_map_tokens.sql

-- 1. Create rest points table (similar to map_churches)
CREATE TABLE IF NOT EXISTS public.map_rest_points (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id      uuid        NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  image_url   text,
  radius      float       NOT NULL DEFAULT 10,
  position_x  float       NOT NULL DEFAULT 50,
  position_y  float       NOT NULL DEFAULT 50,
  created_by  uuid        REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.map_rest_points ENABLE ROW LEVEL SECURITY;

-- Everyone can read rest points
CREATE POLICY "Anyone can view rest points"
  ON public.map_rest_points FOR SELECT
  USING (true);

-- Only admin/DM can manage rest points
CREATE POLICY "Admin can insert rest points"
  ON public.map_rest_points FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

CREATE POLICY "Admin can update rest points"
  ON public.map_rest_points FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

CREATE POLICY "Admin can delete rest points"
  ON public.map_rest_points FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dm')
    )
  );

-- Index for quick lookup by map
CREATE INDEX IF NOT EXISTS idx_map_rest_points_map ON public.map_rest_points(map_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.map_rest_points;
