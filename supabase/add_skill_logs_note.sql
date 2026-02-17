-- Add note column to skill_usage_logs
ALTER TABLE skill_usage_logs
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS success_rate integer,
  ADD COLUMN IF NOT EXISTS roll integer,
  ADD COLUMN IF NOT EXISTS outcome text;

-- Comment on column
COMMENT ON COLUMN skill_usage_logs.note IS 'บันทึกเพิ่มเติมจากผู้ใช้ (เช่น แอคชั่นหรือภารกิจที่เกี่ยวข้อง)';
COMMENT ON COLUMN skill_usage_logs.success_rate IS 'อัตราสำเร็จ (1-20)';
COMMENT ON COLUMN skill_usage_logs.roll IS 'ผลสุ่ม (1-20)';
COMMENT ON COLUMN skill_usage_logs.outcome IS 'ผลการใช้สกิล: success/fail';

CREATE OR REPLACE FUNCTION public.get_skill_embed_log(p_reference_code text)
RETURNS TABLE (
  player_id uuid,
  skill_id uuid,
  used_at timestamptz,
  reference_code text,
  note text,
  outcome text,
  roll integer,
  success_rate integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    l.player_id,
    l.skill_id,
    l.used_at,
    l.reference_code,
    l.note,
    l.outcome,
    l.roll,
    l.success_rate
  FROM public.skill_usage_logs l
  WHERE l.reference_code = p_reference_code
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_skill_embed_log(text) TO anon, authenticated;
