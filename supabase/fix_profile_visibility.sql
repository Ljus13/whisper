-- ══════════════════════════════════════════════════════════════
-- FIX: Normal players can't see other players' profiles on the map
-- ══════════════════════════════════════════════════════════════
-- Problem: RLS on "profiles" only allows users to read their OWN profile.
-- Admin/DM can see all profiles, but normal players cannot.
-- This means on the map view, other players' tokens show as "? ผู้เล่น"
-- instead of their display_name and avatar.
--
-- Fix: Add a policy that allows ALL authenticated users to SELECT profiles.
-- This is safe because the profiles table only contains:
--   id, display_name, avatar_url, role (no sensitive data).

CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (auth.role() = 'authenticated');
