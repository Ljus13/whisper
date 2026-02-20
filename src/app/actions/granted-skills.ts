'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/* ── Helper: verify admin/dm role ── */
async function requireStaff() {
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

  return { supabase, user }
}

/* ══════════════════════════════════════════════
   GRANT SKILL TO PLAYER (มอบพลัง)
   ══════════════════════════════════════════════ */

export interface GrantSkillInput {
  playerId: string
  skillId: string
  title: string
  detail?: string
  imageUrl?: string | null
  isTransferable?: boolean
  reusePolicy: 'once' | 'cooldown' | 'unlimited'
  cooldownMinutes?: number
  expiresAt?: string | null
  effectHp?: number
  effectSanity?: number
  effectMaxSanity?: number
  effectTravel?: number
  effectMaxTravel?: number
  effectSpirituality?: number
  effectMaxSpirituality?: number
  effectPotionDigest?: number
}

export async function grantSkillToPlayer(input: GrantSkillInput) {
  try {
    const { supabase, user } = await requireStaff()

    if (!input.playerId || !input.skillId || !input.title?.trim()) {
      return { error: 'กรุณากรอกข้อมูลให้ครบ (ผู้เล่น, สกิล, ชื่อ)' }
    }

    // Verify skill exists
    const { data: skill } = await supabase
      .from('skills')
      .select('id, name')
      .eq('id', input.skillId)
      .single()

    if (!skill) return { error: 'ไม่พบสกิลที่เลือก' }

    // Verify player exists
    const { data: player } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('id', input.playerId)
      .single()

    if (!player) return { error: 'ไม่พบผู้เล่นที่เลือก' }

    const effects = {
      effect_hp: input.effectHp || 0,
      effect_sanity: input.effectSanity || 0,
      effect_max_sanity: input.effectMaxSanity || 0,
      effect_travel: input.effectTravel || 0,
      effect_max_travel: input.effectMaxTravel || 0,
      effect_spirituality: input.effectSpirituality || 0,
      effect_max_spirituality: input.effectMaxSpirituality || 0,
      effect_potion_digest: input.effectPotionDigest || 0,
    }

    // Insert granted skill
    const { data: granted, error: insertErr } = await supabase
      .from('granted_skills')
      .insert({
        player_id: input.playerId,
        skill_id: input.skillId,
        granted_by: user.id,
        title: input.title.trim(),
        detail: input.detail?.trim() || null,
        image_url: input.imageUrl?.trim() || null,
        is_transferable: input.isTransferable ?? false,
        reuse_policy: input.reusePolicy,
        cooldown_minutes: input.reusePolicy === 'cooldown' ? (input.cooldownMinutes || 60) : null,
        expires_at: input.expiresAt || null,
        ...effects,
      })
      .select('id')
      .single()

    if (insertErr) return { error: insertErr.message }

    // Log the grant action
    await supabase.from('granted_skill_logs').insert({
      granted_skill_id: granted.id,
      player_id: input.playerId,
      skill_id: input.skillId,
      granted_by: user.id,
      action: 'grant',
      title: input.title.trim(),
      detail: input.detail?.trim() || null,
      effects_json: effects,
      note: `มอบพลัง "${skill.name}" ให้ ${player.display_name || 'ผู้เล่น'}`,
    })

    revalidatePath('/dashboard/skills')
    revalidatePath('/dashboard/grant-skills')
    return { success: true, grantedId: granted.id }
  } catch (e: any) {
    return { error: e.message || 'เกิดข้อผิดพลาด' }
  }
}

/* ══════════════════════════════════════════════
   UPDATE GRANTED SKILL (admin แก้ไข)
   ══════════════════════════════════════════════ */

export interface UpdateGrantSkillInput {
  grantedSkillId: string
  title: string
  detail?: string | null
  imageUrl?: string | null
  isTransferable?: boolean
  reusePolicy: 'once' | 'cooldown' | 'unlimited'
  cooldownMinutes?: number | null
  expiresAt?: string | null
  effectHp?: number
  effectSanity?: number
  effectMaxSanity?: number
  effectTravel?: number
  effectMaxTravel?: number
  effectSpirituality?: number
  effectMaxSpirituality?: number
  effectPotionDigest?: number
  isActive?: boolean
}

export async function updateGrantedSkill(input: UpdateGrantSkillInput) {
  try {
    const { supabase, user } = await requireStaff()

    if (!input.title?.trim()) return { error: 'กรุณากรอกชื่อ' }

    const { data: gs } = await supabase
      .from('granted_skills')
      .select('id, title, player_id, skill_id')
      .eq('id', input.grantedSkillId)
      .single()

    if (!gs) return { error: 'ไม่พบรายการ' }

    const { error: updateErr } = await supabase
      .from('granted_skills')
      .update({
        title: input.title.trim(),
        detail: input.detail?.trim() || null,
        image_url: input.imageUrl?.trim() || null,
        reuse_policy: input.reusePolicy,
        cooldown_minutes: input.reusePolicy === 'cooldown' ? (input.cooldownMinutes || 60) : null,
        expires_at: input.expiresAt || null,
        effect_hp: input.effectHp ?? 0,
        effect_sanity: input.effectSanity ?? 0,
        effect_max_sanity: input.effectMaxSanity ?? 0,
        effect_travel: input.effectTravel ?? 0,
        effect_max_travel: input.effectMaxTravel ?? 0,
        effect_spirituality: input.effectSpirituality ?? 0,
        effect_max_spirituality: input.effectMaxSpirituality ?? 0,
        effect_potion_digest: input.effectPotionDigest ?? 0,
        is_transferable: input.isTransferable ?? false,
        is_active: input.isActive ?? true,
      })
      .eq('id', input.grantedSkillId)

    if (updateErr) return { error: updateErr.message }

    await supabase.from('granted_skill_logs').insert({
      granted_skill_id: gs.id,
      player_id: gs.player_id,
      skill_id: gs.skill_id,
      granted_by: user.id,
      action: 'grant',
      title: input.title.trim(),
      detail: input.detail?.trim() || null,
      note: `แก้ไขโดยทีมงาน (เดิม: "${gs.title}")`,
    })

    revalidatePath('/dashboard/skills')
    revalidatePath('/dashboard/grant-skills')
    return { success: true }
  } catch (e: any) {
    return { error: e.message || 'เกิดข้อผิดพลาด' }
  }
}

/* ══════════════════════════════════════════════
   DELETE GRANTED SKILL (admin ลบ)
   ══════════════════════════════════════════════ */

export async function deleteGrantedSkill(grantedSkillId: string) {
  try {
    const { supabase, user } = await requireStaff()

    const { data: gs } = await supabase
      .from('granted_skills')
      .select('id, title, player_id, skill_id')
      .eq('id', grantedSkillId)
      .single()

    if (!gs) return { error: 'ไม่พบรายการ' }

    await supabase.from('granted_skill_logs').insert({
      granted_skill_id: gs.id,
      player_id: gs.player_id,
      skill_id: gs.skill_id,
      granted_by: user.id,
      action: 'revoke',
      title: gs.title,
      note: 'ลบโดยทีมงาน',
    })

    const { error: delErr } = await supabase
      .from('granted_skills')
      .delete()
      .eq('id', grantedSkillId)

    if (delErr) return { error: delErr.message }

    revalidatePath('/dashboard/skills')
    revalidatePath('/dashboard/grant-skills')
    return { success: true }
  } catch (e: any) {
    return { error: e.message || 'เกิดข้อผิดพลาด' }
  }
}

/* ══════════════════════════════════════════════
   TRANSFER GRANTED SKILL (ผู้เล่นโอนของให้ผู้เล่นอื่น)
   ══════════════════════════════════════════════ */

export async function transferGrantedSkill(grantedSkillId: string, targetPlayerId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    if (user.id === targetPlayerId) return { error: 'ไม่สามารถโอนให้ตัวเองได้' }

    // 1) Fetch the granted skill
    const { data: gs } = await supabase
      .from('granted_skills')
      .select('*')
      .eq('id', grantedSkillId)
      .eq('player_id', user.id)
      .single()

    if (!gs) return { error: 'ไม่พบรายการ หรือไม่ใช่ของคุณ' }
    if (!gs.is_active) return { error: 'สิ่งนี้ถูกปิดใช้งานแล้ว' }
    if (!gs.is_transferable) return { error: 'สิ่งนี้ไม่สามารถส่งมอบได้' }

    // 2) Verify target player exists
    const { data: target } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('id', targetPlayerId)
      .single()

    if (!target) return { error: 'ไม่พบผู้เล่นปลายทาง' }

    // 3) Fetch sender name
    const { data: sender } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()

    // 4) Transfer: update player_id to new owner, reset usage
    const { error: transferErr } = await supabase
      .from('granted_skills')
      .update({
        player_id: targetPlayerId,
        times_used: 0,
        last_used_at: null,
      })
      .eq('id', gs.id)

    if (transferErr) return { error: transferErr.message }

    // 5) Log the transfer
    await supabase.from('granted_skill_logs').insert({
      granted_skill_id: gs.id,
      player_id: user.id,
      skill_id: gs.skill_id,
      granted_by: user.id,
      action: 'transfer',
      title: gs.title,
      detail: gs.detail,
      note: `โอนจาก ${sender?.display_name || 'ผู้เล่น'} ให้ ${target.display_name || 'ผู้เล่น'}`,
    })

    revalidatePath('/dashboard/skills')
    return { success: true, targetName: target.display_name || 'ผู้เล่น' }
  } catch (e: any) {
    return { error: e.message || 'เกิดข้อผิดพลาด' }
  }
}

/* ══════════════════════════════════════════════
   GET PLAYERS FOR TRANSFER (ผู้เล่นอื่นทั้งหมด)
   ══════════════════════════════════════════════ */

export async function getPlayersForTransfer() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated', players: [] }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .neq('id', user.id)
      .order('display_name')

    if (error) return { error: error.message, players: [] }
    return { players: data || [] }
  } catch (e: any) {
    return { error: e.message, players: [] }
  }
}

/* ══════════════════════════════════════════════
   USE GRANTED SKILL (ผู้เล่นใช้สกิลที่ถูกมอบ)
   ══════════════════════════════════════════════ */

export async function useGrantedSkill(grantedSkillId: string, successRate: number, roll: number, note?: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const normalizedRate = Math.floor(successRate)
  const normalizedRoll = Math.floor(roll)
  const normalizedNote = note?.trim() || null

  if (!Number.isFinite(normalizedRate) || normalizedRate < 1 || normalizedRate > 20) {
    return { error: 'กรุณาระบุอัตราสำเร็จระหว่าง 1-20' }
  }
  if (!Number.isFinite(normalizedRoll) || normalizedRoll < 1 || normalizedRoll > 20) {
    return { error: 'ผลลัพธ์สุ่มไม่ถูกต้อง' }
  }

  // 1) Fetch granted skill
  const { data: gs } = await supabase
    .from('granted_skills')
    .select('*')
    .eq('id', grantedSkillId)
    .eq('player_id', user.id)
    .single()

  if (!gs) return { error: 'ไม่พบสิ่งที่มอบให้' }
  if (!gs.is_active) return { error: 'สิ่งนี้ถูกปิดใช้งานแล้ว' }

  // 2) Check expiration
  if (gs.expires_at && new Date(gs.expires_at) < new Date()) {
    await supabase.from('granted_skills').update({ is_active: false }).eq('id', gs.id)
    return { error: 'สิ่งนี้หมดอายุแล้ว' }
  }

  // 3) Check reuse policy
  if (gs.reuse_policy === 'once' && gs.times_used > 0) {
    return { error: 'สิ่งนี้ใช้ได้ครั้งเดียวและถูกใช้แล้ว' }
  }
  if (gs.reuse_policy === 'cooldown' && gs.last_used_at && gs.cooldown_minutes) {
    const cooldownEnd = new Date(gs.last_used_at)
    cooldownEnd.setMinutes(cooldownEnd.getMinutes() + gs.cooldown_minutes)
    if (new Date() < cooldownEnd) {
      const remaining = Math.ceil((cooldownEnd.getTime() - Date.now()) / 60000)
      return { error: `ติดคูลดาวน์ อีก ${remaining} นาที` }
    }
  }

  // 4) Fetch skill info (including spirit_cost)
  const { data: skill } = await supabase
    .from('skills')
    .select('id, name, description, spirit_cost')
    .eq('id', gs.skill_id)
    .single()

  if (!skill) return { error: 'ไม่พบข้อมูล' }

  // 5) Fetch player profile & check spirituality
  const { data: profile } = await supabase
    .from('profiles')
    .select('hp, sanity, max_sanity, travel_points, max_travel_points, spirituality, max_spirituality, potion_digest_progress')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: 'ไม่พบโปรไฟล์' }

  // 5.1) Check & deduct spirit_cost (same as castSkill)
  if (profile.spirituality < skill.spirit_cost) {
    return { error: `พลังวิญญาณไม่เพียงพอ (ต้องการ ${skill.spirit_cost} แต่มี ${profile.spirituality})` }
  }

  const spiritAfterCost = profile.spirituality - skill.spirit_cost

  // 5.2) Apply effects to player profile (spirit deduction + effects combined)
  const updates: Record<string, number> = {}
  updates.spirituality = spiritAfterCost  // always deduct spirit_cost
  if (gs.effect_hp !== 0) updates.hp = Math.max(0, profile.hp + gs.effect_hp)
  if (gs.effect_sanity !== 0) updates.sanity = Math.max(0, Math.min(profile.max_sanity + (gs.effect_max_sanity || 0), profile.sanity + gs.effect_sanity))
  if (gs.effect_max_sanity !== 0) updates.max_sanity = Math.max(0, profile.max_sanity + gs.effect_max_sanity)
  if (gs.effect_travel !== 0) updates.travel_points = Math.max(0, profile.travel_points + gs.effect_travel)
  if (gs.effect_max_travel !== 0) updates.max_travel_points = Math.max(0, profile.max_travel_points + gs.effect_max_travel)
  // effect_spirituality stacks on top of the spirit_cost deduction
  if (gs.effect_spirituality !== 0) updates.spirituality = Math.max(0, spiritAfterCost + gs.effect_spirituality)
  if (gs.effect_max_spirituality !== 0) updates.max_spirituality = Math.max(0, profile.max_spirituality + gs.effect_max_spirituality)
  if (gs.effect_potion_digest !== 0) updates.potion_digest_progress = Math.max(0, Math.min(100, profile.potion_digest_progress + gs.effect_potion_digest))

  const { error: updateErr } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
  if (updateErr) return { error: updateErr.message }

  // 6) Update granted skill usage tracking
  const now = new Date().toISOString()
  const newTimesUsed = gs.times_used + 1
  const deactivate = gs.reuse_policy === 'once'

  await supabase
    .from('granted_skills')
    .update({
      times_used: newTimesUsed,
      last_used_at: now,
      is_active: deactivate ? false : gs.is_active,
    })
    .eq('id', gs.id)

  // 7) Generate reference code
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = String(d.getFullYear())
  const uidSuffix = user.id.replace(/-/g, '').slice(-4).toUpperCase()
  const outcome = normalizedRoll >= normalizedRate ? 'success' : 'fail'
  const outcomeCode = outcome === 'success' ? 'S' : 'F'
  const referenceCode = `GS-${uidSuffix}${dd}${mm}${yyyy}-T${normalizedRate}-R${normalizedRoll}-${outcomeCode}`

  // 8) Log the usage
  const effects = {
    effect_hp: gs.effect_hp,
    effect_sanity: gs.effect_sanity,
    effect_max_sanity: gs.effect_max_sanity,
    effect_travel: gs.effect_travel,
    effect_max_travel: gs.effect_max_travel,
    effect_spirituality: gs.effect_spirituality,
    effect_max_spirituality: gs.effect_max_spirituality,
    effect_potion_digest: gs.effect_potion_digest,
  }

  await supabase.from('granted_skill_logs').insert({
    granted_skill_id: gs.id,
    player_id: user.id,
    skill_id: gs.skill_id,
    granted_by: gs.granted_by,
    action: 'use',
    title: gs.title,
    detail: gs.detail,
    effects_json: effects,
    reference_code: referenceCode,
    note: normalizedNote,
  })

  // Also log in skill_usage_logs for unified history (with actual spirit_cost)
  await supabase.from('skill_usage_logs').insert({
    player_id: user.id,
    skill_id: gs.skill_id,
    spirit_cost: skill.spirit_cost,
    reference_code: referenceCode,
    note: `[มอบพลัง] ${gs.title}${normalizedNote ? ' — ' + normalizedNote : ''}`,
    success_rate: normalizedRate,
    roll: normalizedRoll,
    outcome,
  })

  revalidatePath('/dashboard/skills')
  return {
    success: true,
    skillName: skill.name,
    skillDescription: skill.description || null,
    spiritCost: skill.spirit_cost,
    remaining: updates.spirituality ?? spiritAfterCost,
    grantTitle: gs.title,
    grantDetail: gs.detail || null,
    referenceCode,
    successRate: normalizedRate,
    roll: normalizedRoll,
    outcome,
    effects,
    note: normalizedNote,
  }
}

/* ══════════════════════════════════════════════
   GET GRANTED SKILLS FOR PLAYER
   ══════════════════════════════════════════════ */

export async function getGrantedSkillsForPlayer(playerId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', skills: [] }

  const targetId = playerId || user.id

  // If requesting another player's data, must be staff
  if (targetId !== user.id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!profile || (profile.role !== 'admin' && profile.role !== 'dm')) {
      return { error: 'ไม่มีสิทธิ์', skills: [] }
    }
  }

  const { data, error } = await supabase
    .from('granted_skills')
    .select('*, skills(id, name, description, spirit_cost, pathway_id, sequence_id)')
    .eq('player_id', targetId)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message, skills: [] }
  return { skills: data || [] }
}

/* ══════════════════════════════════════════════
   GET GRANT SKILL LOGS (admin)
   ══════════════════════════════════════════════ */

const LOGS_PER_PAGE = 20

export async function getGrantSkillLogs(page: number = 1, search?: string) {
  try {
    const { supabase } = await requireStaff()

    const offset = (page - 1) * LOGS_PER_PAGE
    const query = search?.trim() || ''

    let countQuery = supabase
      .from('granted_skill_logs')
      .select('*', { count: 'exact', head: true })

    let dataQuery = supabase
      .from('granted_skill_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + LOGS_PER_PAGE - 1)

    if (query) {
      countQuery = countQuery.or(`title.ilike.%${query}%,note.ilike.%${query}%,reference_code.ilike.%${query}%`)
      dataQuery = dataQuery.or(`title.ilike.%${query}%,note.ilike.%${query}%,reference_code.ilike.%${query}%`)
    }

    const [countRes, dataRes] = await Promise.all([countQuery, dataQuery])
    const totalCount = countRes.count || 0
    const rawLogs = dataRes.data || []

    // Fetch player & granter names
    const allIds = [...new Set([
      ...rawLogs.map(l => l.player_id),
      ...rawLogs.map(l => l.granted_by),
    ])]
    const skillIds = [...new Set(rawLogs.map(l => l.skill_id))]

    const [profilesRes, skillsRes] = await Promise.all([
      allIds.length > 0
        ? supabase.from('profiles').select('id, display_name, avatar_url').in('id', allIds)
        : { data: [] },
      skillIds.length > 0
        ? supabase.from('skills').select('id, name').in('id', skillIds)
        : { data: [] },
    ])

    const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p]))
    const skillMap = new Map((skillsRes.data || []).map(s => [s.id, s]))

    const logs = rawLogs.map((row: any) => {
      const player = profileMap.get(row.player_id)
      const granter = profileMap.get(row.granted_by)
      const skill = skillMap.get(row.skill_id)
      return {
        ...row,
        player_name: player?.display_name || 'ไม่ทราบชื่อ',
        player_avatar: player?.avatar_url || null,
        granter_name: granter?.display_name || 'ไม่ทราบชื่อ',
        skill_name: skill?.name || 'ไม่ทราบสกิล',
      }
    })

    return {
      logs,
      total: totalCount,
      page,
      totalPages: Math.ceil(totalCount / LOGS_PER_PAGE),
    }
  } catch (e: any) {
    return { error: e.message, logs: [], total: 0, page: 1, totalPages: 1 }
  }
}

/* ══════════════════════════════════════════════
   GET ALL PLAYERS WITH PATHWAYS (for admin table)
   ══════════════════════════════════════════════ */

export async function getPlayersForGrantSkill() {
  try {
    const { supabase } = await requireStaff()

    const [playersRes, ppRes, pathwaysRes, seqRes] = await Promise.all([
      supabase.from('profiles').select('id, display_name, avatar_url, role').order('display_name'),
      supabase.from('player_pathways').select('player_id, pathway_id, sequence_id').not('pathway_id', 'is', null),
      supabase.from('skill_pathways').select('id, name'),
      supabase.from('skill_sequences').select('id, pathway_id, seq_number, name'),
    ])

    const pathwayMap = new Map((pathwaysRes.data || []).map(p => [p.id, p.name]))
    const seqMap = new Map((seqRes.data || []).map(s => [s.id, s]))

    const ppByPlayer = new Map<string, { pathwayName: string; seqName: string; seqNumber: number }[]>()
    for (const pp of (ppRes.data || [])) {
      if (!pp.pathway_id) continue
      const pathwayName = pathwayMap.get(pp.pathway_id) || '—'
      const seq = pp.sequence_id ? seqMap.get(pp.sequence_id) : null
      const entry = {
        pathwayName,
        seqName: seq?.name || '—',
        seqNumber: seq?.seq_number ?? -1,
      }
      const existing = ppByPlayer.get(pp.player_id) || []
      existing.push(entry)
      ppByPlayer.set(pp.player_id, existing)
    }

    const players = (playersRes.data || []).map(p => ({
      ...p,
      pathways: ppByPlayer.get(p.id) || [],
    }))

    return { players }
  } catch (e: any) {
    return { error: e.message, players: [] }
  }
}

/* ══════════════════════════════════════════════
   GET ALL SKILLS GROUPED (for skill selector)
   ══════════════════════════════════════════════ */

export async function getAllSkillsGrouped() {
  try {
    const { supabase } = await requireStaff()

    const [typesRes, pathwaysRes, seqRes, skillsRes] = await Promise.all([
      supabase.from('skill_types').select('id, name').order('name'),
      supabase.from('skill_pathways').select('id, type_id, name').order('name'),
      supabase.from('skill_sequences').select('id, pathway_id, seq_number, name').order('seq_number', { ascending: false }),
      supabase.from('skills').select('id, pathway_id, sequence_id, name, description, spirit_cost').order('name'),
    ])

    return {
      types: typesRes.data || [],
      pathways: pathwaysRes.data || [],
      sequences: seqRes.data || [],
      skills: skillsRes.data || [],
    }
  } catch (e: any) {
    return { error: e.message, types: [], pathways: [], sequences: [], skills: [] }
  }
}

/* ══════════════════════════════════════════════
   REVOKE GRANTED SKILL (admin)
   ══════════════════════════════════════════════ */

export async function revokeGrantedSkill(grantedSkillId: string) {
  try {
    const { supabase, user } = await requireStaff()

    const { data: gs } = await supabase
      .from('granted_skills')
      .select('*')
      .eq('id', grantedSkillId)
      .single()

    if (!gs) return { error: 'ไม่พบรายการ' }

    await supabase
      .from('granted_skills')
      .update({ is_active: false })
      .eq('id', grantedSkillId)

    // Log revocation
    await supabase.from('granted_skill_logs').insert({
      granted_skill_id: gs.id,
      player_id: gs.player_id,
      skill_id: gs.skill_id,
      granted_by: user.id,
      action: 'revoke',
      title: gs.title,
      detail: gs.detail,
      note: 'เพิกถอนโดยทีมงาน',
    })

    revalidatePath('/dashboard/skills')
    revalidatePath('/dashboard/grant-skills')
    return { success: true }
  } catch (e: any) {
    return { error: e.message }
  }
}
