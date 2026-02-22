-- ══════════════════════════════════════════════════════════════
-- Cooldown & Roleplay Submission Limit for Action/Quest Codes
-- ══════════════════════════════════════════════════════════════
-- Run AFTER: add_expiration_repeat.sql

-- 1. Action Codes — เพิ่มคูลดาวน์ + จำกัดจำนวนโรลเพลย์
ALTER TABLE public.action_codes
  ADD COLUMN IF NOT EXISTS cooldown_minutes         int  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_roleplay_submissions int  DEFAULT NULL;

COMMENT ON COLUMN public.action_codes.cooldown_minutes IS 'Cooldown in minutes between submissions. NULL = no cooldown (ไม่มีคูลดาวน์)';
COMMENT ON COLUMN public.action_codes.max_roleplay_submissions IS 'Max roleplay submissions per player. NULL = unlimited (ไม่จำกัด)';

-- 2. Quest Codes — เพิ่มคูลดาวน์ + จำกัดจำนวนโรลเพลย์
ALTER TABLE public.quest_codes
  ADD COLUMN IF NOT EXISTS cooldown_minutes         int  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_roleplay_submissions int  DEFAULT NULL;

COMMENT ON COLUMN public.quest_codes.cooldown_minutes IS 'Cooldown in minutes between submissions. NULL = no cooldown (ไม่มีคูลดาวน์)';
COMMENT ON COLUMN public.quest_codes.max_roleplay_submissions IS 'Max roleplay submissions per player. NULL = unlimited (ไม่จำกัด)';
