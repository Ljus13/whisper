-- ══════════════════════════════════════════════════════════════
-- Add DEX and WIS fields to combat_participants table
-- ══════════════════════════════════════════════════════════════

-- Add DEX and WIS columns
ALTER TABLE public.combat_participants 
ADD COLUMN IF NOT EXISTS current_dex integer NOT NULL DEFAULT 10 CHECK (current_dex >= 0),
ADD COLUMN IF NOT EXISTS current_wis integer NOT NULL DEFAULT 10 CHECK (current_wis >= 0);

-- Add comments
COMMENT ON COLUMN public.combat_participants.current_dex IS 'ความคล่องแคล่ว (Dexterity)';
COMMENT ON COLUMN public.combat_participants.current_wis IS 'ปัญญา (Wisdom)';
