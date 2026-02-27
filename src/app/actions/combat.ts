'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type {
  CombatSession,
  CombatParticipant,
  CombatLog,
  CombatStatusEffect,
  CombatLogType,
} from '@/lib/types/database'

/* ══════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════ */

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'dm')) {
    throw new Error('Admin or DM role required')
  }
  return { supabase, user, role: profile.role }
}

async function getAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return { supabase, user }
}

/** Broadcast an event to all clients on a combat session channel */
async function broadcastCombat(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  event: string,
  payload: Record<string, unknown> = {}
) {
  try {
    await supabase.channel(`combat:${sessionId}`).send({
      type: 'broadcast',
      event,
      payload: { ...payload, ts: Date.now() },
    })
  } catch {
    // broadcast failure is non-fatal — postgres changes backup
  }
}

/** Insert a combat log + broadcast */
async function addLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  type: CombatLogType,
  message: string,
  participantId?: string | null,
  payload: Record<string, unknown> = {}
) {
  await supabase.from('combat_logs').insert({
    session_id: sessionId,
    participant_id: participantId || null,
    type,
    message,
    payload,
  })
}


/* ══════════════════════════════════════════════
   READ: Fetch sessions list
   ══════════════════════════════════════════════ */

export async function getCombatSessions() {
  const { supabase, user } = await getAuth()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isStaff = profile?.role === 'admin' || profile?.role === 'dm'

  // Staff sees ALL sessions, players only sessions they're in
  if (isStaff) {
    const { data, error } = await supabase
      .from('combat_sessions')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return { error: error.message, sessions: [] }
    return { sessions: (data || []) as CombatSession[], isStaff }
  }

  // Player: get sessions they participate in
  const { data: participants } = await supabase
    .from('combat_participants')
    .select('session_id')
    .eq('profile_id', user.id)

  if (!participants || participants.length === 0) return { sessions: [], isStaff }

  const sessionIds = participants.map(p => p.session_id)
  const { data, error } = await supabase
    .from('combat_sessions')
    .select('*')
    .in('id', sessionIds)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message, sessions: [] }
  return { sessions: (data || []) as CombatSession[], isStaff }
}


/* ══════════════════════════════════════════════
   READ: Fetch full session data (participants + logs)
   ══════════════════════════════════════════════ */

export async function getCombatSession(sessionId: string) {
  const { supabase, user } = await getAuth()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isStaff = profile?.role === 'admin' || profile?.role === 'dm'

  const [sessionRes, participantsRes, logsRes] = await Promise.all([
    supabase
      .from('combat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single(),
    supabase
      .from('combat_participants')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true }),
    supabase
      .from('combat_logs')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (sessionRes.error) return { error: sessionRes.error.message }

  return {
    session: sessionRes.data as CombatSession,
    participants: (participantsRes.data || []) as CombatParticipant[],
    logs: (logsRes.data || []) as CombatLog[],
    isStaff,
    userId: user.id,
  }
}


/* ══════════════════════════════════════════════
   READ: Combat logs with pagination
   ══════════════════════════════════════════════ */

export async function getCombatLogs(sessionId: string, page: number = 0) {
  const { supabase } = await getAuth()
  const limit = 10
  const offset = page * limit

  const { data, error } = await supabase
    .from('combat_logs')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return { error: error.message, logs: [] }
  return { logs: (data || []) as CombatLog[] }
}


/* ══════════════════════════════════════════════
   CREATE: New combat session (admin/dm only)
   ══════════════════════════════════════════════ */

export async function createCombatSession(name: string) {
  const { supabase, user } = await requireAdmin()

  const { data, error } = await supabase
    .from('combat_sessions')
    .insert({ name, created_by: user.id })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/dashboard/combat')
  return { session: data as CombatSession }
}


/* ══════════════════════════════════════════════
   ADD: Player participant (from profiles)
   ══════════════════════════════════════════════ */

export async function addPlayerToCombat(sessionId: string, profileId: string) {
  const { supabase } = await requireAdmin()

  // Fetch profile data
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url, hp, sanity, spirituality')
    .eq('id', profileId)
    .single()

  if (!profile) return { error: 'ไม่พบผู้เล่น' }

  const { error } = await supabase.from('combat_participants').insert({
    session_id: sessionId,
    profile_id: profileId,
    type: 'player',
    display_name: profile.display_name || 'ผู้เล่น',
    avatar_url: profile.avatar_url,
    current_hp: profile.hp ?? 5,
    current_sanity: profile.sanity ?? 10,
    current_spirit: profile.spirituality ?? 15,
    current_dex: 10,
    current_wis: 10,
  })

  if (error) return { error: error.message }

  await broadcastCombat(supabase, sessionId, 'participant_added', { profileId })
  revalidatePath(`/dashboard/combat/${sessionId}`)
  return { success: true }
}


/* ══════════════════════════════════════════════
   ADD: NPC participant (on-the-fly)
   ══════════════════════════════════════════════ */

export async function addNpcToCombat(
  sessionId: string,
  name: string,
  hp: number,
  sanity: number,
  spirit: number,
  dex: number,
  wis: number,
  avatarUrl?: string
) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase.from('combat_participants').insert({
    session_id: sessionId,
    profile_id: null,
    type: 'npc',
    display_name: name,
    avatar_url: avatarUrl || null,
    current_hp: Math.max(0, hp),
    current_sanity: Math.max(0, sanity),
    current_spirit: Math.max(0, spirit),
    current_dex: Math.max(0, dex),
    current_wis: Math.max(0, wis),
  })

  if (error) return { error: error.message }

  await broadcastCombat(supabase, sessionId, 'participant_added', { name })
  revalidatePath(`/dashboard/combat/${sessionId}`)
  return { success: true }
}


/* ══════════════════════════════════════════════
   REMOVE: Participant
   ══════════════════════════════════════════════ */

export async function removeParticipant(sessionId: string, participantId: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('combat_participants')
    .delete()
    .eq('id', participantId)
    .eq('session_id', sessionId)

  if (error) return { error: error.message }

  await broadcastCombat(supabase, sessionId, 'participant_removed', { participantId })
  revalidatePath(`/dashboard/combat/${sessionId}`)
  return { success: true }
}


/* ══════════════════════════════════════════════
   SESSION: Start scene (lobby → active)
   ══════════════════════════════════════════════ */

export async function startCombatSession(sessionId: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('combat_sessions')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('status', 'lobby') // guard

  if (error) return { error: error.message }

  await addLog(supabase, sessionId, 'session_start', 'ฉากการต่อสู้เริ่มต้นแล้ว!')
  await broadcastCombat(supabase, sessionId, 'session_update', { status: 'active' })
  revalidatePath(`/dashboard/combat/${sessionId}`)
  return { success: true }
}


/* ══════════════════════════════════════════════
   SESSION: End scene (active → ended)
   ══════════════════════════════════════════════ */

export async function endCombatSession(sessionId: string) {
  const { supabase } = await requireAdmin()

  // Sync all player participants to their profiles before ending
  const { data: players } = await supabase
    .from('combat_participants')
    .select('id, profile_id')
    .eq('session_id', sessionId)
    .not('profile_id', 'is', null)

  if (players) {
    for (const p of players) {
      await supabase.rpc('sync_combat_to_profile', { p_participant_id: p.id })
    }
  }

  const { error } = await supabase
    .from('combat_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) return { error: error.message }

  await addLog(supabase, sessionId, 'session_end', 'ฉากการต่อสู้จบลงแล้ว')
  await broadcastCombat(supabase, sessionId, 'session_update', { status: 'ended' })
  revalidatePath('/dashboard/combat')
  return { success: true }
}


/* ══════════════════════════════════════════════
   STATS: Direct edit HP/Sanity/Spirit
   ══════════════════════════════════════════════ */

export async function updateParticipantStat(
  sessionId: string,
  participantId: string,
  field: 'current_hp' | 'current_sanity' | 'current_spirit' | 'current_dex' | 'current_wis',
  delta: number,
  reason?: string
) {
  const { supabase } = await requireAdmin()

  // Get current value
  const { data: p } = await supabase
    .from('combat_participants')
    .select('current_hp, current_sanity, current_spirit, current_dex, current_wis, display_name, profile_id')
    .eq('id', participantId)
    .single()

  if (!p) return { error: 'ไม่พบผู้เข้าร่วม' }

  const oldVal = p[field] as number
  const newVal = Math.max(0, oldVal + delta)

  const { error } = await supabase
    .from('combat_participants')
    .update({ [field]: newVal })
    .eq('id', participantId)

  if (error) return { error: error.message }

  // Sync to profile if player (only for HP, Sanity, Spirit)
  if (p.profile_id && ['current_hp', 'current_sanity', 'current_spirit'].includes(field)) {
    await supabase.rpc('sync_combat_to_profile', { p_participant_id: participantId })
  }

  const fieldLabels: Record<string, string> = {
    current_hp: 'HP',
    current_sanity: 'Sanity',
    current_spirit: 'Spirit',
    current_dex: 'DEX',
    current_wis: 'WIS'
  }
  const fieldLabel = fieldLabels[field] || field
  const reasonText = reason ? ` (${reason})` : ''
  await addLog(supabase, sessionId, 'stat_change',
    `${p.display_name}: ${fieldLabel} ${oldVal} → ${newVal} (${delta > 0 ? '+' : ''}${delta})${reasonText}`,
    participantId,
    { field, old: oldVal, new: newVal, delta, reason }
  )

  await broadcastCombat(supabase, sessionId, 'stat_update', {
    participantId, field, oldVal, newVal, delta,
  })

  revalidatePath(`/dashboard/combat/${sessionId}`)
  return { success: true, newVal }
}


/* ══════════════════════════════════════════════
   STATS: Set absolute value
   ══════════════════════════════════════════════ */

export async function setParticipantStat(
  sessionId: string,
  participantId: string,
  field: 'current_hp' | 'current_sanity' | 'current_spirit',
  value: number
) {
  const { supabase } = await requireAdmin()

  const { data: p } = await supabase
    .from('combat_participants')
    .select('current_hp, current_sanity, current_spirit, display_name, profile_id')
    .eq('id', participantId)
    .single()

  if (!p) return { error: 'ไม่พบผู้เข้าร่วม' }

  const oldVal = p[field] as number
  const newVal = Math.max(0, value)

  const { error } = await supabase
    .from('combat_participants')
    .update({ [field]: newVal })
    .eq('id', participantId)

  if (error) return { error: error.message }

  if (p.profile_id) {
    await supabase.rpc('sync_combat_to_profile', { p_participant_id: participantId })
  }

  const fieldLabel = field === 'current_hp' ? 'HP' : field === 'current_sanity' ? 'Sanity' : 'Spirit'
  await addLog(supabase, sessionId, 'stat_change',
    `${p.display_name}: ${fieldLabel} ${oldVal} → ${newVal}`,
    participantId,
    { field, old: oldVal, new: newVal, delta: newVal - oldVal }
  )

  await broadcastCombat(supabase, sessionId, 'stat_update', {
    participantId, field, oldVal, newVal,
  })

  revalidatePath(`/dashboard/combat/${sessionId}`)
  return { success: true, newVal }
}


/* ══════════════════════════════════════════════
   STATUS EFFECTS: Set/Clear
   ══════════════════════════════════════════════ */

export async function setStatusEffect(
  sessionId: string,
  participantId: string,
  slot: 1 | 2,
  effect: CombatStatusEffect | null
) {
  const { supabase } = await requireAdmin()

  const { data: p } = await supabase
    .from('combat_participants')
    .select('display_name, status_effect_1, status_effect_2')
    .eq('id', participantId)
    .single()

  if (!p) return { error: 'ไม่พบผู้เข้าร่วม' }

  const colName = slot === 1 ? 'status_effect_1' : 'status_effect_2'
  const oldEffect = p[colName]

  const { error } = await supabase
    .from('combat_participants')
    .update({ [colName]: effect })
    .eq('id', participantId)

  if (error) return { error: error.message }

  const action = effect ? 'add' : 'remove'
  const msg = effect
    ? `${p.display_name} ได้รับสถานะ: ${effect}`
    : `${p.display_name} หายจากสถานะ: ${oldEffect}`

  await addLog(supabase, sessionId, 'status_effect', msg, participantId, {
    action, effect: effect || oldEffect, slot,
  })

  await broadcastCombat(supabase, sessionId, 'status_update', {
    participantId, slot, effect, oldEffect,
  })

  revalidatePath(`/dashboard/combat/${sessionId}`)
  return { success: true }
}


/* ══════════════════════════════════════════════
   TURN: Give turn to a specific participant
   ══════════════════════════════════════════════ */

export async function giveTurn(sessionId: string, participantId: string) {
  const { supabase } = await requireAdmin()

  // Clear all turns first
  await supabase
    .from('combat_participants')
    .update({ is_current_turn: false, turn_status: 'waiting' })
    .eq('session_id', sessionId)

  // Set the active turn
  const { error } = await supabase
    .from('combat_participants')
    .update({ is_current_turn: true, turn_status: 'active' })
    .eq('id', participantId)

  if (error) return { error: error.message }

  const { data: p } = await supabase
    .from('combat_participants')
    .select('display_name')
    .eq('id', participantId)
    .single()

  await addLog(supabase, sessionId, 'turn_change',
    `เทิร์นของ ${p?.display_name || '???'}`,
    participantId,
    { to_id: participantId }
  )

  await broadcastCombat(supabase, sessionId, 'turn_change', { participantId })
  revalidatePath(`/dashboard/combat/${sessionId}`)
  return { success: true }
}


/* ══════════════════════════════════════════════
   ANNOUNCEMENT: DM broadcasts a message
   ══════════════════════════════════════════════ */

export async function sendAnnouncement(
  sessionId: string,
  message: string,
  ackRequired: boolean = true
) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('combat_sessions')
    .update({
      announcement: message,
      announcement_ack: ackRequired,
    })
    .eq('id', sessionId)

  if (error) return { error: error.message }

  await addLog(supabase, sessionId, 'announcement', message, null, {
    text: message, ack_required: ackRequired,
  })

  await broadcastCombat(supabase, sessionId, 'announcement', {
    message, ackRequired,
  })

  revalidatePath(`/dashboard/combat/${sessionId}`)
  return { success: true }
}


/* ══════════════════════════════════════════════
   ANNOUNCEMENT: Clear announcement
   ══════════════════════════════════════════════ */

export async function clearAnnouncement(sessionId: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('combat_sessions')
    .update({ announcement: null, announcement_ack: false })
    .eq('id', sessionId)

  if (error) return { error: error.message }

  await broadcastCombat(supabase, sessionId, 'announcement_clear', {})
  revalidatePath(`/dashboard/combat/${sessionId}`)
  return { success: true }
}


/* ══════════════════════════════════════════════
   PLAYER: Submit roleplay link (player action)
   ══════════════════════════════════════════════ */

export async function submitRoleplayLink(sessionId: string, url: string) {
  const { supabase, user } = await getAuth()

  // Find participant
  const { data: participant } = await supabase
    .from('combat_participants')
    .select('id, display_name, is_current_turn, status_effect_1, status_effect_2')
    .eq('session_id', sessionId)
    .eq('profile_id', user.id)
    .single()

  if (!participant) return { error: 'คุณไม่ได้อยู่ในฉากนี้' }
  if (!participant.is_current_turn) return { error: 'ยังไม่ถึงเทิร์นของคุณ' }

  // Check disabling effects
  const disabling = ['stunned', 'frozen', 'paralyzed', 'charmed']
  if (
    (participant.status_effect_1 && disabling.includes(participant.status_effect_1)) ||
    (participant.status_effect_2 && disabling.includes(participant.status_effect_2))
  ) {
    return { error: 'คุณถูกสถานะผิดปกติ ไม่สามารถส่งลิงก์ได้' }
  }

  await addLog(supabase, sessionId, 'roleplay_link',
    `${participant.display_name} ส่งลิงก์โรลเพลย์`,
    participant.id,
    { url }
  )

  await broadcastCombat(supabase, sessionId, 'roleplay_link', {
    participantId: participant.id,
    displayName: participant.display_name,
    url,
  })

  revalidatePath(`/dashboard/combat/${sessionId}`)
  return { success: true }
}


/* ══════════════════════════════════════════════
   PLAYER: Check if user is in active combat
   ══════════════════════════════════════════════ */

export async function getPlayerActiveCombat() {
  const { supabase, user } = await getAuth()

  const { data: participant } = await supabase
    .from('combat_participants')
    .select('session_id, combat_sessions!inner(id, name, status)')
    .eq('profile_id', user.id)
    .eq('combat_sessions.status', 'active')
    .limit(1)
    .maybeSingle()

  if (!participant) return { inCombat: false }

  const session = participant.combat_sessions as unknown as { id: string; name: string }
  return {
    inCombat: true,
    sessionId: session.id,
    sessionName: session.name,
  }
}


/* ══════════════════════════════════════════════
   ADMIN: Get all players for picker
   ══════════════════════════════════════════════ */

export async function getPlayersForCombat() {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, hp, sanity, spirituality, role')
    .eq('role', 'player')
    .order('display_name')

  if (error) return { error: error.message, players: [] }
  return { players: data || [] }
}
