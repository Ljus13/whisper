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
  deleteCombatSession,
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
import { ArrowLeft, Plus, Trash2, Play, Square, Megaphone, Send, Swords, X, UserPlus, Bot, Edit2, Shield, Heart, Brain, Sparkles, Target, Eye, ChevronRight, Crown, Skull, Zap } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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

const STATUS_EFFECT_ICONS: Record<string, string> = {
  stunned: '💫', frozen: '🧊', cursed: '☠️', death_aura: '💀',
  sleeping: '😴', burning: '🔥', blinding_light: '✨', paralyzed: '⚡',
  poisoned: '🧪', berserk: '😤', blinded: '🙈', bleeding: '🩸',
  charmed: '💖', drowning: '🌊',
}

export default function CombatRoomContent({ sessionId, userId, isStaff }: Props) {
  const router = useRouter()
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
      .on('broadcast', { event: 'stat_update' }, () => { console.log('[RT] broadcast: stat_update'); fetchData() })
      .on('broadcast', { event: 'status_update' }, () => { console.log('[RT] broadcast: status_update'); fetchData() })
      .on('broadcast', { event: 'turn_change' }, () => { console.log('[RT] broadcast: turn_change'); fetchData() })
      .on('broadcast', { event: 'session_update' }, () => { console.log('[RT] broadcast: session_update'); fetchData() })
      .on('broadcast', { event: 'participant_added' }, () => { console.log('[RT] broadcast: participant_added'); fetchData() })
      .on('broadcast', { event: 'participant_removed' }, () => { console.log('[RT] broadcast: participant_removed'); fetchData() })
      .on('broadcast', { event: 'roleplay_link' }, () => { console.log('[RT] broadcast: roleplay_link'); fetchData() })
      .on('broadcast', { event: 'announcement' }, ({ payload }) => {
        console.log('[RT] broadcast: announcement', payload)
        fetchData()
        if (!isStaff && payload?.message) {
          setAnnouncementMsg(payload.message)
          setShowAnnouncement(true)
        }
      })
      .on('broadcast', { event: 'announcement_clear' }, () => {
        console.log('[RT] broadcast: announcement_clear')
        setShowAnnouncement(false)
        fetchData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_sessions', filter: `id=eq.${sessionId}` }, (p) => { console.log('[RT] pg: combat_sessions', p.eventType); debouncedFetch() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_participants', filter: `session_id=eq.${sessionId}` }, (p) => { console.log('[RT] pg: combat_participants', p.eventType); debouncedFetch() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_logs', filter: `session_id=eq.${sessionId}` }, (p) => { console.log('[RT] pg: combat_logs', p.eventType); debouncedFetch() })
      .subscribe((status, err) => {
        console.log(`[RT] channel subscribe status: ${status}`, err || '')
      })

    return () => {
      console.log('[RT] cleanup: removing channel')
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
  const currentTurnParticipant = participants.find(p => p.is_current_turn)

  // === Handlers ===

  const handleAddPlayer = async (profileId: string) => {
    setPending(true)
    const res = await addPlayerToCombat(sessionId, profileId)
    if (res.error) alert(res.error)
    else {
      setShowAddPlayer(false)
      await fetchData()
    }
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
      await fetchData()
    }
    setPending(false)
  }

  const handleRemove = async (pid: string) => {
    if (!confirm('ลบผู้เข้าร่วมนี้?')) return
    setPending(true)
    const res = await removeParticipant(sessionId, pid)
    if (res.error) alert('ลบไม่สำเร็จ: ' + res.error)
    else await fetchData()
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

  const handleDelete = async () => {
    if (!confirm('ลบห้องต่อสู้นี้ถาวร? จะลบผู้เข้าร่วมและบันทึกทั้งหมด')) return
    if (!confirm('ยืนยันอีกครั้ง — การลบไม่สามารถย้อนกลับได้')) return
    setPending(true)
    const res = await deleteCombatSession(sessionId)
    if (res.error) { alert(res.error); setPending(false); return }
    router.push('/dashboard/combat')
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <Swords className="w-12 h-12 text-gold-400 animate-pulse" />
          <div className="absolute inset-0 bg-gold-400/20 blur-xl rounded-full" />
        </div>
        <p className="text-victorian-400 animate-pulse text-sm">กำลังโหลดสนามรบ...</p>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        <div className="text-center py-12 space-y-4">
          <Skull className="w-16 h-16 mx-auto text-red-500/50" />
          <p className="text-red-400 text-lg">{error || 'ไม่พบห้องต่อสู้'}</p>
          <Link href="/dashboard/combat" className="text-gold-400 text-sm hover:text-gold-300 transition-colors inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> กลับไปรายการ
          </Link>
        </div>
      </div>
    )
  }

  const statusConfig = {
    lobby: { label: 'ล็อบบี้รอเริ่ม', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', dot: 'bg-yellow-400' },
    active: { label: 'กำลังต่อสู้', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-400 animate-pulse' },
    ended: { label: 'จบฉากแล้ว', color: 'text-victorian-400', bg: 'bg-victorian-500/10', border: 'border-victorian-500/30', dot: 'bg-victorian-400' },
  }
  const sc = statusConfig[session.status as keyof typeof statusConfig] || statusConfig.lobby

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

      <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-6 space-y-5">

        {/* ═══════════════════════════════════════
            HEADER — Scene Title & Controls
           ═══════════════════════════════════════ */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-victorian-950 via-victorian-900/80 to-victorian-950 rounded-2xl" />
          <div className="relative p-4 md:p-5 rounded-2xl border border-victorian-700/40 backdrop-blur-sm">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <Link href="/dashboard/combat" className="w-10 h-10 rounded-xl bg-victorian-800/80 border border-victorian-600/30 flex items-center justify-center text-victorian-400 hover:text-gold-400 hover:border-gold-400/30 transition-all">
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                  <h1 className="heading-victorian text-xl md:text-2xl">{session.name}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${sc.bg} ${sc.color} ${sc.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      {sc.label}
                    </span>
                    <span className="text-victorian-600 text-[10px]">•</span>
                    <span className="text-victorian-500 text-[10px]">{participants.length} ผู้เข้าร่วม</span>
                  </div>
                </div>
              </div>

              {isStaff && session.status !== 'ended' && (
                <div className="flex gap-2">
                  {session.status === 'lobby' && (
                    <button type="button" onClick={handleStart} disabled={pending || participants.length < 2}
                      className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/40 text-green-300 text-sm font-bold hover:from-green-600/30 hover:to-emerald-600/30 cursor-pointer disabled:opacity-50 transition-all">
                      <Play className="w-4 h-4 group-hover:scale-110 transition-transform" /> เริ่มฉากต่อสู้
                    </button>
                  )}
                  {session.status === 'active' && (
                    <button type="button" onClick={handleEnd} disabled={pending}
                      className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600/20 to-rose-600/20 border border-red-500/40 text-red-300 text-sm font-bold hover:from-red-600/30 hover:to-rose-600/30 cursor-pointer disabled:opacity-50 transition-all">
                      <Square className="w-4 h-4 group-hover:scale-110 transition-transform" /> จบฉาก
                    </button>
                  )}
                </div>
              )}

              {/* Delete button — only lobby/ended */}
              {isStaff && session.status !== 'active' && (
                <button type="button" onClick={handleDelete} disabled={pending}
                  className="group inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-950/30 border border-red-500/20 text-red-400/60 text-xs font-bold hover:bg-red-950/50 hover:text-red-400 hover:border-red-500/40 cursor-pointer disabled:opacity-50 transition-all"
                  title="ลบห้องต่อสู้">
                  <Trash2 className="w-3.5 h-3.5" /> ลบห้อง
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════
            TURN ORDER STRIP (Active only)
           ═══════════════════════════════════════ */}
        {session.status === 'active' && currentTurnParticipant && (
          <div className="combat-turn-banner rounded-2xl border border-gold-400/20 p-4 relative overflow-hidden">
            <div className="combat-announce-sweep absolute inset-0 pointer-events-none" />
            <div className="relative flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  {currentTurnParticipant.avatar_url ? (
                    <img src={currentTurnParticipant.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-gold-400/50 combat-turn-active" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-victorian-700 border-2 border-gold-400/50 flex items-center justify-center text-xl combat-turn-active">
                      {currentTurnParticipant.type === 'npc' ? '👹' : '👤'}
                    </div>
                  )}
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gold-400 flex items-center justify-center">
                    <Crown className="w-3 h-3 text-victorian-950" />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-gold-400/70 font-bold uppercase tracking-wider">เทิร์นปัจจุบัน</p>
                  <p className="text-gold-300 font-bold text-lg leading-tight">{currentTurnParticipant.display_name}</p>
                </div>
              </div>
              {/* Turn order avatars */}
              <div className="hidden md:flex items-center gap-1 ml-auto">
                <span className="text-victorian-500 text-[10px] mr-2">ลำดับ:</span>
                {participants.map((p) => (
                  <div
                    key={p.id}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs shrink-0 transition-all ${
                      p.is_current_turn
                        ? 'border-gold-400 scale-110 shadow-lg shadow-gold-400/20'
                        : 'border-victorian-600/30 opacity-50 hover:opacity-80'
                    }`}
                    title={p.display_name}
                  >
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span>{p.type === 'npc' ? '👹' : '👤'}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════
            DM ANNOUNCEMENT BAR
           ═══════════════════════════════════════ */}
        {isStaff && session.status === 'active' && (
          <div className="rounded-2xl bg-gradient-to-r from-victorian-900/80 via-victorian-900/60 to-victorian-900/80 border border-victorian-700/40 overflow-hidden">
            <div className="p-3 md:p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
                <Megaphone className="w-4 h-4 text-red-400" />
              </div>
              <input
                type="text"
                value={announcementText}
                onChange={e => setAnnouncementText(e.target.value)}
                placeholder="พิมพ์ประกาศถึงผู้เล่นทุกคน..."
                className="flex-1 bg-transparent border-none outline-none text-nouveau-cream text-sm placeholder:text-victorian-600"
                onKeyDown={e => e.key === 'Enter' && handleAnnounce()}
              />
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={handleAnnounce} disabled={pending || !announcementText.trim()}
                  className="px-4 py-2 rounded-xl bg-red-600/20 border border-red-500/40 text-red-300 text-xs font-bold hover:bg-red-600/30 cursor-pointer disabled:opacity-40 transition-all">
                  📢 ประกาศ
                </button>
                {session.announcement && (
                  <button type="button" onClick={handleClearAnnouncement}
                    className="px-3 py-2 rounded-xl bg-victorian-800 border border-victorian-600/30 text-victorian-400 text-xs hover:text-victorian-300 cursor-pointer transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            {session.announcement && (
              <div className="px-4 pb-3">
                <div className="px-3 py-2 rounded-lg bg-red-950/30 border border-red-500/20">
                  <p className="text-xs text-yellow-300/80">📢 {session.announcement}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Player announcement banner */}
        {!isStaff && session.announcement && !showAnnouncement && (
          <div className="rounded-2xl bg-gradient-to-r from-red-950/60 via-red-900/40 to-red-950/60 border border-red-500/30 p-4 flex items-center gap-3 relative overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
              <Megaphone className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-red-200 text-sm font-semibold">{session.announcement}</p>
          </div>
        )}

        {/* Player status effects banner */}
        {!isStaff && myEffects.length > 0 && (
          <div className="rounded-2xl bg-gradient-to-r from-purple-950/40 via-purple-900/20 to-purple-950/40 border border-purple-500/30 p-3 flex items-center gap-3 flex-wrap">
            <Shield className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="text-purple-300 text-xs font-bold">สถานะบนตัวคุณ:</span>
            {myEffects.map(e => (
              <span key={e} className="combat-effect-chip inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-200 text-xs font-bold">
                <span>{STATUS_EFFECT_ICONS[e]}</span>
                {STATUS_EFFECT_LABELS[e]}
              </span>
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════
            ADD PARTICIPANTS (Lobby)
           ═══════════════════════════════════════ */}
        {isStaff && session.status === 'lobby' && (
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={loadPlayers}
              className="group inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/10 border border-blue-500/30 text-blue-300 text-xs font-bold hover:bg-blue-600/20 hover:border-blue-500/50 cursor-pointer transition-all">
              <UserPlus className="w-4 h-4 group-hover:scale-110 transition-transform" /> เพิ่มผู้เล่น
            </button>
            <button type="button" onClick={() => setShowAddNpc(!showAddNpc)}
              className="group inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600/10 border border-purple-500/30 text-purple-300 text-xs font-bold hover:bg-purple-600/20 hover:border-purple-500/50 cursor-pointer transition-all">
              <Bot className="w-4 h-4 group-hover:scale-110 transition-transform" /> เพิ่ม NPC ศัตรู
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
          <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/30 to-victorian-900/80 border border-purple-500/20 space-y-4">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-400" />
              <h4 className="text-purple-300 text-sm font-bold">สร้าง NPC ศัตรู</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <label className="flex flex-col gap-1.5 col-span-2 md:col-span-2 lg:col-span-1">
                <span className="text-victorian-400 text-[10px] font-bold uppercase tracking-wider px-0.5">ชื่อศัตรู</span>
                <input type="text" value={npcForm.name} onChange={e => setNpcForm({ ...npcForm, name: e.target.value })}
                  placeholder="เช่น บารอนอันนาส" className="input-victorian !py-2.5 !text-xs !rounded-xl" />
              </label>
              {([
                { key: 'hp', label: 'HP', icon: '❤️', color: 'text-red-400' },
                { key: 'sanity', label: 'Sanity', icon: '🧠', color: 'text-yellow-400' },
                { key: 'spirit', label: 'Spirit', icon: '✨', color: 'text-blue-400' },
                { key: 'dex', label: 'DEX', icon: '🎯', color: 'text-green-400' },
                { key: 'wis', label: 'WIS', icon: '🔮', color: 'text-purple-400' },
              ] as const).map(s => (
                <label key={s.key} className="flex flex-col gap-1.5">
                  <span className={`${s.color} text-[10px] font-bold px-0.5`}>{s.icon} {s.label}</span>
                  <input type="number" value={npcForm[s.key]} onChange={e => setNpcForm({ ...npcForm, [s.key]: e.target.value })}
                    min={0} className="input-victorian !py-2.5 !text-xs !rounded-xl" />
                </label>
              ))}
              <label className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                <span className="text-victorian-400 text-[10px] font-bold uppercase tracking-wider px-0.5">Avatar URL</span>
                <input type="text" value={npcForm.avatar} onChange={e => setNpcForm({ ...npcForm, avatar: e.target.value })}
                  placeholder="https://..." className="input-victorian !py-2.5 !text-xs !rounded-xl" />
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAddNpc(false)} className="px-4 py-2 text-victorian-400 text-xs cursor-pointer hover:text-victorian-300 transition-colors">ยกเลิก</button>
              <button type="button" onClick={handleAddNpc} disabled={pending || !npcForm.name.trim()}
                className="px-5 py-2 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-300 text-xs font-bold hover:bg-purple-600/30 cursor-pointer disabled:opacity-50 transition-all">
                ✨ สร้าง NPC
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════
            BATTLEFIELD — Card-based Combat View
           ═══════════════════════════════════════ */}
        <div className="space-y-2">
          {/* Players Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                <Shield className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-blue-300 text-sm font-bold">ฝั่งผู้เล่น</h3>
                <p className="text-victorian-500 text-[10px]">{players.length} ตัวละคร</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
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

          {/* ── VS Divider ── */}
          {npcs.length > 0 && (
            <div className="flex items-center justify-center py-4">
              <div className="flex items-center gap-4 w-full max-w-md">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-400/20 to-gold-400/40 combat-vs-line" />
                <div className="flex items-center gap-2">
                  <Swords className="w-5 h-5 text-gold-400/60" />
                  <span className="combat-vs-text text-gold-400 font-bold text-xl tracking-widest">VS</span>
                  <Swords className="w-5 h-5 text-gold-400/60 scale-x-[-1]" />
                </div>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-400/20 to-gold-400/40 combat-vs-line" />
              </div>
            </div>
          )}

          {/* Enemies Section */}
          {npcs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <Skull className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <h3 className="text-red-300 text-sm font-bold">ฝั่งศัตรู</h3>
                  <p className="text-victorian-500 text-[10px]">{npcs.length} ตัว</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
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
          )}
        </div>

        {/* ═══════════════════════════════════════
            YOUR TURN — Roleplay Link Submit
           ═══════════════════════════════════════ */}
        {!isStaff && session.status === 'active' && myParticipant?.is_current_turn && !isDisabled && (
          <div className="combat-turn-banner rounded-2xl border-2 border-gold-400/40 p-5 space-y-3 relative overflow-hidden">
            <div className="combat-announce-sweep absolute inset-0 pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gold-400/20 border border-gold-400/40 flex items-center justify-center combat-turn-active">
                  <Swords className="w-5 h-5 text-gold-400" />
                </div>
                <div>
                  <p className="text-gold-300 text-sm font-bold">⚔️ ถึงเทิร์นของคุณแล้ว!</p>
                  <p className="text-gold-400/60 text-[10px]">ส่งลิงก์โรลเพลย์เพื่อดำเนินเทิร์น</p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={rpLink}
                  onChange={e => setRpLink(e.target.value)}
                  placeholder="วางลิงก์โรลเพลย์ที่นี่..."
                  className="flex-1 bg-victorian-950/60 border border-gold-400/20 rounded-xl px-4 py-3 text-nouveau-cream text-sm outline-none focus:border-gold-400/50 focus:shadow-gold transition-all placeholder:text-victorian-600"
                  onKeyDown={e => e.key === 'Enter' && handleSubmitRp()}
                />
                <button type="button" onClick={handleSubmitRp} disabled={pending || !rpLink.trim()}
                  className="px-5 py-3 rounded-xl bg-gold-400/20 border border-gold-400/40 text-gold-300 font-bold hover:bg-gold-400/30 cursor-pointer disabled:opacity-40 transition-all">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════
            COMBAT LOG / FEED
           ═══════════════════════════════════════ */}
        <CombatFeed sessionId={sessionId} initialLogs={logs} />
      </div>
    </>
  )
}


/* ══════════════════════════════════════════════════════════
   COMBAT CARD — Immersive TRPG character card
   ══════════════════════════════════════════════════════════ */

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
  const isDead = p.current_hp <= 0
  const isLowHp = p.current_hp <= 2 && p.current_hp > 0

  // DM can edit stats: during active = all stats, during lobby = DEX/WIS always, HP/SAN/SPI only for NPC
  const canEditStat = (field: string) => {
    if (!isStaff) return false
    if (sessionStatus === 'active') return true
    if (sessionStatus === 'lobby') {
      // In lobby: NPC = all editable, Player = only DEX/WIS
      if (p.type === 'npc') return true
      return field === 'current_dex' || field === 'current_wis'
    }
    return false
  }

  return (
    <div className={`combat-card border rounded-2xl overflow-hidden transition-all ${
      isDead ? 'combat-card-dead border-victorian-800/30 bg-victorian-950/70' :
      p.is_current_turn
        ? 'combat-card-active border-gold-400/40 bg-gradient-to-br from-victorian-900/90 via-gold-400/[0.03] to-victorian-900/90'
        : 'border-victorian-700/30 bg-victorian-900/60 hover:border-victorian-600/50'
    } ${isMe ? 'ring-1 ring-blue-500/20' : ''}`}>

      {/* Card Top — Avatar & Name Header */}
      <div className={`relative p-4 pb-3 ${p.is_current_turn ? 'bg-gold-400/[0.04]' : ''}`}>
        {/* Turn indicator ribbon */}
        {p.is_current_turn && !isDead && (
          <div className="absolute top-0 right-4 bg-gold-400 text-victorian-950 text-[9px] font-bold px-2.5 py-1 rounded-b-lg shadow-lg shadow-gold-400/20">
            ⚔️ TURN
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative shrink-0">
            {p.avatar_url ? (
              <img
                src={p.avatar_url}
                alt=""
                className={`w-14 h-14 rounded-2xl object-cover border-2 ${
                  p.is_current_turn ? 'border-gold-400/60' :
                  p.type === 'npc' ? 'border-red-500/30' : 'border-blue-500/30'
                }`}
              />
            ) : (
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl border-2 ${
                p.type === 'npc'
                  ? 'bg-red-950/40 border-red-500/30'
                  : 'bg-blue-950/40 border-blue-500/30'
              }`}>
                {p.type === 'npc' ? '👹' : '👤'}
              </div>
            )}
            {/* Type badge */}
            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-md flex items-center justify-center text-[10px] border ${
              p.type === 'npc'
                ? 'bg-red-950 border-red-500/40 text-red-400'
                : 'bg-blue-950 border-blue-500/40 text-blue-400'
            }`}>
              {p.type === 'npc' ? '🗡' : '🛡'}
            </div>
          </div>

          {/* Name & badges */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className={`font-bold text-sm truncate ${
                isDead ? 'text-victorian-500 line-through' :
                p.is_current_turn ? 'text-gold-300' : 'text-nouveau-cream'
              }`}>
                {p.display_name}
              </p>
              {isMe && (
                <span className="text-blue-400 text-[9px] font-bold px-1.5 py-0.5 bg-blue-500/15 border border-blue-500/30 rounded-md">คุณ</span>
              )}
            </div>
            {isDead && <p className="text-red-500/70 text-[10px] font-bold mt-0.5">💀 หมดสติ / ตาย</p>}

            {/* Status effects inline */}
            {effects.length > 0 && !isDead && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {effects.map(e => (
                  <span key={e} className="combat-effect-chip inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/25 text-purple-300 text-[9px] font-bold">
                    {STATUS_EFFECT_ICONS[e]} {STATUS_EFFECT_LABELS[e]}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-victorian-700/30 to-transparent" />

      {/* Card Body — Stats */}
      <div className="p-4 pt-3 space-y-3">
        {/* Primary Stats — Integer "lives" display */}
        <div className="space-y-1.5">
          <StatValueRow
            icon="❤️" label="HP" value={p.current_hp} color="hp"
            isLow={isLowHp} isDead={isDead}
            onClick={canEditStat('current_hp') ? () => onStatClick('current_hp', 'HP', p.current_hp) : undefined}
          />
          <StatValueRow
            icon="🧠" label="SAN" value={p.current_sanity} color="sanity"
            isDead={isDead}
            onClick={canEditStat('current_sanity') ? () => onStatClick('current_sanity', 'Sanity', p.current_sanity) : undefined}
          />
          <StatValueRow
            icon="✨" label="SPI" value={p.current_spirit} color="spirit"
            isDead={isDead}
            onClick={canEditStat('current_spirit') ? () => onStatClick('current_spirit', 'Spirit', p.current_spirit) : undefined}
          />
        </div>

        {/* Secondary Stats — Compact */}
        <div className="flex gap-2">
          <CompactStat
            icon="🎯" label="DEX" value={p.current_dex} color="green"
            onClick={canEditStat('current_dex') ? () => onStatClick('current_dex', 'DEX', p.current_dex) : undefined}
          />
          <CompactStat
            icon="🔮" label="WIS" value={p.current_wis} color="purple"
            onClick={canEditStat('current_wis') ? () => onStatClick('current_wis', 'WIS', p.current_wis) : undefined}
          />
        </div>

        {/* Status Effect Slots (Admin) */}
        {isStaff && sessionStatus === 'active' && (
          <div className="flex gap-2">
            <StatusSlotButton slot={1} effect={p.status_effect_1} onClick={() => onStatusClick(1, p.status_effect_1)} />
            <StatusSlotButton slot={2} effect={p.status_effect_2} onClick={() => onStatusClick(2, p.status_effect_2)} />
          </div>
        )}

        {/* Admin Actions */}
        {isStaff && (
          <div className="flex gap-2 pt-1">
            {sessionStatus === 'active' && (
              <button
                type="button"
                onClick={onGiveTurn}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  p.is_current_turn
                    ? 'bg-gold-400/20 border border-gold-400/40 text-gold-300 shadow-sm shadow-gold-400/10'
                    : 'bg-victorian-800/60 border border-victorian-600/20 text-victorian-400 hover:bg-victorian-700/60 hover:text-victorian-300'
                }`}
              >
                <Crown className="w-3 h-3 inline mr-1" />
                มอบเทิร์น
              </button>
            )}
            {sessionStatus === 'lobby' && (
              <button
                type="button"
                onClick={onRemove}
                className="flex-1 px-3 py-2 rounded-xl bg-red-950/30 border border-red-500/20 text-red-400/70 text-xs font-bold hover:bg-red-950/50 hover:text-red-400 cursor-pointer transition-all"
              >
                <Trash2 className="w-3 h-3 inline mr-1" />
                ลบออก
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


/* ── Stat Value Row — HP/Sanity/Spirit as integer "lives" (no max) ── */
function StatValueRow({ icon, label, value, color, isLow, isDead, onClick }: {
  icon: string
  label: string
  value: number
  color: 'hp' | 'sanity' | 'spirit'
  isLow?: boolean
  isDead?: boolean
  onClick?: () => void
}) {
  const colorMap = {
    hp: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25', glow: 'shadow-red-500/10' },
    sanity: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/25', glow: 'shadow-yellow-500/10' },
    spirit: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/25', glow: 'shadow-blue-500/10' },
  }
  const c = colorMap[color]

  return (
    <div
      className={`group flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all ${c.bg} ${c.border} ${
        onClick ? 'cursor-pointer hover:brightness-125' : ''
      } ${isLow ? 'animate-pulse' : ''} ${isDead ? 'opacity-40 grayscale' : ''}`}
      onClick={onClick}
    >
      <span className="text-sm shrink-0">{icon}</span>
      <span className={`text-[10px] font-bold uppercase tracking-wider ${c.text} opacity-70`}>{label}</span>
      <div className="flex-1" />
      <span className={`text-lg font-black tabular-nums ${c.text} ${value <= 0 ? 'text-red-600' : ''}`}>
        {value}
      </span>
      {onClick && (
        <Edit2 className="w-3 h-3 text-victorian-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      )}
    </div>
  )
}


/* ── Compact Stat — DEX/WIS inline ── */
function CompactStat({ icon, label, value, color, onClick }: {
  icon: string
  label: string
  value: number
  color: 'green' | 'purple'
  onClick?: () => void
}) {
  const colors = {
    green: 'text-green-400 bg-green-500/[0.08] border-green-500/20 hover:border-green-500/40',
    purple: 'text-purple-400 bg-purple-500/[0.08] border-purple-500/20 hover:border-purple-500/40',
  }

  return (
    <div
      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border ${colors[color]} ${onClick ? 'cursor-pointer' : ''} transition-all`}
      onClick={onClick}
    >
      <span className="text-xs">{icon}</span>
      <span className="text-[10px] font-bold opacity-70">{label}</span>
      <span className="text-sm font-bold">{value}</span>
      {onClick && <Edit2 className="w-2.5 h-2.5 opacity-30" />}
    </div>
  )
}


/* ── Status Slot Button (Admin) ── */
function StatusSlotButton({ slot, effect, onClick }: {
  slot: 1 | 2
  effect: CombatStatusEffect | null
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl border text-xs cursor-pointer transition-all ${
        effect
          ? 'bg-purple-500/10 border-purple-500/25 text-purple-200 hover:bg-purple-500/15'
          : 'bg-victorian-800/30 border-victorian-700/20 text-victorian-500 hover:border-victorian-600/40 hover:text-victorian-400'
      }`}
    >
      <span className="font-semibold truncate">
        {effect ? `${STATUS_EFFECT_ICONS[effect]} ${STATUS_EFFECT_LABELS[effect]}` : `สถานะ ${slot}: —`}
      </span>
      <Edit2 className="w-3 h-3 opacity-40 shrink-0 ml-1" />
    </button>
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
      <div className="relative bg-gradient-to-b from-victorian-900 to-victorian-950 border border-gold-400/20 rounded-2xl shadow-2xl shadow-black/50 w-full max-w-md max-h-[80vh] overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 pb-3 border-b border-victorian-700/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserPlus className="w-5 h-5 text-blue-400" />
              <h3 className="heading-victorian text-lg">เลือกผู้เล่น</h3>
            </div>
            <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg bg-victorian-800 border border-victorian-600/30 flex items-center justify-center text-victorian-400 hover:text-gold-400 cursor-pointer transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* List */}
        <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {players.map(p => {
            const alreadyIn = participants.some(pp => pp.profile_id === p.id)
            return (
              <button key={p.id} type="button" disabled={alreadyIn || pending}
                onClick={() => onSelect(p.id)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left cursor-pointer transition-all ${alreadyIn
                  ? 'border-victorian-700/20 bg-victorian-950/50 opacity-35 cursor-not-allowed'
                  : 'border-victorian-700/30 bg-victorian-800/40 hover:border-blue-500/30 hover:bg-victorian-800/70 hover:shadow-lg'
                }`}>
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover border border-victorian-600/30 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-victorian-700 flex items-center justify-center shrink-0 text-lg">👤</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-nouveau-cream text-sm font-bold truncate">{p.display_name || 'ผู้เล่น'}</p>
                  <p className="text-victorian-500 text-[10px] mt-0.5">
                    ❤️ {p.hp} • 🧠 {p.sanity} • ✨ {p.spirituality}
                  </p>
                </div>
                {alreadyIn ? (
                  <span className="text-victorian-500 text-[10px] bg-victorian-800 px-2 py-0.5 rounded">อยู่แล้ว</span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-victorian-500" />
                )}
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
      <div className="relative bg-gradient-to-b from-victorian-900 to-victorian-950 border border-gold-400/20 rounded-2xl shadow-2xl shadow-black/50 w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 pb-3 border-b border-victorian-700/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-purple-400" />
              <div>
                <h3 className="heading-victorian text-lg">ตั้งสถานะช่อง {slot}</h3>
                <p className="text-victorian-500 text-[10px] mt-0.5">{participantName}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg bg-victorian-800 border border-victorian-600/30 flex items-center justify-center text-victorian-400 hover:text-gold-400 cursor-pointer transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Effect List */}
        <div className="p-4 space-y-1.5 max-h-[50vh] overflow-y-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className={`w-full px-3 py-2.5 rounded-xl border text-left text-sm font-semibold cursor-pointer transition-all ${
              selected === null
                ? 'bg-gold-400/10 border-gold-400/30 text-gold-300 shadow-sm shadow-gold-400/10'
                : 'bg-victorian-800/40 border-victorian-700/20 text-victorian-400 hover:border-gold-400/20 hover:text-victorian-300'
            }`}
          >
            ✕ ลบสถานะออก
          </button>
          {ALL_EFFECTS.map(e => (
            <button
              key={e}
              type="button"
              onClick={() => setSelected(e)}
              className={`w-full px-3 py-2.5 rounded-xl border text-left text-sm cursor-pointer transition-all ${
                selected === e
                  ? 'bg-purple-600/15 border-purple-500/30 text-purple-200 shadow-sm shadow-purple-500/10'
                  : 'bg-victorian-800/40 border-victorian-700/20 text-victorian-300 hover:border-purple-500/20 hover:bg-victorian-800/60'
              }`}
            >
              <span className="mr-2">{STATUS_EFFECT_ICONS[e]}</span>
              <span className="font-semibold">{STATUS_EFFECT_LABELS[e]}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 pt-3 border-t border-victorian-700/30 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-victorian-800 border border-victorian-600/30 text-victorian-300 text-sm hover:text-nouveau-cream cursor-pointer transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selected)}
            className="px-5 py-2.5 rounded-xl bg-gold-400/15 border border-gold-400/30 text-gold-300 text-sm font-bold hover:bg-gold-400/25 cursor-pointer transition-all"
          >
            ✓ ยืนยัน
          </button>
        </div>
      </div>
    </div>
  )
}
