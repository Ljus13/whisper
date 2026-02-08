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
