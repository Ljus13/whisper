'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { debouncedCall } from '@/lib/client-cache'
import { getCombatSessions, createCombatSession } from '@/app/actions/combat'
import type { CombatSession } from '@/lib/types/database'
import { Swords, Plus, Clock, Play, CheckCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface Props {
  userId: string
  isStaff: boolean
}

function fmtDate(d: string) {
  const x = new Date(d)
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()} ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`
}

const statusLabel: Record<string, { text: string; color: string; icon: React.ReactNode }> = {
  lobby: { text: 'รอเริ่ม', color: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10', icon: <Clock className="w-3.5 h-3.5" /> },
  active: { text: 'กำลังต่อสู้', color: 'text-red-400 border-red-500/40 bg-red-500/10', icon: <Play className="w-3.5 h-3.5" /> },
  ended: { text: 'จบแล้ว', color: 'text-victorian-400 border-victorian-500/40 bg-victorian-500/10', icon: <CheckCircle className="w-3.5 h-3.5" /> },
}

export default function CombatListContent({ userId, isStaff }: Props) {
  const [sessions, setSessions] = useState<CombatSession[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const mountedRef = useRef(true)

  const fetchData = useCallback(() => {
    getCombatSessions().then(r => {
      if (mountedRef.current) {
        setSessions(r.sessions || [])
        setLoading(false)
      }
    })
  }, [])

  useEffect(() => {
    mountedRef.current = true
    fetchData()

    const supabase = createClient()
    const debouncedFetch = () => debouncedCall('combat-list', fetchData, 150)

    const channel = supabase
      .channel('combat_list_realtime', { config: { broadcast: { self: true } } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_sessions' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_participants' }, debouncedFetch)
      .subscribe()

    return () => {
      mountedRef.current = false
      supabase.removeChannel(channel)
    }
  }, [fetchData])

  const handleCreate = async () => {
    if (!newName.trim() || creating) return
    setCreating(true)
    const res = await createCombatSession(newName.trim())
    if (res.error) {
      alert(res.error)
    } else {
      setNewName('')
      setShowCreate(false)
      fetchData()
    }
    setCreating(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-victorian-400 animate-pulse">กำลังโหลด...</div>
      </div>
    )
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 md:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center">
            <Swords className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="heading-victorian text-2xl">ระบบการต่อสู้</h1>
            <p className="text-victorian-400 text-xs mt-0.5">Combat System</p>
          </div>
        </div>

        {isStaff && (
          <button
            type="button"
            onClick={() => setShowCreate(!showCreate)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-400/10 border border-gold-400/30 text-gold-400 hover:bg-gold-400/20 text-sm font-bold cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" /> สร้างห้องต่อสู้
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && isStaff && (
        <div className="p-4 rounded-xl bg-victorian-900/80 border border-gold-400/20 space-y-3">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="ชื่อฉาก เช่น ปะทะกองโจรในป่า"
            className="input-victorian !py-3 !text-sm"
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setShowCreate(false); setNewName('') }}
              className="px-4 py-2 text-victorian-400 text-sm hover:text-victorian-300 cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="px-4 py-2 rounded-lg bg-gold-400/20 border border-gold-400/40 text-gold-300 text-sm font-bold hover:bg-gold-400/30 cursor-pointer disabled:opacity-50 transition-colors"
            >
              {creating ? 'กำลังสร้าง...' : 'สร้าง'}
            </button>
          </div>
        </div>
      )}

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <div className="text-center py-20 text-victorian-500">
          <Swords className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>ยังไม่มีห้องต่อสู้</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => {
            const st = statusLabel[s.status]
            return (
              <Link
                key={s.id}
                href={`/dashboard/combat/${s.id}`}
                className="flex items-center justify-between p-4 rounded-xl bg-victorian-900/60 border border-victorian-700/50 hover:border-gold-400/30 hover:bg-victorian-900/80 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${st.color}`}>
                    {st.icon}
                    {st.text}
                  </div>
                  <div className="min-w-0">
                    <p className="text-nouveau-cream font-semibold truncate">{s.name}</p>
                    <p className="text-victorian-500 text-xs">{fmtDate(s.created_at)}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-victorian-500 group-hover:text-gold-400 transition-colors shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
