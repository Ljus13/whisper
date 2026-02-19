-- ══════════════════════════════════════════════════════════════
-- FIX: Anon (embed iframe) cannot see profiles joined from map_tokens
-- ══════════════════════════════════════════════════════════════
-- Problem:
--   The embed page at /embed/maps/[id] runs as anon (no auth session).
--   When fetching map_tokens with a join on profiles, the profiles rows
--   are blocked by RLS because no policy allows anon SELECT on profiles.
--   Result: all player tokens show null display_name and avatar_url.
--
-- Fix:
--   Add a policy that allows anon to SELECT profiles, but ONLY for
--   profiles that are referenced by a map_token on an embeddable map.
--   This is the minimal-privilege approach — anon cannot enumerate all
--   profiles, only those visible in an embed context.
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Anon can view profiles on embeddable maps" ON public.profiles;

CREATE POLICY "Anon can view profiles on embeddable maps"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.map_tokens mt
      JOIN public.maps m ON m.id = mt.map_id
      WHERE mt.user_id = profiles.id
        AND m.embed_enabled = true
    )
  );
