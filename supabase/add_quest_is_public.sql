-- ══════════════════════════════════════════════════════════════
--  Add is_public column to quest_codes
--  TRUE  = เผยแพร่ (public) → Discord bot จะแจ้งเตือน
--  FALSE = ไพรเวท  (private) → ไม่แจ้งเตือน
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.quest_codes
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;

-- Index เพื่อ query เฉพาะ public quests ได้เร็ว
CREATE INDEX IF NOT EXISTS idx_quest_codes_is_public
  ON public.quest_codes(is_public) WHERE is_public = true;

-- Comment สำหรับเอกสาร
COMMENT ON COLUMN public.quest_codes.is_public IS
  'true = เผยแพร่ให้ทุกคนเห็น (Discord notification จะถูกส่ง), false = ไพรเวท (เฉพาะ admin/dm เห็น)';
