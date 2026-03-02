-- ══════════════════════════════════════════════════════════════════════════════
-- WHISPER DND — Add pathway & sequence to combat_participants for NPC skill usage
-- + NPC granted skills (temporary, combat-only)
-- ══════════════════════════════════════════════════════════════════════════════

-- NPC สามารถผูกกับเส้นทาง (pathway) + ลำดับ (sequence) เพื่อให้ทีมงานใช้สกิลแทน NPC ได้
ALTER TABLE public.combat_participants
  ADD COLUMN IF NOT EXISTS pathway_id uuid REFERENCES public.skill_pathways(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sequence_id uuid REFERENCES public.skill_sequences(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.combat_participants.pathway_id IS 'เส้นทางสกิลของ NPC (null สำหรับผู้เล่น — ดึงจาก player_pathways แทน)';
COMMENT ON COLUMN public.combat_participants.sequence_id IS 'ลำดับขั้นของ NPC ในเส้นทาง (null สำหรับผู้เล่น)';

-- สกิลพิเศษ (granted) ของ NPC — เก็บเป็น JSONB array, ชั่วคราวเฉพาะ combat session นี้
-- แต่ละ element:
-- {
--   "id": "uuid",           -- unique ID (gen ฝั่ง app)
--   "name": "ชื่อสกิล",
--   "description": "รายละเอียด",
--   "spirit_cost": 4,
--   "reuse_policy": "once" | "cooldown" | "unlimited",
--   "cooldown_minutes": null | 10,
--   "times_used": 0,
--   "last_used_at": null | "2026-03-02T...",
--   "effect_hp": 0,
--   "effect_sanity": 0,
--   "effect_spirit": 0
-- }
ALTER TABLE public.combat_participants
  ADD COLUMN IF NOT EXISTS npc_granted_skills jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.combat_participants.npc_granted_skills IS 'สกิลพิเศษของ NPC — ชั่วคราวเฉพาะ combat session นี้ (JSONB array)';
