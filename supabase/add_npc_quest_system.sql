-- ══════════════════════════════════════════════════════════════
-- NPC Quest System — เพิ่มเขตทำการ NPC + เชื่อมภารกิจกับ NPC
-- ══════════════════════════════════════════════════════════════
-- Run AFTER: add_map_tokens.sql, add_action_quest_system.sql, add_quest_map_requirement.sql

-- ─────────────────────────────────────────────
-- 1. เพิ่ม interaction_radius ให้ NPC tokens
--    (radius เป็น % ของภาพแมพ, default = 0 คือไม่แสดงรัศมี)
-- ─────────────────────────────────────────────
ALTER TABLE public.map_tokens
  ADD COLUMN IF NOT EXISTS interaction_radius float NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.map_tokens.interaction_radius
  IS 'NPC interaction radius as percentage of map image (0 = no radius). Used for quest proximity checks.';

-- ─────────────────────────────────────────────
-- 2. เพิ่ม npc_token_id ให้ quest_codes
--    (nullable = ภารกิจไม่กำหนด NPC)
-- ─────────────────────────────────────────────
ALTER TABLE public.quest_codes
  ADD COLUMN IF NOT EXISTS npc_token_id uuid REFERENCES public.map_tokens(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.quest_codes.npc_token_id
  IS 'Optional NPC requirement. If set, player must be within NPC interaction radius to submit the quest.';

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_quest_codes_npc_token_id ON public.quest_codes(npc_token_id);
