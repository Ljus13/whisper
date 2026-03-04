-- ══════════════════════════════════════════════════════════════
-- JWT Custom Claims: Embed user role in access token
-- ══════════════════════════════════════════════════════════════
-- This eliminates the need to query the `profiles` table for
-- role-checking on every page load. The role is embedded in the
-- JWT token at login/refresh time.
--
-- SETUP INSTRUCTIONS:
-- 1. Run this SQL in your Supabase SQL Editor
-- 2. Go to Supabase Dashboard → Authentication → Hooks
-- 3. Enable "Customize Access Token (JWT) Claims" hook
-- 4. Point it to: public.custom_access_token_hook
-- ══════════════════════════════════════════════════════════════

-- Step 1: Create the hook function
-- SECURITY DEFINER = runs as function owner (bypasses RLS on profiles table)
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_role text;
  discord_linked boolean;
BEGIN
  -- Fetch role and discord status from profiles
  -- Wrapped in exception handler so auth NEVER fails even if profiles lookup fails
  BEGIN
    SELECT 
      p.role,
      (p.discord_user_id IS NOT NULL)
    INTO user_role, discord_linked
    FROM public.profiles p
    WHERE p.id = (event->>'user_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    -- If profiles lookup fails for any reason, use safe defaults
    user_role := NULL;
    discord_linked := false;
  END;

  -- Build custom claims
  claims := event->'claims';

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  ELSE
    claims := jsonb_set(claims, '{user_role}', '"player"');
  END IF;

  claims := jsonb_set(claims, '{discord_linked}', to_jsonb(COALESCE(discord_linked, false)));

  -- Update the event with new claims
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;
$$;

-- Step 2: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Ensure the auth admin can read profiles for role lookup
GRANT SELECT ON public.profiles TO supabase_auth_admin;

-- Step 3: Revoke access from other roles for security
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- ══════════════════════════════════════════════════════════════
-- After running this SQL:
-- 1. Go to Supabase Dashboard → Authentication → Hooks
-- 2. Enable "Customize Access Token (JWT) Claims" 
-- 3. Select schema: public, function: custom_access_token_hook
-- 4. Click Save
--
-- Users will need to re-login or wait for token refresh (~1hr)
-- to get the new claims in their JWT.
-- ══════════════════════════════════════════════════════════════
