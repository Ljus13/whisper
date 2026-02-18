-- ══════════════════════════════════════════════════════════════
-- Quick-apply: REPLICA IDENTITY FULL + RPC function + Realtime publications
-- Run this in Supabase SQL Editor to fix realtime + punishment progress
-- ══════════════════════════════════════════════════════════════

-- 1. REPLICA IDENTITY FULL for all realtime tables
--    (Required for Supabase Realtime to evaluate RLS policies)
ALTER TABLE public.action_submissions REPLICA IDENTITY FULL;
ALTER TABLE public.quest_submissions REPLICA IDENTITY FULL;
ALTER TABLE public.sleep_requests REPLICA IDENTITY FULL;
ALTER TABLE public.roleplay_submissions REPLICA IDENTITY FULL;
ALTER TABLE public.roleplay_links REPLICA IDENTITY FULL;
ALTER TABLE public.punishments REPLICA IDENTITY FULL;
ALTER TABLE public.punishment_players REPLICA IDENTITY FULL;
ALTER TABLE public.punishment_required_tasks REPLICA IDENTITY FULL;
ALTER TABLE public.punishment_logs REPLICA IDENTITY FULL;

-- 2. Add missing tables to realtime publication
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'sleep_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sleep_requests;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'punishment_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.punishment_logs;
  END IF;
END $$;

-- 3. RPC: Check punishment task completion (SECURITY DEFINER — bypasses RLS)
CREATE OR REPLACE FUNCTION public.check_punishment_task_completion(
  p_punishment_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_event_mode text;
  v_group_mode text;
  v_created_at timestamptz;
  v_task record;
  v_total int := 0;
  v_done int := 0;
  v_assigned_ids uuid[];
BEGIN
  SELECT event_mode, group_mode, created_at INTO v_event_mode, v_group_mode, v_created_at
  FROM public.punishments WHERE id = p_punishment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allCompleted', false, 'done', 0, 'total', 0);
  END IF;

  SELECT array_agg(player_id) INTO v_assigned_ids
  FROM public.punishment_players WHERE punishment_id = p_punishment_id;

  IF v_assigned_ids IS NULL THEN
    RETURN jsonb_build_object('allCompleted', false, 'done', 0, 'total', 0);
  END IF;

  FOR v_task IN
    SELECT action_code_id, quest_code_id
    FROM public.punishment_required_tasks
    WHERE punishment_id = p_punishment_id
  LOOP
    v_total := v_total + 1;

    IF v_event_mode = 'group' AND v_group_mode = 'shared' THEN
      IF v_task.action_code_id IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM public.action_submissions
          WHERE action_code_id = v_task.action_code_id
            AND player_id = ANY(v_assigned_ids)
            AND status = 'approved'
            AND created_at >= v_created_at
        ) THEN
          v_done := v_done + 1;
        END IF;
      ELSIF v_task.quest_code_id IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM public.quest_submissions
          WHERE quest_code_id = v_task.quest_code_id
            AND player_id = ANY(v_assigned_ids)
            AND status = 'approved'
            AND created_at >= v_created_at
        ) THEN
          v_done := v_done + 1;
        END IF;
      END IF;
    ELSE
      IF v_task.action_code_id IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM public.action_submissions
          WHERE action_code_id = v_task.action_code_id
            AND player_id = p_user_id
            AND status = 'approved'
            AND created_at >= v_created_at
        ) THEN
          v_done := v_done + 1;
        END IF;
      ELSIF v_task.quest_code_id IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM public.quest_submissions
          WHERE quest_code_id = v_task.quest_code_id
            AND player_id = p_user_id
            AND status = 'approved'
            AND created_at >= v_created_at
        ) THEN
          v_done := v_done + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('allCompleted', v_done >= v_total AND v_total > 0, 'done', v_done, 'total', v_total);
END;
$$;

-- 4. RPC: Complete shared punishment for all players (SECURITY DEFINER — bypasses RLS)
--    Used when shared mode tasks are all done and any player clicks mercy
CREATE OR REPLACE FUNCTION public.complete_shared_punishment(
  p_punishment_id uuid,
  p_submitted_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_affected int;
  v_player_ids uuid[];
BEGIN
  -- Update all pending players to mercy_requested + completed
  UPDATE public.punishment_players
  SET mercy_requested = true,
      mercy_requested_at = v_now,
      is_completed = true,
      completed_at = v_now
  WHERE punishment_id = p_punishment_id
    AND mercy_requested = false;

  GET DIAGNOSTICS v_affected = ROW_COUNT;

  -- Set primary submitter
  UPDATE public.punishments
  SET primary_submitter_id = p_submitted_by
  WHERE id = p_punishment_id
    AND primary_submitter_id IS NULL;

  -- Get all player IDs for logging
  SELECT array_agg(player_id) INTO v_player_ids
  FROM public.punishment_players
  WHERE punishment_id = p_punishment_id;

  -- Insert logs for all players
  IF v_player_ids IS NOT NULL THEN
    INSERT INTO public.punishment_logs (punishment_id, player_id, action, details, created_by)
    SELECT p_punishment_id, unnest(v_player_ids), 'mercy_requested',
           jsonb_build_object('mode', 'group_shared', 'primary_submitter_id', p_submitted_by),
           p_submitted_by;
  END IF;

  RETURN jsonb_build_object('success', true, 'updated', v_affected);
END;
$$;
