'use client'

import { useState, useCallback } from 'react'
import { getCombatLogs } from '@/app/actions/combat'
import type { CombatLog } from '@/lib/types/database'
import { ChevronDown, ExternalLink, Megaphone, Zap, Shield, Swords, Play } from 'lucide-react'

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
    <div className="rounded-xl border border-victorian-700/30 bg-victorian-950/50 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-victorian-700/30">
        <h3 className="heading-victorian text-sm">ประวัติการต่อสู้</h3>
      </div>

      <div className="divide-y divide-victorian-800/30 max-h-[400px] overflow-y-auto custom-scrollbar">
        {logs.map(log => {
          const tc = typeConfig[log.type] || { icon: null, color: 'text-victorian-400' }
          const url = (log.payload as any)?.url

          return (
            <div key={log.id} className="px-4 py-2.5 flex items-start gap-2 hover:bg-victorian-900/30 transition-colors">
              <span className={`mt-0.5 shrink-0 ${tc.color}`}>{tc.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-nouveau-cream text-xs leading-relaxed">
                  {log.message}
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      className="ml-1 text-blue-400 hover:text-blue-300 underline transition-colors">
                      [ลิงก์]
                    </a>
                  )}
                </p>
              </div>
              <span className="text-victorian-600 text-[10px] shrink-0 mt-0.5">{fmtTime(log.created_at)}</span>
            </div>
          )
        })}
      </div>

      {hasMore && (
        <div className="px-4 py-2 border-t border-victorian-700/30 text-center">
          <button type="button" onClick={loadMore} disabled={loadingMore}
            className="inline-flex items-center gap-1.5 text-victorian-400 text-xs hover:text-gold-400 cursor-pointer disabled:opacity-50 transition-colors">
            <ChevronDown className="w-3.5 h-3.5" />
            {loadingMore ? 'กำลังโหลด...' : 'โหลดเพิ่ม'}
          </button>
        </div>
      )}
    </div>
  )
}
