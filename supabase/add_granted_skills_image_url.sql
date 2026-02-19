-- ══════════════════════════════════════════════════════════════
-- WHISPER DND — Add image_url to granted_skills + edit/delete support
-- ══════════════════════════════════════════════════════════════

-- 1. Add image_url column
ALTER TABLE public.granted_skills
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.granted_skills.image_url IS 'Direct URL ของรูปภาพสกิล (optional)';
