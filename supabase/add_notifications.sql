-- ══════════════════════════════════════════════════
-- NOTIFICATION SYSTEM — ระบบแจ้งเตือนเรียลไทม์
-- ══════════════════════════════════════════════════

-- Notifications table
-- target_user_id = specific player (NULL = admin/dm only notification)
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  target_user_id uuid,
  actor_id uuid,
  actor_name text,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Performance indexes
CREATE INDEX idx_notifications_target_user ON public.notifications(target_user_id, created_at DESC);
CREATE INDEX idx_notifications_admin_feed ON public.notifications(created_at DESC) WHERE target_user_id IS NULL;
CREATE INDEX idx_notifications_unread ON public.notifications(target_user_id) WHERE is_read = false;

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Players can read their own notifications
CREATE POLICY "Players can read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = target_user_id);

-- Admin/DM can read ALL notifications (admin sees everything)
CREATE POLICY "Admin can read all notifications"
  ON public.notifications FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

-- Any authenticated user can insert notifications
-- (player submitting action creates notification for admin, and vice versa)
CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Players can update (mark read) their own notifications
CREATE POLICY "Players can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = target_user_id);

-- Admin/DM can update any notification
CREATE POLICY "Admin can update notifications"
  ON public.notifications FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dm'))
  );

-- Auto-cleanup: delete notifications older than 30 days (optional cron)
-- SELECT cron.schedule('cleanup-old-notifications', '0 3 * * *', $$
--   DELETE FROM public.notifications WHERE created_at < now() - interval '30 days';
-- $$);

-- Add to realtime publication for postgres_changes backup
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
