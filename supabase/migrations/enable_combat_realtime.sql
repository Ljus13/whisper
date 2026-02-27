-- ══════════════════════════════════════════════════════════════
-- Enable Realtime for Combat System Tables
-- ══════════════════════════════════════════════════════════════

-- Enable REPLICA IDENTITY for realtime updates
ALTER TABLE public.combat_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.combat_participants REPLICA IDENTITY FULL;
ALTER TABLE public.combat_logs REPLICA IDENTITY FULL;

-- Enable realtime publication (idempotent - use exception handling)
DO $$ 
BEGIN
  -- Try to drop tables from publication (ignore errors if not in publication)
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.combat_sessions;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.combat_participants;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.combat_logs;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  -- Add tables to publication (ignore errors if already in publication)
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.combat_sessions;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.combat_participants;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.combat_logs;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
