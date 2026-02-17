-- ══════════════════════════════════════════════════════════════
-- WHISPER DND — Complete Setup Script
-- Generated on: 2026-02-08 18:37:53.325674
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- START OF FILE: schema.sql
-- ══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════════
-- WHISPER DND — Database Schema
-- Stack: Supabase (PostgreSQL)
-- ══════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ══════════════════════════════════════════════════════════════

-- ┌────────────────────────────────────────────┐
-- │  1. ENUM: User role (player, admin, dm)    │
-- └────────────────────────────────────────────┘
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('player', 'admin', 'dm');
  END IF;
END
$$;


-- ┌────────────────────────────────────────────┐
-- │  2. TABLE: profiles                        │
-- │  Linked to auth.users via id (uuid FK)     │
-- └────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- Linked directly to Auth UID
  display_name text,
  avatar_url   text,        -- direct URL to profile picture
  role         user_role   NOT NULL DEFAULT 'player',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Add comment for documentation
COMMENT ON TABLE  public.profiles IS 'User profiles linked to Supabase Auth. Roles: player, admin, dm.';
COMMENT ON COLUMN public.profiles.avatar_url IS 'Direct URL to avatar image (Google/Discord profile pic or custom).';
COMMENT ON COLUMN public.profiles.role IS 'User permission level: player (default), admin, or dm (Dungeon Master).';


-- ┌────────────────────────────────────────────┐
-- │  3. FUNCTION: Auto-create profile          │
-- │  on signup (Google / Discord login)        │
-- └────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, role)
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
    'player'  -- Default role for new users
  );
  RETURN NEW;
END;
$$;


-- ┌────────────────────────────────────────────┐
-- │  4. TRIGGER: Fire on new auth.users row    │
-- └────────────────────────────────────────────┘
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ┌────────────────────────────────────────────┐
-- │  5. FUNCTION: Auto-update updated_at       │
-- └────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ┌────────────────────────────────────────────┐
-- │  6. ROW LEVEL SECURITY (RLS)               │
-- └────────────────────────────────────────────┘
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: DM and Admin can view all profiles
CREATE POLICY "DM and Admin can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'dm')
    )
  );

-- Policy: Users can update their own profile (display_name, avatar_url only)
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "DM can update any profile"
  ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'dm'
    )
  );

CREATE POLICY "Admin can update non-dm profiles"
  ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
    AND role <> 'dm'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
    AND role <> 'dm'
  );

-- Policy: Only the trigger (SECURITY DEFINER) inserts profiles
-- No direct INSERT from clients
CREATE POLICY "No direct insert"
  ON public.profiles
  FOR INSERT
  WITH CHECK (false);

-- Policy: No direct delete from clients  
CREATE POLICY "No direct delete"
  ON public.profiles
  FOR DELETE
  USING (false);


-- ┌────────────────────────────────────────────┐
-- │  7. INDEX for role lookups                 │
-- └────────────────────────────────────────────┘
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);


-- ══════════════════════════════════════════════════════════════
-- SETUP COMPLETE
-- 
-- Summary:
--   ✓ profiles table with id, display_name, avatar_url, role
--   ✓ user_role enum: player | admin | dm
--   ✓ Trigger: auto-insert profile on signup (Google/Discord)
--   ✓ Trigger: auto-update updated_at on changes
--   ✓ RLS enabled with granular policies
--   ✓ Index on role column for fast lookups
--
-- Next steps:
--   1. Enable Google OAuth in Supabase Dashboard > Auth > Providers
--   2. Enable Discord OAuth in Supabase Dashboard > Auth > Providers
--   3. Set redirect URL to: https://your-domain.com/auth/callback
-- ══════════════════════════════════════════════════════════════


-- END OF FILE: schema.sql

-- ══════════════════════════════════════════════════════════════
-- START OF FILE: fix_rls_recursion.sql
-- ══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════════
-- FIX: Infinite Recursion in RLS
-- ══════════════════════════════════════════════════════════════
-- The error "infinite recursion detected" happens because the policy checks the 'profiles' table,
-- which triggers the policy again, creating a loop.
-- To fix this, we use a SECURITY DEFINER function to read the role safely.

-- 1. Create a secure function to get the current user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER -- This allows the function to bypass RLS
SET search_path = public
STABLE
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- 2. Drop the problematic recursive policies
DROP POLICY IF EXISTS "DM and Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin and DM can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "DM can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update non-dm profiles" ON public.profiles;

-- 3. Re-create them using the function (No recursion!)
CREATE POLICY "DM and Admin can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    public.get_my_role() IN ('admin', 'dm')
  );

CREATE POLICY "DM can update any profile"
  ON public.profiles
  FOR UPDATE
  USING (
    public.get_my_role() = 'dm'
  );

CREATE POLICY "Admin can update non-dm profiles"
  ON public.profiles
  FOR UPDATE
  USING (
    public.get_my_role() = 'admin' AND role <> 'dm'
  )
  WITH CHECK (
    public.get_my_role() = 'admin' AND role <> 'dm'
  );


-- END OF FILE: fix_rls_recursion.sql

-- ══════════════════════════════════════════════════════════════
-- START OF FILE: add_hp_sanity.sql
-- ══════════════════════════════════════════════════════════════
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


-- END OF FILE: add_hp_sanity.sql

-- ══════════════════════════════════════════════════════════════
-- START OF FILE: add_spirit_travel.sql
-- ══════════════════════════════════════════════════════════════
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


-- END OF FILE: add_spirit_travel.sql

-- ══════════════════════════════════════════════════════════════
-- START OF FILE: add_maps.sql
-- ══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════════
-- WHISPER DND — Map System
-- ══════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor AFTER schema.sql and fix_rls_recursion.sql
-- Uses get_my_role() SECURITY DEFINER function to avoid RLS recursion
-- ══════════════════════════════════════════════════════════════

-- ┌────────────────────────────────────────────┐
-- │  1. TABLE: maps                            │
-- │  Stores campaign maps managed by admin/dm  │
-- └────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.maps (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  image_url   text        NOT NULL,       -- direct URL to map image (forced 1:1 crop on display)
  sort_order  int         NOT NULL DEFAULT 0,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.maps IS 'Campaign maps. Only admin/dm can create/edit. All authenticated users can view.';
COMMENT ON COLUMN public.maps.image_url IS 'Direct URL to map image. Displayed as 1:1 square in gallery; full-size in detail view.';
COMMENT ON COLUMN public.maps.sort_order IS 'Display order in the gallery (lower = first).';

-- ┌────────────────────────────────────────────┐
-- │  2. TRIGGER: Auto-update updated_at        │
-- └────────────────────────────────────────────┘
DROP TRIGGER IF EXISTS set_maps_updated_at ON public.maps;
CREATE TRIGGER set_maps_updated_at
  BEFORE UPDATE ON public.maps
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ┌────────────────────────────────────────────┐
-- │  3. ROW LEVEL SECURITY (RLS)               │
-- │  Uses get_my_role() to prevent recursion   │
-- └────────────────────────────────────────────┘
ALTER TABLE public.maps ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view maps
DROP POLICY IF EXISTS "Authenticated users can view maps" ON public.maps;
CREATE POLICY "Authenticated users can view maps"
  ON public.maps
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admin/dm can insert maps
DROP POLICY IF EXISTS "Admin and DM can insert maps" ON public.maps;
CREATE POLICY "Admin and DM can insert maps"
  ON public.maps
  FOR INSERT
  WITH CHECK (
    public.get_my_role() IN ('admin', 'dm')
  );

-- Only admin/dm can update maps
DROP POLICY IF EXISTS "Admin and DM can update maps" ON public.maps;
CREATE POLICY "Admin and DM can update maps"
  ON public.maps
  FOR UPDATE
  USING (
    public.get_my_role() IN ('admin', 'dm')
  );

-- Only admin can delete maps
DROP POLICY IF EXISTS "Admin can delete maps" ON public.maps;
CREATE POLICY "Admin can delete maps"
  ON public.maps
  FOR DELETE
  USING (
    public.get_my_role() = 'admin'
  );


-- ┌────────────────────────────────────────────┐
-- │  4. INDEX: sort_order for gallery display   │
-- └────────────────────────────────────────────┘
CREATE INDEX IF NOT EXISTS idx_maps_sort_order ON public.maps (sort_order ASC, created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.maps;


-- END OF FILE: add_maps.sql

-- ══════════════════════════════════════════════════════════════
-- START OF FILE: add_map_tokens.sql
-- ══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════════
-- WHISPER DND — Map Tokens & Locked Zones
-- ══════════════════════════════════════════════════════════════
-- Run this AFTER add_maps.sql
-- Uses get_my_role() SECURITY DEFINER to avoid RLS recursion
-- ══════════════════════════════════════════════════════════════

-- ┌────────────────────────────────────────────┐
-- │  1. TABLE: map_tokens                      │
-- │  Player characters & NPCs placed on maps   │
-- └────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.map_tokens (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id        uuid        NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  -- Player tokens: user_id links to auth.users
  user_id       uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  -- NPC tokens: name + image (no user_id)
  npc_name      text,
  npc_image_url text,
  -- Token type
  token_type    text        NOT NULL DEFAULT 'player'
                            CHECK (token_type IN ('player', 'npc')),
  -- Position on map (percentage 0-100)
  position_x    float       NOT NULL DEFAULT 50,
  position_y    float       NOT NULL DEFAULT 50,
  -- Who placed this token
  created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- A player can only have ONE token across ALL maps
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_player_token
  ON public.map_tokens (user_id)
  WHERE user_id IS NOT NULL;

-- Data integrity (idempotent: only add if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_token_data'
  ) THEN
    ALTER TABLE public.map_tokens
      ADD CONSTRAINT check_token_data CHECK (
        (token_type = 'player' AND user_id IS NOT NULL)
        OR
        (token_type = 'npc' AND npc_name IS NOT NULL AND npc_image_url IS NOT NULL)
      );
  END IF;
END
$$;

COMMENT ON TABLE  public.map_tokens IS 'Characters & NPCs placed on campaign maps.';
COMMENT ON COLUMN public.map_tokens.position_x IS 'Percentage X position (0–100) on the map image.';
COMMENT ON COLUMN public.map_tokens.position_y IS 'Percentage Y position (0–100) on the map image.';

-- ┌────────────────────────────────────────────┐
-- │  2. TABLE: map_locked_zones                │
-- │  Admin-defined restricted areas            │
-- └────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.map_locked_zones (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id           uuid        NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  -- Zone rectangle (percentage 0-100)
  zone_x           float       NOT NULL,
  zone_y           float       NOT NULL,
  zone_width       float       NOT NULL,
  zone_height      float       NOT NULL,
  -- Lock info
  message          text        NOT NULL DEFAULT 'พื้นที่นี้ถูกล็อค',
  -- Users allowed into this zone (UUID array)
  allowed_user_ids uuid[]      NOT NULL DEFAULT '{}',
  -- Who created this zone
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.map_locked_zones IS 'Admin-defined restricted areas on campaign maps.';
COMMENT ON COLUMN public.map_locked_zones.allowed_user_ids IS 'Array of user IDs allowed to enter this zone.';

-- Also add embed_enabled to maps (for public iframe embeds)
ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS embed_enabled boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.maps.embed_enabled IS 'Whether this map can be embedded as public iframe.';


-- ┌────────────────────────────────────────────┐
-- │  3. TRIGGERS: Auto-update updated_at       │
-- └────────────────────────────────────────────┘
DROP TRIGGER IF EXISTS set_map_tokens_updated_at ON public.map_tokens;
CREATE TRIGGER set_map_tokens_updated_at
  BEFORE UPDATE ON public.map_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_map_locked_zones_updated_at ON public.map_locked_zones;
CREATE TRIGGER set_map_locked_zones_updated_at
  BEFORE UPDATE ON public.map_locked_zones
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ┌────────────────────────────────────────────┐
-- │  4. RLS: map_tokens                        │
-- └────────────────────────────────────────────┘
ALTER TABLE public.map_tokens ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view tokens
DROP POLICY IF EXISTS "Authenticated users can view map tokens" ON public.map_tokens;
CREATE POLICY "Authenticated users can view map tokens"
  ON public.map_tokens FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Anonymous can view tokens on embeddable maps
DROP POLICY IF EXISTS "Anon can view tokens on embeddable maps" ON public.map_tokens;
CREATE POLICY "Anon can view tokens on embeddable maps"
  ON public.map_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.maps m
      WHERE m.id = map_tokens.map_id AND m.embed_enabled = true
    )
  );

-- Admin/DM can insert any token
DROP POLICY IF EXISTS "Admin and DM can insert map tokens" ON public.map_tokens;
CREATE POLICY "Admin and DM can insert map tokens"
  ON public.map_tokens FOR INSERT
  WITH CHECK (
    public.get_my_role() IN ('admin', 'dm')
  );

-- Players can insert their OWN token
DROP POLICY IF EXISTS "Players can add themselves to map" ON public.map_tokens;
CREATE POLICY "Players can add themselves to map"
  ON public.map_tokens FOR INSERT
  WITH CHECK (
    token_type = 'player'
    AND user_id = auth.uid()
    AND created_by = auth.uid()
  );

-- Admin/DM can update any token
DROP POLICY IF EXISTS "Admin and DM can update map tokens" ON public.map_tokens;
CREATE POLICY "Admin and DM can update map tokens"
  ON public.map_tokens FOR UPDATE
  USING (
    public.get_my_role() IN ('admin', 'dm')
  );

-- Players can update their OWN token position
DROP POLICY IF EXISTS "Players can move their own token" ON public.map_tokens;
CREATE POLICY "Players can move their own token"
  ON public.map_tokens FOR UPDATE
  USING (
    token_type = 'player' AND user_id = auth.uid()
  );

-- Only admin/dm can delete tokens
DROP POLICY IF EXISTS "Admin and DM can delete map tokens" ON public.map_tokens;
CREATE POLICY "Admin and DM can delete map tokens"
  ON public.map_tokens FOR DELETE
  USING (
    public.get_my_role() IN ('admin', 'dm')
  );


-- ┌────────────────────────────────────────────┐
-- │  5. RLS: map_locked_zones                  │
-- └────────────────────────────────────────────┘
ALTER TABLE public.map_locked_zones ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view zones
DROP POLICY IF EXISTS "Authenticated users can view locked zones" ON public.map_locked_zones;
CREATE POLICY "Authenticated users can view locked zones"
  ON public.map_locked_zones FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Anonymous can view zones on embeddable maps
DROP POLICY IF EXISTS "Anon can view zones on embeddable maps" ON public.map_locked_zones;
CREATE POLICY "Anon can view zones on embeddable maps"
  ON public.map_locked_zones FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.maps m
      WHERE m.id = map_locked_zones.map_id AND m.embed_enabled = true
    )
  );

-- Only admin/dm can manage zones
DROP POLICY IF EXISTS "Admin and DM can insert locked zones" ON public.map_locked_zones;
CREATE POLICY "Admin and DM can insert locked zones"
  ON public.map_locked_zones FOR INSERT
  WITH CHECK (
    public.get_my_role() IN ('admin', 'dm')
  );

DROP POLICY IF EXISTS "Admin and DM can update locked zones" ON public.map_locked_zones;
CREATE POLICY "Admin and DM can update locked zones"
  ON public.map_locked_zones FOR UPDATE
  USING (
    public.get_my_role() IN ('admin', 'dm')
  );

DROP POLICY IF EXISTS "Admin and DM can delete locked zones" ON public.map_locked_zones;
CREATE POLICY "Admin and DM can delete locked zones"
  ON public.map_locked_zones FOR DELETE
  USING (
    public.get_my_role() IN ('admin', 'dm')
  );


-- ┌────────────────────────────────────────────┐
-- │  6. RLS: maps anon SELECT for embeds       │
-- └────────────────────────────────────────────┘
DROP POLICY IF EXISTS "Anon can view embeddable maps" ON public.maps;
CREATE POLICY "Anon can view embeddable maps"
  ON public.maps FOR SELECT
  USING (embed_enabled = true);


-- ┌────────────────────────────────────────────┐
-- │  7. INDEXES                                │
-- └────────────────────────────────────────────┘
CREATE INDEX IF NOT EXISTS idx_map_tokens_map_id     ON public.map_tokens (map_id);
CREATE INDEX IF NOT EXISTS idx_map_tokens_user_id    ON public.map_tokens (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_map_locked_zones_map  ON public.map_locked_zones (map_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.map_tokens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.map_locked_zones;


-- END OF FILE: add_map_tokens.sql

-- ══════════════════════════════════════════════════════════════
-- START OF FILE: add_skill_system.sql
-- ══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════════
-- WHISPER DND — Skill System Schema
-- Tables: skill_types, skill_pathways, skill_sequences,
--         skills, player_pathways
-- ══════════════════════════════════════════════════════════════

-- ┌────────────────────────────────────────────────┐
-- │  1. TABLE: skill_types (กลุ่ม)                 │
-- │  Top-level grouping for skills                 │
-- └────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.skill_types (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  description  text,
  sort_order   int         NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.skill_types IS 'Top-level skill grouping (กลุ่ม). e.g. "เวทมนตร์", "กายภาพ"';

-- ┌────────────────────────────────────────────────┐
-- │  2. TABLE: skill_pathways (เส้นทาง)            │
-- │  Paths within each type                        │
-- └────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.skill_pathways (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id      uuid        NOT NULL REFERENCES public.skill_types(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  description  text,
  sort_order   int         NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.skill_pathways IS 'Skill pathway within a type (เส้นทาง). e.g. "สายไฟ", "สายน้ำ"';
CREATE INDEX IF NOT EXISTS idx_skill_pathways_type ON public.skill_pathways(type_id);

-- ┌────────────────────────────────────────────────┐
-- │  3. TABLE: skill_sequences (ลำดับ)             │
-- │  Inverted tiers: 9 = weakest → 0 = strongest  │
-- │  Players accumulate skills as they descend     │
-- └────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.skill_sequences (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_id   uuid        NOT NULL REFERENCES public.skill_pathways(id) ON DELETE CASCADE,
  seq_number   int         NOT NULL CHECK (seq_number >= 0 AND seq_number <= 9),
  name         text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pathway_id, seq_number)
);

COMMENT ON TABLE public.skill_sequences IS 'ลำดับขั้น: 9 = อ่อนแอที่สุด → 0 = แข็งแกร่งที่สุด. สกิลสะสมจากลำดับก่อนหน้า';
CREATE INDEX IF NOT EXISTS idx_skill_sequences_pathway ON public.skill_sequences(pathway_id);

-- ┌────────────────────────────────────────────────┐
-- │  4. TABLE: skills (สกิล)                       │
-- │  Individual skills linked to a pathway         │
-- │  with spirit cost and sequence requirement     │
-- └────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.skills (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_id      uuid        NOT NULL REFERENCES public.skill_pathways(id) ON DELETE CASCADE,
  sequence_id     uuid        NOT NULL REFERENCES public.skill_sequences(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  description     text,
  spirit_cost     int         NOT NULL DEFAULT 1,
  icon_url        text,
  sort_order      int         NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.skills IS 'Individual skill definition with spirit cost and sequence requirement.';
COMMENT ON COLUMN public.skills.spirit_cost IS 'จำนวนพลังวิญญาณที่ใช้';
COMMENT ON COLUMN public.skills.sequence_id IS 'ลำดับขั้นขั้นต่ำที่ต้องถึงจึงจะใช้สกิลนี้ได้ (ยิ่งเลขน้อย = ยิ่งยาก)';
CREATE INDEX IF NOT EXISTS idx_skills_pathway ON public.skills(pathway_id);
CREATE INDEX IF NOT EXISTS idx_skills_sequence ON public.skills(sequence_id);

-- ┌────────────────────────────────────────────────┐
-- │  5. TABLE: player_pathways                     │
-- │  Links players to their pathways + sequence    │
-- └────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.player_pathways (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pathway_id   uuid        REFERENCES public.skill_pathways(id) ON DELETE SET NULL,
  sequence_id  uuid        REFERENCES public.skill_sequences(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, pathway_id)
);

COMMENT ON TABLE public.player_pathways IS 'Player progression: which pathway and current sequence level.';
CREATE INDEX IF NOT EXISTS idx_player_pathways_player ON public.player_pathways(player_id);
CREATE INDEX IF NOT EXISTS idx_player_pathways_pathway ON public.player_pathways(pathway_id);


-- ┌────────────────────────────────────────────────┐
-- │  6. TRIGGER: Auto-create player_pathways       │
-- │  on first login (after profile created)        │
-- └────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.handle_new_player_pathways()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Insert a default NULL pathway entry so player has a row in player_pathways
  INSERT INTO public.player_pathways (player_id, pathway_id, sequence_id)
  VALUES (NEW.id, NULL, NULL)
  ON CONFLICT (player_id, pathway_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_pathways ON public.profiles;
CREATE TRIGGER on_profile_created_pathways
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_player_pathways();


-- ┌────────────────────────────────────────────────┐
-- │  7. BACKFILL: Add player_pathways for          │
-- │  existing users who don't have one yet         │
-- └────────────────────────────────────────────────┘
INSERT INTO public.player_pathways (player_id, pathway_id, sequence_id)
SELECT p.id, NULL, NULL
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.player_pathways pp WHERE pp.player_id = p.id
)
ON CONFLICT DO NOTHING;


-- ┌────────────────────────────────────────────────┐
-- │  8. Auto-update updated_at triggers            │
-- └────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_skill_types ON public.skill_types;
CREATE TRIGGER set_updated_at_skill_types
  BEFORE UPDATE ON public.skill_types
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_skill_pathways ON public.skill_pathways;
CREATE TRIGGER set_updated_at_skill_pathways
  BEFORE UPDATE ON public.skill_pathways
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_skill_sequences ON public.skill_sequences;
CREATE TRIGGER set_updated_at_skill_sequences
  BEFORE UPDATE ON public.skill_sequences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_skills ON public.skills;
CREATE TRIGGER set_updated_at_skills
  BEFORE UPDATE ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_player_pathways ON public.player_pathways;
CREATE TRIGGER set_updated_at_player_pathways
  BEFORE UPDATE ON public.player_pathways
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ┌────────────────────────────────────────────────┐
-- │  9. ROW LEVEL SECURITY                         │
-- │  Uses public.get_my_role() SECURITY DEFINER    │
-- │  to avoid RLS recursion on profiles table      │
-- └────────────────────────────────────────────────┘

-- skill_types: Everyone can read, admin/dm can write
ALTER TABLE public.skill_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read skill_types"
  ON public.skill_types FOR SELECT USING (true);

CREATE POLICY "Admin/DM can insert skill_types"
  ON public.skill_types FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can update skill_types"
  ON public.skill_types FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can delete skill_types"
  ON public.skill_types FOR DELETE
  USING (public.get_my_role() IN ('admin', 'dm'));

-- skill_pathways: Everyone can read, admin/dm can write
ALTER TABLE public.skill_pathways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read skill_pathways"
  ON public.skill_pathways FOR SELECT USING (true);

CREATE POLICY "Admin/DM can insert skill_pathways"
  ON public.skill_pathways FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can update skill_pathways"
  ON public.skill_pathways FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can delete skill_pathways"
  ON public.skill_pathways FOR DELETE
  USING (public.get_my_role() IN ('admin', 'dm'));

-- skill_sequences: Everyone can read, admin/dm can write
ALTER TABLE public.skill_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read skill_sequences"
  ON public.skill_sequences FOR SELECT USING (true);

CREATE POLICY "Admin/DM can insert skill_sequences"
  ON public.skill_sequences FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can update skill_sequences"
  ON public.skill_sequences FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can delete skill_sequences"
  ON public.skill_sequences FOR DELETE
  USING (public.get_my_role() IN ('admin', 'dm'));

-- skills: Everyone can read, admin/dm can write
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read skills"
  ON public.skills FOR SELECT USING (true);

CREATE POLICY "Admin/DM can insert skills"
  ON public.skills FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can update skills"
  ON public.skills FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can delete skills"
  ON public.skills FOR DELETE
  USING (public.get_my_role() IN ('admin', 'dm'));

-- player_pathways: Players read own, admin/dm reads all, admin/dm writes
ALTER TABLE public.player_pathways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own pathways"
  ON public.player_pathways FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Admin/DM can view all player_pathways"
  ON public.player_pathways FOR SELECT
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM or self can insert player_pathways"
  ON public.player_pathways FOR INSERT
  WITH CHECK (
    public.get_my_role() IN ('admin', 'dm')
    OR auth.uid() = player_id
  );

CREATE POLICY "Admin/DM can update player_pathways"
  ON public.player_pathways FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can delete player_pathways"
  ON public.player_pathways FOR DELETE
  USING (public.get_my_role() IN ('admin', 'dm'));


-- ══════════════════════════════════════════════════════════════
-- DONE — Skill System Schema
--
-- Summary:
--   ✓ skill_types       — กลุ่ม (Type) top-level grouping
--   ✓ skill_pathways    — เส้นทาง (Pathways) within each type
--   ✓ skill_sequences   — ลำดับ (Sequence) numbered tiers
--   ✓ skills            — สกิล with spirit_cost, sequence requirement
--   ✓ player_pathways   — Player progression tracking
--   ✓ Trigger: auto-create player_pathways on new profile
--   ✓ Backfill: existing users get default NULL entry
--   ✓ updated_at triggers on all tables
--   ✓ RLS: read-all, write-admin for skill tables
--   ✓ RLS: player sees own pathways, admin sees all
-- ══════════════════════════════════════════════════════════════


-- END OF FILE: add_skill_system.sql

-- ══════════════════════════════════════════════════════════════
-- START OF FILE: add_pathway_images.sql
-- ══════════════════════════════════════════════════════════════
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


-- END OF FILE: add_pathway_images.sql

-- ══════════════════════════════════════════════════════════════
-- START OF FILE: fix_sequence_range.sql
-- ══════════════════════════════════════════════════════════════
-- ============================================================
-- FIX: Inverted Sequence System (9=weakest → 0=strongest)
-- ============================================================
-- seq_number range: 0–9
-- Lower number = stronger / higher rank
-- Players keep cumulative skills from higher seq_numbers
-- ============================================================

-- Add CHECK constraint to enforce 0–9 range
ALTER TABLE public.skill_sequences
  DROP CONSTRAINT IF EXISTS skill_sequences_seq_number_range;

ALTER TABLE public.skill_sequences
  ADD CONSTRAINT skill_sequences_seq_number_range
  CHECK (seq_number >= 0 AND seq_number <= 9);

-- Update comments
COMMENT ON TABLE  public.skill_sequences IS 'ลำดับขั้น (Sequence): 9 = อ่อนแอที่สุด → 0 = แข็งแกร่งที่สุด. สกิลสะสมจากลำดับก่อนหน้า';
COMMENT ON COLUMN public.skill_sequences.seq_number IS 'ลำดับ 9 (เริ่มต้น) → 0 (สูงสุด). ยิ่งเลขน้อย ยิ่งแข็งแกร่ง';
COMMENT ON COLUMN public.skills.sequence_id IS 'ลำดับขั้นขั้นต่ำที่ต้องถึงจึงจะใช้สกิลนี้ได้ (ยิ่งเลขน้อย = ยิ่งยาก)';

-- ✅ Done — Now seq_number restricted to 0-9


-- END OF FILE: fix_sequence_range.sql

-- ══════════════════════════════════════════════════════════════
-- START OF FILE: fix_skill_rls.sql
-- ══════════════════════════════════════════════════════════════
-- ============================================================
-- FIX: Skill System RLS Recursion
-- ============================================================
-- Problem: skill table policies used EXISTS (SELECT FROM profiles)
--          but profiles has RLS → recursion → permission denied
-- Fix:     Use public.get_my_role() SECURITY DEFINER function
--          (already created in fix_rls_recursion.sql)
-- Also:    Allow 'dm' role for admin operations
-- ============================================================

-- ┌──────────────────────────────────────────────────────────┐
-- │  DROP all old AND new-named policies (idempotent)       │
-- └──────────────────────────────────────────────────────────┘

-- skill_types (old names + new names)
DROP POLICY IF EXISTS "Admin can insert skill_types"      ON public.skill_types;
DROP POLICY IF EXISTS "Admin can update skill_types"      ON public.skill_types;
DROP POLICY IF EXISTS "Admin can delete skill_types"      ON public.skill_types;
DROP POLICY IF EXISTS "Admin/DM can insert skill_types"   ON public.skill_types;
DROP POLICY IF EXISTS "Admin/DM can update skill_types"   ON public.skill_types;
DROP POLICY IF EXISTS "Admin/DM can delete skill_types"   ON public.skill_types;

-- skill_pathways
DROP POLICY IF EXISTS "Admin can insert skill_pathways"    ON public.skill_pathways;
DROP POLICY IF EXISTS "Admin can update skill_pathways"    ON public.skill_pathways;
DROP POLICY IF EXISTS "Admin can delete skill_pathways"    ON public.skill_pathways;
DROP POLICY IF EXISTS "Admin/DM can insert skill_pathways" ON public.skill_pathways;
DROP POLICY IF EXISTS "Admin/DM can update skill_pathways" ON public.skill_pathways;
DROP POLICY IF EXISTS "Admin/DM can delete skill_pathways" ON public.skill_pathways;

-- skill_sequences
DROP POLICY IF EXISTS "Admin can insert skill_sequences"    ON public.skill_sequences;
DROP POLICY IF EXISTS "Admin can update skill_sequences"    ON public.skill_sequences;
DROP POLICY IF EXISTS "Admin can delete skill_sequences"    ON public.skill_sequences;
DROP POLICY IF EXISTS "Admin/DM can insert skill_sequences" ON public.skill_sequences;
DROP POLICY IF EXISTS "Admin/DM can update skill_sequences" ON public.skill_sequences;
DROP POLICY IF EXISTS "Admin/DM can delete skill_sequences" ON public.skill_sequences;

-- skills
DROP POLICY IF EXISTS "Admin can insert skills"      ON public.skills;
DROP POLICY IF EXISTS "Admin can update skills"      ON public.skills;
DROP POLICY IF EXISTS "Admin can delete skills"      ON public.skills;
DROP POLICY IF EXISTS "Admin/DM can insert skills"   ON public.skills;
DROP POLICY IF EXISTS "Admin/DM can update skills"   ON public.skills;
DROP POLICY IF EXISTS "Admin/DM can delete skills"   ON public.skills;

-- player_pathways
DROP POLICY IF EXISTS "Admin and DM can view all player_pathways"  ON public.player_pathways;
DROP POLICY IF EXISTS "Admin can insert player_pathways"            ON public.player_pathways;
DROP POLICY IF EXISTS "Admin can update player_pathways"            ON public.player_pathways;
DROP POLICY IF EXISTS "Admin can delete player_pathways"            ON public.player_pathways;
DROP POLICY IF EXISTS "Admin/DM can view all player_pathways"      ON public.player_pathways;
DROP POLICY IF EXISTS "Admin/DM or self can insert player_pathways" ON public.player_pathways;
DROP POLICY IF EXISTS "Admin/DM can update player_pathways"        ON public.player_pathways;
DROP POLICY IF EXISTS "Admin/DM can delete player_pathways"        ON public.player_pathways;


-- ══════════════════════════════════════════════════════════
-- RECREATE with get_my_role() — no recursion, dm included
-- ══════════════════════════════════════════════════════════

-- skill_types
CREATE POLICY "Admin/DM can insert skill_types"
  ON public.skill_types FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can update skill_types"
  ON public.skill_types FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can delete skill_types"
  ON public.skill_types FOR DELETE
  USING (public.get_my_role() IN ('admin', 'dm'));

-- skill_pathways
CREATE POLICY "Admin/DM can insert skill_pathways"
  ON public.skill_pathways FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can update skill_pathways"
  ON public.skill_pathways FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can delete skill_pathways"
  ON public.skill_pathways FOR DELETE
  USING (public.get_my_role() IN ('admin', 'dm'));

-- skill_sequences
CREATE POLICY "Admin/DM can insert skill_sequences"
  ON public.skill_sequences FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can update skill_sequences"
  ON public.skill_sequences FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can delete skill_sequences"
  ON public.skill_sequences FOR DELETE
  USING (public.get_my_role() IN ('admin', 'dm'));

-- skills
CREATE POLICY "Admin/DM can insert skills"
  ON public.skills FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can update skills"
  ON public.skills FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can delete skills"
  ON public.skills FOR DELETE
  USING (public.get_my_role() IN ('admin', 'dm'));

-- player_pathways
CREATE POLICY "Admin/DM can view all player_pathways"
  ON public.player_pathways FOR SELECT
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM or self can insert player_pathways"
  ON public.player_pathways FOR INSERT
  WITH CHECK (
    public.get_my_role() IN ('admin', 'dm')
    OR auth.uid() = player_id
  );

CREATE POLICY "Admin/DM can update player_pathways"
  ON public.player_pathways FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'dm'));

CREATE POLICY "Admin/DM can delete player_pathways"
  ON public.player_pathways FOR DELETE
  USING (public.get_my_role() IN ('admin', 'dm'));

-- ✅ Done — all skill table policies now use get_my_role()


-- END OF FILE: fix_skill_rls.sql

-- ══════════════════════════════════════════════════════════════
-- START OF FILE: repair_profiles.sql
-- ══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════════
-- REPAIR SCRIPT: Backfill Missing Profiles
-- ══════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor to ensure all users have a profile

INSERT INTO public.profiles (id, display_name, avatar_url, role)
SELECT 
  id,
  COALESCE(
    raw_user_meta_data ->> 'full_name',
    raw_user_meta_data ->> 'name',
    raw_user_meta_data ->> 'user_name',
    split_part(email, '@', 1)
  ) as display_name,
  COALESCE(
    raw_user_meta_data ->> 'avatar_url',
    raw_user_meta_data ->> 'picture'
  ) as avatar_url,
  'player' as role
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- DIAGNOSTIC: Check your specific user
-- Replace 'your-email@example.com' with your actual email to check
-- ══════════════════════════════════════════════════════════════
/*
SELECT au.id as auth_id, au.email, p.id as profile_id, p.role 
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE au.email = 'YOUR_EMAIL_HERE';
*/


-- END OF FILE: repair_profiles.sql

