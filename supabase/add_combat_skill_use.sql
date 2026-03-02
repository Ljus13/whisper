-- Add 'skill_use' value to combat_log_type enum
-- This allows combat logs to record when a player uses a skill during combat

ALTER TYPE combat_log_type ADD VALUE IF NOT EXISTS 'skill_use';
