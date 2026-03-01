'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCombatLogs } from '@/app/actions/combat'
import type { CombatLog } from '@/lib/types/database'
import { ChevronDown, ExternalLink, Megaphone, Zap, Shield, Swords, Play, Scroll } from 'lucide-react'

interface Props {
  sessionId: string
  initialLogs: CombatLog[]
}

function fmtTime(d: string) {
  const x = new Date(d)
  return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}:${String(x.getSeconds()).padStart(2, '0')}`
}

const typeConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  stat_change: { icon: <Zap className="w-3 h-3" />, color: 'text-yellow-400' },
  roleplay_link: { icon: <ExternalLink className="w-3 h-3" />, color: 'text-blue-400' },
  announcement: { icon: <Megaphone className="w-3 h-3" />, color: 'text-red-400' },
  status_effect: { icon: <Shield className="w-3 h-3" />, color: 'text-purple-400' },
  turn_change: { icon: <Swords className="w-3 h-3" />, color: 'text-gold-400' },
  session_start: { icon: <Play className="w-3 h-3" />, color: 'text-green-400' },
  session_end: { icon: <Play className="w-3 h-3" />, color: 'text-victorian-400' },
}

export default function CombatFeed({ sessionId, initialLogs }: Props) {
  const [logs, setLogs] = useState<CombatLog[]>(initialLogs)
  const [page, setPage] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialLogs.length >= 10)
  const mountedRef = useRef(true)

  // Update logs when initialLogs changes (from parent refetch)
  useEffect(() => {
    setLogs(initialLogs)
  }, [initialLogs])

  // Listen for new logs across all devices
  useEffect(() => {
    mountedRef.current = true

    const supabase = createClient()
    const channel = supabase
      .channel(`combat-logs-feed:${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'combat_logs',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        if (!mountedRef.current) return
        const newLog = payload.new as CombatLog
        console.log('[CombatFeed] New log received:', newLog)
        setLogs(prev => [newLog, ...prev])
      })
      .subscribe()

    return () => {
      mountedRef.current = false
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  const loadMore = useCallback(async () => {
    setLoadingMore(true)
    const nextPage = page + 1
    const res = await getCombatLogs(sessionId, nextPage)
    if (res.logs.length > 0) {
      setLogs(prev => [...prev, ...res.logs])
      setPage(nextPage)
      setHasMore(res.logs.length >= 10)
    } else {
      setHasMore(false)
    }
    setLoadingMore(false)
  }, [sessionId, page])

  if (logs.length === 0) return null

  return (
    <div className="rounded-2xl border border-victorian-700/30 bg-gradient-to-b from-victorian-950/70 to-victorian-950/40 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-victorian-700/30 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-gold-400/10 border border-gold-400/20 flex items-center justify-center">
          <Scroll className="w-3.5 h-3.5 text-gold-400" />
        </div>
        <h3 className="heading-victorian text-sm">ประวัติการต่อสู้</h3>
        <span className="text-victorian-600 text-[10px] ml-auto">{logs.length} รายการ</span>
      </div>

      <div className="divide-y divide-victorian-800/20 max-h-[400px] overflow-y-auto custom-scrollbar">
        {logs.map(log => {
          const tc = typeConfig[log.type] || { icon: null, color: 'text-victorian-400' }
          const url = (log.payload as any)?.url

          return (
            <div key={log.id} className="combat-feed-entry px-5 py-3 flex items-start gap-3 hover:bg-victorian-900/30 transition-colors">
              <div className={`mt-0.5 shrink-0 w-6 h-6 rounded-lg flex items-center justify-center ${tc.color} bg-current/[0.08]`} style={{ backgroundColor: undefined }}>
                <span className={tc.color}>{tc.icon}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-nouveau-cream/90 text-xs leading-relaxed">
                  {log.message}
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      className="ml-1.5 text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">
                      [ลิงก์]
                    </a>
                  )}
                </p>
              </div>
              <span className="text-victorian-600 text-[10px] shrink-0 mt-0.5 tabular-nums">{fmtTime(log.created_at)}</span>
            </div>
          )
        })}
      </div>

      {hasMore && (
        <div className="px-5 py-3 border-t border-victorian-700/30 text-center">
          <button type="button" onClick={loadMore} disabled={loadingMore}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-victorian-800/40 border border-victorian-700/20 text-victorian-400 text-xs font-semibold hover:text-gold-400 hover:border-gold-400/20 cursor-pointer disabled:opacity-50 transition-all">
            <ChevronDown className="w-3.5 h-3.5" />
            {loadingMore ? 'กำลังโหลด...' : 'โหลดเพิ่ม'}
          </button>
        </div>
      )}
    </div>
  )
}
