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

-- 3. Re-create them using the function (No recursion!)
CREATE POLICY "DM and Admin can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    public.get_my_role() IN ('admin', 'dm')
  );

CREATE POLICY "Admin can update any profile"
  ON public.profiles
  FOR UPDATE
  USING (
    public.get_my_role() = 'admin'
  );
