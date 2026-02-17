DROP POLICY IF EXISTS "Admin can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin and DM can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "DM can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update non-dm profiles" ON public.profiles;

CREATE POLICY "DM can update any profile"
  ON public.profiles
  FOR UPDATE
  USING (public.get_my_role() = 'dm');

CREATE POLICY "Admin can update non-dm profiles"
  ON public.profiles
  FOR UPDATE
  USING (public.get_my_role() = 'admin' AND role <> 'dm')
  WITH CHECK (public.get_my_role() = 'admin' AND role <> 'dm');
