'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import { getTravelRoleplayLogs } from '@/app/actions/map-tokens'

type TravelLog = {
  id: string
  player_id: string
  player_name: string
  player_avatar: string | null
  token_id: string | null
  from_map_id: string | null
  to_map_id: string | null
  from_map_name: string
  to_map_name: string
  from_x: number | null
  from_y: number | null
  to_x: number | null
  to_y: number | null
  origin_url: string
  destination_url: string
  move_type: string
  created_at: string
}

function formatDate(value: string) {
  const date = new Date(value)
  return date.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function shortenUrl(url: string) {
  if (url.length <= 42) return url
  return `${url.slice(0, 42)}...`
}

function moveTypeLabel(value: string) {
  if (value === 'cross_map') return 'ข้ามแมพ'
  if (value === 'first_entry') return 'เข้าแมพครั้งแรก'
  return 'ย้ายในแมพ'
}

export default function TravelLogsContent() {
  const [logs, setLogs] = useState<TravelLog[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async (p: number = 1) => {
    setLoading(true)
    const res = await getTravelRoleplayLogs(p)
    setLogs(res.logs as TravelLog[])
    setPage(res.page || 1)
    setTotalPages(res.totalPages || 1)
    setTotal(res.total || 0)
    setIsAdmin(!!res.isAdmin)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLogs(1)
  }, [fetchLogs])

  return (
    <div className="min-h-screen bg-victorian-950 text-victorian-200">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/maps" className="text-gold-400 hover:text-gold-300 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="heading-victorian text-2xl lg:text-3xl text-gold-300">ประวัติการเดินทาง</h1>
            <p className="text-victorian-500 text-xs lg:text-sm">รวมทุกแมพ ({total})</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-victorian-400">กำลังโหลด...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-victorian-400">ยังไม่มีประวัติการเดินทาง</div>
        ) : (
          <div className="overflow-x-auto border border-gold-400/10 rounded-sm bg-victorian-900/40">
            <table className="w-full text-sm">
              <thead className="bg-victorian-900/70 text-victorian-300">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">วันที่</th>
                  {isAdmin && <th className="text-left px-4 py-2 font-medium">ผู้เล่น</th>}
                  <th className="text-left px-4 py-2 font-medium">ต้นทาง</th>
                  <th className="text-left px-4 py-2 font-medium">ปลายทาง</th>
                  <th className="text-left px-4 py-2 font-medium">ลิงก์ต้นทาง</th>
                  <th className="text-left px-4 py-2 font-medium">ลิงก์ปลายทาง</th>
                  <th className="text-left px-4 py-2 font-medium">ประเภท</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold-400/10">
                {logs.map(log => (
                  <tr key={log.id} className="text-victorian-200">
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(log.created_at)}</td>
                    {isAdmin && (
                      <td className="px-4 py-2">{log.player_name}</td>
                    )}
                    <td className="px-4 py-2">{log.from_map_name}</td>
                    <td className="px-4 py-2">{log.to_map_name}</td>
                    <td className="px-4 py-2">
                      <a
                        href={log.origin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-gold-400 hover:text-gold-300"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="truncate">{shortenUrl(log.origin_url)}</span>
                      </a>
                    </td>
                    <td className="px-4 py-2">
                      <a
                        href={log.destination_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-gold-400 hover:text-gold-300"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="truncate">{shortenUrl(log.destination_url)}</span>
                      </a>
                    </td>
                    <td className="px-4 py-2">{moveTypeLabel(log.move_type)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => fetchLogs(page - 1)}
              disabled={page <= 1}
              className="p-2 rounded-lg border border-gold-400/20 text-gold-400 hover:bg-victorian-800/50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-victorian-300 text-sm font-mono">{page} / {totalPages}</span>
            <button
              type="button"
              onClick={() => fetchLogs(page + 1)}
              disabled={page >= totalPages}
              className="p-2 rounded-lg border border-gold-400/20 text-gold-400 hover:bg-victorian-800/50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
