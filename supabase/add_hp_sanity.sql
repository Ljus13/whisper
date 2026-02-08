-- ══════════════════════════════════════════════════════════════
-- WHISPER DND — Add HP (ตัวตายตัวแทน) & Sanity (สติ) to profiles
-- Run this in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════
-- HP = "ตัวตายตัวแทน" (story-driven, not traditional HP)
-- Sanity = "สติ" — decays by 2 per day, default 10
-- ══════════════════════════════════════════════════════════════

-- ┌──────────────────────────────────────────────────┐
-- │  1. ADD COLUMNS: hp & sanity                     │
-- └──────────────────────────────────────────────────┘
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hp          int NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS sanity      int NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_sanity  int NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS sanity_last_decay timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.profiles.hp IS 'ตัวตายตัวแทน — จำนวนครั้งที่ตายได้ตลอดแคมเพจน์. DM ปรับเพิ่ม/ลดได้. Default 5.';
COMMENT ON COLUMN public.profiles.sanity IS 'สติ (Sanity). ลดลงวันละ 2. Default 10.';
COMMENT ON COLUMN public.profiles.max_sanity IS 'สติสูงสุด. Default 10.';
COMMENT ON COLUMN public.profiles.sanity_last_decay IS 'วันที่ล่าสุดที่สติถูกหักครับ ใช้คำนวณ auto-decay.';


-- ┌──────────────────────────────────────────────────┐
-- │  2. CHECK CONSTRAINTS                            │
-- └──────────────────────────────────────────────────┘
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS chk_hp_range;
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_hp_range
    CHECK (hp >= 0);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS chk_sanity_range;
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_sanity_range
    CHECK (sanity >= 0 AND sanity <= max_sanity);


-- ┌──────────────────────────────────────────────────┐
-- │  3. FUNCTION: Apply Sanity Decay                 │
-- │  Calculates days passed since last decay,        │
-- │  reduces sanity by 2 per day elapsed             │
-- └──────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.apply_sanity_decay(player_uuid uuid)
RETURNS int  -- returns current sanity after decay
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  days_elapsed int;
  current_sanity int;
  new_sanity int;
BEGIN
  SELECT
    GREATEST(0, EXTRACT(DAY FROM (now() - sanity_last_decay))::int),
    sanity
  INTO days_elapsed, current_sanity
  FROM profiles
  WHERE id = player_uuid;

  IF days_elapsed > 0 THEN
    new_sanity := GREATEST(0, current_sanity - (days_elapsed * 2));

    UPDATE profiles
    SET sanity = new_sanity,
        sanity_last_decay = now()
    WHERE id = player_uuid;

    RETURN new_sanity;
  END IF;

  RETURN current_sanity;
END;
$$;

COMMENT ON FUNCTION public.apply_sanity_decay IS 'หักค่าสติ 2 หน่วยต่อวัน นับจาก sanity_last_decay. เรียกเมื่อผู้เล่นเข้าระบบ.';


-- ┌──────────────────────────────────────────────────┐
-- │  4. UPDATE handle_new_user() with new defaults   │
-- └──────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, display_name, avatar_url, role,
    spirituality, max_spirituality,
    travel_points, max_travel_points,
    hp,
    sanity, max_sanity, sanity_last_decay
  )
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
    15, 15,   -- spirituality
    9,  9,    -- travel_points
    5,        -- hp (ตัวตายตัวแทน)
    10, 10,   -- sanity (สติ)
    now()     -- sanity_last_decay
  );
  RETURN NEW;
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- DONE
--   ✓ hp                    (int, default 5, จำนวนครั้งที่ตายได้)
--   ✓ sanity / max_sanity   (int, default 10, range 0–max)
--   ✓ sanity_last_decay     (timestamptz, tracks last auto-decay)
--   ✓ apply_sanity_decay()  (function: -2 per day elapsed)
--   ✓ handle_new_user()     updated with all defaults
--   ✓ CHECK constraints for data integrity
-- ══════════════════════════════════════════════════════════════
