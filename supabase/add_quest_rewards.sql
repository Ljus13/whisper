-- ================================================================
-- Add reward columns to quest_codes (supports negative = penalty)
-- ================================================================

ALTER TABLE quest_codes
  ADD COLUMN IF NOT EXISTS reward_hp            integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_sanity        integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_travel        integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_spirituality  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_max_sanity    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_max_travel    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_max_spirituality integer NOT NULL DEFAULT 0;
