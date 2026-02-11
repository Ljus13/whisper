-- ══════════════════════════════════════════════════════════════
-- pg_cron: Auto-apply Punishment Penalties (ลงโทษอัตโนมัติ)
-- ══════════════════════════════════════════════════════════════
-- RUN AFTER: add_punishment_system.sql
-- Then run add_punishment_cron_schedule.sql separately to register the cron job

-- Function: auto-apply penalties for expired punishments
-- Runs periodically to find punishments past their deadline,
-- apply penalties to players who haven't completed tasks or requested mercy,
-- and deactivate fully-processed punishments.
CREATE OR REPLACE FUNCTION public.auto_apply_expired_punishments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pun       RECORD;   -- punishment row
  pp        RECORD;   -- punishment_player row
  prof      RECORD;   -- profile row
  new_max_san   int;
  new_max_trv   int;
  new_max_spr   int;
  remaining     int;
BEGIN
  -- Loop through every active punishment whose deadline has passed
  FOR pun IN
    SELECT *
    FROM public.punishments
    WHERE is_active = true
      AND deadline IS NOT NULL
      AND deadline < now()
  LOOP

    -- Find players who haven't been penalized AND haven't requested mercy
    remaining := 0;

    FOR pp IN
      SELECT ppl.id, ppl.player_id
      FROM public.punishment_players ppl
      WHERE ppl.punishment_id = pun.id
        AND ppl.penalty_applied = false
        AND ppl.mercy_requested = false
    LOOP
      remaining := remaining + 1;

      -- Get player profile stats
      SELECT p.hp, p.sanity, p.max_sanity,
             p.travel_points, p.max_travel_points,
             p.spirituality, p.max_spirituality
      INTO prof
      FROM public.profiles p
      WHERE p.id = pp.player_id;

      IF NOT FOUND THEN
        CONTINUE;
      END IF;

      -- Calculate new max values first (they affect current value caps)
      new_max_san := GREATEST(0, COALESCE(prof.max_sanity, 10) - pun.penalty_max_sanity);
      new_max_trv := GREATEST(0, COALESCE(prof.max_travel_points, 10) - pun.penalty_max_travel);
      new_max_spr := GREATEST(0, COALESCE(prof.max_spirituality, 10) - pun.penalty_max_spirituality);

      -- Apply all penalties in one UPDATE
      UPDATE public.profiles
      SET
        -- Max stats reduction
        max_sanity        = CASE WHEN pun.penalty_max_sanity > 0
                                 THEN new_max_san
                                 ELSE max_sanity END,
        max_travel_points = CASE WHEN pun.penalty_max_travel > 0
                                 THEN new_max_trv
                                 ELSE max_travel_points END,
        max_spirituality  = CASE WHEN pun.penalty_max_spirituality > 0
                                 THEN new_max_spr
                                 ELSE max_spirituality END,

        -- Current stats reduction (capped at 0 and at new max)
        sanity = CASE
          WHEN pun.penalty_sanity > 0
            THEN GREATEST(0, LEAST(new_max_san, COALESCE(prof.sanity, 0) - pun.penalty_sanity))
          WHEN pun.penalty_max_sanity > 0
            THEN LEAST(new_max_san, COALESCE(prof.sanity, 0))
          ELSE sanity END,

        hp = CASE WHEN pun.penalty_hp > 0
                  THEN GREATEST(0, COALESCE(prof.hp, 0) - pun.penalty_hp)
                  ELSE hp END,

        travel_points = CASE
          WHEN pun.penalty_travel > 0
            THEN GREATEST(0, LEAST(new_max_trv, COALESCE(prof.travel_points, 0) - pun.penalty_travel))
          WHEN pun.penalty_max_travel > 0
            THEN LEAST(new_max_trv, COALESCE(prof.travel_points, 0))
          ELSE travel_points END,

        spirituality = CASE
          WHEN pun.penalty_spirituality > 0
            THEN GREATEST(0, LEAST(new_max_spr, COALESCE(prof.spirituality, 0) - pun.penalty_spirituality))
          WHEN pun.penalty_max_spirituality > 0
            THEN LEAST(new_max_spr, COALESCE(prof.spirituality, 0))
          ELSE spirituality END,

        updated_at = now()
      WHERE id = pp.player_id;

      -- Mark penalty as applied
      UPDATE public.punishment_players
      SET penalty_applied = true
      WHERE id = pp.id;

      -- Log the auto-penalty
      INSERT INTO public.punishment_logs (punishment_id, player_id, action, details, created_by)
      VALUES (
        pun.id,
        pp.player_id,
        'penalty_applied',
        jsonb_build_object(
          'auto', true,
          'reason', 'หมดเวลาบทลงโทษ — ลงโทษอัตโนมัติ (pg_cron)',
          'penalty_sanity', pun.penalty_sanity,
          'penalty_hp', pun.penalty_hp,
          'penalty_travel', pun.penalty_travel,
          'penalty_spirituality', pun.penalty_spirituality,
          'penalty_max_sanity', pun.penalty_max_sanity,
          'penalty_max_travel', pun.penalty_max_travel,
          'penalty_max_spirituality', pun.penalty_max_spirituality
        ),
        pun.created_by   -- use the admin who created the punishment
      );
    END LOOP;

    -- Deactivate the punishment after processing all players
    -- (even if remaining=0, that means all players already handled)
    UPDATE public.punishments
    SET is_active = false,
        updated_at = now()
    WHERE id = pun.id;

  END LOOP;
END;
$$;
