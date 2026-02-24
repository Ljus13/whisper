'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { debouncedCall } from '@/lib/client-cache'
import {
  getCombatSession,
  getCombatLogs,
  addPlayerToCombat,
  addNpcToCombat,
  removeParticipant,
  startCombatSession,
  endCombatSession,
  updateParticipantStat,
  setStatusEffect,
  giveTurn,
  sendAnnouncement,
  clearAnnouncement,
  submitRoleplayLink,
  getPlayersForCombat,
} from '@/app/actions/combat'
import type {
  CombatSession,
  CombatParticipant,
  CombatLog,
  CombatStatusEffect,
} from '@/lib/types/database'
import { STATUS_EFFECT_LABELS, DISABLING_EFFECTS } from '@/lib/types/database'
import { ArrowLeft, Plus, Trash2, Play, Square, Megaphone, Send, ChevronDown, ChevronUp, Swords, X, UserPlus, Bot } from 'lucide-react'
import Link from 'next/link'
import StatusEffectOverlay from './status-effect-overlay'
import AnnouncementOverlay from './announcement-overlay'
import CombatFeed from './combat-feed'

interface Props {
  sessionId: string
  userId: string
  isStaff: boolean
}

const ALL_EFFECTS: CombatStatusEffect[] = [
  'stunned', 'frozen', 'cursed', 'death_aura', 'sleeping', 'burning',
  'blinding_light', 'paralyzed', 'poisoned', 'berserk', 'blinded',
  'bleeding', 'charmed', 'drowning',
]

export default function CombatRoomContent({ sessionId, userId, isStaff }: Props) {
  const [session, setSession] = useState<CombatSession | null>(null)
  const [participants, setParticipants] = useState<CombatParticipant[]>([])
  const [logs, setLogs] = useState<CombatLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Admin states
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [showAddNpc, setShowAddNpc] = useState(false)
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([])
  const [npcForm, setNpcForm] = useState({ name: '', hp: '5', sanity: '10', spirit: '15', avatar: '' })
  const [announcementText, setAnnouncementText] = useState('')
  const [pending, setPending] = useState(false)

  // Player states
  const [showAnnouncement, setShowAnnouncement] = useState(false)
  const [announcementMsg, setAnnouncementMsg] = useState('')
  const [rpLink, setRpLink] = useState('')

  const mountedRef = useRef(true)

  const fetchData = useCallback(async () => {
    const res = await getCombatSession(sessionId)
    if (!mountedRef.current) return
    if (res.error) { setError(res.error); setLoading(false); return }
    setSession(res.session!)
    setParticipants(res.participants || [])
    setLogs(res.logs || [])
    setLoading(false)

    // Check for announcement that requires ack
    if (res.session?.announcement && res.session.announcement_ack && !isStaff) {
      setAnnouncementMsg(res.session.announcement)
      setShowAnnouncement(true)
    }
  }, [sessionId, isStaff])

  useEffect(() => {
    mountedRef.current = true
    fetchData()

    const supabase = createClient()
    const debouncedFetch = () => debouncedCall(`combat-room-${sessionId}`, fetchData, 100)

    // Dual strategy: broadcast (instant) + postgres changes (backup)
    const channel = supabase
      .channel(`combat:${sessionId}`, { config: { broadcast: { self: true } } })
      // Broadcast: instant — no debounce
      .on('broadcast', { event: 'stat_update' }, () => fetchData())
      .on('broadcast', { event: 'status_update' }, () => fetchData())
      .on('broadcast', { event: 'turn_change' }, () => fetchData())
      .on('broadcast', { event: 'session_update' }, () => fetchData())
      .on('broadcast', { event: 'participant_added' }, () => fetchData())
      .on('broadcast', { event: 'participant_removed' }, () => fetchData())
      .on('broadcast', { event: 'roleplay_link' }, () => fetchData())
      .on('broadcast', { event: 'announcement' }, ({ payload }) => {
        fetchData()
        if (!isStaff && payload?.message) {
          setAnnouncementMsg(payload.message)
          setShowAnnouncement(true)
        }
      })
      .on('broadcast', { event: 'announcement_clear' }, () => {
        setShowAnnouncement(false)
        fetchData()
      })
      // Postgres changes: backup with light debounce
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_sessions', filter: `id=eq.${sessionId}` }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_participants', filter: `session_id=eq.${sessionId}` }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_logs', filter: `session_id=eq.${sessionId}` }, debouncedFetch)
      .subscribe()

    return () => {
      mountedRef.current = false
      supabase.removeChannel(channel)
    }
  }, [sessionId, fetchData, isStaff])

  // Find my participant (for player view)
  const myParticipant = participants.find(p => p.profile_id === userId)
  const myPrimaryEffect = myParticipant?.status_effect_1 || null
  const myEffects = [myParticipant?.status_effect_1, myParticipant?.status_effect_2].filter(Boolean) as CombatStatusEffect[]
  const isDisabled = myEffects.some(e => DISABLING_EFFECTS.includes(e))

  // Split participants
  const players = participants.filter(p => p.type === 'player')
  const npcs = participants.filter(p => p.type === 'npc')

  // === Handlers ===

  const handleAddPlayer = async (profileId: string) => {
    setPending(true)
    const res = await addPlayerToCombat(sessionId, profileId)
    if (res.error) alert(res.error)
    else setShowAddPlayer(false)
    setPending(false)
  }

  const handleAddNpc = async () => {
    if (!npcForm.name.trim()) return
    setPending(true)
    const res = await addNpcToCombat(
      sessionId, npcForm.name.trim(),
      parseInt(npcForm.hp) || 5,
      parseInt(npcForm.sanity) || 10,
      parseInt(npcForm.spirit) || 15,
      npcForm.avatar || undefined
    )
    if (res.error) alert(res.error)
    else {
      setNpcForm({ name: '', hp: '5', sanity: '10', spirit: '15', avatar: '' })
      setShowAddNpc(false)
    }
    setPending(false)
  }

  const handleRemove = async (pid: string) => {
    if (!confirm('ลบผู้เข้าร่วมนี้?')) return
    setPending(true)
    const res = await removeParticipant(sessionId, pid)
    if (res.error) alert('ลบไม่สำเร็จ: ' + res.error)
    else setParticipants(prev => prev.filter(p => p.id !== pid))
    setPending(false)
  }

  const handleStart = async () => {
    if (!confirm('เริ่มฉากการต่อสู้? (จะล็อคห้อง)')) return
    setPending(true)
    const res = await startCombatSession(sessionId)
    if (res.error) alert(res.error)
    setPending(false)
  }

  const handleEnd = async () => {
    if (!confirm('จบฉากการต่อสู้? (ค่า stats จะถูก sync กลับ profile)')) return
    setPending(true)
    const res = await endCombatSession(sessionId)
    if (res.error) alert(res.error)
    setPending(false)
  }

  const handleStatDelta = async (pid: string, field: 'current_hp' | 'current_sanity' | 'current_spirit', delta: number) => {
    await updateParticipantStat(sessionId, pid, field, delta)
  }

  const handleStatusEffect = async (pid: string, slot: 1 | 2, effect: CombatStatusEffect | null) => {
    await setStatusEffect(sessionId, pid, slot, effect)
  }

  const handleGiveTurn = async (pid: string) => {
    await giveTurn(sessionId, pid)
  }

  const handleAnnounce = async () => {
    if (!announcementText.trim()) return
    setPending(true)
    const res = await sendAnnouncement(sessionId, announcementText.trim(), true)
    if (res.error) alert(res.error)
    else setAnnouncementText('')
    setPending(false)
  }

  const handleClearAnnouncement = async () => {
    await clearAnnouncement(sessionId)
  }

  const handleSubmitRp = async () => {
    if (!rpLink.trim()) return
    setPending(true)
    const res = await submitRoleplayLink(sessionId, rpLink.trim())
    if (res.error) alert(res.error)
    else setRpLink('')
    setPending(false)
  }

  const loadPlayers = async () => {
    const res = await getPlayersForCombat()
    setAvailablePlayers(res.players || [])
    setShowAddPlayer(true)
  }

  // === LOADING ===
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-victorian-400 animate-pulse">กำลังโหลดห้องต่อสู้...</div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        <p className="text-red-400">{error || 'ไม่พบห้องต่อสู้'}</p>
        <Link href="/dashboard/combat" className="text-gold-400 text-sm mt-2 inline-block">← กลับ</Link>
      </div>
    )
  }

  // === RENDER ===
  return (
    <>
      {/* Status effect overlay — player only */}
      {!isStaff && myPrimaryEffect && (
        <StatusEffectOverlay effect={myPrimaryEffect} allEffects={myEffects} />
      )}

      {/* Announcement overlay — player only */}
      {!isStaff && showAnnouncement && (
        <AnnouncementOverlay
          message={announcementMsg}
          onAck={() => setShowAnnouncement(false)}
        />
      )}

      <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/combat" className="text-victorian-400 hover:text-gold-400 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="heading-victorian text-xl">{session.name}</h1>
              <p className="text-victorian-500 text-xs">
                {session.status === 'lobby' && '🟡 รอเริ่ม'}
                {session.status === 'active' && '🔴 กำลังต่อสู้'}
                {session.status === 'ended' && '⚫ จบแล้ว'}
              </p>
            </div>
          </div>

          {/* Admin controls */}
          {isStaff && session.status !== 'ended' && (
            <div className="flex gap-2">
              {session.status === 'lobby' && (
                <button type="button" onClick={handleStart} disabled={pending || participants.length < 2}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600/20 border border-green-500/40 text-green-300 text-sm font-bold hover:bg-green-600/30 cursor-pointer disabled:opacity-50 transition-colors">
                  <Play className="w-4 h-4" /> เริ่มฉาก
                </button>
              )}
              {session.status === 'active' && (
                <button type="button" onClick={handleEnd} disabled={pending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600/20 border border-red-500/40 text-red-300 text-sm font-bold hover:bg-red-600/30 cursor-pointer disabled:opacity-50 transition-colors">
                  <Square className="w-4 h-4" /> จบฉาก
                </button>
              )}
            </div>
          )}
        </div>

        {/* Announcement bar (admin) */}
        {isStaff && session.status === 'active' && (
          <div className="p-3 rounded-xl bg-victorian-900/60 border border-victorian-700/40 space-y-2">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-gold-400 shrink-0" />
              <input
                type="text"
                value={announcementText}
                onChange={e => setAnnouncementText(e.target.value)}
                placeholder="พิมพ์ประกาศถึงผู้เล่น..."
                className="flex-1 bg-transparent border-none outline-none text-nouveau-cream text-sm placeholder:text-victorian-500"
                onKeyDown={e => e.key === 'Enter' && handleAnnounce()}
              />
              <button type="button" onClick={handleAnnounce} disabled={pending || !announcementText.trim()}
                className="px-3 py-1.5 rounded-lg bg-red-600/20 border border-red-500/40 text-red-300 text-xs font-bold hover:bg-red-600/30 cursor-pointer disabled:opacity-50 transition-colors">
                📢 ประกาศ
              </button>
              {session.announcement && (
                <button type="button" onClick={handleClearAnnouncement}
                  className="px-3 py-1.5 rounded-lg bg-victorian-800 border border-victorian-600/40 text-victorian-400 text-xs hover:text-victorian-300 cursor-pointer transition-colors">
                  ล้าง
                </button>
              )}
            </div>
            {session.announcement && (
              <p className="text-xs text-yellow-400/80 pl-6">ประกาศปัจจุบัน: {session.announcement}</p>
            )}
          </div>
        )}

        {/* Non-staff announcement display (if no overlay / already acked) */}
        {!isStaff && session.announcement && !showAnnouncement && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/30 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-red-200 text-sm font-semibold">{session.announcement}</p>
          </div>
        )}

        {/* Status effects display for player */}
        {!isStaff && myEffects.length > 0 && (
          <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-center gap-2 flex-wrap">
            <span className="text-purple-300 text-xs font-bold">สถานะปัจจุบัน:</span>
            {myEffects.map(e => (
              <span key={e} className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-200 text-xs font-bold">
                {STATUS_EFFECT_LABELS[e]}
              </span>
            ))}
          </div>
        )}

        {/* Add participants (lobby only) */}
        {isStaff && session.status === 'lobby' && (
          <div className="flex gap-2">
            <button type="button" onClick={loadPlayers}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-300 text-xs font-bold hover:bg-blue-600/30 cursor-pointer transition-colors">
              <UserPlus className="w-3.5 h-3.5" /> เพิ่มผู้เล่น
            </button>
            <button type="button" onClick={() => setShowAddNpc(!showAddNpc)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/40 text-purple-300 text-xs font-bold hover:bg-purple-600/30 cursor-pointer transition-colors">
              <Bot className="w-3.5 h-3.5" /> เพิ่ม NPC ศัตรู
            </button>
          </div>
        )}

        {/* Player picker modal */}
        {showAddPlayer && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={() => setShowAddPlayer(false)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className="relative bg-victorian-900 border border-gold-400/20 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto p-5 space-y-3"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="heading-victorian text-lg">เลือกผู้เล่น</h3>
                <button type="button" onClick={() => setShowAddPlayer(false)} className="text-victorian-400 hover:text-gold-400 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-1.5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {availablePlayers.map(p => {
                  const alreadyIn = participants.some(pp => pp.profile_id === p.id)
                  return (
                    <button key={p.id} type="button" disabled={alreadyIn || pending}
                      onClick={() => handleAddPlayer(p.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left cursor-pointer transition-colors ${alreadyIn
                        ? 'border-victorian-700/30 bg-victorian-950 opacity-40 cursor-not-allowed'
                        : 'border-victorian-700/40 bg-victorian-800/50 hover:border-gold-400/30 hover:bg-victorian-800/80'
                      }`}>
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-victorian-700 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-nouveau-cream text-sm font-semibold truncate">{p.display_name || 'ผู้เล่น'}</p>
                        <p className="text-victorian-500 text-[10px]">HP {p.hp} | San {p.sanity} | Spi {p.spirituality}</p>
                      </div>
                      {alreadyIn && <span className="text-victorian-500 text-[10px]">อยู่แล้ว</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* NPC form */}
        {showAddNpc && (
          <div className="p-4 rounded-xl bg-victorian-900/80 border border-purple-500/20 space-y-3">
            <h4 className="text-purple-300 text-sm font-bold">เพิ่ม NPC ศัตรู</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <label className="flex flex-col gap-1 col-span-2 md:col-span-1">
                <span className="text-victorian-400 text-[10px] px-0.5">ชื่อศัตรู</span>
                <input type="text" value={npcForm.name} onChange={e => setNpcForm({ ...npcForm, name: e.target.value })}
                  placeholder="เช่น บารอนอันนาส" className="input-victorian !py-2 !text-xs" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-red-400 text-[10px] px-0.5">HP ❤️</span>
                <input type="number" value={npcForm.hp} onChange={e => setNpcForm({ ...npcForm, hp: e.target.value })}
                  min={0} className="input-victorian !py-2 !text-xs" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-yellow-400 text-[10px] px-0.5">สติ 🧠</span>
                <input type="number" value={npcForm.sanity} onChange={e => setNpcForm({ ...npcForm, sanity: e.target.value })}
                  min={0} className="input-victorian !py-2 !text-xs" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-blue-400 text-[10px] px-0.5">จิตใจ ✨</span>
                <input type="number" value={npcForm.spirit} onChange={e => setNpcForm({ ...npcForm, spirit: e.target.value })}
                  min={0} className="input-victorian !py-2 !text-xs" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-victorian-400 text-[10px] px-0.5">Avatar URL (ไม่จำเป็น)</span>
                <input type="text" value={npcForm.avatar} onChange={e => setNpcForm({ ...npcForm, avatar: e.target.value })}
                  placeholder="https://..." className="input-victorian !py-2 !text-xs" />
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAddNpc(false)} className="text-victorian-400 text-xs cursor-pointer">ยกเลิก</button>
              <button type="button" onClick={handleAddNpc} disabled={pending || !npcForm.name.trim()}
                className="px-3 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/40 text-purple-300 text-xs font-bold hover:bg-purple-600/30 cursor-pointer disabled:opacity-50 transition-colors">
                เพิ่ม
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            MAIN COMBAT TABLE (admin: raw HTML table, player: styled cards)
           ══════════════════════════════════════════════ */}

        {isStaff ? (
          /* ─── ADMIN VIEW: Fast & Ugly tables ─── */
          <div className="space-y-4">
            {/* Players table */}
            <AdminTable
              title="ฝั่งผู้เล่น"
              titleColor="text-blue-400"
              borderColor="border-blue-500/30"
              participants={players}
              sessionStatus={session.status}
              onStatDelta={handleStatDelta}
              onStatusEffect={handleStatusEffect}
              onGiveTurn={handleGiveTurn}
              onRemove={handleRemove}
            />

            {/* NPCs table */}
            <AdminTable
              title="ฝั่งศัตรู"
              titleColor="text-red-400"
              borderColor="border-red-500/30"
              participants={npcs}
              sessionStatus={session.status}
              onStatDelta={handleStatDelta}
              onStatusEffect={handleStatusEffect}
              onGiveTurn={handleGiveTurn}
              onRemove={handleRemove}
            />
          </div>
        ) : (
          /* ─── PLAYER VIEW: Styled cards ─── */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Player team */}
            <div className="space-y-2">
              <h3 className="text-blue-400 text-sm font-bold flex items-center gap-2">
                <Swords className="w-4 h-4" /> ฝั่งผู้เล่น
              </h3>
              {players.map(p => (
                <PlayerCard key={p.id} participant={p} isMe={p.profile_id === userId} />
              ))}
            </div>

            {/* Enemy team */}
            <div className="space-y-2">
              <h3 className="text-red-400 text-sm font-bold flex items-center gap-2">
                <Swords className="w-4 h-4" /> ฝั่งศัตรู
              </h3>
              {npcs.map(p => (
                <PlayerCard key={p.id} participant={p} isMe={false} />
              ))}
            </div>
          </div>
        )}

        {/* Roleplay link submit (player, active session, my turn) */}
        {!isStaff && session.status === 'active' && myParticipant?.is_current_turn && !isDisabled && (
          <div className="p-4 rounded-xl bg-gold-400/5 border-2 border-gold-400/30 animate-pulse-slow space-y-2">
            <p className="text-gold-300 text-sm font-bold">✨ ถึงเทิร์นของคุณแล้ว! ส่งลิงก์โรลเพลย์</p>
            <div className="flex gap-2">
              <input
                type="url"
                value={rpLink}
                onChange={e => setRpLink(e.target.value)}
                placeholder="https://..."
                className="flex-1 bg-victorian-900/80 border border-gold-400/20 rounded-lg px-3 py-2 text-nouveau-cream text-sm outline-none focus:border-gold-400/50"
                onKeyDown={e => e.key === 'Enter' && handleSubmitRp()}
              />
              <button type="button" onClick={handleSubmitRp} disabled={pending || !rpLink.trim()}
                className="px-4 py-2 rounded-lg bg-gold-400/20 border border-gold-400/40 text-gold-300 text-sm font-bold hover:bg-gold-400/30 cursor-pointer disabled:opacity-50 transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Combat Feed */}
        <CombatFeed sessionId={sessionId} initialLogs={logs} />
      </div>
    </>
  )
}


/* ══════════════════════════════════════════════
   ADMIN TABLE — raw HTML table, speed over beauty
   ══════════════════════════════════════════════ */

function AdminTable({
  title,
  titleColor,
  borderColor,
  participants,
  sessionStatus,
  onStatDelta,
  onStatusEffect,
  onGiveTurn,
  onRemove,
}: {
  title: string
  titleColor: string
  borderColor: string
  participants: CombatParticipant[]
  sessionStatus: string
  onStatDelta: (pid: string, field: 'current_hp' | 'current_sanity' | 'current_spirit', delta: number) => void
  onStatusEffect: (pid: string, slot: 1 | 2, effect: CombatStatusEffect | null) => void
  onGiveTurn: (pid: string) => void
  onRemove: (pid: string, display_name: string) => void
}) {
  if (participants.length === 0) {
    return (
      <div className={`p-3 rounded-lg border ${borderColor} bg-victorian-950/50`}>
        <p className={`${titleColor} text-sm font-bold`}>{title}</p>
        <p className="text-victorian-500 text-xs mt-1">ยังไม่มีผู้เข้าร่วม</p>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border ${borderColor} bg-victorian-950/50 overflow-x-auto`}>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-victorian-700/30">
            <th className={`text-left p-2 ${titleColor} font-bold`}>{title}</th>
            <th className="text-center p-2 text-red-400 whitespace-nowrap">HP</th>
            <th className="text-center p-2 text-blue-400 whitespace-nowrap">Sanity</th>
            <th className="text-center p-2 text-purple-400 whitespace-nowrap">Spirit</th>
            <th className="text-center p-2 text-yellow-400 whitespace-nowrap">สถานะ 1</th>
            <th className="text-center p-2 text-yellow-400 whitespace-nowrap">สถานะ 2</th>
            {sessionStatus === 'active' && <th className="text-center p-2 text-gold-400 whitespace-nowrap">เทิร์น</th>}
            {sessionStatus === 'lobby' && <th className="text-center p-2 whitespace-nowrap">ลบ</th>}
          </tr>
        </thead>
        <tbody>
          {participants.map(p => (
            <tr key={p.id}
              className={`border-b border-victorian-800/30 ${p.is_current_turn ? 'bg-gold-400/10' : 'hover:bg-victorian-900/40'} transition-colors`}>
              {/* Name + Avatar */}
              <td className="p-2">
                <div className="flex items-center gap-2">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-victorian-700 shrink-0 flex items-center justify-center text-victorian-500 text-[10px]">
                      {p.type === 'npc' ? '👹' : '👤'}
                    </div>
                  )}
                  <span className={`font-semibold truncate max-w-[120px] ${p.is_current_turn ? 'text-gold-300' : 'text-nouveau-cream'}`}>
                    {p.display_name}
                  </span>
                  {p.is_current_turn && <span className="text-gold-400 text-[10px]">⚔️</span>}
                </div>
              </td>

              {/* HP */}
              <td className="p-2">
                <StatCell value={p.current_hp} color="text-red-400"
                  onDelta={d => onStatDelta(p.id, 'current_hp', d)} />
              </td>

              {/* Sanity */}
              <td className="p-2">
                <StatCell value={p.current_sanity} color="text-blue-400"
                  onDelta={d => onStatDelta(p.id, 'current_sanity', d)} />
              </td>

              {/* Spirit */}
              <td className="p-2">
                <StatCell value={p.current_spirit} color="text-purple-400"
                  onDelta={d => onStatDelta(p.id, 'current_spirit', d)} />
              </td>

              {/* Status 1 */}
              <td className="p-2">
                <StatusDropdown value={p.status_effect_1}
                  onChange={v => onStatusEffect(p.id, 1, v)} />
              </td>

              {/* Status 2 */}
              <td className="p-2">
                <StatusDropdown value={p.status_effect_2}
                  onChange={v => onStatusEffect(p.id, 2, v)} />
              </td>

              {/* Turn button */}
              {sessionStatus === 'active' && (
                <td className="p-2 text-center">
                  <button type="button" onClick={() => onGiveTurn(p.id)}
                    className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                      p.is_current_turn
                        ? 'bg-gold-400/30 border border-gold-400/50 text-gold-300'
                        : 'bg-victorian-800 border border-victorian-600/30 text-victorian-400 hover:bg-victorian-700'
                    }`}>
                    มอบเทิร์น
                  </button>
                </td>
              )}

              {/* Remove button (lobby only) */}
              {sessionStatus === 'lobby' && (
                <td className="p-2 text-center">
                  <button type="button" onClick={() => onRemove(p.id, p.display_name)}
                    className="text-red-500/50 hover:text-red-400 cursor-pointer transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


/* ── Stat Cell: +/- buttons ── */
function StatCell({ value, color, onDelta }: { value: number; color: string; onDelta: (d: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-1">
      <button type="button" onClick={() => onDelta(-1)}
        className="w-5 h-5 rounded bg-red-900/50 text-red-400 text-[10px] hover:bg-red-900/80 cursor-pointer flex items-center justify-center transition-colors">
        −
      </button>
      <span className={`${color} font-bold text-sm min-w-[24px] text-center`}>{value}</span>
      <button type="button" onClick={() => onDelta(1)}
        className="w-5 h-5 rounded bg-green-900/50 text-green-400 text-[10px] hover:bg-green-900/80 cursor-pointer flex items-center justify-center transition-colors">
        +
      </button>
    </div>
  )
}


/* ── Status Dropdown ── */
function StatusDropdown({ value, onChange }: { value: CombatStatusEffect | null; onChange: (v: CombatStatusEffect | null) => void }) {
  return (
    <select
      value={value || ''}
      onChange={e => onChange((e.target.value || null) as CombatStatusEffect | null)}
      className="bg-victorian-900 border border-victorian-700/40 rounded px-1 py-0.5 text-[10px] text-nouveau-cream outline-none cursor-pointer w-full max-w-[100px]"
    >
      <option value="">— ไม่มี —</option>
      {ALL_EFFECTS.map(e => (
        <option key={e} value={e}>{STATUS_EFFECT_LABELS[e]}</option>
      ))}
    </select>
  )
}


/* ── Player Card (player view) ── */
function PlayerCard({ participant: p, isMe }: { participant: CombatParticipant; isMe: boolean }) {
  const effects = [p.status_effect_1, p.status_effect_2].filter(Boolean) as CombatStatusEffect[]

  return (
    <div className={`p-3 rounded-xl border transition-all ${
      p.is_current_turn
        ? 'border-gold-400/50 bg-gold-400/5 shadow-gold'
        : 'border-victorian-700/30 bg-victorian-900/50'
    } ${isMe ? 'ring-1 ring-blue-500/30' : ''}`}>
      <div className="flex items-center gap-3">
        {p.avatar_url ? (
          <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-victorian-700 shrink-0 flex items-center justify-center text-lg">
            {p.type === 'npc' ? '👹' : '👤'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`font-semibold text-sm truncate ${p.is_current_turn ? 'text-gold-300' : 'text-nouveau-cream'}`}>
              {p.display_name}
            </p>
            {isMe && <span className="text-blue-400 text-[10px] font-bold">(คุณ)</span>}
            {p.is_current_turn && <span className="text-gold-400 text-[10px]">⚔️ เทิร์น</span>}
          </div>
          {/* Stats bar */}
          <div className="flex gap-3 mt-1 text-[10px]">
            <span className="text-red-400">❤️ {p.current_hp}</span>
            <span className="text-blue-400">🧠 {p.current_sanity}</span>
            <span className="text-purple-400">✨ {p.current_spirit}</span>
          </div>
          {/* Status effects */}
          {effects.length > 0 && (
            <div className="flex gap-1 mt-1">
              {effects.map(e => (
                <span key={e} className="px-1.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-200 text-[9px] font-bold">
                  {STATUS_EFFECT_LABELS[e]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
