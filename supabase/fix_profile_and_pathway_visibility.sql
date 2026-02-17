-- ══════════════════════════════════════════════════════════════
-- FIX: Profile & Player Pathway Visibility Issues
-- ══════════════════════════════════════════════════════════════
-- Issue 1: Admin ไม่ควรแก้ไขโปรไฟล์ของ DM
--          → ปรับให้ DM แก้ไขได้ทุกโปรไฟล์ และ Admin แก้ไขได้เฉพาะที่ไม่ใช่ DM
-- Issue 2: Players cannot see other players' pathways in player list
--          → player_pathways only has "view own" + "admin/dm view all" policies
--          → Need to add policy allowing all authenticated users to view all player_pathways
-- ══════════════════════════════════════════════════════════════

-- ┌──────────────────────────────────────────────────────────────┐
-- │  FIX 1: Allow Admin AND DM to update any profile            │
-- └──────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS "Admin can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin and DM can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "DM can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update non-dm profiles" ON public.profiles;

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


-- ┌──────────────────────────────────────────────────────────────┐
-- │  FIX 2: Allow all authenticated users to view player_pathways│
-- │         (needed for player list to show pathways/sequences)  │
-- └──────────────────────────────────────────────────────────────┘

-- Keep existing policies (view own, admin/dm view all) but add a general one
CREATE POLICY "All authenticated users can view player_pathways"
  ON public.player_pathways
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
  );

-- Note: This doesn't conflict with existing policies because RLS uses OR logic
-- i.e., if ANY policy allows access, the row is visible

-- ✅ Done — Admin/DM can now edit all profiles, and all players can see each other's pathways
