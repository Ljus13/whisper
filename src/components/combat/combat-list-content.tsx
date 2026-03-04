'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { debouncedCall } from '@/lib/client-cache'
import { getCombatSessions, createCombatSession, deleteCombatSession } from '@/app/actions/combat'
import type { CombatSession } from '@/lib/types/database'
import { Swords, Plus, Clock, Play, CheckCircle, ArrowRight, Shield, Skull, Sparkles, Trash2, AlertTriangle, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Props {
  userId: string
  isStaff: boolean
  /** Server-fetched initial sessions — skips the client-side loading spinner */
  initialSessions?: CombatSession[]
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

export default function CombatListContent({ userId, isStaff, initialSessions }: Props) {
  const [sessions, setSessions] = useState<CombatSession[]>(initialSessions ?? [])
  const [loading, setLoading] = useState(!initialSessions)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [alertModal, setAlertModal] = useState<{ message: string; type?: 'error' | 'info' } | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ message: string; subMessage?: string; destructive?: boolean; onConfirm: () => void } | null>(null)
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
    // If server provided initial data, only subscribe to realtime (skip initial fetch)
    if (!initialSessions) fetchData()

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
  }, [fetchData, initialSessions])

  const handleCreate = async () => {
    if (!newName.trim() || creating) return
    setCreating(true)
    const res = await createCombatSession(newName.trim())
    if (res.error) {
      setAlertModal({ message: res.error, type: 'error' })
    } else {
      setNewName('')
      setShowCreate(false)
      fetchData()
    }
    setCreating(false)
  }

  const handleDelete = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setConfirmModal({
      message: 'ลบห้องต่อสู้นี้ถาวร?',
      subMessage: 'การลบไม่สามารถย้อนกลับได้',
      destructive: true,
      onConfirm: async () => {
        setConfirmModal(null)
        setDeletingId(sessionId)
        const res = await deleteCombatSession(sessionId)
        if (res.error) setAlertModal({ message: res.error, type: 'error' })
        else fetchData()
        setDeletingId(null)
      }
    })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <Swords className="w-12 h-12 text-gold-400 animate-pulse" />
          <div className="absolute inset-0 bg-gold-400/20 blur-xl rounded-full" />
        </div>
        <p className="text-victorian-400 animate-pulse text-sm">กำลังโหลดสนามรบ...</p>
      </div>
    )
  }

  return (
    <>
      {/* Alert Modal */}
      {alertModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={() => setAlertModal(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-victorian-900 border border-victorian-700/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-nouveau-cream text-sm leading-relaxed">{alertModal.message}</p>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => setAlertModal(null)} className="px-4 py-2 rounded-xl bg-victorian-800 border border-victorian-600/30 text-victorian-300 text-sm hover:text-nouveau-cream cursor-pointer transition-colors">
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-victorian-900 border border-victorian-700/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-start gap-3 mb-2">
              <Trash2 className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-nouveau-cream text-sm font-bold">{confirmModal.message}</p>
                {confirmModal.subMessage && <p className="text-victorian-400 text-xs mt-1">{confirmModal.subMessage}</p>}
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button type="button" onClick={() => setConfirmModal(null)} className="px-4 py-2 rounded-xl bg-victorian-800 border border-victorian-600/30 text-victorian-300 text-sm hover:text-nouveau-cream cursor-pointer transition-colors">
                ยกเลิก
              </button>
              <button type="button" onClick={confirmModal.onConfirm} className="px-4 py-2 rounded-xl bg-red-900/40 border border-red-500/40 text-red-300 text-sm font-bold hover:bg-red-900/60 cursor-pointer transition-all">
                ยืนยัน ลบ
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-screen-xl mx-auto px-4 md:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-victorian-950 via-victorian-900/80 to-victorian-950 rounded-2xl" />
        <div className="relative p-5 rounded-2xl border border-victorian-700/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 md:gap-4">
              <Link
                href="/dashboard"
                className="w-10 h-10 rounded-xl bg-victorian-800/80 border border-victorian-600/30 flex items-center justify-center text-victorian-400 hover:text-gold-400 hover:border-gold-400/30 transition-all shrink-0"
                title="กลับแดชบอร์ด"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                  <Swords className="w-6 h-6 text-red-400" />
                </div>
                <div className="absolute inset-0 bg-red-500/10 blur-lg rounded-full" />
              </div>
              <div>
                <h1 className="heading-victorian text-2xl md:text-3xl">ระบบการต่อสู้</h1>
                <p className="text-victorian-500 text-xs mt-1">⚔️ Combat System — Real-time TRPG</p>
              </div>
            </div>

            {isStaff && (
              <button
                type="button"
                onClick={() => setShowCreate(!showCreate)}
                className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold-400/10 border border-gold-400/30 text-gold-400 hover:bg-gold-400/20 hover:border-gold-400/50 text-sm font-bold cursor-pointer transition-all"
              >
                <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" /> สร้างห้องต่อสู้
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Create form */}
      {showCreate && isStaff && (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-victorian-900/80 to-victorian-950 border border-gold-400/20 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold-400" />
            <span className="text-gold-300 text-sm font-bold">สร้างฉากต่อสู้ใหม่</span>
          </div>
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="ชื่อฉาก เช่น ปะทะกองโจรในป่า"
            className="input-victorian !py-3 !text-sm !rounded-xl"
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setShowCreate(false); setNewName('') }}
              className="px-5 py-2.5 text-victorian-400 text-sm hover:text-victorian-300 cursor-pointer transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="px-5 py-2.5 rounded-xl bg-gold-400/15 border border-gold-400/30 text-gold-300 text-sm font-bold hover:bg-gold-400/25 cursor-pointer disabled:opacity-50 transition-all"
            >
              {creating ? <><Loader2 className="w-4 h-4 animate-spin inline mr-1" />กำลังสร้าง...</> : '⚔️ สร้างฉาก'}
            </button>
          </div>
        </div>
      )}

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <div className="text-center py-24 space-y-4">
          <div className="relative inline-block">
            <Swords className="w-16 h-16 mx-auto text-victorian-700/40" />
            <div className="absolute inset-0 bg-victorian-700/10 blur-2xl rounded-full" />
          </div>
          <p className="text-victorian-500 text-sm">ยังไม่มีห้องต่อสู้</p>
          {isStaff && <p className="text-victorian-600 text-xs">กดปุ่ม &quot;สร้างห้องต่อสู้&quot; เพื่อเริ่มต้น</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => {
            const st = statusLabel[s.status]
            const isActive = s.status === 'active'
            return (
              <Link
                key={s.id}
                href={`/dashboard/combat/${s.id}`}
                className={`group flex items-center justify-between p-4 md:p-5 rounded-2xl border transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-red-950/20 via-victorian-900/80 to-victorian-900/60 border-red-500/20 hover:border-red-500/40 shadow-lg shadow-red-950/20'
                    : 'bg-victorian-900/60 border-victorian-700/30 hover:border-gold-400/30 hover:bg-victorian-900/80'
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                    s.status === 'active' ? 'bg-red-500/10 border border-red-500/30' :
                    s.status === 'lobby' ? 'bg-yellow-500/10 border border-yellow-500/30' :
                    'bg-victorian-800/60 border border-victorian-600/20'
                  }`}>
                    {s.status === 'active' ? <Swords className="w-5 h-5 text-red-400" /> :
                     s.status === 'lobby' ? <Clock className="w-5 h-5 text-yellow-400" /> :
                     <CheckCircle className="w-5 h-5 text-victorian-500" />}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-bold truncate ${isActive ? 'text-nouveau-cream' : 'text-nouveau-cream/80'}`}>{s.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${st.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          s.status === 'active' ? 'bg-red-400 animate-pulse' :
                          s.status === 'lobby' ? 'bg-yellow-400' : 'bg-victorian-500'
                        }`} />
                        {st.text}
                      </span>
                      <span className="text-victorian-600 text-[10px]">•</span>
                      <span className="text-victorian-500 text-[10px]">{fmtDate(s.created_at)}</span>
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-victorian-600 group-hover:text-gold-400 group-hover:translate-x-1 transition-all shrink-0" />
                {isStaff && s.status !== 'active' && (
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, s.id)}
                    className="w-8 h-8 rounded-lg bg-red-950/30 border border-red-500/20 flex items-center justify-center text-red-400/50 hover:text-red-400 hover:bg-red-950/60 hover:border-red-500/40 cursor-pointer transition-all shrink-0 ml-1"
                    title="ลบห้อง"
                  >
                    {deletingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
    </>
  )
}
