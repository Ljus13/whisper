-- ══════════════════════════════════════════════════════════════
-- REPAIR SCRIPT: Backfill Missing Profiles
-- ══════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor to ensure all users have a profile

INSERT INTO public.profiles (id, display_name, avatar_url, role)
SELECT 
  id,
  COALESCE(
    raw_user_meta_data ->> 'full_name',
    raw_user_meta_data ->> 'name',
    raw_user_meta_data ->> 'user_name',
    split_part(email, '@', 1)
  ) as display_name,
  COALESCE(
    raw_user_meta_data ->> 'avatar_url',
    raw_user_meta_data ->> 'picture'
  ) as avatar_url,
  'player' as role
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- DIAGNOSTIC: Check your specific user
-- Replace 'your-email@example.com' with your actual email to check
-- ══════════════════════════════════════════════════════════════
/*
SELECT au.id as auth_id, au.email, p.id as profile_id, p.role 
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE au.email = 'YOUR_EMAIL_HERE';
*/
