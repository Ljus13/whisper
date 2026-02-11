-- ══════════════════════════════════════════════════════════════
-- Cron Scheduling for Auto-Apply Punishment Penalties
-- ══════════════════════════════════════════════════════════════
-- RUN THIS ONLY AFTER: add_punishment_cron.sql
--
-- Schedule: every 15 minutes
-- Unlike sleep (which resets daily at midnight), punishments have
-- arbitrary deadlines, so we check more frequently.

SELECT cron.schedule(
  'auto-apply-expired-punishments',
  '*/15 * * * *',
  $$ SELECT public.auto_apply_expired_punishments(); $$
);
