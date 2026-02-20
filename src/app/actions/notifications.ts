'use server'

import { createClient } from '@/lib/supabase/server'

const NOTIF_PAGE_SIZE = 30

/* ══════════════════════════════════════════════════════════════
   Broadcast notification via Supabase Realtime
   ══════════════════════════════════════════════════════════════ */

async function broadcastRefreshInternal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  channelName: string,
  eventName: string,
  payload: Record<string, unknown>
) {
  try {
    await Promise.race([
      new Promise<void>((resolve) => {
        const channel = supabase.channel(channelName)
        channel.subscribe(async (status: string) => {
          if (status !== 'SUBSCRIBED') return
          try {
            await channel.send({ type: 'broadcast', event: eventName, payload })
          } catch {}
          try { supabase.removeChannel(channel) } catch {}
          resolve()
        })
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 500))
    ])
  } catch {}
}

/**
 * Broadcast a notification event so clients show it instantly.
 * payload includes the notification data for immediate display.
 */
async function broadcastNotification(
  supabase: Awaited<ReturnType<typeof createClient>>,
  notification: {
    id: string
    target_user_id: string | null
    type: string
    title: string
    message: string | null
    link: string | null
    actor_name: string | null
    created_at: string
  }
) {
  await broadcastRefreshInternal(
    supabase,
    'notification_realtime',
    'new_notification',
    { ...notification, ts: Date.now() }
  )
}

/* ══════════════════════════════════════════════════════════════
   Create & broadcast notification (used by all server actions)
   ══════════════════════════════════════════════════════════════ */

export interface NotificationInput {
  targetUserId: string | null // null = admin/dm notification
  actorId: string
  actorName: string
  type: string
  title: string
  message?: string
  link?: string
}

/**
 * Insert a notification into the database and broadcast it via realtime.
 * Fire-and-forget — errors are silently caught so they never break the caller.
 */
export async function createNotification(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: NotificationInput
) {
  try {
    const { data } = await supabase
      .from('notifications')
      .insert({
        target_user_id: input.targetUserId,
        actor_id: input.actorId,
        actor_name: input.actorName,
        type: input.type,
        title: input.title,
        message: input.message || null,
        link: input.link || null,
      })
      .select('id, target_user_id, type, title, message, link, actor_name, created_at')
      .single()

    if (data) {
      await broadcastNotification(supabase, data)
    }
  } catch {
    // Never let notification errors break the main action
  }
}

/**
 * Create multiple notifications at once (e.g. punishment assigned to N players).
 */
export async function createNotifications(
  supabase: Awaited<ReturnType<typeof createClient>>,
  inputs: NotificationInput[]
) {
  if (inputs.length === 0) return
  try {
    const rows = inputs.map(input => ({
      target_user_id: input.targetUserId,
      actor_id: input.actorId,
      actor_name: input.actorName,
      type: input.type,
      title: input.title,
      message: input.message || null,
      link: input.link || null,
    }))

    const { data } = await supabase
      .from('notifications')
      .insert(rows)
      .select('id, target_user_id, type, title, message, link, actor_name, created_at')

    // Broadcast all at once
    if (data && data.length > 0) {
      for (const n of data) {
        await broadcastNotification(supabase, n)
      }
    }
  } catch {}
}

/* ══════════════════════════════════════════════════════════════
   READ operations (called from client components)
   ══════════════════════════════════════════════════════════════ */

/**
 * Get notifications for the current user.
 * - Admin/DM: sees only null-target (broadcast) or notifications targeted to themselves
 * - Player: sees only notifications targeted to them
 */
export async function getNotifications(page: number = 1) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { notifications: [], total: 0 }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'dm'
  const offset = (page - 1) * NOTIF_PAGE_SIZE

  let query = supabase
    .from('notifications')
    .select('id, target_user_id, actor_id, actor_name, type, title, message, link, is_read, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + NOTIF_PAGE_SIZE - 1)

  // Everyone sees only their own or null-target notifications
  query = query.or(`target_user_id.eq.${user.id},target_user_id.is.null`)

  const { data, count, error } = await query

  if (error) return { notifications: [], total: 0 }

  return {
    notifications: data || [],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / NOTIF_PAGE_SIZE),
    isAdmin,
  }
}

/**
 * Get unread notification count for the current user.
 */
export async function getUnreadNotificationCount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const query = supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)
    .or(`target_user_id.eq.${user.id},target_user_id.is.null`)

  const { count } = await query
  return count || 0
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
}

/**
 * Mark all notifications as read for the current user.
 */
export async function markAllNotificationsRead() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false)
    .or(`target_user_id.eq.${user.id},target_user_id.is.null`)
}
