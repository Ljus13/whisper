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
