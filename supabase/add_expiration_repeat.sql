-- ══════════════════════════════════════════════════════════════
-- Expiration & Repeat Limit for Action Codes & Quest Codes
-- ══════════════════════════════════════════════════════════════
-- Run AFTER: add_action_quest_system.sql, add_action_rewards.sql

-- 1. Action Codes — เพิ่มวันหมดอายุ + จำกัดจำนวนครั้ง
ALTER TABLE public.action_codes
  ADD COLUMN IF NOT EXISTS expires_at   timestamptz  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_repeats  int          DEFAULT NULL;

COMMENT ON COLUMN public.action_codes.expires_at IS 'Expiration date/time. NULL = never expires (ตลอดไป)';
COMMENT ON COLUMN public.action_codes.max_repeats IS 'Max times each player can submit. NULL = unlimited (ไม่จำกัด)';

-- 2. Quest Codes — เพิ่มวันหมดอายุ + จำกัดจำนวนครั้ง
ALTER TABLE public.quest_codes
  ADD COLUMN IF NOT EXISTS expires_at   timestamptz  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_repeats  int          DEFAULT NULL;

COMMENT ON COLUMN public.quest_codes.expires_at IS 'Expiration date/time. NULL = never expires (ตลอดไป)';
COMMENT ON COLUMN public.quest_codes.max_repeats IS 'Max times each player can submit. NULL = unlimited (ไม่จำกัด)';

-- Index for expiration checks
CREATE INDEX IF NOT EXISTS idx_action_codes_expires ON public.action_codes(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quest_codes_expires ON public.quest_codes(expires_at) WHERE expires_at IS NOT NULL;
