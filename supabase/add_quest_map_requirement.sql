-- ══════════════════════════════════════════════════════════════
-- Quest Map Requirement — ภารกิจที่ต้องอยู่ในแมพที่กำหนด
-- ══════════════════════════════════════════════════════════════
-- Run AFTER: add_action_quest_system.sql and add_maps.sql

-- 1. Add map_id column to quest_codes (nullable = quest ไม่บังคับสถานที่)
ALTER TABLE public.quest_codes
  ADD COLUMN IF NOT EXISTS map_id uuid REFERENCES public.maps(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.quest_codes.map_id IS 'Optional map requirement. If set, player must be on this map to submit the quest.';

-- 2. Index for lookups
CREATE INDEX IF NOT EXISTS idx_quest_codes_map_id ON public.quest_codes(map_id);
