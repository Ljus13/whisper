-- ══════════════════════════════════════════════════════════════
-- WHISPER DND — Add Spirit & Travel Points to profiles
-- Run this in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ┌──────────────────────────────────────────────────┐
-- │  1. ADD COLUMNS: spirituality & travel_points    │
-- └──────────────────────────────────────────────────┘
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS spirituality   int NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS max_spirituality int NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS travel_points  int NOT NULL DEFAULT 9,
  ADD COLUMN IF NOT EXISTS max_travel_points int NOT NULL DEFAULT 9;

COMMENT ON COLUMN public.profiles.spirituality IS 'Current spirit energy (พลังวิญญาณ). Default 15.';
COMMENT ON COLUMN public.profiles.max_spirituality IS 'Maximum spirit energy cap. Default 15.';
COMMENT ON COLUMN public.profiles.travel_points IS 'Current travel units (หน่วยการเดินทาง). Default 9.';
COMMENT ON COLUMN public.profiles.max_travel_points IS 'Maximum travel units cap. Default 9.';


-- ┌──────────────────────────────────────────────────┐
-- │  2. UPDATE handle_new_user() to include defaults │
-- └──────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, role, spirituality, max_spirituality, travel_points, max_travel_points)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      NEW.raw_user_meta_data ->> 'user_name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data ->> 'avatar_url',
      NEW.raw_user_meta_data ->> 'picture'
    ),
    'player',
    15,  -- spirituality default
    15,  -- max_spirituality default
    9,   -- travel_points default
    9    -- max_travel_points default
  );
  RETURN NEW;
END;
$$;


-- ┌──────────────────────────────────────────────────┐
-- │  3. CHECK CONSTRAINTS (prevent negative/overflow)│
-- └──────────────────────────────────────────────────┘
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_spirituality_range
    CHECK (spirituality >= 0 AND spirituality <= max_spirituality);

ALTER TABLE public.profiles
  ADD CONSTRAINT chk_travel_points_range
    CHECK (travel_points >= 0 AND travel_points <= max_travel_points);


-- ══════════════════════════════════════════════════════════════
-- DONE
--   ✓ spirituality     (int, default 15, range 0–max)
--   ✓ max_spirituality  (int, default 15)
--   ✓ travel_points    (int, default 9, range 0–max)
--   ✓ max_travel_points (int, default 9)
--   ✓ handle_new_user() updated with new defaults
--   ✓ CHECK constraints for data integrity
-- ══════════════════════════════════════════════════════════════
