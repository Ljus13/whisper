-- ══════════════════════════════════════════════════════════════
-- Action Code Rewards — ของรางวัลจากแอคชั่น
-- ══════════════════════════════════════════════════════════════
-- Run AFTER: add_action_quest_system.sql

-- 1. ประเภทที่ 1: มอบให้ (เพิ่มจากค่าปัจจุบัน)
ALTER TABLE public.action_codes
  ADD COLUMN IF NOT EXISTS reward_hp          int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_sanity      int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_travel      int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_spirituality int NOT NULL DEFAULT 0;

-- 2. ประเภทที่ 2: เพิ่มค่าสูงสุด (ขยาย max cap)
ALTER TABLE public.action_codes
  ADD COLUMN IF NOT EXISTS reward_max_sanity      int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_max_travel      int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_max_spirituality int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.action_codes.reward_hp IS 'HP to add to player on approval';
COMMENT ON COLUMN public.action_codes.reward_sanity IS 'Sanity to add to player on approval';
COMMENT ON COLUMN public.action_codes.reward_travel IS 'Travel points to add to player on approval';
COMMENT ON COLUMN public.action_codes.reward_spirituality IS 'Spirituality to add to player on approval';
COMMENT ON COLUMN public.action_codes.reward_max_sanity IS 'Increase max sanity cap on approval';
COMMENT ON COLUMN public.action_codes.reward_max_travel IS 'Increase max travel points cap on approval';
COMMENT ON COLUMN public.action_codes.reward_max_spirituality IS 'Increase max spirituality cap on approval';
