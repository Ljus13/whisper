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

export async function generateActionCode(name: string) {
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

  const { data, error } = await supabase
    .from('action_codes')
    .insert({ name: name.trim(), code, created_by: user.id })
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

export async function generateQuestCode(name: string, mapId?: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }
  if (!name?.trim()) return { error: 'กรุณากรอกชื่อภารกิจ' }

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

  const insertData: { name: string; code: string; created_by: string; map_id?: string } = {
    name: name.trim(), code, created_by: user.id
  }
  if (mapId) insertData.map_id = mapId

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
  const { data: profiles } = creatorIds.length > 0
    ? await supabase.from('profiles').select('id, display_name').in('id', creatorIds)
    : { data: [] }
  const { data: maps } = mapIds.length > 0
    ? await supabase.from('maps').select('id, name').in('id', mapIds)
    : { data: [] }
  const pMap = new Map((profiles || []).map(p => [p.id, p.display_name]))
  const mMap = new Map((maps || []).map(m => [m.id, m.name]))

  const codes = (data || []).map(c => ({
    ...c,
    created_by_name: pMap.get(c.created_by) || 'ไม่ทราบ',
    map_name: c.map_id ? (mMap.get(c.map_id) || null) : null,
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

  let countQ = supabase.from('action_submissions').select('*', { count: 'exact', head: true })
  if (!isAdmin) countQ = countQ.eq('player_id', user.id)
  const { count } = await countQ

  let dataQ = supabase.from('action_submissions').select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)
  if (!isAdmin) dataQ = dataQ.eq('player_id', user.id)
  const { data, error } = await dataQ

  if (error) return { submissions: [], total: 0 }
  const rows = data || []

  const playerIds = [...new Set(rows.map(r => r.player_id))]
  const reviewerIds = [...new Set(rows.filter(r => r.reviewed_by).map(r => r.reviewed_by!))]
  const codeIds = [...new Set(rows.map(r => r.action_code_id))]
  const allProfileIds = [...new Set([...playerIds, ...reviewerIds])]

  const { data: profiles } = allProfileIds.length > 0
    ? await supabase.from('profiles').select('id, display_name, avatar_url').in('id', allProfileIds)
    : { data: [] }
  const { data: codes } = codeIds.length > 0
    ? await supabase.from('action_codes').select('id, name, code').in('id', codeIds)
    : { data: [] }

  const pMap = new Map((profiles || []).map(p => [p.id, p]))
  const cMap = new Map((codes || []).map(c => [c.id, c]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submissions = rows.map((r: any) => {
    const player = pMap.get(r.player_id)
    const reviewer = r.reviewed_by ? pMap.get(r.reviewed_by) : null
    const code = cMap.get(r.action_code_id)
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
    }
  })

  return { submissions, total: count || 0, page, totalPages: Math.ceil((count || 0) / PAGE_SIZE), isAdmin }
}

export async function approveActionSubmission(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await requireAdmin(supabase, user.id))) return { error: 'Admin/DM required' }

  const { error } = await supabase
    .from('action_submissions')
    .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')

  if (error) return { error: error.message }
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
    .select('id, name, map_id')
    .eq('code', codeStr.trim())
    .maybeSingle()

  if (!codeRow) return { error: 'ไม่พบรหัสภารกิจนี้ กรุณาตรวจสอบรหัสอีกครั้ง' }

  // ── ตรวจสอบว่าผู้เล่นอยู่ในแมพที่ภารกิจกำหนดหรือไม่ ──
  if (codeRow.map_id) {
    const { data: playerToken } = await supabase
      .from('map_tokens')
      .select('map_id')
      .eq('user_id', user.id)
      .single()

    if (!playerToken) {
      // Player doesn't have a token on any map
      const { data: requiredMap } = await supabase
        .from('maps')
        .select('name')
        .eq('id', codeRow.map_id)
        .single()
      const mapName = requiredMap?.name || 'สถานที่ที่กำหนด'
      return { error: `คุณต้องเดินทางไปยัง "${mapName}" ในแผนที่ก่อนจึงจะส่งภารกิจนี้ได้` }
    }

    if (playerToken.map_id !== codeRow.map_id) {
      // Player is on a different map
      const { data: requiredMap } = await supabase
        .from('maps')
        .select('name')
        .eq('id', codeRow.map_id)
        .single()
      const mapName = requiredMap?.name || 'สถานที่ที่กำหนด'
      return { error: `คุณต้องเดินทางไปยัง "${mapName}" ในแผนที่ก่อนจึงจะส่งภารกิจนี้ได้` }
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

  let countQ = supabase.from('quest_submissions').select('*', { count: 'exact', head: true })
  if (!isAdmin) countQ = countQ.eq('player_id', user.id)
  const { count } = await countQ

  let dataQ = supabase.from('quest_submissions').select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)
  if (!isAdmin) dataQ = dataQ.eq('player_id', user.id)
  const { data, error } = await dataQ

  if (error) return { submissions: [], total: 0 }
  const rows = data || []

  const playerIds = [...new Set(rows.map(r => r.player_id))]
  const reviewerIds = [...new Set(rows.filter(r => r.reviewed_by).map(r => r.reviewed_by!))]
  const codeIds = [...new Set(rows.map(r => r.quest_code_id))]
  const allProfileIds = [...new Set([...playerIds, ...reviewerIds])]

  const { data: profiles } = allProfileIds.length > 0
    ? await supabase.from('profiles').select('id, display_name, avatar_url').in('id', allProfileIds)
    : { data: [] }
  const { data: codes } = codeIds.length > 0
    ? await supabase.from('quest_codes').select('id, name, code').in('id', codeIds)
    : { data: [] }

  const pMap = new Map((profiles || []).map(p => [p.id, p]))
  const cMap = new Map((codes || []).map(c => [c.id, c]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submissions = rows.map((r: any) => {
    const player = pMap.get(r.player_id)
    const reviewer = r.reviewed_by ? pMap.get(r.reviewed_by) : null
    const code = cMap.get(r.quest_code_id)
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

  let countQ = supabase.from('sleep_requests').select('*', { count: 'exact', head: true })
  if (!isAdmin) countQ = countQ.eq('player_id', user.id)
  const { count } = await countQ

  let dataQ = supabase.from('sleep_requests').select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)
  if (!isAdmin) dataQ = dataQ.eq('player_id', user.id)
  const { data, error } = await dataQ

  if (error) return { logs: [], total: 0 }
  const rows = data || []

  const playerIds = [...new Set(rows.map(r => r.player_id))]
  const reviewerIds = [...new Set(rows.filter(r => r.reviewed_by).map(r => r.reviewed_by!))]
  const allIds = [...new Set([...playerIds, ...reviewerIds])]

  const { data: profiles } = allIds.length > 0
    ? await supabase.from('profiles').select('id, display_name, avatar_url').in('id', allIds)
    : { data: [] }
  const pMap = new Map((profiles || []).map(p => [p.id, p]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs = rows.map((r: any) => {
    const player = pMap.get(r.player_id)
    const reviewer = r.reviewed_by ? pMap.get(r.reviewed_by) : null
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
