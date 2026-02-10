'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, ScrollText, ChevronLeft, ChevronRight, Copy, Check, Sparkles } from 'lucide-react'
import { getSkillUsageLogs } from '@/app/actions/skills'
import { OrnamentedCard } from '@/components/ui/ornaments'

interface LogEntry {
  id: string
  player_id: string
  skill_id: string
  spirit_cost: number
  reference_code: string
  used_at: string
  player_name: string
  player_avatar: string | null
  skill_name: string
}

export default function SkillLogsContent() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchLogs(p: number) {
    setLoading(true)
    setError(null)
    try {
      const result = await getSkillUsageLogs(p)
      if (result.error) {
        setError(result.error)
      } else {
        setLogs(result.logs as LogEntry[])
        setTotalPages(result.totalPages || 1)
        setTotal(result.total || 0)
        setIsAdmin(result.isAdmin || false)
        setPage(p)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchLogs(1)
  }, [])

  function handleCopy(code: string, id: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`
  }

  return (
    <div className="min-h-screen bg-victorian-950 text-victorian-100">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 opacity-5" style={{
        backgroundImage: `radial-gradient(circle at 25% 25%, #D4AF37 1px, transparent 1px),
                          radial-gradient(circle at 75% 75%, #D4AF37 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      <div className="relative z-10 max-w-4xl mx-auto p-4 md:p-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a
              href="/dashboard/skills"
              className="p-2 rounded-lg border border-gold-400/10 text-gold-400 hover:bg-victorian-800/50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </a>
            <div>
              <h1 className="heading-victorian text-2xl md:text-4xl">ประวัติการใช้สกิล</h1>
              <p className="text-victorian-400 text-xs md:text-sm mt-1">
                {isAdmin ? `บันทึกทั้งหมด ${total} รายการ` : `บันทึกของคุณ ${total} รายการ`}
              </p>
            </div>
          </div>
        </div>

        {/* Ornamental divider */}
        <div className="ornament-divider" />

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-900/40 border-2 border-red-500/40 rounded-xl text-red-300 text-center">
            <p className="font-semibold">เกิดข้อผิดพลาด</p>
            <p className="text-sm mt-1 text-red-400/80">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="border border-[#D4AF37]/10 rounded-sm p-4 md:p-5" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#2A2520] animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-28 rounded bg-[#2A2520] animate-pulse" />
                      <div className="h-4 w-10 rounded bg-[#2A2520] animate-pulse" />
                    </div>
                    <div className="h-3 w-40 rounded bg-[#2A2520] animate-pulse" />
                  </div>
                  <div className="h-6 w-24 rounded bg-[#2A2520] animate-pulse flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && logs.length === 0 && (
          <OrnamentedCard className="p-10 text-center">
            <ScrollText className="w-16 h-16 text-gold-400/40 mx-auto mb-4" />
            <p className="text-victorian-400 text-2xl heading-victorian">ยังไม่มีประวัติการใช้สกิล</p>
            <p className="text-victorian-500 text-lg mt-2">เมื่อคุณใช้สกิล ประวัติจะแสดงที่นี่</p>
          </OrnamentedCard>
        )}

        {/* Log entries */}
        {!loading && logs.length > 0 && (
          <div className="space-y-3">
            {logs.map((log) => (
              <OrnamentedCard key={log.id} className="p-4 md:p-5">
                <div className="flex items-center gap-3 md:gap-4">
                  {/* Player avatar (admin only) */}
                  {isAdmin && (
                    <div className="flex-shrink-0">
                      {log.player_avatar ? (
                        <img
                          src={log.player_avatar}
                          alt={log.player_name}
                          className="w-10 h-10 rounded-full border border-gold-400/20 object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full border border-gold-400/20 bg-victorian-800 flex items-center justify-center">
                          <span className="text-gold-400 text-sm font-display">
                            {log.player_name[0]?.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Sparkles className="w-4 h-4 text-gold-400 flex-shrink-0" />
                      <span className="text-gold-200 font-semibold truncate">{log.skill_name}</span>
                      <span className="text-blue-400/80 text-xs flex items-center gap-0.5 flex-shrink-0">
                        ⚡{log.spirit_cost}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-victorian-500 flex-wrap">
                      {isAdmin && (
                        <span className="text-victorian-300">{log.player_name}</span>
                      )}
                      <span>{formatDate(log.used_at)}</span>
                    </div>
                  </div>

                  {/* Reference code */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <code className="text-gold-300/80 text-xs md:text-sm font-mono tracking-wider bg-victorian-900/60 px-2 py-1 rounded border border-gold-400/10">
                      {log.reference_code}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopy(log.reference_code, log.id)}
                      className="p-1.5 rounded border border-gold-400/10 text-gold-400/60 hover:text-gold-400 hover:bg-gold-400/10 transition-colors cursor-pointer"
                      title="คัดลอก"
                    >
                      {copiedId === log.id ? (
                        <Check className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </OrnamentedCard>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-4">
            <button
              type="button"
              onClick={() => fetchLogs(page - 1)}
              disabled={page <= 1}
              className="p-2 rounded-lg border border-gold-400/20 text-gold-400 hover:bg-victorian-800/50 
                         transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-victorian-300 text-sm font-mono">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => fetchLogs(page + 1)}
              disabled={page >= totalPages}
              className="p-2 rounded-lg border border-gold-400/20 text-gold-400 hover:bg-victorian-800/50 
                         transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
