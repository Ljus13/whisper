-- ══════════════════════════════════════════════════════════════
-- Add category column to skills table
-- Categories: จิตใจ (WIS), คำสาป, กายภาพ, โรลเพลย์, รักษา, 
--             ความตาย, บัฟ, เวทมนตร์, การตรวจสอบ, ประดิษฐ์
-- ══════════════════════════════════════════════════════════════

-- Add category column to skills table
ALTER TABLE public.skills 
ADD COLUMN IF NOT EXISTS category text;

-- Add comment explaining the category column
COMMENT ON COLUMN public.skills.category IS 'ประเภทของสกิล: จิตใจ (WIS), คำสาป, กายภาพ, โรลเพลย์, รักษา, ความตาย, บัฟ, เวทมนตร์, การตรวจสอบ, ประดิษฐ์';

-- Create index for category filtering
CREATE INDEX IF NOT EXISTS idx_skills_category ON public.skills(category);
