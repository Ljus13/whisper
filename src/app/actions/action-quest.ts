'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
  revalidatePath('/dashboard/action-quest')
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

  revalidatePath('/dashboard/action-quest')
  return { success: true }
}

export async function rejectSleepRequest(requestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }

  const { error } = await supabase
    .from('sleep_requests')
    .update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/action-quest')
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
  revalidatePath('/dashboard/action-quest')
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

export async function generateActionCode(name: string, rewards?: ActionRewards) {
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

  const { data, error } = await supabase
    .from('action_codes')
    .insert(insertData)
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/dashboard/action-quest')
  return { success: true, code: data.code, name: data.name }
}

export async function getActionCodes(page: number = 1) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { codes: [], total: 0 }

  const offset = (page - 1) * PAGE_SIZE

  const { count } = await supabase
    .from('action_codes')
    .select('*', { count: 'exact', head: true })

  const { data, error } = await supabase
    .from('action_codes')
    .select('*')
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

export async function generateQuestCode(name: string, mapId?: string | null, npcTokenId?: string | null) {
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

  const insertData: { name: string; code: string; created_by: string; map_id?: string; npc_token_id?: string } = {
    name: name.trim(), code, created_by: user.id
  }
  if (resolvedMapId) insertData.map_id = resolvedMapId
  if (npcTokenId) insertData.npc_token_id = npcTokenId

  const { data, error } = await supabase
    .from('quest_codes')
    .insert(insertData)
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/dashboard/action-quest')
  return { success: true, code: data.code, name: data.name }
}

export async function getQuestCodes(page: number = 1) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { codes: [], total: 0 }

  const offset = (page - 1) * PAGE_SIZE

  const { count } = await supabase
    .from('quest_codes')
    .select('*', { count: 'exact', head: true })

  const { data, error } = await supabase
    .from('quest_codes')
    .select('*')
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
    .select('id, name')
    .eq('code', codeStr.trim())
    .maybeSingle()

  if (!codeRow) return { error: 'ไม่พบรหัสแอคชั่นนี้ กรุณาตรวจสอบรหัสอีกครั้ง' }

  const cleanUrls = evidenceUrls.filter(u => u.trim()).map(u => u.trim())

  const { error } = await supabase
    .from('action_submissions')
    .insert({
      player_id: user.id,
      action_code_id: codeRow.id,
      evidence_urls: cleanUrls,
    })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/action-quest')
  return { success: true, actionName: codeRow.name }
}

export async function getActionSubmissions(page: number = 1) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { submissions: [], total: 0 }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'dm'
  const offset = (page - 1) * PAGE_SIZE

  // Use foreign key joins to get all related data in one query
  const selectFields = `
    *,
    player:player_id(id, display_name, avatar_url),
    reviewer:reviewed_by(id, display_name, avatar_url),
    action_code:action_code_id(id, name, code, reward_hp, reward_sanity, reward_travel, reward_spirituality, reward_max_sanity, reward_max_travel, reward_max_spirituality)
  `

  let countQ = supabase.from('action_submissions').select('*', { count: 'exact', head: true })
  if (!isAdmin) countQ = countQ.eq('player_id', user.id)
  const { count } = await countQ

  let dataQ = supabase.from('action_submissions').select(selectFields)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)
  if (!isAdmin) dataQ = dataQ.eq('player_id', user.id)
  const { data, error } = await dataQ

  if (error) return { submissions: [], total: 0 }
  const rows = data || []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submissions = rows.map((r: any) => {
    const player = r.player
    const reviewer = r.reviewer
    const code = r.action_code
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
    .select('reward_hp, reward_sanity, reward_travel, reward_spirituality, reward_max_sanity, reward_max_travel, reward_max_spirituality')
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

  revalidatePath('/dashboard/action-quest')
  return { success: true }
}

export async function rejectActionSubmission(id: string, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }
  if (!reason?.trim()) return { error: 'กรุณาระบุเหตุผลการปฏิเสธ' }

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
  revalidatePath('/dashboard/action-quest')
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
    .select('id, name, map_id, npc_token_id')
    .eq('code', codeStr.trim())
    .maybeSingle()

  if (!codeRow) return { error: 'ไม่พบรหัสภารกิจนี้ กรุณาตรวจสอบรหัสอีกครั้ง' }

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
  revalidatePath('/dashboard/action-quest')
  return { success: true, questName: codeRow.name }
}

export async function getQuestSubmissions(page: number = 1) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { submissions: [], total: 0 }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'dm'
  const offset = (page - 1) * PAGE_SIZE

  // Use foreign key joins to get all related data in one query
  const selectFields = `
    *,
    player:player_id(id, display_name, avatar_url),
    reviewer:reviewed_by(id, display_name, avatar_url),
    quest_code:quest_code_id(id, name, code)
  `

  let countQ = supabase.from('quest_submissions').select('*', { count: 'exact', head: true })
  if (!isAdmin) countQ = countQ.eq('player_id', user.id)
  const { count } = await countQ

  let dataQ = supabase.from('quest_submissions').select(selectFields)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)
  if (!isAdmin) dataQ = dataQ.eq('player_id', user.id)
  const { data, error } = await dataQ

  if (error) return { submissions: [], total: 0 }
  const rows = data || []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submissions = rows.map((r: any) => {
    const player = r.player
    const reviewer = r.reviewer
    const code = r.quest_code
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
    }
  })

  return { submissions, total: count || 0, page, totalPages: Math.ceil((count || 0) / PAGE_SIZE), isAdmin }
}

export async function approveQuestSubmission(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }

  const { error } = await supabase
    .from('quest_submissions')
    .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')

  if (error) return { error: error.message }
  revalidatePath('/dashboard/action-quest')
  return { success: true }
}

export async function rejectQuestSubmission(id: string, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }
  if (!reason?.trim()) return { error: 'กรุณาระบุเหตุผลการปฏิเสธ' }

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
  revalidatePath('/dashboard/action-quest')
  return { success: true }
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
    *,
    player:player_id(id, display_name, avatar_url),
    reviewer:reviewed_by(id, display_name, avatar_url)
  `

  let countQ = supabase.from('sleep_requests').select('*', { count: 'exact', head: true })
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
