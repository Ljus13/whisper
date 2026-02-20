-- ============================================================
-- add_discord_integration.sql
-- เพิ่ม discord_user_id ใน profiles + backfill + trigger
-- ============================================================

-- 1. เพิ่มคอลัมน์ discord_user_id
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discord_user_id TEXT UNIQUE;

-- 2. Index สำหรับ lookup เร็ว
CREATE INDEX IF NOT EXISTS idx_profiles_discord_user_id
  ON public.profiles (discord_user_id)
  WHERE discord_user_id IS NOT NULL;

-- 3. Backfill จาก auth.identities (users ที่ login ด้วย Discord แต่ยังไม่มีค่า)
UPDATE public.profiles p
SET discord_user_id = i.provider_id
FROM auth.identities i
WHERE i.user_id = p.id
  AND i.provider = 'discord'
  AND p.discord_user_id IS NULL;

-- ตรวจสอบผล backfill
DO $$
DECLARE
  v_total   INT;
  v_linked  INT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.profiles;
  SELECT COUNT(*) INTO v_linked FROM public.profiles WHERE discord_user_id IS NOT NULL;
  RAISE NOTICE 'Backfill complete: % / % profiles linked', v_linked, v_total;
END $$;

-- 4. อัปเดต trigger handle_new_user ให้ set discord_user_id อัตโนมัติตอน signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_discord_id TEXT;
BEGIN
  -- ดึง discord user id จาก raw_user_meta_data (มีเมื่อ provider = discord)
  IF NEW.raw_user_meta_data ? 'provider_id' AND
     NEW.raw_user_meta_data ->> 'iss' IS NOT NULL AND
     NEW.raw_user_meta_data ->> 'iss' LIKE '%discord%' THEN
    v_discord_id := NEW.raw_user_meta_data ->> 'provider_id';
  ELSIF NEW.raw_user_meta_data ? 'sub' THEN
    -- fallback: ใช้ sub ซึ่ง discord ใส่เป็น discord user id
    v_discord_id := NEW.raw_user_meta_data ->> 'sub';
  ELSE
    v_discord_id := NULL;
  END IF;

  INSERT INTO public.profiles (
    id,
    display_name,
    avatar_url,
    role,
    discord_user_id,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name',
             NEW.raw_user_meta_data ->> 'name',
             NEW.raw_user_meta_data ->> 'user_name',
             split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url',
             NEW.raw_user_meta_data ->> 'picture'),
    'player',
    v_discord_id,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    discord_user_id = COALESCE(EXCLUDED.discord_user_id, public.profiles.discord_user_id),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- ตรวจสอบว่า trigger ยังอยู่
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'on_auth_user_created'
      AND event_object_schema = 'auth'
      AND event_object_table = 'users'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    RAISE NOTICE 'Trigger created: on_auth_user_created';
  ELSE
    RAISE NOTICE 'Trigger already exists: on_auth_user_created';
  END IF;
END $$;
