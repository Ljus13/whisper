-- ============================================================
-- FIX: Inverted Sequence System (9=weakest → 0=strongest)
-- ============================================================
-- seq_number range: 0–9
-- Lower number = stronger / higher rank
-- Players keep cumulative skills from higher seq_numbers
-- ============================================================

-- Add CHECK constraint to enforce 0–9 range
ALTER TABLE public.skill_sequences
  DROP CONSTRAINT IF EXISTS skill_sequences_seq_number_range;

ALTER TABLE public.skill_sequences
  ADD CONSTRAINT skill_sequences_seq_number_range
  CHECK (seq_number >= 0 AND seq_number <= 9);

-- Update comments
COMMENT ON TABLE  public.skill_sequences IS 'ลำดับขั้น (Sequence): 9 = อ่อนแอที่สุด → 0 = แข็งแกร่งที่สุด. สกิลสะสมจากลำดับก่อนหน้า';
COMMENT ON COLUMN public.skill_sequences.seq_number IS 'ลำดับ 9 (เริ่มต้น) → 0 (สูงสุด). ยิ่งเลขน้อย ยิ่งแข็งแกร่ง';
COMMENT ON COLUMN public.skills.sequence_id IS 'ลำดับขั้นขั้นต่ำที่ต้องถึงจึงจะใช้สกิลนี้ได้ (ยิ่งเลขน้อย = ยิ่งยาก)';

-- ✅ Done — Now seq_number restricted to 0-9
