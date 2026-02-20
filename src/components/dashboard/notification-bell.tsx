'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, X, Check, CheckCheck, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/app/actions/notifications'

/* ── Notification type icons & labels ── */
const NOTIF_META: Record<string, { icon: string; color: string }> = {
  // Action/Quest
  action_submitted:     { icon: '⚔️', color: 'text-amber-400' },
  action_approved:      { icon: '✅', color: 'text-emerald-400' },
  action_rejected:      { icon: '❌', color: 'text-red-400' },
  quest_submitted:      { icon: '🎯', color: 'text-emerald-400' },
  quest_approved:       { icon: '✅', color: 'text-emerald-400' },
  quest_rejected:       { icon: '❌', color: 'text-red-400' },
  // Sleep
  sleep_submitted:      { icon: '😴', color: 'text-indigo-400' },
  sleep_approved:       { icon: '💤', color: 'text-indigo-400' },
  sleep_rejected:       { icon: '❌', color: 'text-red-400' },
  // Punishment
  punishment_assigned:  { icon: '💀', color: 'text-red-400' },
  punishment_submitted: { icon: '📨', color: 'text-amber-400' },
  penalty_applied:      { icon: '⚡', color: 'text-red-400' },
  // Skills
  skill_granted:        { icon: '🎁', color: 'text-purple-400' },
  skill_revoked:        { icon: '🚫', color: 'text-red-400' },
  skill_transferred:    { icon: '🔄', color: 'text-blue-400' },
  skill_used:           { icon: '✨', color: 'text-yellow-400' },
  // Roleplay
  roleplay_submitted:   { icon: '🎭', color: 'text-pink-400' },
  roleplay_reviewed:    { icon: '📝', color: 'text-pink-400' },
  // Prayer
  prayer_submitted:     { icon: '🙏', color: 'text-sky-400' },
  // Pathway
  pathway_granted:      { icon: '🧪', color: 'text-teal-400' },
  pathway_accepted:     { icon: '🌿', color: 'text-teal-400' },
  digest_promoted:      { icon: '⬆️', color: 'text-teal-400' },
  // Admin
  player_updated:       { icon: '📋', color: 'text-amber-400' },
  // Default
  default:              { icon: '🔔', color: 'text-gold-400' },
}

function getNotifMeta(type: string) {
  return NOTIF_META[type] || NOTIF_META.default
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const d = new Date(dateStr).getTime()
  const diff = Math.max(0, now - d)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'เมื่อสักครู่'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} นาทีที่แล้ว`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} ชั่วโมงที่แล้ว`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} วันที่แล้ว`
  return `${Math.floor(day / 7)} สัปดาห์ที่แล้ว`
}

interface NotificationItem {
  id: string
  target_user_id: string | null
  actor_id: string | null
  actor_name: string | null
  type: string
  title: string
  message: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export default function NotificationBell({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)
  const mountedRef = useRef(true)

  // ── Fetch unread count on mount ──
  const fetchUnreadCount = useCallback(async () => {
    const count = await getUnreadNotificationCount()
    if (mountedRef.current) setUnreadCount(count)
  }, [])

  // ── Fetch notification list ──
  const fetchNotifications = useCallback(async (p: number = 1, append = false) => {
    setLoading(true)
    const result = await getNotifications(p)
    if (!mountedRef.current) return
    if (append) {
      setNotifications(prev => [...prev, ...result.notifications])
    } else {
      setNotifications(result.notifications)
    }
    setHasMore(p < (result.totalPages ?? 1))
    setPage(p)
    setLoading(false)
  }, [])

  // ── Initial load ──
  useEffect(() => {
    mountedRef.current = true
    fetchUnreadCount()
    return () => { mountedRef.current = false }
  }, [fetchUnreadCount])

  // ── Load notifications when dropdown opens ──
  useEffect(() => {
    if (isOpen) {
      fetchNotifications(1)
    }
  }, [isOpen, fetchNotifications])

  // ── Close dropdown on outside click ──
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [isOpen])

  // ── Realtime: Broadcast subscription (instant) ──
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('notification_realtime', { config: { broadcast: { self: true } } })
      .on('broadcast', { event: 'new_notification' }, ({ payload }) => {
        if (!payload) return

        // Filter: admin sees all, player sees only their own
        if (!isAdmin && payload.target_user_id !== userId) return

        const newNotif: NotificationItem = {
          id: payload.id,
          target_user_id: payload.target_user_id,
          actor_id: payload.actor_id || null,
          actor_name: payload.actor_name || null,
          type: payload.type,
          title: payload.title,
          message: payload.message || null,
          link: payload.link || null,
          is_read: false,
          created_at: payload.created_at || new Date().toISOString(),
        }

        // Prepend to list (avoid duplicates)
        setNotifications(prev => {
          if (prev.some(n => n.id === newNotif.id)) return prev
          return [newNotif, ...prev]
        })
        setUnreadCount(prev => prev + 1)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, isAdmin])

  // ── Realtime: Postgres changes (backup) ──
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('notification_pg_backup')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const row = payload.new as NotificationItem
        if (!row) return

        // Filter for player
        if (!isAdmin && row.target_user_id !== userId) return

        setNotifications(prev => {
          if (prev.some(n => n.id === row.id)) return prev
          return [row, ...prev]
        })
        setUnreadCount(prev => prev + 1)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, isAdmin])

  // ── Mark single notification as read ──
  async function handleMarkRead(notifId: string) {
    setNotifications(prev =>
      prev.map(n => n.id === notifId ? { ...n, is_read: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
    await markNotificationRead(notifId)
  }

  // ── Mark all as read ──
  async function handleMarkAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
    await markAllNotificationsRead()
  }

  // ── Load more (pagination) ──
  function handleLoadMore() {
    if (!loading && hasMore) {
      fetchNotifications(page + 1, true)
    }
  }

  return (
    <div className="relative">
      {/* Bell icon */}
      <button
        ref={bellRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg border border-gold-400/10 text-gold-400 hover:bg-victorian-800/50 transition-colors cursor-pointer"
        aria-label="การแจ้งเตือน"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 w-[360px] max-h-[480px] overflow-hidden rounded-xl border border-gold-400/20 bg-victorian-900 shadow-2xl shadow-black/50 z-[60] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gold-400/10">
            <h3 className="text-gold-400 font-bold text-sm flex items-center gap-2">
              <Bell className="w-4 h-4" /> การแจ้งเตือน
              {unreadCount > 0 && (
                <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full border border-red-500/30">
                  {unreadCount} ใหม่
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[10px] text-gold-400/70 hover:text-gold-400 transition-colors cursor-pointer flex items-center gap-1"
                  title="อ่านทั้งหมด"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> อ่านทั้งหมด
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-victorian-400 hover:text-gold-400 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {notifications.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-12 text-victorian-500">
                <Bell className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">ยังไม่มีการแจ้งเตือน</p>
              </div>
            )}

            {notifications.map((notif) => {
              const meta = getNotifMeta(notif.type)
              return (
                <div
                  key={notif.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-victorian-800/50 transition-colors cursor-pointer hover:bg-victorian-800/30 ${
                    !notif.is_read ? 'bg-gold-400/5' : ''
                  }`}
                  onClick={() => {
                    if (!notif.is_read) handleMarkRead(notif.id)
                    if (notif.link) {
                      window.location.href = notif.link
                      setIsOpen(false)
                    }
                  }}
                >
                  {/* Icon */}
                  <div className="shrink-0 w-8 h-8 rounded-full bg-victorian-800 border border-gold-400/10 flex items-center justify-center text-sm">
                    {meta.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${!notif.is_read ? 'text-victorian-100' : 'text-victorian-300'}`}>
                      {notif.title}
                    </p>
                    {notif.message && (
                      <p className="text-[11px] text-victorian-400 mt-0.5 line-clamp-2">{notif.message}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-victorian-500">{timeAgo(notif.created_at)}</span>
                      {notif.actor_name && (
                        <span className="text-[10px] text-victorian-500">โดย {notif.actor_name}</span>
                      )}
                      {notif.link && (
                        <ExternalLink className="w-2.5 h-2.5 text-victorian-500" />
                      )}
                    </div>
                  </div>

                  {/* Unread dot */}
                  {!notif.is_read && (
                    <div className="shrink-0 mt-1.5">
                      <div className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
                    </div>
                  )}
                </div>
              )
            })}

            {/* Load more */}
            {hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="w-full py-3 text-xs text-gold-400/70 hover:text-gold-400 hover:bg-victorian-800/30 transition-colors cursor-pointer"
              >
                {loading ? 'กำลังโหลด...' : 'โหลดเพิ่มเติม'}
              </button>
            )}

            {loading && notifications.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
