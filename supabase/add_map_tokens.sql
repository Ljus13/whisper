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
