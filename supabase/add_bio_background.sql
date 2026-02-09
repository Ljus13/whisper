-- ═══════════════════════════════════════════
-- Add bio and background_url to profiles
-- ═══════════════════════════════════════════

-- Background image for player cards
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS background_url TEXT DEFAULT NULL;

-- Rich-text bio (stores HTML from TipTap editor)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT NULL;

-- Allow players to update their own bio and background
-- (RLS policy should already allow profile owner to update their own row)
