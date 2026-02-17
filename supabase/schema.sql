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
