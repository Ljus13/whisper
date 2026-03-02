'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
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

/** Broadcast an event to all clients on a combat session channel.
 *  Uses the service-role (admin) client — a plain @supabase/supabase-js
 *  client that handles Realtime broadcast reliably, unlike the SSR
 *  cookie-based client which can silently fail on .send().
 */
async function broadcastCombat(
  sessionId: string,
  event: string,
  payload: Record<string, unknown> = {}
) {
  try {
    const admin = createAdminClient()
    const channelName = `combat:${sessionId}`
    const ch = admin.channel(channelName)

    // send() on an unsubscribed channel uses the HTTP broadcast fallback
    const result = await ch.send({
      type: 'broadcast',
      event,
      payload: { ...payload, ts: Date.now() },
    })

    // Clean up the transient channel
    await admin.removeChannel(ch)

    if (result !== 'ok') {
      console.warn(`[broadcastCombat] send result: ${result} for event=${event} session=${sessionId}`)
    }
  } catch (err) {
    console.error('[broadcastCombat] error:', err)
    // non-fatal — postgres_changes is the backup
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
  const { user } = await getAuth()
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isStaff = profile?.role === 'admin' || profile?.role === 'dm'

  const [sessionRes, participantsRes, logsRes] = await Promise.all([
    admin
      .from('combat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single(),
    admin
      .from('combat_participants')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true }),
    admin
      .from('combat_logs')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (sessionRes.error) return { error: sessionRes.error.message }

  // Access check: staff can view any session; players must be participants
  if (!isStaff) {
    const isParticipant = (participantsRes.data || []).some(
      (p: any) => p.profile_id === user.id
    )
    if (!isParticipant) return { error: 'คุณไม่ได้อยู่ในห้องต่อสู้นี้' }
  }

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
  await getAuth()
  const admin = createAdminClient()
  const limit = 10
  const offset = page * limit

  const { data, error } = await admin
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

  // Check if player is already in this session
  const { data: existing } = await supabase
    .from('combat_participants')
    .select('id')
    .eq('session_id', sessionId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (existing) return { error: 'ผู้เล่นคนนี้อยู่ในห้องแล้ว' }

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

  await broadcastCombat(sessionId, 'participant_added', { profileId })
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
  avatarUrl?: string,
  pathwayId?: string,
  sequenceId?: string
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
    pathway_id: pathwayId || null,
    sequence_id: sequenceId || null,
  })

  if (error) return { error: error.message }

  await broadcastCombat(sessionId, 'participant_added', { name })
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

  await broadcastCombat(sessionId, 'participant_removed', { participantId })
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
  await broadcastCombat(sessionId, 'session_update', { status: 'active' })
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
  await broadcastCombat(sessionId, 'session_update', { status: 'ended' })
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

  await broadcastCombat(sessionId, 'stat_update', {
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

  await broadcastCombat(sessionId, 'stat_update', {
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

  await broadcastCombat(sessionId, 'status_update', {
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

  await broadcastCombat(sessionId, 'turn_change', { participantId })
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

  await broadcastCombat(sessionId, 'announcement', {
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

  await broadcastCombat(sessionId, 'announcement_clear', {})
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

  await broadcastCombat(sessionId, 'roleplay_link', {
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


/* ══════════════════════════════════════════════
   ADMIN: Delete a combat session entirely
   Only allowed for lobby / ended sessions
   ══════════════════════════════════════════════ */

export async function deleteCombatSession(sessionId: string) {
  const { supabase } = await requireAdmin()

  // Fetch session to check status
  const { data: session, error: fetchErr } = await supabase
    .from('combat_sessions')
    .select('id, status, name')
    .eq('id', sessionId)
    .single()

  if (fetchErr || !session) return { error: 'ไม่พบห้องต่อสู้' }
  if (session.status === 'active') return { error: 'ไม่สามารถลบห้องที่กำลังต่อสู้อยู่ กรุณาจบฉากก่อน' }

  // Delete session — combat_participants & combat_logs cascade via ON DELETE CASCADE
  const { error } = await supabase.from('combat_sessions').delete().eq('id', sessionId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/combat')
  return { success: true }
}


/* ══════════════════════════════════════════════
   PLAYER: Get available skills for combat
   ══════════════════════════════════════════════ */

export async function getCombatSkills() {
  const { supabase, user } = await getAuth()

  // ── Pathway skills ──
  const { data: playerPathways } = await supabase
    .from('player_pathways')
    .select('pathway_id, sequence_id')
    .eq('player_id', user.id)
    .not('pathway_id', 'is', null)

  const pp = playerPathways ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pathwaySkills: any[] = []

  if (pp.length > 0) {
    const pathwayIds = pp.map(p => p.pathway_id).filter(Boolean)
    const [skillsRes, seqRes] = await Promise.all([
      supabase
        .from('skills')
        .select('id, name, description, spirit_cost, pathway_id, sequence_id, icon_url, sequence:skill_sequences(id, seq_number)')
        .in('pathway_id', pathwayIds),
      supabase
        .from('skill_sequences')
        .select('id, seq_number')
        .in('id', pp.map(p => p.sequence_id).filter(Boolean)),
    ])

    if (!skillsRes.error && skillsRes.data) {
      const playerSeqMap = new Map<string, number>(
        (seqRes.data ?? []).map(s => [s.id, s.seq_number])
      )
      pathwaySkills = skillsRes.data.filter(skill => {
        const entry = pp.find(p => p.pathway_id === skill.pathway_id)
        if (!entry?.sequence_id) return false
        const playerSeqNum = playerSeqMap.get(entry.sequence_id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const skillSeqNum = (skill.sequence as any)?.seq_number
        if (playerSeqNum === undefined || skillSeqNum === undefined) return false
        return skillSeqNum >= playerSeqNum
      })
    }
  }

  // ── Granted skills ──
  const { data: grantedRaw } = await supabase
    .from('granted_skills')
    .select('id, title, detail, reuse_policy, cooldown_minutes, last_used_at, times_used, expires_at, image_url, skill:skills(id, name, description, spirit_cost)')
    .eq('player_id', user.id)
    .eq('is_active', true)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grantedSkills = (grantedRaw ?? []).filter((g: any) => {
    if (g.reuse_policy === 'once' && g.times_used > 0) return false
    if (g.expires_at && new Date(g.expires_at) < new Date()) return false
    if (g.reuse_policy === 'cooldown' && g.last_used_at && g.cooldown_minutes) {
      const end = new Date(g.last_used_at)
      end.setMinutes(end.getMinutes() + g.cooldown_minutes)
      if (new Date() < end) return false
    }
    return true
  })

  // ── Player spirit info ──
  const { data: profile } = await supabase
    .from('profiles')
    .select('spirituality, max_spirituality')
    .eq('id', user.id)
    .single()

  return {
    pathwaySkills: pathwaySkills.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      spiritCost: s.spirit_cost,
      type: 'pathway' as const,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    grantedSkills: grantedSkills.map((g: any) => ({
      id: g.id,
      name: g.title,
      description: g.detail || (g.skill as any)?.description || null,
      spiritCost: (g.skill as any)?.spirit_cost ?? 0,
      linkedSkillName: (g.skill as any)?.name ?? null,
      type: 'granted' as const,
    })),
    spirit: profile?.spirituality ?? 0,
    maxSpirit: profile?.max_spirituality ?? 0,
  }
}


/* ══════════════════════════════════════════════
   PLAYER: Use a pathway skill in combat
   ══════════════════════════════════════════════ */

export async function useCombatSkill(
  sessionId: string,
  skillId: string,
  successRate: number,
  roll: number,
  note?: string | null
) {
  const { supabase, user } = await getAuth()

  const normalizedRate = Math.floor(successRate)
  const normalizedRoll = Math.floor(roll)
  if (!Number.isFinite(normalizedRate) || normalizedRate < 1 || normalizedRate > 20) return { error: 'Success Rate ต้องเป็น 1-20' }
  if (!Number.isFinite(normalizedRoll) || normalizedRoll < 1 || normalizedRoll > 20) return { error: 'Roll ไม่ถูกต้อง' }

  // 1) Verify participant in combat
  const { data: participant } = await supabase
    .from('combat_participants')
    .select('id, display_name, is_current_turn, status_effect_1, status_effect_2')
    .eq('session_id', sessionId)
    .eq('profile_id', user.id)
    .single()

  if (!participant) return { error: 'คุณไม่ได้อยู่ในฉากนี้' }
  if (!participant.is_current_turn) return { error: 'ยังไม่ถึงเทิร์นของคุณ' }

  const disabling = ['stunned', 'frozen', 'paralyzed', 'charmed']
  if (
    (participant.status_effect_1 && disabling.includes(participant.status_effect_1)) ||
    (participant.status_effect_2 && disabling.includes(participant.status_effect_2))
  ) {
    return { error: 'คุณถูกสถานะผิดปกติ ไม่สามารถใช้สกิลได้' }
  }

  // 2) Fetch skill
  const { data: skill } = await supabase
    .from('skills')
    .select('id, name, description, spirit_cost, pathway_id, sequence_id')
    .eq('id', skillId)
    .single()

  if (!skill) return { error: 'ไม่พบสกิล' }

  // 3) Check spirituality
  const { data: profile } = await supabase
    .from('profiles')
    .select('spirituality, max_spirituality')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: 'ไม่พบโปรไฟล์' }
  if (profile.spirituality < skill.spirit_cost) {
    return { error: `พลังวิญญาณไม่พอ (ต้องการ ${skill.spirit_cost} มี ${profile.spirituality})` }
  }

  // 4) Check pathway access
  const { data: ppData } = await supabase
    .from('player_pathways')
    .select('id, sequence_id')
    .eq('player_id', user.id)
    .eq('pathway_id', skill.pathway_id)
    .single()

  if (!ppData?.sequence_id) return { error: 'คุณไม่มีสิทธิ์ใช้สกิลในเส้นทางนี้' }

  const [playerSeqRes, skillSeqRes] = await Promise.all([
    supabase.from('skill_sequences').select('seq_number').eq('id', ppData.sequence_id).single(),
    supabase.from('skill_sequences').select('seq_number').eq('id', skill.sequence_id).single(),
  ])

  if (!playerSeqRes.data || !skillSeqRes.data) return { error: 'ข้อมูลลำดับผิดพลาด' }
  if (skillSeqRes.data.seq_number < playerSeqRes.data.seq_number) {
    return { error: `ลำดับของคุณยังไม่ถึง` }
  }

  // 5) Deduct spirit from profile
  const newSpirit = profile.spirituality - skill.spirit_cost
  await supabase.from('profiles').update({ spirituality: newSpirit }).eq('id', user.id)

  // 6) Also update combat participant spirit
  await supabase
    .from('combat_participants')
    .update({ current_spirit: newSpirit })
    .eq('id', participant.id)

  // 7) Determine outcome
  const isSuccess = normalizedRoll >= normalizedRate
  const outcome = isSuccess ? 'success' : 'fail'

  // 8) Generate reference code
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = String(now.getFullYear())
  const uidSuffix = user.id.replace(/-/g, '').slice(-4).toUpperCase()
  const outcomeCode = isSuccess ? 'S' : 'F'
  const referenceCode = `SKL-${uidSuffix}${dd}${mm}${yyyy}-T${normalizedRate}-R${normalizedRoll}-${outcomeCode}`

  // 9) Log to skill_usage_logs (unified history)
  await supabase.from('skill_usage_logs').insert({
    player_id: user.id,
    skill_id: skillId,
    spirit_cost: skill.spirit_cost,
    reference_code: referenceCode,
    note: note?.trim() || null,
    success_rate: normalizedRate,
    roll: normalizedRoll,
    outcome,
  })

  // 10) Log to combat
  const resultEmoji = isSuccess ? '✅' : '❌'
  const combatMessage = `${resultEmoji} ${participant.display_name} ใช้สกิล「${skill.name}」— Roll ${normalizedRoll}/${normalizedRate} → ${isSuccess ? 'สำเร็จ!' : 'พลาด'} (✨ -${skill.spirit_cost})`

  await addLog(supabase, sessionId, 'skill_use' as CombatLogType, combatMessage, participant.id, {
    skillId: skill.id,
    skillName: skill.name,
    spiritCost: skill.spirit_cost,
    successRate: normalizedRate,
    roll: normalizedRoll,
    outcome,
    referenceCode,
    remainingSpirit: newSpirit,
    note: note?.trim() || null,
  })

  await broadcastCombat(sessionId, 'skill_use', {
    participantId: participant.id,
    displayName: participant.display_name,
    skillName: skill.name,
    outcome,
    roll: normalizedRoll,
    successRate: normalizedRate,
  })

  revalidatePath(`/dashboard/combat/${sessionId}`)
  return {
    success: true,
    skillName: skill.name,
    outcome,
    roll: normalizedRoll,
    successRate: normalizedRate,
    referenceCode,
    spiritCost: skill.spirit_cost,
    remaining: newSpirit,
  }
}


/* ══════════════════════════════════════════════
   PLAYER: Use a granted skill in combat
   ══════════════════════════════════════════════ */

export async function useCombatGrantedSkill(
  sessionId: string,
  grantedSkillId: string,
  successRate: number,
  roll: number,
  note?: string | null
) {
  const { supabase, user } = await getAuth()

  const normalizedRate = Math.floor(successRate)
  const normalizedRoll = Math.floor(roll)
  if (!Number.isFinite(normalizedRate) || normalizedRate < 1 || normalizedRate > 20) return { error: 'Success Rate ต้องเป็น 1-20' }
  if (!Number.isFinite(normalizedRoll) || normalizedRoll < 1 || normalizedRoll > 20) return { error: 'Roll ไม่ถูกต้อง' }

  // 1) Verify participant
  const { data: participant } = await supabase
    .from('combat_participants')
    .select('id, display_name, is_current_turn, status_effect_1, status_effect_2')
    .eq('session_id', sessionId)
    .eq('profile_id', user.id)
    .single()

  if (!participant) return { error: 'คุณไม่ได้อยู่ในฉากนี้' }
  if (!participant.is_current_turn) return { error: 'ยังไม่ถึงเทิร์นของคุณ' }

  const disabling = ['stunned', 'frozen', 'paralyzed', 'charmed']
  if (
    (participant.status_effect_1 && disabling.includes(participant.status_effect_1)) ||
    (participant.status_effect_2 && disabling.includes(participant.status_effect_2))
  ) {
    return { error: 'คุณถูกสถานะผิดปกติ ไม่สามารถใช้สกิลได้' }
  }

  // 2) Fetch granted skill
  const { data: gs } = await supabase
    .from('granted_skills')
    .select('*, skill:skills(id, name, description, spirit_cost)')
    .eq('id', grantedSkillId)
    .eq('player_id', user.id)
    .single()

  if (!gs || !gs.is_active) return { error: 'ไม่พบสิ่งนี้หรือถูกปิดแล้ว' }

  // 3) Expiration check
  if (gs.expires_at && new Date(gs.expires_at) < new Date()) {
    await supabase.from('granted_skills').update({ is_active: false }).eq('id', gs.id)
    return { error: 'สิ่งนี้หมดอายุแล้ว' }
  }

  // 4) Reuse check
  if (gs.reuse_policy === 'once' && gs.times_used > 0) return { error: 'ใช้ได้ครั้งเดียวและถูกใช้แล้ว' }
  if (gs.reuse_policy === 'cooldown' && gs.last_used_at && gs.cooldown_minutes) {
    const cooldownEnd = new Date(gs.last_used_at)
    cooldownEnd.setMinutes(cooldownEnd.getMinutes() + gs.cooldown_minutes)
    if (new Date() < cooldownEnd) {
      const rem = Math.ceil((cooldownEnd.getTime() - Date.now()) / 60000)
      return { error: `ติดคูลดาวน์ อีก ${rem} นาที` }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skill = gs.skill as any
  if (!skill) return { error: 'ไม่พบข้อมูลสกิล' }

  // 5) Check spirit & profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('hp, sanity, max_sanity, travel_points, max_travel_points, spirituality, max_spirituality, potion_digest_progress')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: 'ไม่พบโปรไฟล์' }
  if (profile.spirituality < skill.spirit_cost) {
    return { error: `พลังวิญญาณไม่พอ (ต้องการ ${skill.spirit_cost} มี ${profile.spirituality})` }
  }

  // 6) Apply effects
  const spiritAfterCost = profile.spirituality - skill.spirit_cost
  const updates: Record<string, number> = { spirituality: spiritAfterCost }
  if (gs.effect_hp !== 0) updates.hp = Math.max(0, profile.hp + gs.effect_hp)
  if (gs.effect_sanity !== 0) updates.sanity = Math.max(0, Math.min(profile.max_sanity + (gs.effect_max_sanity || 0), profile.sanity + gs.effect_sanity))
  if (gs.effect_max_sanity !== 0) updates.max_sanity = Math.max(0, profile.max_sanity + gs.effect_max_sanity)
  if (gs.effect_travel !== 0) updates.travel_points = Math.max(0, profile.travel_points + gs.effect_travel)
  if (gs.effect_max_travel !== 0) updates.max_travel_points = Math.max(0, profile.max_travel_points + gs.effect_max_travel)
  if (gs.effect_spirituality !== 0) updates.spirituality = Math.max(0, spiritAfterCost + gs.effect_spirituality)
  if (gs.effect_max_spirituality !== 0) updates.max_spirituality = Math.max(0, profile.max_spirituality + gs.effect_max_spirituality)
  if (gs.effect_potion_digest !== 0) updates.potion_digest_progress = Math.max(0, Math.min(100, (profile.potion_digest_progress ?? 0) + gs.effect_potion_digest))

  await supabase.from('profiles').update(updates).eq('id', user.id)

  // 7) Update combat participant spirit + HP + sanity to stay in sync
  const combatUpdates: Record<string, number> = { current_spirit: updates.spirituality ?? spiritAfterCost }
  if (updates.hp !== undefined) combatUpdates.current_hp = updates.hp
  if (updates.sanity !== undefined) combatUpdates.current_sanity = updates.sanity
  await supabase.from('combat_participants').update(combatUpdates).eq('id', participant.id)

  // 8) Update granted skill tracking
  await supabase.from('granted_skills').update({
    times_used: gs.times_used + 1,
    last_used_at: new Date().toISOString(),
    is_active: gs.reuse_policy === 'once' ? false : gs.is_active,
  }).eq('id', gs.id)

  // 9) Outcome
  const isSuccess = normalizedRoll >= normalizedRate
  const outcome = isSuccess ? 'success' : 'fail'

  // 10) Reference code
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = String(now.getFullYear())
  const uidSuffix = user.id.replace(/-/g, '').slice(-4).toUpperCase()
  const outcomeCode = isSuccess ? 'S' : 'F'
  const referenceCode = `GS-${uidSuffix}${dd}${mm}${yyyy}-T${normalizedRate}-R${normalizedRoll}-${outcomeCode}`

  // 11) Log to granted_skill_logs
  await supabase.from('granted_skill_logs').insert({
    granted_skill_id: gs.id,
    player_id: user.id,
    skill_id: gs.skill_id,
    granted_by: gs.granted_by,
    action: 'use',
    title: gs.title,
    detail: gs.detail,
    effects_json: {
      outcome, success_rate: normalizedRate, roll: normalizedRoll, spirit_cost: skill.spirit_cost,
    },
    reference_code: referenceCode,
    note: note?.trim() || null,
  })

  // Also log to skill_usage_logs
  await supabase.from('skill_usage_logs').insert({
    player_id: user.id,
    skill_id: gs.skill_id,
    spirit_cost: skill.spirit_cost,
    reference_code: referenceCode,
    note: `[มอบพลัง/คอมแบท] ${gs.title}${note?.trim() ? ' — ' + note.trim() : ''}`,
    success_rate: normalizedRate,
    roll: normalizedRoll,
    outcome,
  })

  // 12) Combat log
  const resultEmoji = isSuccess ? '✅' : '❌'
  const skillLabel = gs.title || skill.name
  const combatMessage = `${resultEmoji} ${participant.display_name} ใช้「${skillLabel}」— Roll ${normalizedRoll}/${normalizedRate} → ${isSuccess ? 'สำเร็จ!' : 'พลาด'} (✨ -${skill.spirit_cost})`

  // Collect effects for display
  const effectParts: string[] = []
  if (gs.effect_hp !== 0) effectParts.push(`❤️ HP ${gs.effect_hp > 0 ? '+' : ''}${gs.effect_hp}`)
  if (gs.effect_sanity !== 0) effectParts.push(`🧠 Sanity ${gs.effect_sanity > 0 ? '+' : ''}${gs.effect_sanity}`)
  if (gs.effect_spirituality !== 0) effectParts.push(`✨ Spirit ${gs.effect_spirituality > 0 ? '+' : ''}${gs.effect_spirituality}`)

  await addLog(supabase, sessionId, 'skill_use' as CombatLogType, combatMessage, participant.id, {
    skillId: gs.skill_id,
    skillName: skillLabel,
    grantedSkillId: gs.id,
    spiritCost: skill.spirit_cost,
    successRate: normalizedRate,
    roll: normalizedRoll,
    outcome,
    referenceCode,
    remainingSpirit: updates.spirituality ?? spiritAfterCost,
    effects: effectParts,
    note: note?.trim() || null,
  })

  await broadcastCombat(sessionId, 'skill_use', {
    participantId: participant.id,
    displayName: participant.display_name,
    skillName: skillLabel,
    outcome,
    roll: normalizedRoll,
    successRate: normalizedRate,
  })

  revalidatePath(`/dashboard/combat/${sessionId}`)
  return {
    success: true,
    skillName: skillLabel,
    outcome,
    roll: normalizedRoll,
    successRate: normalizedRate,
    referenceCode,
    spiritCost: skill.spirit_cost,
    remaining: updates.spirituality ?? spiritAfterCost,
    effects: effectParts,
  }
}


/* ══════════════════════════════════════════════
   STAFF: Get all pathways + sequences for NPC creation dropdown
   ══════════════════════════════════════════════ */

export async function getPathwaysForNpc() {
  const { supabase } = await requireAdmin()

  const { data: pathways } = await supabase
    .from('skill_pathways')
    .select('id, name, skill_sequences(id, seq_number, name)')
    .order('sort_order')

  return (pathways ?? []).map(pw => ({
    id: pw.id,
    name: pw.name,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sequences: ((pw as any).skill_sequences ?? [])
      .sort((a: any, b: any) => b.seq_number - a.seq_number)  // 9 (weakest) first
      .map((s: any) => ({ id: s.id, seqNumber: s.seq_number, name: s.name })),
  }))
}


/* ══════════════════════════════════════════════
   STAFF: Submit roleplay link on behalf of NPC
   ══════════════════════════════════════════════ */

export async function submitNpcRoleplayLink(sessionId: string, participantId: string, url: string) {
  const { supabase } = await requireAdmin()

  const { data: participant } = await supabase
    .from('combat_participants')
    .select('id, display_name, type')
    .eq('id', participantId)
    .eq('session_id', sessionId)
    .single()

  if (!participant) return { error: 'ไม่พบตัวละครนี้' }

  await addLog(supabase, sessionId, 'roleplay_link',
    `${participant.display_name} ส่งลิงก์โรลเพลย์`,
    participant.id,
    { url }
  )

  await broadcastCombat(sessionId, 'roleplay_link', {
    participantId: participant.id,
    displayName: participant.display_name,
    url,
  })

  revalidatePath(`/dashboard/combat/${sessionId}`)
  return { success: true }
}


/* ══════════════════════════════════════════════
   STAFF: Get NPC's available skills (based on pathway + sequence)
   ══════════════════════════════════════════════ */

export async function getNpcCombatSkills(sessionId: string, participantId: string) {
  const { supabase } = await requireAdmin()

  const { data: participant } = await supabase
    .from('combat_participants')
    .select('id, display_name, pathway_id, sequence_id, current_spirit, type, npc_granted_skills')
    .eq('id', participantId)
    .eq('session_id', sessionId)
    .single()

  if (!participant) return { pathwaySkills: [], grantedSkills: [], spirit: 0, maxSpirit: 0 }

  // ── Pathway skills ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pathwaySkills: any[] = []

  if (participant.pathway_id && participant.sequence_id) {
    const { data: npcSeq } = await supabase
      .from('skill_sequences')
      .select('seq_number')
      .eq('id', participant.sequence_id)
      .single()

    if (npcSeq) {
      const { data: skills } = await supabase
        .from('skills')
        .select('id, name, description, spirit_cost, sequence_id, sequence:skill_sequences(id, seq_number)')
        .eq('pathway_id', participant.pathway_id)

      pathwaySkills = (skills ?? []).filter(skill => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const skillSeqNum = (skill.sequence as any)?.seq_number
        if (skillSeqNum === undefined) return false
        return skillSeqNum >= npcSeq.seq_number
      })
    }
  }

  // ── NPC Granted skills (from JSONB) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawGranted = (participant.npc_granted_skills as any[]) ?? []
  const grantedSkills = rawGranted.filter((g: any) => {
    if (g.reuse_policy === 'once' && g.times_used > 0) return false
    if (g.reuse_policy === 'cooldown' && g.last_used_at && g.cooldown_minutes) {
      const end = new Date(g.last_used_at)
      end.setMinutes(end.getMinutes() + g.cooldown_minutes)
      if (new Date() < end) return false
    }
    return true
  })

  return {
    pathwaySkills: pathwaySkills.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      spiritCost: s.spirit_cost,
      type: 'pathway' as const,
    })),
    grantedSkills: grantedSkills.map((g: any) => ({
      id: g.id,
      name: g.name,
      description: g.description || null,
      spiritCost: g.spirit_cost ?? 0,
      type: 'granted' as const,
      reusePolicy: g.reuse_policy,
      effectHp: g.effect_hp ?? 0,
      effectSanity: g.effect_sanity ?? 0,
      effectSpirit: g.effect_spirit ?? 0,
    })),
    spirit: participant.current_spirit ?? 0,
    maxSpirit: participant.current_spirit ?? 0,
  }
}


/* ══════════════════════════════════════════════
   STAFF: Use a skill on behalf of NPC in combat
   ══════════════════════════════════════════════ */

export async function useNpcCombatSkill(
  sessionId: string,
  participantId: string,
  skillId: string,
  successRate: number,
  roll: number,
  note?: string | null
) {
  const { supabase } = await requireAdmin()

  const normalizedRate = Math.floor(successRate)
  const normalizedRoll = Math.floor(roll)
  if (!Number.isFinite(normalizedRate) || normalizedRate < 1 || normalizedRate > 20) return { error: 'Success Rate ต้องเป็น 1-20' }
  if (!Number.isFinite(normalizedRoll) || normalizedRoll < 1 || normalizedRoll > 20) return { error: 'Roll ไม่ถูกต้อง' }

  // 1) Get participant
  const { data: participant } = await supabase
    .from('combat_participants')
    .select('id, display_name, current_spirit, pathway_id, sequence_id, type')
    .eq('id', participantId)
    .eq('session_id', sessionId)
    .single()

  if (!participant) return { error: 'ไม่พบตัวละคร NPC' }

  // 2) Fetch skill
  const { data: skill } = await supabase
    .from('skills')
    .select('id, name, description, spirit_cost, pathway_id, sequence_id')
    .eq('id', skillId)
    .single()

  if (!skill) return { error: 'ไม่พบสกิล' }

  // 3) Check spirit
  if ((participant.current_spirit ?? 0) < skill.spirit_cost) {
    return { error: `Spirit ไม่พอ (ต้องการ ${skill.spirit_cost}, มี ${participant.current_spirit})` }
  }

  // 4) Deduct spirit from participant
  const spiritAfterCost = (participant.current_spirit ?? 0) - skill.spirit_cost
  await supabase
    .from('combat_participants')
    .update({ current_spirit: spiritAfterCost })
    .eq('id', participant.id)

  // 5) Determine outcome (roll >= rate = success, same as castSkill)
  const outcome = normalizedRoll >= normalizedRate ? 'success' : 'fail'

  // 6) Generate reference code
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  const referenceCode = `NCSK-${dateStr}-${rand}`

  // 7) Log to combat
  await addLog(supabase, sessionId, 'skill_use',
    `🎲 ${participant.display_name} ใช้สกิล「${skill.name}」— ` +
    `ทอย ${normalizedRoll}/${normalizedRate} → ${outcome === 'success' ? '✅ สำเร็จ' : '❌ พลาด'}` +
    ` | ✨ ${spiritAfterCost} (-${skill.spirit_cost})` +
    (note?.trim() ? ` | 📝 ${note.trim()}` : '') +
    ` | 🏷️ ${referenceCode}`,
    participant.id,
    {
      skillId: skill.id,
      skillName: skill.name,
      outcome,
      roll: normalizedRoll,
      successRate: normalizedRate,
      spiritCost: skill.spirit_cost,
      remaining: spiritAfterCost,
      referenceCode,
      note: note?.trim() || null,
      isNpc: true,
    }
  )

  await broadcastCombat(sessionId, 'skill_use', {
    participantId: participant.id,
    displayName: participant.display_name,
    skillName: skill.name,
    outcome,
    roll: normalizedRoll,
    successRate: normalizedRate,
  })

  // Also broadcast stat update so cards refresh
  await broadcastCombat(sessionId, 'stat_update', {
    participantId: participant.id,
    field: 'current_spirit',
    value: spiritAfterCost,
  })

  revalidatePath(`/dashboard/combat/${sessionId}`)
  return {
    success: true,
    skillName: skill.name,
    outcome,
    roll: normalizedRoll,
    successRate: normalizedRate,
    referenceCode,
    spiritCost: skill.spirit_cost,
    remaining: spiritAfterCost,
  }
}


/* ══════════════════════════════════════════════
   STAFF: Add a granted skill to NPC (temporary, combat-only)
   ══════════════════════════════════════════════ */

export async function addNpcGrantedSkill(
  sessionId: string,
  participantId: string,
  skill: {
    name: string
    description?: string
    spiritCost: number
    reusePolicy: 'once' | 'cooldown' | 'unlimited'
    cooldownMinutes?: number
    effectHp?: number
    effectSanity?: number
    effectSpirit?: number
  }
) {
  const { supabase } = await requireAdmin()

  const { data: participant } = await supabase
    .from('combat_participants')
    .select('id, npc_granted_skills, type')
    .eq('id', participantId)
    .eq('session_id', sessionId)
    .single()

  if (!participant) return { error: 'ไม่พบ NPC' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = (participant.npc_granted_skills as any[]) ?? []
  const newSkill = {
    id: crypto.randomUUID(),
    name: skill.name.trim(),
    description: skill.description?.trim() || null,
    spirit_cost: Math.max(0, skill.spiritCost),
    reuse_policy: skill.reusePolicy,
    cooldown_minutes: skill.reusePolicy === 'cooldown' ? (skill.cooldownMinutes ?? 5) : null,
    times_used: 0,
    last_used_at: null,
    effect_hp: skill.effectHp ?? 0,
    effect_sanity: skill.effectSanity ?? 0,
    effect_spirit: skill.effectSpirit ?? 0,
  }

  const { error } = await supabase
    .from('combat_participants')
    .update({ npc_granted_skills: [...existing, newSkill] })
    .eq('id', participantId)

  if (error) return { error: error.message }

  await broadcastCombat(sessionId, 'stat_update', { participantId })
  revalidatePath(`/dashboard/combat/${sessionId}`)
  return { success: true, skillId: newSkill.id }
}


/* ══════════════════════════════════════════════
   STAFF: Remove a granted skill from NPC
   ══════════════════════════════════════════════ */

export async function removeNpcGrantedSkill(sessionId: string, participantId: string, skillId: string) {
  const { supabase } = await requireAdmin()

  const { data: participant } = await supabase
    .from('combat_participants')
    .select('id, npc_granted_skills')
    .eq('id', participantId)
    .eq('session_id', sessionId)
    .single()

  if (!participant) return { error: 'ไม่พบ NPC' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = (participant.npc_granted_skills as any[]) ?? []
  const updated = existing.filter((g: any) => g.id !== skillId)

  const { error } = await supabase
    .from('combat_participants')
    .update({ npc_granted_skills: updated })
    .eq('id', participantId)

  if (error) return { error: error.message }

  await broadcastCombat(sessionId, 'stat_update', { participantId })
  revalidatePath(`/dashboard/combat/${sessionId}`)
  return { success: true }
}


/* ══════════════════════════════════════════════
   STAFF: Use a granted skill on behalf of NPC in combat
   ══════════════════════════════════════════════ */

export async function useNpcGrantedSkill(
  sessionId: string,
  participantId: string,
  grantedSkillId: string,
  successRate: number,
  roll: number,
  note?: string | null
) {
  const { supabase } = await requireAdmin()

  const normalizedRate = Math.floor(successRate)
  const normalizedRoll = Math.floor(roll)
  if (!Number.isFinite(normalizedRate) || normalizedRate < 1 || normalizedRate > 20) return { error: 'Success Rate ต้องเป็น 1-20' }
  if (!Number.isFinite(normalizedRoll) || normalizedRoll < 1 || normalizedRoll > 20) return { error: 'Roll ไม่ถูกต้อง' }

  // 1) Get participant
  const { data: participant } = await supabase
    .from('combat_participants')
    .select('id, display_name, current_hp, current_sanity, current_spirit, npc_granted_skills, type')
    .eq('id', participantId)
    .eq('session_id', sessionId)
    .single()

  if (!participant) return { error: 'ไม่พบ NPC' }

  // 2) Find the granted skill from JSONB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grantedSkills = (participant.npc_granted_skills as any[]) ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gs = grantedSkills.find((g: any) => g.id === grantedSkillId)
  if (!gs) return { error: 'ไม่พบสกิลพิเศษนี้' }

  // 3) Reuse check
  if (gs.reuse_policy === 'once' && gs.times_used > 0) return { error: 'สกิลนี้ใช้ได้ครั้งเดียวและถูกใช้แล้ว' }
  if (gs.reuse_policy === 'cooldown' && gs.last_used_at && gs.cooldown_minutes) {
    const cooldownEnd = new Date(gs.last_used_at)
    cooldownEnd.setMinutes(cooldownEnd.getMinutes() + gs.cooldown_minutes)
    if (new Date() < cooldownEnd) {
      const rem = Math.ceil((cooldownEnd.getTime() - Date.now()) / 60000)
      return { error: `ติดคูลดาวน์ อีก ${rem} นาที` }
    }
  }

  // 4) Check spirit
  const spiritCost = gs.spirit_cost ?? 0
  if ((participant.current_spirit ?? 0) < spiritCost) {
    return { error: `Spirit ไม่พอ (ต้องการ ${spiritCost}, มี ${participant.current_spirit})` }
  }

  // 5) Calculate stat updates (NPC stats are only in combat_participants)
  const spiritAfterCost = (participant.current_spirit ?? 0) - spiritCost
  const combatUpdates: Record<string, unknown> = { current_spirit: spiritAfterCost }
  const effectParts: string[] = []

  if (gs.effect_hp && gs.effect_hp !== 0) {
    combatUpdates.current_hp = Math.max(0, (participant.current_hp ?? 0) + gs.effect_hp)
    effectParts.push(`❤️ HP ${gs.effect_hp > 0 ? '+' : ''}${gs.effect_hp}`)
  }
  if (gs.effect_sanity && gs.effect_sanity !== 0) {
    combatUpdates.current_sanity = Math.max(0, (participant.current_sanity ?? 0) + gs.effect_sanity)
    effectParts.push(`🧠 Sanity ${gs.effect_sanity > 0 ? '+' : ''}${gs.effect_sanity}`)
  }
  if (gs.effect_spirit && gs.effect_spirit !== 0) {
    combatUpdates.current_spirit = Math.max(0, spiritAfterCost + gs.effect_spirit)
    effectParts.push(`✨ Spirit ${gs.effect_spirit > 0 ? '+' : ''}${gs.effect_spirit}`)
  }

  // 6) Update the granted skill tracking in JSONB
  const updatedSkills = grantedSkills.map((g: any) =>
    g.id === grantedSkillId
      ? {
          ...g,
          times_used: (g.times_used ?? 0) + 1,
          last_used_at: new Date().toISOString(),
        }
      : g
  )
  combatUpdates.npc_granted_skills = updatedSkills

  await supabase.from('combat_participants').update(combatUpdates).eq('id', participant.id)

  // 7) Outcome
  const outcome = normalizedRoll >= normalizedRate ? 'success' : 'fail'

  // 8) Reference code
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  const referenceCode = `NGSK-${dateStr}-${rand}`

  // 9) Combat log
  await addLog(supabase, sessionId, 'skill_use',
    `🎲 ${participant.display_name} ใช้สกิลพิเศษ「${gs.name}」— ` +
    `ทอย ${normalizedRoll}/${normalizedRate} → ${outcome === 'success' ? '✅ สำเร็จ' : '❌ พลาด'}` +
    ` | ✨ ${combatUpdates.current_spirit as number} (-${spiritCost})` +
    (effectParts.length > 0 ? ` | ${effectParts.join(' ')}` : '') +
    (note?.trim() ? ` | 📝 ${note.trim()}` : '') +
    ` | 🏷️ ${referenceCode}`,
    participant.id,
    {
      grantedSkillId,
      skillName: gs.name,
      outcome,
      roll: normalizedRoll,
      successRate: normalizedRate,
      spiritCost,
      remaining: combatUpdates.current_spirit,
      referenceCode,
      effects: effectParts,
      note: note?.trim() || null,
      isNpc: true,
    }
  )

  await broadcastCombat(sessionId, 'skill_use', {
    participantId: participant.id,
    displayName: participant.display_name,
    skillName: gs.name,
    outcome,
    roll: normalizedRoll,
    successRate: normalizedRate,
  })

  await broadcastCombat(sessionId, 'stat_update', {
    participantId: participant.id,
  })

  revalidatePath(`/dashboard/combat/${sessionId}`)
  return {
    success: true,
    skillName: gs.name,
    outcome,
    roll: normalizedRoll,
    successRate: normalizedRate,
    referenceCode,
    spiritCost,
    remaining: combatUpdates.current_spirit as number,
    effects: effectParts,
  }
}