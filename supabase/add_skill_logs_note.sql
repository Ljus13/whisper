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
