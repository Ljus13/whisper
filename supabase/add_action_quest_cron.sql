-- ══════════════════════════════════════════════════════════════
-- Cron Scheduling for Auto-Approve Sleep Requests
-- ══════════════════════════════════════════════════════════════
-- RUN THIS ONLY AFTER: add_action_quest_system.sql

-- Schedule: run every day at midnight (UTC+7 = 17:00 UTC)
-- Adjust the cron time to match your timezone
-- '0 17 * * *' = 17:00 UTC = 00:00 ICT (Bangkok)
SELECT cron.schedule(
  'auto-approve-sleep-requests',
  '0 17 * * *',
  $$ SELECT public.auto_approve_expired_sleep_requests(); $$
);
