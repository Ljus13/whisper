-- ═══════════════════════════════════════════════════════════
-- Add display_name_set flag to profiles
-- Forces first-login users to confirm their display name
-- ═══════════════════════════════════════════════════════════

-- 1. Add column (default false for all existing + new users)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS display_name_set boolean NOT NULL DEFAULT false;

-- 2. Mark all EXISTING users as already set (they've been using the system)
UPDATE profiles SET display_name_set = true WHERE display_name_set = false;

-- 3. Update the handle_new_user trigger so NEW signups get false
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    display_name,
    avatar_url,
    role,
    hp,
    sanity,
    max_sanity,
    spirituality,
    max_spirituality,
    travel_points,
    max_travel_points,
    display_name_set
  )
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'user_name',
      split_part(new.email, '@', 1)
    ),
    COALESCE(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    ),
    'player',
    5,    -- hp
    10,   -- sanity
    10,   -- max_sanity
    15,   -- spirituality
    15,   -- max_spirituality
    9,    -- travel_points
    9,    -- max_travel_points
    false -- display_name_set: must confirm on first login
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
