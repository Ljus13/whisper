-- Add reference_code column to skill_usage_logs
ALTER TABLE skill_usage_logs
  ADD COLUMN IF NOT EXISTS reference_code TEXT;

-- Create index for fast lookups by reference code
CREATE INDEX IF NOT EXISTS idx_skill_usage_logs_reference_code
  ON skill_usage_logs (reference_code);

-- Create index for player log queries with pagination
CREATE INDEX IF NOT EXISTS idx_skill_usage_logs_player_used_at
  ON skill_usage_logs (player_id, used_at DESC);

-- Create index for admin log queries with pagination
CREATE INDEX IF NOT EXISTS idx_skill_usage_logs_used_at
  ON skill_usage_logs (used_at DESC);
