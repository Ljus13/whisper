'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react'
import { getSkillUsageLogs } from '@/app/actions/skills'
import { getCached, setCache } from '@/lib/client-cache'

interface LogEntry {
  id: string
  player_id: string
  skill_id: string
  spirit_cost: number
  reference_code: string
  note: string | null
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
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [origin, setOrigin] = useState('')

  const fetchLogs = useCallback(async (p: number, query: string = searchQuery) => {
    const cacheKey = `skill-logs:${p}:${query || 'all'}`
    const cached = getCached<{
      logs: LogEntry[]
      totalPages: number
      total: number
      isAdmin: boolean
    }>(cacheKey)
    if (cached) {
      setLogs(cached.logs)
      setTotalPages(cached.totalPages || 1)
      setTotal(cached.total || 0)
      setIsAdmin(cached.isAdmin || false)
      setPage(p)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await getSkillUsageLogs(p, query)
      if (result.error) {
        setError(result.error)
      } else {
        setLogs(result.logs as LogEntry[])
        setTotalPages(result.totalPages || 1)
        setTotal(result.total || 0)
        setIsAdmin(result.isAdmin || false)
        setPage(p)
        setCache(cacheKey, {
          logs: result.logs as LogEntry[],
          totalPages: result.totalPages || 1,
          total: result.total || 0,
          isAdmin: result.isAdmin || false
        }, 60 * 1000)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    }
    setLoading(false)
  }, [searchQuery])

  useEffect(() => {
    fetchLogs(1, '')
  }, [fetchLogs])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])

  function handleCopy(code: string, id: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  function getEmbedUrl(referenceCode: string) {
    if (!origin) return ''
    return `${origin}/embed/skills/${referenceCode}`
  }

  function getEmbedIframe(referenceCode: string) {
    const url = getEmbedUrl(referenceCode)
    if (!url) return ''
    return `<iframe src="${url}" width="500" height="45" style="border:0"></iframe>`
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

  function handleSearch() {
    const q = searchInput.trim()
    setSearchQuery(q)
    fetchLogs(1, q)
  }

  function handleClearSearch() {
    setSearchInput('')
    setSearchQuery('')
    fetchLogs(1, '')
  }

  return (
    <div className="min-h-screen bg-victorian-950 text-victorian-100">
      <div className="relative z-10 max-w-4xl mx-auto p-4 md:p-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
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
                {searchQuery ? `ผลลัพธ์ ${total} รายการ` : (isAdmin ? `บันทึกทั้งหมด ${total} รายการ` : `บันทึกของคุณ ${total} รายการ`)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
              placeholder="ค้นหาชื่อผู้เล่นหรือรหัสอ้างอิง"
              className="flex-1 md:w-72 px-3 py-2 rounded-sm bg-victorian-900/60 border border-gold-400/20 text-sm text-victorian-100 placeholder:text-victorian-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSearch}
              className="px-3 py-2 rounded-sm border border-gold-400/20 text-gold-400 hover:bg-victorian-800/50 transition-colors text-sm"
            >
              ค้นหา
            </button>
            {(searchInput || searchQuery) && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-3 py-2 rounded-sm border border-gold-400/10 text-victorian-300 hover:bg-victorian-800/50 transition-colors text-sm"
              >
                ล้าง
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-900/40 border-2 border-red-500/40 rounded-xl text-red-300 text-center">
            <p className="font-semibold">เกิดข้อผิดพลาด</p>
            <p className="text-sm mt-1 text-red-400/80">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="w-full overflow-x-auto border border-gold-400/10 rounded-sm bg-victorian-900/30">
            <table className="w-full text-sm">
              <thead className="bg-victorian-900/70 text-victorian-300">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">วันที่</th>
                  {isAdmin && <th className="text-left px-4 py-2 font-medium">ผู้ใช้</th>}
                  <th className="text-left px-4 py-2 font-medium">สกิล</th>
                  <th className="text-left px-4 py-2 font-medium">ค่า Spirit</th>
                  <th className="text-left px-4 py-2 font-medium">หมายเหตุ</th>
                  <th className="text-left px-4 py-2 font-medium">โค้ดอ้างอิง</th>
                  <th className="text-left px-4 py-2 font-medium">Embed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold-400/10">
                {[...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><div className="h-4 w-28 rounded bg-[#2A2520] animate-pulse" /></td>
                    {isAdmin && <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-[#2A2520] animate-pulse" /></td>}
                    <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-[#2A2520] animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-[#2A2520] animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-36 rounded bg-[#2A2520] animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-14 rounded bg-[#2A2520] animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-[#2A2520] animate-pulse" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && logs.length === 0 && (
          <div className="p-6 border border-gold-400/10 rounded-sm text-center text-victorian-400">
            ยังไม่มีประวัติการใช้สกิล
          </div>
        )}

        {/* Log entries */}
        {!loading && logs.length > 0 && (
          <div className="w-full overflow-x-auto border border-gold-400/10 rounded-sm bg-victorian-900/30">
            <table className="w-full text-sm">
              <thead className="bg-victorian-900/70 text-victorian-300">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">วันที่</th>
                  {isAdmin && <th className="text-left px-4 py-2 font-medium">ผู้ใช้</th>}
                  <th className="text-left px-4 py-2 font-medium">สกิล</th>
                  <th className="text-left px-4 py-2 font-medium">ค่า Spirit</th>
                  <th className="text-left px-4 py-2 font-medium">หมายเหตุ</th>
                  <th className="text-left px-4 py-2 font-medium">โค้ดอ้างอิง</th>
                  <th className="text-left px-4 py-2 font-medium">Embed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold-400/10">
                {logs.map((log) => (
                  <tr key={log.id} className="text-victorian-200">
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(log.used_at)}</td>
                    {isAdmin && (
                      <td className="px-4 py-2">{log.player_name}</td>
                    )}
                    <td className="px-4 py-2">{log.skill_name}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{log.spirit_cost}</td>
                    <td className="px-4 py-2">
                      <div className="text-xs text-victorian-300 max-w-[220px] truncate">
                        {log.note || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
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
                    </td>
                    <td className="px-4 py-2">
                      {origin ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                          onClick={() => handleCopy(getEmbedIframe(log.reference_code) || getEmbedUrl(log.reference_code), `embed-${log.id}`)}
                            className="px-2.5 py-1.5 rounded border border-gold-400/10 text-gold-300/80 hover:text-gold-300 hover:bg-gold-400/10 transition-colors cursor-pointer text-xs"
                            title="คัดลอก Embed"
                          >
                            {copiedId === `embed-${log.id}` ? 'คัดลอกแล้ว' : 'คัดลอก Embed'}
                          </button>
                          <a
                            href={getEmbedUrl(log.reference_code)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded border border-gold-400/10 text-gold-300/80 hover:text-gold-300 hover:bg-gold-400/10 transition-colors cursor-pointer text-xs"
                          >
                            เปิด
                          </a>
                        </div>
                      ) : (
                        <span className="text-victorian-500 text-xs">กำลังโหลด...</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
