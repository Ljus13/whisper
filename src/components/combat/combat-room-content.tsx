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
import { ArrowLeft, Plus, Trash2, Play, Square, Megaphone, Send, Swords, X, UserPlus, Bot, Edit2 } from 'lucide-react'
import Link from 'next/link'
import StatusEffectOverlay from './status-effect-overlay'
import AnnouncementOverlay from './announcement-overlay'
import CombatFeed from './combat-feed'
import StatAdjustmentModal from './stat-adjustment-modal'

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
  const [npcForm, setNpcForm] = useState({ name: '', hp: '5', sanity: '10', spirit: '15', dex: '10', wis: '10', avatar: '' })
  const [announcementText, setAnnouncementText] = useState('')
  const [pending, setPending] = useState(false)

  // Stat adjustment modal
  const [statModal, setStatModal] = useState<{
    participantId: string
    participantName: string
    field: 'current_hp' | 'current_sanity' | 'current_spirit' | 'current_dex' | 'current_wis'
    fieldLabel: string
    currentValue: number
  } | null>(null)

  // Status effect editor
  const [statusModal, setStatusModal] = useState<{
    participantId: string
    participantName: string
    slot: 1 | 2
    currentEffect: CombatStatusEffect | null
  } | null>(null)

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

    const channel = supabase
      .channel(`combat:${sessionId}`, { config: { broadcast: { self: true } } })
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_sessions', filter: `id=eq.${sessionId}` }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_participants', filter: `session_id=eq.${sessionId}` }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_logs', filter: `session_id=eq.${sessionId}` }, debouncedFetch)
      .subscribe()

    return () => {
      mountedRef.current = false
      supabase.removeChannel(channel)
    }
  }, [sessionId, fetchData, isStaff])

  const myParticipant = participants.find(p => p.profile_id === userId)
  const myPrimaryEffect = myParticipant?.status_effect_1 || null
  const myEffects = [myParticipant?.status_effect_1, myParticipant?.status_effect_2].filter(Boolean) as CombatStatusEffect[]
  const isDisabled = myEffects.some(e => DISABLING_EFFECTS.includes(e))

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
      parseInt(npcForm.dex) || 10,
      parseInt(npcForm.wis) || 10,
      npcForm.avatar || undefined
    )
    if (res.error) alert(res.error)
    else {
      setNpcForm({ name: '', hp: '5', sanity: '10', spirit: '15', dex: '10', wis: '10', avatar: '' })
      setShowAddNpc(false)
    }
    setPending(false)
  }

  const handleRemove = async (pid: string) => {
    if (!confirm('ลบผู้เข้าร่วมนี้?')) return
    setPending(true)
    const res = await removeParticipant(sessionId, pid)
    if (res.error) alert('ลบไม่สำเร็จ: ' + res.error)
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

  const handleStatAdjust = async (delta: number, reason: string) => {
    if (!statModal) return
    setPending(true)
    await updateParticipantStat(sessionId, statModal.participantId, statModal.field, delta, reason)
    setStatModal(null)
    setPending(false)
  }

  const handleStatusEffect = async (effect: CombatStatusEffect | null) => {
    if (!statusModal) return
    setPending(true)
    await setStatusEffect(sessionId, statusModal.participantId, statusModal.slot, effect)
    setStatusModal(null)
    setPending(false)
  }

  const handleGiveTurn = async (pid: string) => {
    setPending(true)
    await giveTurn(sessionId, pid)
    setPending(false)
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
    setPending(true)
    await clearAnnouncement(sessionId)
    setPending(false)
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
    setShowAddPlayer(true)
    const res = await getPlayersForCombat()
    setAvailablePlayers(res.players || [])
  }

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

  return (
    <>
      {!isStaff && myPrimaryEffect && (
        <StatusEffectOverlay effect={myPrimaryEffect} allEffects={myEffects} />
      )}

      {!isStaff && showAnnouncement && (
        <AnnouncementOverlay
          message={announcementMsg}
          onAck={() => setShowAnnouncement(false)}
        />
      )}

      {statModal && (
        <StatAdjustmentModal
          participantName={statModal.participantName}
          statName={statModal.fieldLabel}
          currentValue={statModal.currentValue}
          onConfirm={handleStatAdjust}
          onClose={() => setStatModal(null)}
        />
      )}

      {statusModal && (
        <StatusEffectModal
          participantName={statusModal.participantName}
          slot={statusModal.slot}
          currentEffect={statusModal.currentEffect}
          onConfirm={handleStatusEffect}
          onClose={() => setStatusModal(null)}
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

        {!isStaff && session.announcement && !showAnnouncement && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/30 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-red-200 text-sm font-semibold">{session.announcement}</p>
          </div>
        )}

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
          <PlayerPickerModal
            players={availablePlayers}
            participants={participants}
            onSelect={handleAddPlayer}
            onClose={() => setShowAddPlayer(false)}
            pending={pending}
          />
        )}

        {/* NPC form */}
        {showAddNpc && (
          <div className="p-4 rounded-xl bg-victorian-900/80 border border-purple-500/20 space-y-3">
            <h4 className="text-purple-300 text-sm font-bold">เพิ่ม NPC ศัตรู</h4>
            <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
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
                <span className="text-yellow-400 text-[10px] px-0.5">Sanity 🧠</span>
                <input type="number" value={npcForm.sanity} onChange={e => setNpcForm({ ...npcForm, sanity: e.target.value })}
                  min={0} className="input-victorian !py-2 !text-xs" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-blue-400 text-[10px] px-0.5">Spirit ✨</span>
                <input type="number" value={npcForm.spirit} onChange={e => setNpcForm({ ...npcForm, spirit: e.target.value })}
                  min={0} className="input-victorian !py-2 !text-xs" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-green-400 text-[10px] px-0.5">DEX 🎯</span>
                <input type="number" value={npcForm.dex} onChange={e => setNpcForm({ ...npcForm, dex: e.target.value })}
                  min={0} className="input-victorian !py-2 !text-xs" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-purple-400 text-[10px] px-0.5">WIS 🔮</span>
                <input type="number" value={npcForm.wis} onChange={e => setNpcForm({ ...npcForm, wis: e.target.value })}
                  min={0} className="input-victorian !py-2 !text-xs" />
              </label>
              <label className="flex flex-col gap-1 col-span-2 md:col-span-1">
                <span className="text-victorian-400 text-[10px] px-0.5">Avatar URL</span>
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

        {/* CARD-BASED COMBAT VIEW */}
        <div className="space-y-4">
          {/* Players Section */}
          <div className="space-y-2">
            <h3 className="text-blue-400 text-sm font-bold flex items-center gap-2">
              <Swords className="w-4 h-4" /> ฝั่งผู้เล่น ({players.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {players.map(p => (
                <CombatCard
                  key={p.id}
                  participant={p}
                  isMe={p.profile_id === userId}
                  isStaff={isStaff}
                  sessionStatus={session.status}
                  onStatClick={(field, label, value) => setStatModal({
                    participantId: p.id,
                    participantName: p.display_name,
                    field,
                    fieldLabel: label,
                    currentValue: value
                  })}
                  onStatusClick={(slot, effect) => setStatusModal({
                    participantId: p.id,
                    participantName: p.display_name,
                    slot,
                    currentEffect: effect
                  })}
                  onGiveTurn={() => handleGiveTurn(p.id)}
                  onRemove={() => handleRemove(p.id)}
                />
              ))}
            </div>
          </div>

          {/* VS Divider */}
          <div className="flex items-center justify-center py-2">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-400/30 to-transparent w-24" />
              <span className="text-gold-400 font-bold text-lg tracking-wider">⚔️ VS ⚔️</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-400/30 to-transparent w-24" />
            </div>
          </div>

          {/* Enemies Section */}
          <div className="space-y-2">
            <h3 className="text-red-400 text-sm font-bold flex items-center gap-2">
              <Swords className="w-4 h-4" /> ฝั่งศัตรู ({npcs.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {npcs.map(p => (
                <CombatCard
                  key={p.id}
                  participant={p}
                  isMe={false}
                  isStaff={isStaff}
                  sessionStatus={session.status}
                  onStatClick={(field, label, value) => setStatModal({
                    participantId: p.id,
                    participantName: p.display_name,
                    field,
                    fieldLabel: label,
                    currentValue: value
                  })}
                  onStatusClick={(slot, effect) => setStatusModal({
                    participantId: p.id,
                    participantName: p.display_name,
                    slot,
                    currentEffect: effect
                  })}
                  onGiveTurn={() => handleGiveTurn(p.id)}
                  onRemove={() => handleRemove(p.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Roleplay link submit */}
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
   COMBAT CARD — Unified card for both views
   ══════════════════════════════════════════════ */

function CombatCard({
  participant: p,
  isMe,
  isStaff,
  sessionStatus,
  onStatClick,
  onStatusClick,
  onGiveTurn,
  onRemove,
}: {
  participant: CombatParticipant
  isMe: boolean
  isStaff: boolean
  sessionStatus: string
  onStatClick: (field: 'current_hp' | 'current_sanity' | 'current_spirit' | 'current_dex' | 'current_wis', label: string, value: number) => void
  onStatusClick: (slot: 1 | 2, effect: CombatStatusEffect | null) => void
  onGiveTurn: () => void
  onRemove: () => void
}) {
  const effects = [p.status_effect_1, p.status_effect_2].filter(Boolean) as CombatStatusEffect[]

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      p.is_current_turn
        ? 'border-gold-400/50 bg-gold-400/5 shadow-lg shadow-gold-400/10'
        : 'border-victorian-700/30 bg-victorian-900/50'
    } ${isMe ? 'ring-2 ring-blue-500/30' : ''}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        {p.avatar_url ? (
          <img src={p.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-victorian-700 shrink-0 flex items-center justify-center text-xl">
            {p.type === 'npc' ? '👹' : '👤'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`font-semibold text-sm truncate ${p.is_current_turn ? 'text-gold-300' : 'text-nouveau-cream'}`}>
              {p.display_name}
            </p>
            {isMe && <span className="text-blue-400 text-[10px] font-bold px-1.5 py-0.5 bg-blue-500/20 rounded">คุณ</span>}
            {p.is_current_turn && <span className="text-gold-400 text-[10px] font-bold">⚔️ เทิร์น</span>}
          </div>
          <p className="text-victorian-500 text-[10px]">{p.type === 'player' ? 'ผู้เล่น' : 'NPC'}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        <StatBadge
          label="HP"
          value={p.current_hp}
          color="red"
          icon="❤️"
          onClick={isStaff && sessionStatus === 'active' ? () => onStatClick('current_hp', 'HP', p.current_hp) : undefined}
        />
        <StatBadge
          label="San"
          value={p.current_sanity}
          color="yellow"
          icon="🧠"
          onClick={isStaff && sessionStatus === 'active' ? () => onStatClick('current_sanity', 'Sanity', p.current_sanity) : undefined}
        />
        <StatBadge
          label="Spi"
          value={p.current_spirit}
          color="blue"
          icon="✨"
          onClick={isStaff && sessionStatus === 'active' ? () => onStatClick('current_spirit', 'Spirit', p.current_spirit) : undefined}
        />
        <StatBadge
          label="DEX"
          value={p.current_dex}
          color="green"
          icon="🎯"
          onClick={isStaff && sessionStatus === 'active' ? () => onStatClick('current_dex', 'DEX', p.current_dex) : undefined}
        />
        <StatBadge
          label="WIS"
          value={p.current_wis}
          color="purple"
          icon="🔮"
          onClick={isStaff && sessionStatus === 'active' ? () => onStatClick('current_wis', 'WIS', p.current_wis) : undefined}
        />
      </div>

      {/* Status Effects */}
      <div className="space-y-1.5 mb-3">
        <StatusEffectBadge
          slot={1}
          effect={p.status_effect_1}
          onClick={isStaff && sessionStatus === 'active' ? () => onStatusClick(1, p.status_effect_1) : undefined}
        />
        <StatusEffectBadge
          slot={2}
          effect={p.status_effect_2}
          onClick={isStaff && sessionStatus === 'active' ? () => onStatusClick(2, p.status_effect_2) : undefined}
        />
      </div>

      {/* Admin Actions */}
      {isStaff && (
        <div className="flex gap-2 pt-2 border-t border-victorian-700/30">
          {sessionStatus === 'active' && (
            <button
              type="button"
              onClick={onGiveTurn}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                p.is_current_turn
                  ? 'bg-gold-400/30 border border-gold-400/50 text-gold-300'
                  : 'bg-victorian-800 border border-victorian-600/30 text-victorian-400 hover:bg-victorian-700'
              }`}
            >
              มอบเทิร์น
            </button>
          )}
          {sessionStatus === 'lobby' && (
            <button
              type="button"
              onClick={onRemove}
              className="flex-1 px-3 py-1.5 rounded-lg bg-red-900/20 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-900/40 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3 h-3 inline mr-1" />
              ลบ
            </button>
          )}
        </div>
      )}
    </div>
  )
}


/* ── Stat Badge ── */
function StatBadge({ label, value, color, icon, onClick }: {
  label: string
  value: number
  color: 'red' | 'yellow' | 'blue' | 'green' | 'purple'
  icon: string
  onClick?: () => void
}) {
  const colors = {
    red: 'text-red-400 bg-red-900/20 border-red-500/30',
    yellow: 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30',
    blue: 'text-blue-400 bg-blue-900/20 border-blue-500/30',
    green: 'text-green-400 bg-green-900/20 border-green-500/30',
    purple: 'text-purple-400 bg-purple-900/20 border-purple-500/30',
  }

  return (
    <div
      className={`flex flex-col items-center justify-center p-2 rounded-lg border ${colors[color]} ${onClick ? 'cursor-pointer hover:opacity-80' : ''} transition-opacity`}
      onClick={onClick}
    >
      <span className="text-[10px] opacity-70">{icon}</span>
      <span className="font-bold text-sm">{value}</span>
      <span className="text-[9px] opacity-60">{label}</span>
      {onClick && <Edit2 className="w-2.5 h-2.5 opacity-40 mt-0.5" />}
    </div>
  )
}


/* ── Status Effect Badge ── */
function StatusEffectBadge({ slot, effect, onClick }: {
  slot: 1 | 2
  effect: CombatStatusEffect | null
  onClick?: () => void
}) {
  return (
    <div
      className={`px-2 py-1 rounded-lg border text-xs flex items-center justify-between ${
        effect
          ? 'bg-purple-900/20 border-purple-500/30 text-purple-200'
          : 'bg-victorian-800/30 border-victorian-700/20 text-victorian-500'
      } ${onClick ? 'cursor-pointer hover:opacity-80' : ''} transition-opacity`}
      onClick={onClick}
    >
      <span className="font-semibold">
        สถานะ {slot}: {effect ? STATUS_EFFECT_LABELS[effect] : '—'}
      </span>
      {onClick && <Edit2 className="w-3 h-3 opacity-50" />}
    </div>
  )
}


/* ── Player Picker Modal ── */
function PlayerPickerModal({ players, participants, onSelect, onClose, pending }: {
  players: any[]
  participants: CombatParticipant[]
  onSelect: (id: string) => void
  onClose: () => void
  pending: boolean
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-victorian-900 border border-gold-400/20 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto p-5 space-y-3"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="heading-victorian text-lg">เลือกผู้เล่น</h3>
          <button type="button" onClick={onClose} className="text-victorian-400 hover:text-gold-400 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {players.map(p => {
            const alreadyIn = participants.some(pp => pp.profile_id === p.id)
            return (
              <button key={p.id} type="button" disabled={alreadyIn || pending}
                onClick={() => onSelect(p.id)}
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
  )
}


/* ── Status Effect Modal ── */
function StatusEffectModal({ participantName, slot, currentEffect, onConfirm, onClose }: {
  participantName: string
  slot: 1 | 2
  currentEffect: CombatStatusEffect | null
  onConfirm: (effect: CombatStatusEffect | null) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<CombatStatusEffect | null>(currentEffect)

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-victorian-900 border border-gold-400/20 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="heading-victorian text-lg">ตั้งสถานะ {slot}</h3>
          <button type="button" onClick={onClose} className="text-victorian-400 hover:text-gold-400 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 rounded-lg bg-victorian-800/50 border border-victorian-700/30">
          <p className="text-nouveau-cream text-sm font-semibold">{participantName}</p>
        </div>

        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className={`w-full px-3 py-2 rounded-lg border text-left text-sm transition-colors ${
              selected === null
                ? 'bg-gold-400/20 border-gold-400/40 text-gold-300'
                : 'bg-victorian-800/50 border-victorian-700/30 text-victorian-300 hover:border-gold-400/20'
            }`}
          >
            — ไม่มีสถานะ —
          </button>
          {ALL_EFFECTS.map(e => (
            <button
              key={e}
              type="button"
              onClick={() => setSelected(e)}
              className={`w-full px-3 py-2 rounded-lg border text-left text-sm transition-colors ${
                selected === e
                  ? 'bg-purple-600/20 border-purple-500/40 text-purple-200'
                  : 'bg-victorian-800/50 border-victorian-700/30 text-victorian-300 hover:border-purple-500/20'
              }`}
            >
              {STATUS_EFFECT_LABELS[e]}
            </button>
          ))}
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-victorian-800 border border-victorian-600/40 text-victorian-300 text-sm hover:text-nouveau-cream cursor-pointer transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selected)}
            className="px-4 py-2 rounded-lg bg-gold-400/20 border border-gold-400/40 text-gold-300 text-sm font-bold hover:bg-gold-400/30 cursor-pointer transition-colors"
          >
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  )
}
