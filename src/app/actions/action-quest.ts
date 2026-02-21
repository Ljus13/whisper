'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotification, createNotifications } from '@/app/actions/notifications'
import { notifyNewPublicQuest, notifyNewPunishment } from '@/lib/discord-notify'

const PAGE_SIZE = 20

/* ══════════════════════════════════════════════════════════════
   Helper: generate code  dd-mm-yy-abcd (4 random lowercase)
   ══════════════════════════════════════════════════════════════ */
function generateCode(): string {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yy = String(now.getFullYear()).slice(-2)
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  let rand = ''
  for (let i = 0; i < 4; i++) rand += chars[Math.floor(Math.random() * 26)]
  return `${dd}-${mm}-${yy}-${rand}`
}

/* Helper: verify current user is admin/dm */
async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return data?.role === 'admin' || data?.role === 'dm'
}

/** Quick lookup: get display_name for a user */
async function getDisplayName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single()
  return data?.display_name || 'ผู้เล่น'
}

function revalidateActionQuestPaths() {
  revalidatePath('/dashboard/action-quest/actions')
  revalidatePath('/dashboard/action-quest/quests')
  revalidatePath('/dashboard/action-quest/sleep')
  revalidatePath('/dashboard/action-quest/prayer')
  revalidatePath('/dashboard/action-quest/punishments')
  revalidatePath('/dashboard/action-quest/roleplay')
}

/**
 * Broadcast refresh signal via Supabase Realtime (Dual Communication Strategy).
 * - channelName: which realtime channel to use
 * - eventName: event type (e.g. 'pun_refresh', 'aq_refresh')
 * - payload: data to send
 *
 * Fire-and-forget with 500ms timeout — never blocks the server action.
 */
async function broadcastRefresh(
  supabase: Awaited<ReturnType<typeof createClient>>,
  channelName: string,
  eventName: string,
  payload: Record<string, unknown>
) {
  try {
    await Promise.race([
      new Promise<void>((resolve) => {
        const channel = supabase.channel(channelName)
        channel.subscribe(async (status: string) => {
          if (status !== 'SUBSCRIBED') return
          try {
            await channel.send({ type: 'broadcast', event: eventName, payload })
          } catch {}
          try { supabase.removeChannel(channel) } catch {}
          resolve()
        })
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 500))
    ])
  } catch {}
}

/** Broadcast punishment banner refresh to specific players */
async function broadcastPunishmentRefresh(
  supabase: Awaited<ReturnType<typeof createClient>>,
  playerIds: string[]
) {
  if (playerIds.length === 0) return
  await broadcastRefresh(supabase, 'punishment_banner_realtime', 'pun_refresh', { player_ids: playerIds, ts: Date.now() })
}

/** Broadcast action-quest tab refresh (new submission, status change, etc.) */
async function broadcastAQRefresh(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tab: 'actions' | 'quests',
  detail?: Record<string, unknown>
) {
  await broadcastRefresh(supabase, 'aq_realtime_broadcast', 'aq_refresh', { tab, ts: Date.now(), ...detail })
}

/* ══════════════════════════════════════════════
   SLEEP REQUESTS — นอนหลับ (Rest)
   ══════════════════════════════════════════════ */

/* ── Fetch all maps for quest location dropdown ── */
export async function getMapsForQuestDropdown() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('maps')
    .select('id, name')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  return data ?? []
}

/* ── Fetch all NPC tokens for quest NPC dropdown ── */
export async function getNpcsForQuestDropdown() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('map_tokens')
    .select('id, npc_name, npc_image_url, map_id, interaction_radius, maps:map_id(name)')
    .eq('token_type', 'npc')
    .order('npc_name', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((t: any) => ({
    id: t.id,
    npc_name: t.npc_name,
    npc_image_url: t.npc_image_url,
    map_id: t.map_id,
    map_name: t.maps?.name || null,
    interaction_radius: t.interaction_radius || 0,
  }))
}

export async function submitSleepRequest(mealUrl: string, sleepUrl: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (!mealUrl?.trim() || !sleepUrl?.trim()) {
    return { error: 'กรุณากรอก URL ทั้ง 2 ลิงก์' }
  }

  // Check if player is in a rest zone (inline check using same supabase client)
  const { data: playerToken } = await supabase
    .from('map_tokens')
    .select('position_x, position_y, map_id')
    .eq('user_id', user.id)
    .eq('token_type', 'player')
    .maybeSingle()

  if (!playerToken) {
    return { error: 'ไม่พบตัวละครบนแผนที่ — ต้องอยู่ในเขตจุดพักเท่านั้นจึงจะนอนหลับได้' }
  }

  const { data: nearbyRestPoints } = await supabase
    .from('map_rest_points')
    .select('position_x, position_y, radius')
    .eq('map_id', playerToken.map_id)

  let inRestZone = false
  if (nearbyRestPoints && nearbyRestPoints.length > 0) {
    for (const rp of nearbyRestPoints) {
      const dx = playerToken.position_x - rp.position_x
      const dy = playerToken.position_y - rp.position_y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance <= rp.radius) { inRestZone = true; break }
    }
  }

  if (!inRestZone) {
    return { error: 'ต้องอยู่ในเขตจุดพักเท่านั้นจึงจะนอนหลับได้' }
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: todayRequests } = await supabase
    .from('sleep_requests')
    .select('id')
    .eq('player_id', user.id)
    .gte('created_at', todayStart.toISOString())

  if (todayRequests && todayRequests.length > 0) {
    return { error: 'คุณส่งคำขอนอนหลับได้เพียง 1 ครั้งต่อวันเท่านั้น' }
  }

  const { error } = await supabase
    .from('sleep_requests')
    .insert({ player_id: user.id, meal_url: mealUrl.trim(), sleep_url: sleepUrl.trim() })

  if (error) return { error: error.message }

  // Notification: admin sees new sleep request
  const actorName = await getDisplayName(supabase, user.id)
  await createNotification(supabase, {
    targetUserId: null,
    actorId: user.id,
    actorName,
    type: 'sleep_submitted',
    title: `${actorName} ส่งคำขอนอนหลับ`,
    message: 'มีคำขอนอนหลับใหม่รอตรวจสอบ',
    link: '/dashboard/action-quest/sleep',
  })

  revalidateActionQuestPaths()
  return { success: true }
}

export async function getTodaySleepStatus() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { submitted: false }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('sleep_requests')
    .select('id, status')
    .eq('player_id', user.id)
    .gte('created_at', todayStart.toISOString())
    .limit(1)
    .maybeSingle()

  return { submitted: !!data, status: data?.status || null }
}

export async function approveSleepRequest(requestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }

  const { data: request } = await supabase
    .from('sleep_requests')
    .select('id, player_id, status')
    .eq('id', requestId)
    .single()

  if (!request) return { error: 'ไม่พบคำขอ' }
  if (request.status !== 'pending') return { error: 'คำขอนี้ได้รับการดำเนินการแล้ว' }

  const { data: playerProfile } = await supabase
    .from('profiles')
    .select('max_spirituality')
    .eq('id', request.player_id)
    .single()

  if (!playerProfile) return { error: 'ไม่พบโปรไฟล์ผู้เล่น' }

  const { error: updateErr } = await supabase
    .from('sleep_requests')
    .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', requestId)

  if (updateErr) return { error: updateErr.message }

  await supabase
    .from('profiles')
    .update({ spirituality: playerProfile.max_spirituality })
    .eq('id', request.player_id)

  // Notification: player sees sleep approved
  const adminName = await getDisplayName(supabase, user.id)
  await createNotification(supabase, {
    targetUserId: request.player_id,
    actorId: user.id,
    actorName: adminName,
    type: 'sleep_approved',
    title: 'การนอนหลับได้รับการอนุมัติ',
    message: 'พลังจิตวิญญาณถูกฟื้นฟูเต็มแล้ว',
    link: '/dashboard/action-quest/sleep',
  })

  revalidateActionQuestPaths()
  return { success: true }
}

export async function rejectSleepRequest(requestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }

  // Fetch request to get player_id for notification
  const { data: sleepReq } = await supabase
    .from('sleep_requests')
    .select('id, player_id')
    .eq('id', requestId)
    .eq('status', 'pending')
    .single()

  if (!sleepReq) return { error: 'ไม่พบคำขอหรือคำขอถูกดำเนินการแล้ว' }

  const { error } = await supabase
    .from('sleep_requests')
    .update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (error) return { error: error.message }

  // Notification: player sees sleep rejected
  const adminName = await getDisplayName(supabase, user.id)
  await createNotification(supabase, {
    targetUserId: sleepReq.player_id,
    actorId: user.id,
    actorName: adminName,
    type: 'sleep_rejected',
    title: 'การนอนหลับถูกปฏิเสธ',
    link: '/dashboard/action-quest/sleep',
  })

  revalidateActionQuestPaths()
  return { success: true }
}

/* Note: auto-approve is now handled by pg_cron at midnight.
   This client-side fallback still works when an admin visits the page. */
export async function autoApproveExpiredRequests() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  if (!(await requireAdmin(supabase, user.id))) return

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: expiredRequests } = await supabase
    .from('sleep_requests')
    .select('id, player_id')
    .eq('status', 'pending')
    .lt('created_at', todayStart.toISOString())

  if (!expiredRequests || expiredRequests.length === 0) return

  for (const req of expiredRequests) {
    const { data: pp } = await supabase
      .from('profiles')
      .select('max_spirituality')
      .eq('id', req.player_id)
      .single()
    if (!pp) continue

    await supabase.from('sleep_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', req.id)

    await supabase.from('profiles')
      .update({ spirituality: pp.max_spirituality })
      .eq('id', req.player_id)
  }
  revalidateActionQuestPaths()
}


/* ══════════════════════════════════════════════
   ACTION CODES — สร้างโค้ดแอคชั่น
   ══════════════════════════════════════════════ */

export interface ActionRewards {
  reward_hp?: number
  reward_sanity?: number
  reward_travel?: number
  reward_spirituality?: number
  reward_max_sanity?: number
  reward_max_travel?: number
  reward_max_spirituality?: number
}

export interface CodeExpiration {
  expires_at?: string | null   // ISO datetime or null for never
  max_repeats?: number | null  // null = unlimited
}

export async function generateActionCode(name: string, rewards?: ActionRewards, expiration?: CodeExpiration) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }
  if (!name?.trim()) return { error: 'กรุณากรอกชื่อแอคชั่น' }

  // Generate unique code — retry on collision
  let code = generateCode()
  for (let i = 0; i < 5; i++) {
    const { data: exists } = await supabase
      .from('action_codes')
      .select('id')
      .eq('code', code)
      .maybeSingle()
    if (!exists) break
    code = generateCode()
  }

  const insertData: Record<string, unknown> = {
    name: name.trim(), code, created_by: user.id,
  }
  if (rewards) {
    if (rewards.reward_hp) insertData.reward_hp = rewards.reward_hp
    if (rewards.reward_sanity) insertData.reward_sanity = rewards.reward_sanity
    if (rewards.reward_travel) insertData.reward_travel = rewards.reward_travel
    if (rewards.reward_spirituality) insertData.reward_spirituality = rewards.reward_spirituality
    if (rewards.reward_max_sanity) insertData.reward_max_sanity = rewards.reward_max_sanity
    if (rewards.reward_max_travel) insertData.reward_max_travel = rewards.reward_max_travel
    if (rewards.reward_max_spirituality) insertData.reward_max_spirituality = rewards.reward_max_spirituality
  }
  if (expiration) {
    if (expiration.expires_at) insertData.expires_at = expiration.expires_at
    if (expiration.max_repeats !== undefined && expiration.max_repeats !== null) insertData.max_repeats = expiration.max_repeats
  }

  const { data, error } = await supabase
    .from('action_codes')
    .insert(insertData)
    .select()
    .single()

  if (error) return { error: error.message }
  revalidateActionQuestPaths()
  return { success: true, code: data.code, name: data.name }
}

export async function getActionCodes(page: number = 1) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { codes: [], total: 0 }

  const offset = (page - 1) * PAGE_SIZE

  const { count } = await supabase
    .from('action_codes')
    .select('id', { count: 'exact', head: true })
    .or('archived.is.null,archived.eq.false')

  const { data, error } = await supabase
    .from('action_codes')
    .select('id, name, code, created_by, reward_hp, reward_sanity, reward_travel, reward_spirituality, reward_max_sanity, reward_max_travel, reward_max_spirituality, expires_at, max_repeats, created_at')
    .or('archived.is.null,archived.eq.false')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (error) return { codes: [], total: 0 }

  const creatorIds = [...new Set((data || []).map(c => c.created_by))]
  const { data: profiles } = creatorIds.length > 0
    ? await supabase.from('profiles').select('id, display_name').in('id', creatorIds)
    : { data: [] }
  const pMap = new Map((profiles || []).map(p => [p.id, p.display_name]))

  const codes = (data || []).map(c => ({
    ...c,
    created_by_name: pMap.get(c.created_by) || 'ไม่ทราบ',
  }))

  return { codes, total: count || 0, page, totalPages: Math.ceil((count || 0) / PAGE_SIZE) }
}


/* ══════════════════════════════════════════════
   QUEST CODES — สร้างโค้ดภารกิจ
   ══════════════════════════════════════════════ */

export async function generateQuestCode(name: string, mapId?: string | null, npcTokenId?: string | null, expiration?: CodeExpiration, rewards?: ActionRewards, isPublic?: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }
  if (!name?.trim()) return { error: 'กรุณากรอกชื่อภารกิจ' }

  // If NPC is selected, auto-fill map from the NPC's map (and validate radius)
  let resolvedMapId = mapId || null
  if (npcTokenId) {
    const { data: npcToken } = await supabase
      .from('map_tokens')
      .select('map_id, interaction_radius')
      .eq('id', npcTokenId)
      .eq('token_type', 'npc')
      .single()
    if (!npcToken) return { error: 'ไม่พบ NPC นี้ในระบบ' }
    if (npcToken.interaction_radius <= 0) return { error: 'NPC นี้ยังไม่ได้กำหนดเขตทำการ กรุณาตั้งค่ารัศมีในแมพก่อน' }
    // Auto-set map to NPC's map
    resolvedMapId = npcToken.map_id
  }

  let code = generateCode()
  for (let i = 0; i < 5; i++) {
    const { data: exists } = await supabase
      .from('quest_codes')
      .select('id')
      .eq('code', code)
      .maybeSingle()
    if (!exists) break
    code = generateCode()
  }

  const insertData: Record<string, unknown> = {
    name: name.trim(), code, created_by: user.id,
    is_public: isPublic !== false  // default true = เผยแพร่
  }
  if (resolvedMapId) insertData.map_id = resolvedMapId
  if (npcTokenId) insertData.npc_token_id = npcTokenId
  if (expiration) {
    if (expiration.expires_at) insertData.expires_at = expiration.expires_at
    if (expiration.max_repeats !== undefined && expiration.max_repeats !== null) insertData.max_repeats = expiration.max_repeats
  }
  if (rewards) {
    // Quest rewards allow negative (penalty) — store regardless of sign
    if (rewards.reward_hp !== undefined) insertData.reward_hp = rewards.reward_hp
    if (rewards.reward_sanity !== undefined) insertData.reward_sanity = rewards.reward_sanity
    if (rewards.reward_travel !== undefined) insertData.reward_travel = rewards.reward_travel
    if (rewards.reward_spirituality !== undefined) insertData.reward_spirituality = rewards.reward_spirituality
    if (rewards.reward_max_sanity !== undefined) insertData.reward_max_sanity = rewards.reward_max_sanity
    if (rewards.reward_max_travel !== undefined) insertData.reward_max_travel = rewards.reward_max_travel
    if (rewards.reward_max_spirituality !== undefined) insertData.reward_max_spirituality = rewards.reward_max_spirituality
  }

  const { data, error } = await supabase
    .from('quest_codes')
    .insert(insertData)
    .select()
    .single()

  if (error) return { error: error.message }
  revalidateActionQuestPaths()

  // 🔔 Discord notification — เฉพาะ quest ที่ is_public = true
  if (data.is_public) {
    const creatorName = await getDisplayName(supabase, user.id)
    let mapName: string | null = null
    let npcName: string | null = null
    if (data.map_id) {
      const { data: mapRow } = await supabase.from('maps').select('name').eq('id', data.map_id).maybeSingle()
      mapName = mapRow?.name ?? null
    }
    if (data.npc_token_id) {
      const { data: npcRow } = await supabase.from('map_tokens').select('label').eq('id', data.npc_token_id).maybeSingle()
      npcName = npcRow?.label ?? null
    }
    notifyNewPublicQuest({
      questName: data.name,
      questCode: data.code,
      creatorName,
      mapName,
      npcName,
      expiresAt: data.expires_at ?? null,
      rewards: {
        hp: data.reward_hp,
        sanity: data.reward_sanity,
        travel: data.reward_travel,
        spirituality: data.reward_spirituality,
        maxSanity: data.reward_max_sanity,
        maxTravel: data.reward_max_travel,
        maxSpirituality: data.reward_max_spirituality,
      },
    }).catch(() => {})
  }

  return { success: true, code: data.code, name: data.name, is_public: data.is_public as boolean }
}

export async function getQuestCodes(page: number = 1) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { codes: [], total: 0 }

  const offset = (page - 1) * PAGE_SIZE

  const { count } = await supabase
    .from('quest_codes')
    .select('id', { count: 'exact', head: true })
    .or('archived.is.null,archived.eq.false')

  const { data, error } = await supabase
    .from('quest_codes')
    .select('id, name, code, created_by, map_id, npc_token_id, reward_hp, reward_sanity, reward_travel, reward_spirituality, reward_max_sanity, reward_max_travel, reward_max_spirituality, expires_at, max_repeats, created_at')
    .or('archived.is.null,archived.eq.false')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (error) return { codes: [], total: 0 }

  const creatorIds = [...new Set((data || []).map(c => c.created_by))]
  const mapIds = [...new Set((data || []).filter(c => c.map_id).map(c => c.map_id!))]
  const npcIds = [...new Set((data || []).filter(c => c.npc_token_id).map(c => c.npc_token_id!))]
  const { data: profiles } = creatorIds.length > 0
    ? await supabase.from('profiles').select('id, display_name').in('id', creatorIds)
    : { data: [] }
  const { data: maps } = mapIds.length > 0
    ? await supabase.from('maps').select('id, name').in('id', mapIds)
    : { data: [] }
  const { data: npcTokens } = npcIds.length > 0
    ? await supabase.from('map_tokens').select('id, npc_name').in('id', npcIds)
    : { data: [] }
  const pMap = new Map((profiles || []).map(p => [p.id, p.display_name]))
  const mMap = new Map((maps || []).map(m => [m.id, m.name]))
  const nMap = new Map((npcTokens || []).map(n => [n.id, n.npc_name]))

  const codes = (data || []).map(c => ({
    ...c,
    created_by_name: pMap.get(c.created_by) || 'ไม่ทราบ',
    map_name: c.map_id ? (mMap.get(c.map_id) || null) : null,
    npc_name: c.npc_token_id ? (nMap.get(c.npc_token_id) || null) : null,
  }))

  return { codes, total: count || 0, page, totalPages: Math.ceil((count || 0) / PAGE_SIZE) }
}


/* ══════════════════════════════════════════════
   ACTION SUBMISSIONS — ส่งแอคชั่น
   ══════════════════════════════════════════════ */

export async function submitAction(codeStr: string, evidenceUrls: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (!codeStr?.trim()) return { error: 'กรุณากรอกรหัสแอคชั่น' }
  if (!evidenceUrls || evidenceUrls.filter(u => u.trim()).length === 0) {
    return { error: 'กรุณาแนบ URL หลักฐานอย่างน้อย 1 ลิงก์' }
  }

  const { data: codeRow } = await supabase
    .from('action_codes')
    .select('id, name, expires_at, max_repeats')
    .eq('code', codeStr.trim())
    .maybeSingle()

  if (!codeRow) return { error: 'ไม่พบรหัสแอคชั่นนี้ กรุณาตรวจสอบรหัสอีกครั้ง' }

  // Check expiration
  if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
    return { error: 'แอคชั่นนี้หมดอายุแล้ว' }
  }

  // Check repeat limit
  if (codeRow.max_repeats !== null && codeRow.max_repeats !== undefined) {
    // นับเฉพาะ pending/approved — rejected ไม่นับ (ให้ส่งใหม่ได้)
    const { count } = await supabase
      .from('action_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', user.id)
      .eq('action_code_id', codeRow.id)
      .neq('status', 'rejected')
    if ((count || 0) >= codeRow.max_repeats) {
      return { error: `คุณส่งแอคชั่นนี้ครบ ${codeRow.max_repeats} ครั้งแล้ว ไม่สามารถส่งซ้ำได้อีก` }
    }
  }

  const cleanUrls = evidenceUrls.filter(u => u.trim()).map(u => u.trim())

  const { error } = await supabase
    .from('action_submissions')
    .insert({
      player_id: user.id,
      action_code_id: codeRow.id,
      evidence_urls: cleanUrls,
    })

  if (error) return { error: error.message }

  // Broadcast so admin sees new submission instantly
  await broadcastAQRefresh(supabase, 'actions', { player_id: user.id })

  // Notification: admin sees new action submission
  const actorName = await getDisplayName(supabase, user.id)
  await createNotification(supabase, {
    targetUserId: null,
    actorId: user.id,
    actorName,
    type: 'action_submitted',
    title: `${actorName} ส่งแอคชั่น "${codeRow.name}"`,
    message: 'มีแอคชั่นใหม่รอตรวจสอบ',
    link: '/dashboard/action-quest/quests',
  })

  revalidateActionQuestPaths()
  return { success: true, actionName: codeRow.name }
}

export async function getActionSubmissions(page: number = 1) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { submissions: [], total: 0 }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'dm'
  const offset = (page - 1) * PAGE_SIZE
  let countQ = supabase.from('action_submissions').select('id', { count: 'exact', head: true })
  if (!isAdmin) countQ = countQ.eq('player_id', user.id)
  const { count } = await countQ

  let dataQ = supabase.from('action_submissions')
    .select('id, player_id, action_code_id, evidence_urls, status, rejection_reason, reviewed_by, reviewed_at, created_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)
  if (!isAdmin) dataQ = dataQ.eq('player_id', user.id)
  const { data, error } = await dataQ

  if (error) return { submissions: [], total: 0 }
  const rows = data || []

  const playerIds = [...new Set(rows.map(r => r.player_id).filter(Boolean))]
  const reviewerIds = [...new Set(rows.map(r => r.reviewed_by).filter(Boolean))]
  const actionCodeIds = [...new Set(rows.map(r => r.action_code_id).filter(Boolean))]
  const profileIds = [...new Set([...playerIds, ...reviewerIds])]

  const { data: profiles } = profileIds.length > 0
    ? await supabase.from('profiles').select('id, display_name, avatar_url').in('id', profileIds)
    : { data: [] }
  const { data: actionCodes } = actionCodeIds.length > 0
    ? await supabase
      .from('action_codes')
      .select('id, name, code, reward_hp, reward_sanity, reward_travel, reward_spirituality, reward_max_sanity, reward_max_travel, reward_max_spirituality')
      .in('id', actionCodeIds)
    : { data: [] }

  const profileMap = new Map((profiles || []).map(p => [p.id, p]))
  const actionCodeMap = new Map((actionCodes || []).map(c => [c.id, c]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submissions = rows.map((r: any) => {
    const player = profileMap.get(r.player_id)
    const reviewer = r.reviewed_by ? profileMap.get(r.reviewed_by) : null
    const code = actionCodeMap.get(r.action_code_id)
    return {
      id: r.id,
      player_id: r.player_id,
      player_name: player?.display_name || 'ไม่ทราบชื่อ',
      player_avatar: player?.avatar_url || null,
      action_name: code?.name || '—',
      action_code: code?.code || '—',
      evidence_urls: (r.evidence_urls || []) as string[],
      status: r.status as string,
      rejection_reason: r.rejection_reason || null,
      reviewed_by_name: reviewer?.display_name || null,
      reviewed_at: r.reviewed_at,
      created_at: r.created_at,
      // rewards from action_code
      reward_hp: code?.reward_hp || 0,
      reward_sanity: code?.reward_sanity || 0,
      reward_travel: code?.reward_travel || 0,
      reward_spirituality: code?.reward_spirituality || 0,
      reward_max_sanity: code?.reward_max_sanity || 0,
      reward_max_travel: code?.reward_max_travel || 0,
      reward_max_spirituality: code?.reward_max_spirituality || 0,
    }
  })

  return { submissions, total: count || 0, page, totalPages: Math.ceil((count || 0) / PAGE_SIZE), isAdmin }
}

export async function approveActionSubmission(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }

  // Fetch the submission + action_code rewards in one go
  const { data: submission } = await supabase
    .from('action_submissions')
    .select('id, player_id, action_code_id, status')
    .eq('id', id)
    .eq('status', 'pending')
    .single()

  if (!submission) return { error: 'ไม่พบคำขอหรือคำขอถูกดำเนินการแล้ว' }

  const { data: actionCode } = await supabase
    .from('action_codes')
    .select('name, reward_hp, reward_sanity, reward_travel, reward_spirituality, reward_max_sanity, reward_max_travel, reward_max_spirituality')
    .eq('id', submission.action_code_id)
    .single()

  // Update submission status
  const { error: updateErr } = await supabase
    .from('action_submissions')
    .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', id)

  if (updateErr) return { error: updateErr.message }

  // Apply rewards if any
  if (actionCode) {
    const hasRewards = (actionCode.reward_hp || 0) + (actionCode.reward_sanity || 0) +
      (actionCode.reward_travel || 0) + (actionCode.reward_spirituality || 0) +
      (actionCode.reward_max_sanity || 0) + (actionCode.reward_max_travel || 0) +
      (actionCode.reward_max_spirituality || 0) > 0

    if (hasRewards) {
      // Fetch current player profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('hp, sanity, max_sanity, travel_points, max_travel_points, spirituality, max_spirituality')
        .eq('id', submission.player_id)
        .single()

      if (profile) {
        const updates: Record<string, number> = {}

        // Step 1: Expand max caps first (so adding current doesn't exceed new max)
        let newMaxSanity = profile.max_sanity ?? 10
        let newMaxTravel = profile.max_travel_points ?? 10
        let newMaxSpirit = profile.max_spirituality ?? 10

        if (actionCode.reward_max_sanity > 0) {
          newMaxSanity += actionCode.reward_max_sanity
          updates.max_sanity = newMaxSanity
        }
        if (actionCode.reward_max_travel > 0) {
          newMaxTravel += actionCode.reward_max_travel
          updates.max_travel_points = newMaxTravel
        }
        if (actionCode.reward_max_spirituality > 0) {
          newMaxSpirit += actionCode.reward_max_spirituality
          updates.max_spirituality = newMaxSpirit
        }

        // Step 2: Add current value rewards (clamped to max)
        if (actionCode.reward_hp > 0) {
          updates.hp = (profile.hp ?? 0) + actionCode.reward_hp
        }
        if (actionCode.reward_sanity > 0) {
          updates.sanity = Math.min(newMaxSanity, (profile.sanity ?? 0) + actionCode.reward_sanity)
        }
        if (actionCode.reward_travel > 0) {
          updates.travel_points = Math.min(newMaxTravel, (profile.travel_points ?? 0) + actionCode.reward_travel)
        }
        if (actionCode.reward_spirituality > 0) {
          updates.spirituality = Math.min(newMaxSpirit, (profile.spirituality ?? 0) + actionCode.reward_spirituality)
        }

        if (Object.keys(updates).length > 0) {
          await supabase.from('profiles').update(updates).eq('id', submission.player_id)
        }
      }
    }
  }

  // Broadcast instant refresh to player's submission list + punishment banner
  await Promise.all([
    broadcastAQRefresh(supabase, 'actions', { player_id: submission.player_id }),
    broadcastPunishmentRefresh(supabase, [submission.player_id]),
  ])

  // Notification: ส่งให้ผู้เล่นเท่านั้น (admin ไม่รับการแจ้งเตือนนี้)
  const adminName = await getDisplayName(supabase, user.id)
  await createNotification(supabase, {
    targetUserId: submission.player_id,
    actorId: user.id,
    actorName: adminName,
    type: 'action_approved',
    title: `แอคชั่น "${actionCode?.name ?? 'แอคชั่น'}" ได้รับการอนุมัติแล้ว!`,
    message: 'ได้รับรางวัลจากแอคชั่นที่ส่ง',
    link: '/dashboard/action-quest/quests',
  })

  revalidateActionQuestPaths()
  return { success: true }
}

export async function rejectActionSubmission(id: string, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }
  if (!reason?.trim()) return { error: 'กรุณาระบุเหตุผลการปฏิเสธ' }

  // Fetch submission to get player_id for broadcast
  const { data: submission } = await supabase
    .from('action_submissions')
    .select('id, player_id')
    .eq('id', id)
    .eq('status', 'pending')
    .single()

  if (!submission) return { error: 'ไม่พบคำขอหรือคำขอถูกดำเนินการแล้ว' }

  const { error } = await supabase
    .from('action_submissions')
    .update({
      status: 'rejected',
      rejection_reason: reason.trim(),
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')

  if (error) return { error: error.message }

  // Broadcast so player sees rejection instantly
  await broadcastAQRefresh(supabase, 'actions', { player_id: submission.player_id })

  // Notification: player sees action rejected
  const adminName = await getDisplayName(supabase, user.id)
  await createNotification(supabase, {
    targetUserId: submission.player_id,
    actorId: user.id,
    actorName: adminName,
    type: 'action_rejected',
    title: 'แอคชั่นถูกปฏิเสธ',
    message: `เหตุผล: ${reason.trim()}`,
    link: '/dashboard/action-quest/quests',
  })

  revalidateActionQuestPaths()
  return { success: true }
}


/* ══════════════════════════════════════════════
   QUEST SUBMISSIONS — ส่งภารกิจ
   ══════════════════════════════════════════════ */

export async function submitQuest(codeStr: string, evidenceUrls: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (!codeStr?.trim()) return { error: 'กรุณากรอกรหัสภารกิจ' }
  if (!evidenceUrls || evidenceUrls.filter(u => u.trim()).length === 0) {
    return { error: 'กรุณาแนบ URL หลักฐานอย่างน้อย 1 ลิงก์' }
  }

  const { data: codeRow } = await supabase
    .from('quest_codes')
    .select('id, name, map_id, npc_token_id, expires_at, max_repeats')
    .eq('code', codeStr.trim())
    .maybeSingle()

  if (!codeRow) return { error: 'ไม่พบรหัสภารกิจนี้ กรุณาตรวจสอบรหัสอีกครั้ง' }

  // Check expiration
  if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
    return { error: 'ภารกิจนี้หมดอายุแล้ว' }
  }

  // Check repeat limit
  if (codeRow.max_repeats !== null && codeRow.max_repeats !== undefined) {
    // นับเฉพาะ pending/approved — rejected ไม่นับ (ให้ส่งใหม่ได้)
    const { count } = await supabase
      .from('quest_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', user.id)
      .eq('quest_code_id', codeRow.id)
      .neq('status', 'rejected')
    if ((count || 0) >= codeRow.max_repeats) {
      return { error: `คุณส่งภารกิจนี้ครบ ${codeRow.max_repeats} ครั้งแล้ว ไม่สามารถส่งซ้ำได้อีก` }
    }
  }

  // ── ดึง token ผู้เล่น (ใช้ทั้ง map check และ NPC proximity check) ──
  const { data: playerToken } = await supabase
    .from('map_tokens')
    .select('map_id, position_x, position_y')
    .eq('user_id', user.id)
    .single()

  // ── ตรวจสอบว่าผู้เล่นอยู่ในแมพที่ภารกิจกำหนดหรือไม่ ──
  if (codeRow.map_id) {
    if (!playerToken) {
      const { data: requiredMap } = await supabase
        .from('maps')
        .select('name')
        .eq('id', codeRow.map_id)
        .single()
      const mapName = requiredMap?.name || 'สถานที่ที่กำหนด'
      return { error: `คุณต้องเดินทางไปยัง "${mapName}" ในแผนที่ก่อนจึงจะส่งภารกิจนี้ได้` }
    }

    if (playerToken.map_id !== codeRow.map_id) {
      const { data: requiredMap } = await supabase
        .from('maps')
        .select('name')
        .eq('id', codeRow.map_id)
        .single()
      const mapName = requiredMap?.name || 'สถานที่ที่กำหนด'
      return { error: `คุณต้องเดินทางไปยัง "${mapName}" ในแผนที่ก่อนจึงจะส่งภารกิจนี้ได้` }
    }
  }

  // ── ตรวจสอบว่าผู้เล่นอยู่ใกล้ NPC ที่กำหนดหรือไม่ ──
  if (codeRow.npc_token_id) {
    const { data: npcToken } = await supabase
      .from('map_tokens')
      .select('map_id, position_x, position_y, interaction_radius, npc_name')
      .eq('id', codeRow.npc_token_id)
      .single()

    if (npcToken && npcToken.interaction_radius > 0) {
      if (!playerToken) {
        return { error: `คุณต้องอยู่ใกล้ NPC "${npcToken.npc_name}" บนแผนที่ก่อนจึงจะส่งภารกิจนี้ได้` }
      }

      if (playerToken.map_id !== npcToken.map_id) {
        return { error: `คุณต้องอยู่บนแมพเดียวกับ NPC "${npcToken.npc_name}" ก่อนจึงจะส่งภารกิจนี้ได้` }
      }

      // คำนวณระยะห่าง (% ของแมพ) — ใช้ Euclidean distance
      const dx = playerToken.position_x - npcToken.position_x
      const dy = playerToken.position_y - npcToken.position_y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > npcToken.interaction_radius) {
        return { error: `คุณอยู่ไกลจาก NPC "${npcToken.npc_name}" เกินไป กรุณาเดินเข้าใกล้เขตทำการของ NPC ก่อน` }
      }
    }
  }

  const cleanUrls = evidenceUrls.filter(u => u.trim()).map(u => u.trim())

  const { error } = await supabase
    .from('quest_submissions')
    .insert({
      player_id: user.id,
      quest_code_id: codeRow.id,
      evidence_urls: cleanUrls,
    })

  if (error) return { error: error.message }

  // Broadcast so admin sees new submission instantly
  await broadcastAQRefresh(supabase, 'quests', { player_id: user.id })

  // Notification: admin sees new quest submission
  const actorName = await getDisplayName(supabase, user.id)
  await createNotification(supabase, {
    targetUserId: null,
    actorId: user.id,
    actorName,
    type: 'quest_submitted',
    title: `${actorName} ส่งภารกิจ "${codeRow.name}"`,
    message: 'มีภารกิจใหม่รอตรวจสอบ',
    link: '/dashboard/action-quest/quests',
  })

  revalidateActionQuestPaths()
  return { success: true, questName: codeRow.name }
}

export async function getQuestSubmissions(page: number = 1) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { submissions: [], total: 0 }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'dm'
  const offset = (page - 1) * PAGE_SIZE
  let countQ = supabase.from('quest_submissions').select('id', { count: 'exact', head: true })
  if (!isAdmin) countQ = countQ.eq('player_id', user.id)
  const { count } = await countQ

  let dataQ = supabase.from('quest_submissions')
    .select('id, player_id, quest_code_id, evidence_urls, status, rejection_reason, reviewed_by, reviewed_at, created_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)
  if (!isAdmin) dataQ = dataQ.eq('player_id', user.id)
  const { data, error } = await dataQ

  if (error) return { submissions: [], total: 0 }
  const rows = data || []

  const playerIds = [...new Set(rows.map(r => r.player_id).filter(Boolean))]
  const reviewerIds = [...new Set(rows.map(r => r.reviewed_by).filter(Boolean))]
  const questCodeIds = [...new Set(rows.map(r => r.quest_code_id).filter(Boolean))]
  const profileIds = [...new Set([...playerIds, ...reviewerIds])]

  const { data: profiles } = profileIds.length > 0
    ? await supabase.from('profiles').select('id, display_name, avatar_url').in('id', profileIds)
    : { data: [] }
  const { data: questCodes } = questCodeIds.length > 0
    ? await supabase.from('quest_codes').select('id, name, code, reward_hp, reward_sanity, reward_travel, reward_spirituality, reward_max_sanity, reward_max_travel, reward_max_spirituality').in('id', questCodeIds)
    : { data: [] }

  const profileMap = new Map((profiles || []).map(p => [p.id, p]))
  const questCodeMap = new Map((questCodes || []).map(c => [c.id, c]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submissions = rows.map((r: any) => {
    const player = profileMap.get(r.player_id)
    const reviewer = r.reviewed_by ? profileMap.get(r.reviewed_by) : null
    const code = questCodeMap.get(r.quest_code_id)
    return {
      id: r.id,
      player_id: r.player_id,
      player_name: player?.display_name || 'ไม่ทราบชื่อ',
      player_avatar: player?.avatar_url || null,
      quest_name: code?.name || '—',
      quest_code: code?.code || '—',
      evidence_urls: (r.evidence_urls || []) as string[],
      status: r.status as string,
      rejection_reason: r.rejection_reason || null,
      reviewed_by_name: reviewer?.display_name || null,
      reviewed_at: r.reviewed_at,
      created_at: r.created_at,
      reward_hp: code?.reward_hp || 0,
      reward_sanity: code?.reward_sanity || 0,
      reward_travel: code?.reward_travel || 0,
      reward_spirituality: code?.reward_spirituality || 0,
      reward_max_sanity: code?.reward_max_sanity || 0,
      reward_max_travel: code?.reward_max_travel || 0,
      reward_max_spirituality: code?.reward_max_spirituality || 0,
    }
  })

  return { submissions, total: count || 0, page, totalPages: Math.ceil((count || 0) / PAGE_SIZE), isAdmin }
}

export async function approveQuestSubmission(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }

  // Fetch submission + quest_code rewards
  const { data: submission } = await supabase
    .from('quest_submissions')
    .select('id, player_id, quest_code_id')
    .eq('id', id)
    .eq('status', 'pending')
    .single()

  if (!submission) return { error: 'ไม่พบคำขอหรือคำขอถูกดำเนินการแล้ว' }

  const { data: questCode } = await supabase
    .from('quest_codes')
    .select('name, reward_hp, reward_sanity, reward_travel, reward_spirituality, reward_max_sanity, reward_max_travel, reward_max_spirituality')
    .eq('id', submission.quest_code_id)
    .single()

  const { error } = await supabase
    .from('quest_submissions')
    .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')

  if (error) return { error: error.message }

  // Apply quest rewards (allows negative = penalty)
  if (questCode) {
    const hasEffect = [
      questCode.reward_hp, questCode.reward_sanity, questCode.reward_travel,
      questCode.reward_spirituality, questCode.reward_max_sanity,
      questCode.reward_max_travel, questCode.reward_max_spirituality,
    ].some(v => (v || 0) !== 0)

    if (hasEffect) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('hp, sanity, max_sanity, travel_points, max_travel_points, spirituality, max_spirituality')
        .eq('id', submission.player_id)
        .single()

      if (profile) {
        const updates: Record<string, number> = {}

        // Adjust max caps first (supports negative — reduce cap)
        let newMaxSanity = profile.max_sanity ?? 10
        let newMaxTravel = profile.max_travel_points ?? 10
        let newMaxSpirit = profile.max_spirituality ?? 10

        if ((questCode.reward_max_sanity || 0) !== 0) {
          newMaxSanity = Math.max(1, newMaxSanity + questCode.reward_max_sanity)
          updates.max_sanity = newMaxSanity
        }
        if ((questCode.reward_max_travel || 0) !== 0) {
          newMaxTravel = Math.max(1, newMaxTravel + questCode.reward_max_travel)
          updates.max_travel_points = newMaxTravel
        }
        if ((questCode.reward_max_spirituality || 0) !== 0) {
          newMaxSpirit = Math.max(1, newMaxSpirit + questCode.reward_max_spirituality)
          updates.max_spirituality = newMaxSpirit
        }

        // Adjust current values (supports negative; clamp 0 .. max)
        if ((questCode.reward_hp || 0) !== 0) {
          updates.hp = Math.max(0, (profile.hp ?? 0) + questCode.reward_hp)
        }
        if ((questCode.reward_sanity || 0) !== 0) {
          updates.sanity = Math.min(newMaxSanity, Math.max(0, (profile.sanity ?? 0) + questCode.reward_sanity))
        }
        if ((questCode.reward_travel || 0) !== 0) {
          updates.travel_points = Math.min(newMaxTravel, Math.max(0, (profile.travel_points ?? 0) + questCode.reward_travel))
        }
        if ((questCode.reward_spirituality || 0) !== 0) {
          updates.spirituality = Math.min(newMaxSpirit, Math.max(0, (profile.spirituality ?? 0) + questCode.reward_spirituality))
        }

        if (Object.keys(updates).length > 0) {
          await supabase.from('profiles').update(updates).eq('id', submission.player_id)
        }
      }
    }
  }

  // Broadcast instant refresh to player's submission list + punishment banner
  await Promise.all([
    broadcastAQRefresh(supabase, 'quests', { player_id: submission.player_id }),
    broadcastPunishmentRefresh(supabase, [submission.player_id]),
  ])

  // Notification: ส่งให้ผู้เล่นเท่านั้น (admin ไม่รับการแจ้งเตือนนี้)
  const adminName = await getDisplayName(supabase, user.id)
  await createNotification(supabase, {
    targetUserId: submission.player_id,
    actorId: user.id,
    actorName: adminName,
    type: 'quest_approved',
    title: `ภารกิจ "${questCode?.name ?? 'ภารกิจ'}" ได้รับการอนุมัติแล้ว!`,
    link: '/dashboard/action-quest/quests',
  })

  revalidateActionQuestPaths()
  return { success: true }
}

export async function rejectQuestSubmission(id: string, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }
  if (!reason?.trim()) return { error: 'กรุณาระบุเหตุผลการปฏิเสธ' }

  // Fetch submission to get player_id for broadcast
  const { data: qSub } = await supabase
    .from('quest_submissions')
    .select('id, player_id')
    .eq('id', id)
    .eq('status', 'pending')
    .single()

  if (!qSub) return { error: 'ไม่พบคำขอหรือคำขอถูกดำเนินการแล้ว' }

  const { error } = await supabase
    .from('quest_submissions')
    .update({
      status: 'rejected',
      rejection_reason: reason.trim(),
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')

  if (error) return { error: error.message }

  // Broadcast so player sees rejection instantly
  await broadcastAQRefresh(supabase, 'quests', { player_id: qSub.player_id })

  // Notification: player sees quest rejected
  const adminName = await getDisplayName(supabase, user.id)
  await createNotification(supabase, {
    targetUserId: qSub.player_id,
    actorId: user.id,
    actorName: adminName,
    type: 'quest_rejected',
    title: 'ภารกิจถูกปฏิเสธ',
    message: `เหตุผล: ${reason.trim()}`,
    link: '/dashboard/action-quest/quests',
  })

  revalidateActionQuestPaths()
  return { success: true }
}

export async function submitRoleplayLinks(urls: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const list = (urls || []).map(u => u.trim()).filter(Boolean)
  if (list.length === 0) return { error: 'กรุณาแนบ URL อย่างน้อย 1 ลิงก์' }

  const today = new Date().toISOString().slice(0, 10)
  const { data: existing } = await supabase
    .from('roleplay_submissions')
    .select('id')
    .eq('player_id', user.id)
    .eq('submitted_date', today)
    .maybeSingle()

  if (existing) return { error: 'วันนี้คุณส่งสวมบทบาทไปแล้ว' }

  const { data: submission, error: subErr } = await supabase
    .from('roleplay_submissions')
    .insert({ player_id: user.id })
    .select('id')
    .single()

  if (subErr || !submission) return { error: subErr?.message || 'ไม่สามารถบันทึกได้' }

  const linkRows = list.map(url => ({ submission_id: submission.id, url }))
  const { error: linkErr } = await supabase.from('roleplay_links').insert(linkRows)
  if (linkErr) return { error: linkErr.message }

  revalidateActionQuestPaths()
  return { success: true }
}

export async function getRoleplaySubmissions(page: number = 1) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { submissions: [], total: 0 }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'dm'
  const offset = (page - 1) * PAGE_SIZE
  let countQ = supabase.from('roleplay_submissions').select('id', { count: 'exact', head: true })
  if (!isAdmin) countQ = countQ.eq('player_id', user.id)
  const { count } = await countQ

  let dataQ = supabase.from('roleplay_submissions')
    .select('id, player_id, created_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)
  if (!isAdmin) dataQ = dataQ.eq('player_id', user.id)
  const { data, error } = await dataQ

  if (error) return { submissions: [], total: 0 }
  const rows = data || []

  const playerIds = [...new Set(rows.map(r => r.player_id).filter(Boolean))]
  const { data: ppData } = playerIds.length > 0
    ? await supabase
      .from('player_pathways')
      .select('player_id, sequence:skill_sequences(id, name, seq_number)')
      .in('player_id', playerIds)
    : { data: [] }
  const playerSequenceMap = new Map<string, { seq_number: number; name: string }[]>()
  for (const row of (ppData || []) as Array<{ player_id: string; sequence: { seq_number: number; name: string }[] | { seq_number: number; name: string } | null }>) {
    const rawSequence = row.sequence
    const sequenceList = Array.isArray(rawSequence) ? rawSequence : rawSequence ? [rawSequence] : []
    if (sequenceList.length === 0) continue
    const list = playerSequenceMap.get(row.player_id) || []
    for (const seq of sequenceList) {
      list.push({ seq_number: seq.seq_number, name: seq.name })
    }
    playerSequenceMap.set(row.player_id, list)
  }

  const submissionIds = rows.map(r => r.id)
  const { data: linkRows } = submissionIds.length > 0
    ? await supabase
      .from('roleplay_links')
      .select('id, submission_id, url, digest_level, digest_percent, digest_note, reviewed_at, reviewed_by')
      .in('submission_id', submissionIds)
    : { data: [] }

  const reviewerIds = [...new Set((linkRows || []).map(l => l.reviewed_by).filter(Boolean))]
  const profileIds = [...new Set([...playerIds, ...reviewerIds])]
  const { data: profiles } = profileIds.length > 0
    ? await supabase.from('profiles').select('id, display_name, avatar_url').in('id', profileIds)
    : { data: [] }
  const profileMap = new Map((profiles || []).map(p => [p.id, p]))

  const linksBySubmission = new Map<string, Array<{ id: string; url: string; digest_level: string; digest_percent: number; digest_note: string | null; reviewed_at: string | null; reviewed_by_name: string | null }>>()
  for (const link of (linkRows || []) as Array<{ id: string; submission_id: string; url: string; digest_level: string; digest_percent: number | null; digest_note: string | null; reviewed_at: string | null; reviewed_by: string | null }>) {
    const reviewer = link.reviewed_by ? profileMap.get(link.reviewed_by) : null
    const list = linksBySubmission.get(link.submission_id) || []
    list.push({
      id: link.id,
      url: link.url,
      digest_level: link.digest_level,
      digest_percent: link.digest_percent || 0,
      digest_note: link.digest_note || null,
      reviewed_by_name: reviewer?.display_name || null,
      reviewed_at: link.reviewed_at,
    })
    linksBySubmission.set(link.submission_id, list)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submissions = rows.map((r: any) => {
    const player = profileMap.get(r.player_id)
    const links = linksBySubmission.get(r.id) || []
    return {
      id: r.id,
      player_id: r.player_id,
      player_name: player?.display_name || 'ไม่ทราบชื่อ',
      player_avatar: player?.avatar_url || null,
      created_at: r.created_at,
      sequence_labels: Array.from(new Set((playerSequenceMap.get(r.player_id) || [])
        .filter(seq => seq?.name)
        .map(seq => `#${seq.seq_number} ${seq.name}`))),
      links,
    }
  })

  return { submissions, total: count || 0, page, totalPages: Math.ceil((count || 0) / PAGE_SIZE), isAdmin }
}

function getDigestPercent(level: string) {
  if (level === 'low') return 2
  if (level === 'medium') return 10
  if (level === 'high') return 25
  return 0
}

export async function reviewRoleplayLink(linkId: string, level: string, note: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }
  if (!note?.trim()) return { error: 'กรุณาระบุหมายเหตุ' }
  if (!['none', 'low', 'medium', 'high'].includes(level)) return { error: 'ระดับไม่ถูกต้อง' }

  const { data: link } = await supabase
    .from('roleplay_links')
    .select('id, digest_level, submission_id')
    .eq('id', linkId)
    .single()

  if (!link) return { error: 'ไม่พบลิงก์' }
  if (link.digest_level !== 'pending') return { error: 'ลิงก์นี้ถูกตรวจแล้ว' }

  const percent = getDigestPercent(level)
  const { error: updErr } = await supabase
    .from('roleplay_links')
    .update({
      digest_level: level,
      digest_percent: percent,
      digest_note: note.trim(),
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', linkId)

  if (updErr) return { error: updErr.message }

  const { data: submission } = await supabase
    .from('roleplay_submissions')
    .select('player_id')
    .eq('id', link.submission_id)
    .maybeSingle()

  const playerId = submission?.player_id
  if (playerId && percent > 0) {
    const { data: prof } = await supabase.from('profiles').select('potion_digest_progress').eq('id', playerId).single()
    const current = prof?.potion_digest_progress ?? 0
    if (current < 100) {
      const next = Math.min(100, current + percent)
      await supabase.from('profiles').update({ potion_digest_progress: next }).eq('id', playerId)
    }
  }

  // Notification: player sees roleplay reviewed
  if (playerId) {
    const levelLabel = level === 'high' ? 'สูง' : level === 'medium' ? 'กลาง' : level === 'low' ? 'ต่ำ' : 'ไม่ผ่าน'
    const adminName = await getDisplayName(supabase, user.id)
    await createNotification(supabase, {
      targetUserId: playerId,
      actorId: user.id,
      actorName: adminName,
      type: 'roleplay_reviewed',
      title: `สวมบทบาทได้รับการตรวจ (ระดับ${levelLabel})`,
      message: percent > 0 ? `พลังย่อย +${percent}%` : undefined,
      link: '/dashboard/action-quest/roleplay',
    })
  }

  revalidateActionQuestPaths()
  revalidatePath('/dashboard')
  return { success: true }
}

export async function getPotionDigestStatus() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { progress: 0 }
  const { data: profile } = await supabase.from('profiles').select('potion_digest_progress').eq('id', user.id).single()
  return { progress: profile?.potion_digest_progress ?? 0 }
}

export async function promotePotionDigest() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('profiles').select('potion_digest_progress').eq('id', user.id).single()
  if (!profile || (profile.potion_digest_progress ?? 0) < 100) return { error: 'ความคืบหน้ายังไม่ครบ 100%' }

  const { data: pathway } = await supabase
    .from('player_pathways')
    .select('id, pathway_id, sequence_id')
    .eq('player_id', user.id)
    .not('pathway_id', 'is', null)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!pathway?.pathway_id) return { error: 'ยังไม่มีสายพลังเวทมนตร์' }

  const { data: sequences } = await supabase
    .from('skill_sequences')
    .select('id, seq_number, name')
    .eq('pathway_id', pathway.pathway_id)
    .order('seq_number', { ascending: true })

  if (!sequences || sequences.length === 0) return { error: 'ไม่พบลำดับขั้นในสายนี้' }

  if (!pathway.sequence_id) return { error: 'ยังไม่มีลำดับขั้น' }
  const currentSeq = sequences.find(s => s.id === pathway.sequence_id)
  if (!currentSeq) return { error: 'ไม่พบลำดับขั้นปัจจุบัน' }
  const nextSequence = sequences
    .filter(s => s.seq_number < currentSeq.seq_number)
    .sort((a, b) => b.seq_number - a.seq_number)[0]
  if (!nextSequence) return { error: 'อยู่ขั้นสูงสุดแล้ว' }

  const { data: updatedRows, error: updErr } = await supabase
    .from('player_pathways')
    .update({ sequence_id: nextSequence.id })
    .eq('id', pathway.id)
    .eq('player_id', user.id)
    .select('id')

  if (updErr) return { error: updErr.message }
  if (!updatedRows || updatedRows.length === 0) return { error: 'ไม่สามารถอัปเดตลำดับได้ (สิทธิ์ไม่เพียงพอ)' }

  await supabase.from('profiles').update({ potion_digest_progress: 0 }).eq('id', user.id)

  revalidatePath('/dashboard')
  revalidateActionQuestPaths()
  revalidatePath('/dashboard/players')
  return { success: true, newSeqNumber: nextSequence.seq_number, newSeqName: nextSequence.name }
}


/* ══════════════════════════════════════════════
   SLEEP REQUEST LOGS (for history tab)
   ══════════════════════════════════════════════ */

export async function getSleepLogs(page: number = 1) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { logs: [], total: 0 }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'dm'
  const offset = (page - 1) * PAGE_SIZE

  // Use foreign key joins to get player and reviewer info in one query
  const selectFields = `
    id, player_id, meal_url, sleep_url, status, reviewed_by, reviewed_at, created_at,
    player:player_id(id, display_name, avatar_url),
    reviewer:reviewed_by(id, display_name, avatar_url)
  `

  let countQ = supabase.from('sleep_requests').select('id', { count: 'exact', head: true })
  if (!isAdmin) countQ = countQ.eq('player_id', user.id)
  const { count } = await countQ

  let dataQ = supabase.from('sleep_requests').select(selectFields)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)
  if (!isAdmin) dataQ = dataQ.eq('player_id', user.id)
  const { data, error } = await dataQ

  if (error) return { logs: [], total: 0 }
  const rows = data || []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs = rows.map((r: any) => {
    const player = r.player
    const reviewer = r.reviewer
    return {
      id: r.id,
      player_id: r.player_id,
      player_name: player?.display_name || 'ไม่ทราบชื่อ',
      player_avatar: player?.avatar_url || null,
      meal_url: r.meal_url,
      sleep_url: r.sleep_url,
      status: r.status as string,
      reviewed_by_name: reviewer?.display_name || null,
      reviewed_at: r.reviewed_at,
      created_at: r.created_at,
    }
  })

  return { logs, total: count || 0, page, totalPages: Math.ceil((count || 0) / PAGE_SIZE), isAdmin }
}


/* ══════════════════════════════════════════════
   PUNISHMENT SYSTEM — บทลงโทษ
   ══════════════════════════════════════════════ */

export async function getPlayersForDropdown() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  if (!(await requireAdmin(supabase, user.id))) return []

  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, role')
    .order('display_name', { ascending: true })

  return (data ?? []).filter(p => p.role === 'player').map(p => ({
    id: p.id,
    display_name: p.display_name || 'Unnamed',
    avatar_url: p.avatar_url,
  }))
}

export async function getAllActionAndQuestCodes() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { actions: [], quests: [] }
  if (!(await requireAdmin(supabase, user.id))) return { actions: [], quests: [] }

  const { data: actions } = await supabase
    .from('action_codes')
    .select('id, name, code')
    .or('archived.is.null,archived.eq.false')
    .order('created_at', { ascending: false })

  const { data: quests } = await supabase
    .from('quest_codes')
    .select('id, name, code')
    .or('archived.is.null,archived.eq.false')
    .order('created_at', { ascending: false })

  return {
    actions: (actions ?? []).map(a => ({ id: a.id, name: a.name, code: a.code, type: 'action' as const })),
    quests: (quests ?? []).map(q => ({ id: q.id, name: q.name, code: q.code, type: 'quest' as const })),
  }
}

export interface PunishmentInput {
  name: string
  description?: string
  event_mode?: 'solo' | 'group'
  group_mode?: 'all' | 'shared'
  penalty_sanity?: number
  penalty_hp?: number
  penalty_travel?: number
  penalty_spirituality?: number
  penalty_max_sanity?: number
  penalty_max_travel?: number
  penalty_max_spirituality?: number
  deadline?: string | null
  required_task_ids: { action_code_id?: string; quest_code_id?: string }[]
  player_ids: string[]
}

export async function createPunishment(input: PunishmentInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }

  if (!input.name?.trim()) return { error: 'กรุณากรอกชื่อเหตุการณ์' }
  if (input.required_task_ids.length === 0) return { error: 'กรุณาเลือกแอคชั่น/ภารกิจที่ต้องทำอย่างน้อย 1 รายการ' }
  if (input.player_ids.length === 0) return { error: 'กรุณาเลือกผู้เล่นอย่างน้อย 1 คน' }

  const eventMode = input.event_mode === 'group' ? 'group' : 'solo'
  const groupMode = input.group_mode === 'shared' ? 'shared' : 'all'

  // Create punishment
  const { data: punishment, error: pErr } = await supabase
    .from('punishments')
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      event_mode: eventMode,
      group_mode: groupMode,
      penalty_sanity: input.penalty_sanity || 0,
      penalty_hp: input.penalty_hp || 0,
      penalty_travel: input.penalty_travel || 0,
      penalty_spirituality: input.penalty_spirituality || 0,
      penalty_max_sanity: input.penalty_max_sanity || 0,
      penalty_max_travel: input.penalty_max_travel || 0,
      penalty_max_spirituality: input.penalty_max_spirituality || 0,
      deadline: input.deadline || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (pErr || !punishment) return { error: pErr?.message || 'ไม่สามารถสร้างเหตุการณ์ได้' }

  // Insert required tasks
  const taskInserts = input.required_task_ids.map(t => ({
    punishment_id: punishment.id,
    action_code_id: t.action_code_id || null,
    quest_code_id: t.quest_code_id || null,
  }))
  const { data: taskData, error: tErr } = await supabase.from('punishment_required_tasks').insert(taskInserts).select()
  if (tErr) return { error: tErr.message }
  if (!taskData || taskData.length === 0) return { error: 'ไม่สามารถบันทึกภารกิจได้ (RLS blocked)' }

  // Insert assigned players
  const playerInserts = input.player_ids.map(pid => ({
    punishment_id: punishment.id,
    player_id: pid,
  }))
  const { data: ppData, error: ppErr } = await supabase.from('punishment_players').insert(playerInserts).select()
  if (ppErr) return { error: ppErr.message }
  if (!ppData || ppData.length === 0) return { error: 'ไม่สามารถบันทึกผู้เล่นได้ (RLS blocked) — กรุณารัน SQL migration ใหม่' }

  // Log creation
  for (const pid of input.player_ids) {
    await supabase.from('punishment_logs').insert({
      punishment_id: punishment.id,
      player_id: pid,
      action: 'assigned',
      details: { punishment_name: punishment.name },
      created_by: user.id,
    })
  }

  // Broadcast instant notification to all assigned players
  await broadcastPunishmentRefresh(supabase, input.player_ids)

  // Notification: each assigned player gets notified
  const adminName = await getDisplayName(supabase, user.id)
  await createNotifications(supabase, input.player_ids.map(pid => ({
    targetUserId: pid,
    actorId: user.id,
    actorName: adminName,
    type: 'punishment_assigned',
    title: `คุณถูกมอบหมายเหตุการณ์ "${punishment.name}"`,
    message: 'ทำภารกิจให้ครบเพื่อส่งเหตุการณ์',
    link: '/dashboard/action-quest/punishments',
  })))

  revalidateActionQuestPaths()

  // 🔔 Discord notification — แจ้งเตือนการลงโทษ
  if (input.player_ids.length > 0) {
    // Fetch player names for the notification
    const { data: playerProfiles } = await supabase
      .from('profiles')
      .select('display_name')
      .in('id', input.player_ids)
    const playerNames = (playerProfiles ?? []).map(p => p.display_name || 'ผู้เล่น').join(', ')
    notifyNewPunishment({
      targetPlayerName: playerNames,
      reason: punishment.description || punishment.name,
      creatorName: adminName,
      penaltyHp: punishment.penalty_hp || null,
      penaltySanity: punishment.penalty_sanity || null,
      taskDescription: input.required_task_ids.length > 0 ? `ต้องทำภารกิจ ${input.required_task_ids.length} รายการ` : null,
      expiresAt: punishment.deadline ?? null,
    }).catch(() => {})
  }

  return { success: true, punishmentId: punishment.id }
}

export async function getPunishments(page: number = 1) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { punishments: [], total: 0 }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'dm'
  const offset = (page - 1) * PAGE_SIZE

  let countQ, dataQ

  if (isAdmin) {
    countQ = supabase.from('punishments').select('id', { count: 'exact', head: true })
      .or('archived.is.null,archived.eq.false')
    dataQ = supabase.from('punishments').select('id, name, description, event_mode, group_mode, penalty_hp, penalty_sanity, penalty_travel, penalty_spirituality, penalty_max_sanity, penalty_max_travel, penalty_max_spirituality, deadline, is_active, created_by, created_at')
      .or('archived.is.null,archived.eq.false')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
  } else {
    // Player: only see punishments assigned to them
    const { data: myPunishmentIds } = await supabase
      .from('punishment_players')
      .select('punishment_id')
      .eq('player_id', user.id)

    const pIds = (myPunishmentIds ?? []).map(p => p.punishment_id)
    if (pIds.length === 0) return { punishments: [], total: 0, page: 1, totalPages: 1 }

    countQ = supabase.from('punishments').select('id', { count: 'exact', head: true }).in('id', pIds)
      .or('archived.is.null,archived.eq.false')
    dataQ = supabase.from('punishments').select('id, name, description, event_mode, group_mode, penalty_hp, penalty_sanity, penalty_travel, penalty_spirituality, penalty_max_sanity, penalty_max_travel, penalty_max_spirituality, deadline, is_active, created_by, created_at')
      .in('id', pIds)
      .or('archived.is.null,archived.eq.false')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
  }

  const { count } = await countQ
  const { data, error } = await dataQ
  if (error) return { punishments: [], total: 0 }

  // Fetch related data
  const punishmentIds = (data ?? []).map(p => p.id)

  // Get required tasks
  const { data: tasks } = punishmentIds.length > 0
    ? await supabase.from('punishment_required_tasks')
        .select('*, action_code:action_code_id(id, name, code), quest_code:quest_code_id(id, name, code)')
        .in('punishment_id', punishmentIds)
    : { data: [] }

  // Get assigned players
  const { data: players } = punishmentIds.length > 0
    ? await supabase.from('punishment_players')
        .select('*, player:player_id(id, display_name, avatar_url)')
        .in('punishment_id', punishmentIds)
    : { data: [] }

  // Get creator names
  const creatorIds = [...new Set((data ?? []).map(p => p.created_by))]
  const { data: profiles } = creatorIds.length > 0
    ? await supabase.from('profiles').select('id, display_name').in('id', creatorIds)
    : { data: [] }
  const pMap = new Map((profiles ?? []).map(p => [p.id, p.display_name]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const punishments = (data ?? []).map((p: any) => ({
    ...p,
    created_by_name: pMap.get(p.created_by) || 'ไม่ทราบ',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    required_tasks: (tasks ?? []).filter((t: any) => t.punishment_id === p.id).map((t: any) => ({
      id: t.id,
      action_code_id: t.action_code_id,
      quest_code_id: t.quest_code_id,
      action_name: t.action_code?.name || null,
      action_code_str: t.action_code?.code || null,
      quest_name: t.quest_code?.name || null,
      quest_code_str: t.quest_code?.code || null,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assigned_players: (players ?? []).filter((pp: any) => pp.punishment_id === p.id).map((pp: any) => ({
      id: pp.id,
      player_id: pp.player_id,
      player_name: pp.player?.display_name || 'ไม่ทราบ',
      player_avatar: pp.player?.avatar_url || null,
      is_completed: pp.is_completed,
      penalty_applied: pp.penalty_applied,
      mercy_requested: pp.mercy_requested,
      mercy_requested_at: pp.mercy_requested_at,
      completed_at: pp.completed_at,
    })),
  }))

  return { punishments, total: count || 0, page, totalPages: Math.ceil((count || 0) / PAGE_SIZE), isAdmin }
}

export async function requestMercy(punishmentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Find the punishment player entry
  const { data: pp } = await supabase
    .from('punishment_players')
    .select('id, is_completed, penalty_applied, mercy_requested, punishment_id')
    .eq('punishment_id', punishmentId)
    .eq('player_id', user.id)
    .single()

  if (!pp) return { error: 'คุณไม่ได้ถูกกำหนดให้รับเหตุการณ์นี้' }
  if (pp.penalty_applied) return { error: 'เหตุการณ์ถูกดำเนินการแล้ว' }
  if (pp.mercy_requested) return { error: 'คุณส่งเหตุการณ์ไปแล้ว' }

  const { data: punishment } = await supabase
    .from('punishments')
    .select('id, event_mode, group_mode, primary_submitter_id, created_at')
    .eq('id', punishmentId)
    .single()

  if (!punishment) return { error: 'ไม่พบเหตุการณ์' }

  const isGroupShared = punishment.event_mode === 'group' && punishment.group_mode === 'shared'

  if (isGroupShared) {
    // Use RPC to check completion (bypasses RLS — can see all players' submissions)
    const { data: rpcResult } = await supabase.rpc('check_punishment_task_completion', {
      p_punishment_id: punishmentId,
      p_user_id: user.id,
    })

    if (!rpcResult || !rpcResult.allCompleted) {
      return { error: 'ภารกิจร่วมยังไม่ครบ หรือยังไม่ได้รับอนุมัติ' }
    }

    // Use SECURITY DEFINER RPC to mark ALL players as completed (bypasses RLS)
    const { data: rpcComplete, error: rpcErr } = await supabase.rpc('complete_shared_punishment', {
      p_punishment_id: punishmentId,
      p_submitted_by: user.id,
    })

    if (rpcErr) return { error: rpcErr.message }

    revalidateActionQuestPaths()
    return { success: true, primary_submitter_id: user.id }
  }

  // Solo / group-all: use RPC to validate task completion
  const { data: soloCheck } = await supabase.rpc('check_punishment_task_completion', {
    p_punishment_id: punishmentId,
    p_user_id: user.id,
  })

  if (!soloCheck || !soloCheck.allCompleted) {
    return { error: 'คุณยังทำแอคชั่น/ภารกิจที่กำหนดไม่ครบ หรือยังไม่ได้รับอนุมัติ' }
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('punishment_players')
    .update({
      mercy_requested: true,
      mercy_requested_at: now,
      is_completed: true,
      completed_at: now,
    })
    .eq('id', pp.id)

  if (error) return { error: error.message }

  await supabase.from('punishment_logs').insert({
    punishment_id: punishmentId,
    player_id: user.id,
    action: 'mercy_requested',
    details: { mode: punishment.event_mode === 'group' ? 'group_all' : 'solo' },
    created_by: user.id,
  })

  // Notification: admin sees mercy request
  const actorName = await getDisplayName(supabase, user.id)
  await createNotification(supabase, {
    targetUserId: null,
    actorId: user.id,
    actorName,
    type: 'punishment_submitted',
    title: `${actorName} ส่งเหตุการณ์เรียบร้อยแล้ว`,
    message: 'ผู้เล่นทำภารกิจครบและส่งเหตุการณ์แล้ว',
    link: '/dashboard/action-quest/punishments',
  })

  revalidateActionQuestPaths()
  return { success: true }
}

export async function applyPenalty(punishmentId: string, playerId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }

  const { data: punishment } = await supabase
    .from('punishments')
    .select('id, name, penalty_hp, penalty_sanity, penalty_travel, penalty_spirituality, penalty_max_sanity, penalty_max_travel, penalty_max_spirituality')
    .eq('id', punishmentId)
    .single()

  if (!punishment) return { error: 'ไม่พบเหตุการณ์' }

  const { data: pp } = await supabase
    .from('punishment_players')
    .select('id, penalty_applied')
    .eq('punishment_id', punishmentId)
    .eq('player_id', playerId)
    .single()

  if (!pp) return { error: 'ไม่พบผู้เล่นในเหตุการณ์นี้' }
  if (pp.penalty_applied) return { error: 'เหตุการณ์ถูกดำเนินการไปแล้ว' }

  // Get player's current stats
  const { data: profile } = await supabase
    .from('profiles')
    .select('hp, sanity, max_sanity, travel_points, max_travel_points, spirituality, max_spirituality')
    .eq('id', playerId)
    .single()

  if (!profile) return { error: 'ไม่พบโปรไฟล์ผู้เล่น' }

  // Apply penalties
  const updates: Record<string, number> = {}

  // Reduce max values first
  if (punishment.penalty_max_sanity > 0) {
    updates.max_sanity = Math.max(0, (profile.max_sanity ?? 10) - punishment.penalty_max_sanity)
  }
  if (punishment.penalty_max_travel > 0) {
    updates.max_travel_points = Math.max(0, (profile.max_travel_points ?? 10) - punishment.penalty_max_travel)
  }
  if (punishment.penalty_max_spirituality > 0) {
    updates.max_spirituality = Math.max(0, (profile.max_spirituality ?? 10) - punishment.penalty_max_spirituality)
  }

  // Reduce current values (clamped to 0, and to new max if max was reduced)
  const newMaxSanity = updates.max_sanity ?? profile.max_sanity ?? 10
  const newMaxTravel = updates.max_travel_points ?? profile.max_travel_points ?? 10
  const newMaxSpirit = updates.max_spirituality ?? profile.max_spirituality ?? 10

  if (punishment.penalty_sanity > 0) {
    updates.sanity = Math.max(0, Math.min(newMaxSanity, (profile.sanity ?? 0) - punishment.penalty_sanity))
  }
  if (punishment.penalty_hp > 0) {
    updates.hp = Math.max(0, (profile.hp ?? 0) - punishment.penalty_hp)
  }
  if (punishment.penalty_travel > 0) {
    updates.travel_points = Math.max(0, Math.min(newMaxTravel, (profile.travel_points ?? 0) - punishment.penalty_travel))
  }
  if (punishment.penalty_spirituality > 0) {
    updates.spirituality = Math.max(0, Math.min(newMaxSpirit, (profile.spirituality ?? 0) - punishment.penalty_spirituality))
  }

  // Clamp current values to new max
  if (updates.max_sanity !== undefined && !updates.sanity) {
    updates.sanity = Math.min(newMaxSanity, profile.sanity ?? 0)
  }
  if (updates.max_travel_points !== undefined && !updates.travel_points) {
    updates.travel_points = Math.min(newMaxTravel, profile.travel_points ?? 0)
  }
  if (updates.max_spirituality !== undefined && !updates.spirituality) {
    updates.spirituality = Math.min(newMaxSpirit, profile.spirituality ?? 0)
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from('profiles').update(updates).eq('id', playerId)
  }

  // Mark penalty applied
  await supabase.from('punishment_players')
    .update({ penalty_applied: true })
    .eq('id', pp.id)

  // Log
  await supabase.from('punishment_logs').insert({
    punishment_id: punishmentId,
    player_id: playerId,
    action: 'penalty_applied',
    details: {
      penalty_sanity: punishment.penalty_sanity,
      penalty_hp: punishment.penalty_hp,
      penalty_travel: punishment.penalty_travel,
      penalty_spirituality: punishment.penalty_spirituality,
      penalty_max_sanity: punishment.penalty_max_sanity,
      penalty_max_travel: punishment.penalty_max_travel,
      penalty_max_spirituality: punishment.penalty_max_spirituality,
    },
    created_by: user.id,
  })

  // Notification: player sees penalty applied
  const adminName = await getDisplayName(supabase, user.id)
  await createNotification(supabase, {
    targetUserId: playerId,
    actorId: user.id,
    actorName: adminName,
    type: 'penalty_applied',
    title: `ดำเนินการจากเหตุการณ์ "${punishment.name}"`,
    message: 'สถานะของคุณถูกปรับแล้ว',
    link: '/dashboard/action-quest/punishments',
  })

  revalidateActionQuestPaths()
  return { success: true }
}

export async function getPunishmentLogs(page: number = 1) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { logs: [], total: 0 }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'dm'
  const offset = (page - 1) * PAGE_SIZE

  const selectFields = `
    *,
    player:player_id(id, display_name, avatar_url),
    punishment:punishment_id(id, name),
    actor:created_by(id, display_name)
  `

  let countQ = supabase.from('punishment_logs').select('*', { count: 'exact', head: true })
  if (!isAdmin) countQ = countQ.eq('player_id', user.id)
  const { count } = await countQ

  let dataQ = supabase.from('punishment_logs').select(selectFields)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)
  if (!isAdmin) dataQ = dataQ.eq('player_id', user.id)
  const { data, error } = await dataQ

  if (error) return { logs: [], total: 0 }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs = (data ?? []).map((r: any) => ({
    id: r.id,
    punishment_id: r.punishment_id,
    punishment_name: r.punishment?.name || '—',
    player_id: r.player_id,
    player_name: r.player?.display_name || 'ไม่ทราบ',
    player_avatar: r.player?.avatar_url || null,
    action: r.action,
    details: r.details || {},
    created_by_name: r.actor?.display_name || null,
    created_at: r.created_at,
  }))

  return { logs, total: count || 0, page, totalPages: Math.ceil((count || 0) / PAGE_SIZE) }
}

export async function checkPlayerTaskCompletion(punishmentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { allCompleted: false, done: 0, total: 0 }

  // Use SECURITY DEFINER RPC to bypass RLS — ensures shared mode sees all players' submissions
  const { data, error } = await supabase.rpc('check_punishment_task_completion', {
    p_punishment_id: punishmentId,
    p_user_id: user.id,
  })

  if (error || !data) return { allCompleted: false, done: 0, total: 0 }

  return {
    allCompleted: data.allCompleted === true,
    done: data.done ?? 0,
    total: data.total ?? 0,
  }
}


/* ══════════════════════════════════════════════
   EDIT ACTION CODE — แก้ไขโค้ดแอคชั่น
   ══════════════════════════════════════════════ */

export async function updateActionCode(
  id: string,
  name: string,
  rewards?: ActionRewards,
  expiration?: CodeExpiration
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }
  if (!name?.trim()) return { error: 'กรุณากรอกชื่อแอคชั่น' }

  const updateData: Record<string, unknown> = {
    name: name.trim(),
    reward_hp: rewards?.reward_hp || 0,
    reward_sanity: rewards?.reward_sanity || 0,
    reward_travel: rewards?.reward_travel || 0,
    reward_spirituality: rewards?.reward_spirituality || 0,
    reward_max_sanity: rewards?.reward_max_sanity || 0,
    reward_max_travel: rewards?.reward_max_travel || 0,
    reward_max_spirituality: rewards?.reward_max_spirituality || 0,
    expires_at: expiration?.expires_at || null,
    max_repeats: expiration?.max_repeats ?? null,
  }

  const { error } = await supabase
    .from('action_codes')
    .update(updateData)
    .eq('id', id)

  if (error) return { error: error.message }
  revalidateActionQuestPaths()
  return { success: true }
}


/* ══════════════════════════════════════════════
   EDIT QUEST CODE — แก้ไขโค้ดภารกิจ
   ══════════════════════════════════════════════ */

export async function updateQuestCode(
  id: string,
  name: string,
  mapId?: string | null,
  npcTokenId?: string | null,
  expiration?: CodeExpiration,
  rewards?: ActionRewards
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }
  if (!name?.trim()) return { error: 'กรุณากรอกชื่อภารกิจ' }

  // If NPC selected, auto-fill map and validate radius
  let resolvedMapId = mapId || null
  if (npcTokenId) {
    const { data: npcToken } = await supabase
      .from('map_tokens')
      .select('map_id, interaction_radius')
      .eq('id', npcTokenId)
      .eq('token_type', 'npc')
      .single()
    if (!npcToken) return { error: 'ไม่พบ NPC นี้ในระบบ' }
    if (npcToken.interaction_radius <= 0) return { error: 'NPC นี้ยังไม่ได้กำหนดเขตทำการ กรุณาตั้งค่ารัศมีในแมพก่อน' }
    resolvedMapId = npcToken.map_id
  }

  const updateData: Record<string, unknown> = {
    name: name.trim(),
    map_id: resolvedMapId,
    npc_token_id: npcTokenId || null,
    expires_at: expiration?.expires_at || null,
    max_repeats: expiration?.max_repeats ?? null,
    reward_hp: rewards?.reward_hp ?? 0,
    reward_sanity: rewards?.reward_sanity ?? 0,
    reward_travel: rewards?.reward_travel ?? 0,
    reward_spirituality: rewards?.reward_spirituality ?? 0,
    reward_max_sanity: rewards?.reward_max_sanity ?? 0,
    reward_max_travel: rewards?.reward_max_travel ?? 0,
    reward_max_spirituality: rewards?.reward_max_spirituality ?? 0,
  }

  const { error } = await supabase
    .from('quest_codes')
    .update(updateData)
    .eq('id', id)

  if (error) return { error: error.message }
  revalidateActionQuestPaths()
  return { success: true }
}


/* ══════════════════════════════════════════════
   EDIT PUNISHMENT — แก้ไขบทลงโทษ
   ══════════════════════════════════════════════ */

export interface PunishmentUpdateInput {
  name: string
  description?: string
  event_mode?: 'solo' | 'group'
  group_mode?: 'all' | 'shared'
  penalty_sanity?: number
  penalty_hp?: number
  penalty_travel?: number
  penalty_spirituality?: number
  penalty_max_sanity?: number
  penalty_max_travel?: number
  penalty_max_spirituality?: number
  deadline?: string | null
  required_task_ids: { action_code_id?: string; quest_code_id?: string }[]
  player_ids: string[]
}

export async function updatePunishment(id: string, input: PunishmentUpdateInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }

  // Check if punishment exists and deadline hasn't passed
  const { data: existing } = await supabase
    .from('punishments')
    .select('id, deadline')
    .eq('id', id)
    .single()

  if (!existing) return { error: 'ไม่พบเหตุการณ์' }

  // Use server time to check deadline
  const { data: serverTimeResult } = await supabase.rpc('now')
  const serverNow = serverTimeResult ? new Date(serverTimeResult) : new Date()

  if (existing.deadline && new Date(existing.deadline) < serverNow) {
    return { error: 'เหตุการณ์หมดเวลาแล้ว ไม่สามารถแก้ไขได้' }
  }

  if (!input.name?.trim()) return { error: 'กรุณากรอกชื่อเหตุการณ์' }
  if (input.required_task_ids.length === 0) return { error: 'กรุณาเลือกแอคชั่น/ภารกิจอย่างน้อย 1 รายการ' }
  if (input.player_ids.length === 0) return { error: 'กรุณาเลือกผู้เล่นอย่างน้อย 1 คน' }

  // Update main punishment
  const { error: pErr } = await supabase
    .from('punishments')
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      event_mode: input.event_mode === 'group' ? 'group' : 'solo',
      group_mode: input.group_mode === 'shared' ? 'shared' : 'all',
      penalty_sanity: input.penalty_sanity || 0,
      penalty_hp: input.penalty_hp || 0,
      penalty_travel: input.penalty_travel || 0,
      penalty_spirituality: input.penalty_spirituality || 0,
      penalty_max_sanity: input.penalty_max_sanity || 0,
      penalty_max_travel: input.penalty_max_travel || 0,
      penalty_max_spirituality: input.penalty_max_spirituality || 0,
      deadline: input.deadline || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (pErr) return { error: pErr.message }

  // Replace required tasks: delete old, insert new
  await supabase.from('punishment_required_tasks').delete().eq('punishment_id', id)
  const taskInserts = input.required_task_ids.map(t => ({
    punishment_id: id,
    action_code_id: t.action_code_id || null,
    quest_code_id: t.quest_code_id || null,
  }))
  const { data: taskData, error: tErr } = await supabase.from('punishment_required_tasks').insert(taskInserts).select()
  if (tErr) return { error: tErr.message }
  if (!taskData || taskData.length === 0) return { error: 'ไม่สามารถบันทึกภารกิจได้ (RLS blocked)' }

  // Replace assigned players: delete those not in new list, add new ones (keep existing completion states)
  const { data: existingPlayers } = await supabase
    .from('punishment_players')
    .select('id, player_id')
    .eq('punishment_id', id)

  const existingPlayerIds = (existingPlayers ?? []).map(p => p.player_id)
  const toRemove = existingPlayerIds.filter(pid => !input.player_ids.includes(pid))
  const toAdd = input.player_ids.filter(pid => !existingPlayerIds.includes(pid))

  if (toRemove.length > 0) {
    await supabase.from('punishment_players').delete()
      .eq('punishment_id', id)
      .in('player_id', toRemove)
  }
  if (toAdd.length > 0) {
    const playerInserts = toAdd.map(pid => ({ punishment_id: id, player_id: pid }))
    const { data: ppData, error: ppAddErr } = await supabase.from('punishment_players').insert(playerInserts).select()
    if (ppAddErr) return { error: ppAddErr.message }
    if (!ppData || ppData.length === 0) return { error: 'ไม่สามารถบันทึกผู้เล่นได้ (RLS blocked)' }
    // Log new assignments
    for (const pid of toAdd) {
      await supabase.from('punishment_logs').insert({
        punishment_id: id,
        player_id: pid,
        action: 'assigned',
        details: { punishment_name: input.name },
        created_by: user.id,
      })
    }
  }

  revalidateActionQuestPaths()
  return { success: true }
}


/* ══════════════════════════════════════════════
   AUTO-APPLY EXPIRED PUNISHMENTS — ลงโทษอัตโนมัติ
   ══════════════════════════════════════════════ */

/**
 * Client-side fallback for auto-applying expired punishment penalties.
 * The PRIMARY mechanism is the pg_cron job `auto_apply_expired_punishments()`
 * running every 15 minutes on Supabase (see supabase/add_punishment_cron.sql).
 * This function serves as an additional safety net when an admin visits the page.
 */
export async function autoApplyExpiredPunishments() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  if (!(await requireAdmin(supabase, user.id))) return

  // Use server time
  const { data: serverTimeResult } = await supabase.rpc('now')
  const serverNow = serverTimeResult ? new Date(serverTimeResult).toISOString() : new Date().toISOString()

  // Find active punishments past deadline
  const { data: expiredPunishments } = await supabase
    .from('punishments')
    .select('id, name, penalty_hp, penalty_sanity, penalty_travel, penalty_spirituality, penalty_max_sanity, penalty_max_travel, penalty_max_spirituality, deadline, is_active')
    .eq('is_active', true)
    .not('deadline', 'is', null)
    .lt('deadline', serverNow)

  if (!expiredPunishments || expiredPunishments.length === 0) return

  for (const punishment of expiredPunishments) {
    // Find players who haven't been penalized and haven't requested mercy
    const { data: pendingPlayers } = await supabase
      .from('punishment_players')
      .select('id, player_id')
      .eq('punishment_id', punishment.id)
      .eq('penalty_applied', false)
      .eq('mercy_requested', false)

    if (!pendingPlayers || pendingPlayers.length === 0) {
      // All players handled — deactivate punishment
      await supabase.from('punishments').update({ is_active: false }).eq('id', punishment.id)
      continue
    }

    for (const pp of pendingPlayers) {
      // Get player's current stats
      const { data: profile } = await supabase
        .from('profiles')
        .select('hp, sanity, max_sanity, travel_points, max_travel_points, spirituality, max_spirituality')
        .eq('id', pp.player_id)
        .single()

      if (!profile) continue

      // Apply penalties (same logic as applyPenalty)
      const updates: Record<string, number> = {}

      if (punishment.penalty_max_sanity > 0) {
        updates.max_sanity = Math.max(0, (profile.max_sanity ?? 10) - punishment.penalty_max_sanity)
      }
      if (punishment.penalty_max_travel > 0) {
        updates.max_travel_points = Math.max(0, (profile.max_travel_points ?? 10) - punishment.penalty_max_travel)
      }
      if (punishment.penalty_max_spirituality > 0) {
        updates.max_spirituality = Math.max(0, (profile.max_spirituality ?? 10) - punishment.penalty_max_spirituality)
      }

      const newMaxSanity = updates.max_sanity ?? profile.max_sanity ?? 10
      const newMaxTravel = updates.max_travel_points ?? profile.max_travel_points ?? 10
      const newMaxSpirit = updates.max_spirituality ?? profile.max_spirituality ?? 10

      if (punishment.penalty_sanity > 0) {
        updates.sanity = Math.max(0, Math.min(newMaxSanity, (profile.sanity ?? 0) - punishment.penalty_sanity))
      }
      if (punishment.penalty_hp > 0) {
        updates.hp = Math.max(0, (profile.hp ?? 0) - punishment.penalty_hp)
      }
      if (punishment.penalty_travel > 0) {
        updates.travel_points = Math.max(0, Math.min(newMaxTravel, (profile.travel_points ?? 0) - punishment.penalty_travel))
      }
      if (punishment.penalty_spirituality > 0) {
        updates.spirituality = Math.max(0, Math.min(newMaxSpirit, (profile.spirituality ?? 0) - punishment.penalty_spirituality))
      }

      if (updates.max_sanity !== undefined && !updates.sanity) {
        updates.sanity = Math.min(newMaxSanity, profile.sanity ?? 0)
      }
      if (updates.max_travel_points !== undefined && !updates.travel_points) {
        updates.travel_points = Math.min(newMaxTravel, profile.travel_points ?? 0)
      }
      if (updates.max_spirituality !== undefined && !updates.spirituality) {
        updates.spirituality = Math.min(newMaxSpirit, profile.spirituality ?? 0)
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('profiles').update(updates).eq('id', pp.player_id)
      }

      // Mark penalty applied
      await supabase.from('punishment_players')
        .update({ penalty_applied: true })
        .eq('id', pp.id)

      // Log auto-penalty
      await supabase.from('punishment_logs').insert({
        punishment_id: punishment.id,
        player_id: pp.player_id,
        action: 'penalty_applied',
        details: {
          auto: true,
          reason: 'หมดเวลาเหตุการณ์ — ดำเนินการอัตโนมัติ',
          penalty_sanity: punishment.penalty_sanity,
          penalty_hp: punishment.penalty_hp,
          penalty_travel: punishment.penalty_travel,
          penalty_spirituality: punishment.penalty_spirituality,
          penalty_max_sanity: punishment.penalty_max_sanity,
          penalty_max_travel: punishment.penalty_max_travel,
          penalty_max_spirituality: punishment.penalty_max_spirituality,
        },
        created_by: user.id,
      })
    }

    // Deactivate punishment after processing
    await supabase.from('punishments').update({ is_active: false }).eq('id', punishment.id)
  }

  revalidateActionQuestPaths()
}


/* ══════════════════════════════════════════════
   GET SERVER TIME — ดึงเวลาจากเซิร์ฟเวอร์
   ══════════════════════════════════════════════ */

export async function getServerTime() {
  const supabase = await createClient()
  const { data } = await supabase.rpc('now')
  return data ? new Date(data).toISOString() : new Date().toISOString()
}


/* ══════════════════════════════════════════════
   ARCHIVE (Soft Delete) — เก็บเข้าคลัง
   ══════════════════════════════════════════════ */

export async function archiveActionCode(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }

  const { error } = await supabase
    .from('action_codes')
    .update({ archived: true })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidateActionQuestPaths()
  return { success: true }
}

export async function archiveQuestCode(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }

  const { error } = await supabase
    .from('quest_codes')
    .update({ archived: true })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidateActionQuestPaths()
  return { success: true }
}

export async function archivePunishment(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }

  const { error } = await supabase
    .from('punishments')
    .update({ archived: true, is_active: false })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidateActionQuestPaths()
  return { success: true }
}


/* ══════════════════════════════════════════════
   PLAYER ACTIVE PUNISHMENTS — บทลงโทษที่กำลังรับ
   ══════════════════════════════════════════════ */

/**
 * Returns active punishments for the current player (for the alert banner).
 * Includes required tasks and codes so the player knows what to do.
 */
export async function getPlayerActivePunishments() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Get punishment_players entries for this user where penalty not yet applied and no mercy
  const { data: myEntries } = await supabase
    .from('punishment_players')
    .select('punishment_id, is_completed, penalty_applied, mercy_requested')
    .eq('player_id', user.id)
    .eq('penalty_applied', false)
    .eq('mercy_requested', false)

  if (!myEntries || myEntries.length === 0) return []

  const punishmentIds = myEntries.map(e => e.punishment_id)

  // Fetch active punishments
  const { data: punishments } = await supabase
    .from('punishments')
    .select('id, name, description, event_mode, group_mode, penalty_hp, penalty_sanity, penalty_travel, penalty_spirituality, penalty_max_sanity, penalty_max_travel, penalty_max_spirituality, deadline, is_active, created_by, created_at')
    .in('id', punishmentIds)
    .eq('is_active', true)
    .or('archived.is.null,archived.eq.false')

  if (!punishments || punishments.length === 0) return []

  // Fetch required tasks with codes
  const pIds = punishments.map(p => p.id)
  const { data: tasks } = await supabase
    .from('punishment_required_tasks')
    .select('*, action_code:action_code_id(id, name, code), quest_code:quest_code_id(id, name, code)')
    .in('punishment_id', pIds)

  const { data: players } = await supabase
    .from('punishment_players')
    .select('punishment_id, player_id, is_completed, mercy_requested')
    .in('punishment_id', pIds)

  const playersByPunishment = new Map<string, Array<{ player_id: string; is_completed: boolean; mercy_requested: boolean }>>()
  for (const row of (players ?? []) as Array<{ punishment_id: string; player_id: string; is_completed: boolean; mercy_requested: boolean }>) {
    const list = playersByPunishment.get(row.punishment_id) ?? []
    list.push({ player_id: row.player_id, is_completed: row.is_completed, mercy_requested: row.mercy_requested })
    playersByPunishment.set(row.punishment_id, list)
  }

  // Use RPC to get progress for each punishment (bypasses RLS for shared mode)
  const progressResults = await Promise.all(
    punishments.map((p: any) =>
      supabase.rpc('check_punishment_task_completion', {
        p_punishment_id: p.id,
        p_user_id: user.id,
      })
    )
  )

  const progressMap = new Map<string, { done: number; total: number }>()
  punishments.forEach((p: any, i: number) => {
    const r = progressResults[i]
    if (r.data) {
      progressMap.set(p.id, { done: r.data.done ?? 0, total: r.data.total ?? 0 })
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return punishments.map((p: any) => {
    const required = (tasks ?? []).filter((t: any) => t.punishment_id === p.id)
    const progress = progressMap.get(p.id) ?? { done: 0, total: required.length }

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      deadline: p.deadline,
      event_mode: p.event_mode,
      group_mode: p.group_mode,
      primary_submitter_id: p.primary_submitter_id || null,
      penalty_sanity: p.penalty_sanity,
      penalty_hp: p.penalty_hp,
      penalty_travel: p.penalty_travel,
      penalty_spirituality: p.penalty_spirituality,
      penalty_max_sanity: p.penalty_max_sanity,
      penalty_max_travel: p.penalty_max_travel,
      penalty_max_spirituality: p.penalty_max_spirituality,
      progress_current: progress.done,
      progress_total: progress.total,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      required_tasks: required.map((t: any) => ({
        id: t.id,
        action_code_id: t.action_code_id,
        quest_code_id: t.quest_code_id,
        action_name: t.action_code?.name || null,
        action_code_str: t.action_code?.code || null,
        quest_name: t.quest_code?.name || null,
        quest_code_str: t.quest_code?.code || null,
      })),
    }
  })
}
