'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotification } from '@/app/actions/notifications'

/* ── Helper: get display name ── */
async function getDisplayName(supabase: any, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single()
  return data?.display_name || 'ผู้เล่น'
}

/* ── Helper: verify admin role ── */
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

  return { supabase, user }
}

/* ══════════════════════════════════════════════
   SKILL USAGE LOGS (ประวัติการใช้สกิล)
   ══════════════════════════════════════════════ */

const LOGS_PER_PAGE = 15

export async function getSkillUsageLogs(page: number = 1, search?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', logs: [], total: 0 }

  // Check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: 'Profile not found', logs: [], total: 0 }

  const isAdmin = profile.role === 'admin' || profile.role === 'dm'
  const query = search?.trim() || ''
  const offset = (page - 1) * LOGS_PER_PAGE
  const hasQuery = query.length > 0

  let matchingPlayerIds: string[] = []
  if (hasQuery) {
    const { data: playersRes } = await supabase
      .from('profiles')
      .select('id')
      .ilike('display_name', `%${query}%`)
    matchingPlayerIds = (playersRes || []).map(p => p.id)
  }

  let countQuery = supabase
    .from('skill_usage_logs')
    .select('*', { count: 'exact', head: true })

  if (!isAdmin) {
    countQuery = countQuery.eq('player_id', user.id)
  }
  if (hasQuery) {
    if (matchingPlayerIds.length > 0) {
      countQuery = countQuery.or(`reference_code.ilike.%${query}%,player_id.in.(${matchingPlayerIds.join(',')})`)
    } else {
      countQuery = countQuery.ilike('reference_code', `%${query}%`)
    }
  }

  const countResult = await countQuery
  const totalCount = countResult.count || 0

  let dataQuery = supabase
    .from('skill_usage_logs')
    .select('*')
    .order('used_at', { ascending: false })
    .range(offset, offset + LOGS_PER_PAGE - 1)

  if (!isAdmin) {
    dataQuery = dataQuery.eq('player_id', user.id)
  }
  if (hasQuery) {
    if (matchingPlayerIds.length > 0) {
      dataQuery = dataQuery.or(`reference_code.ilike.%${query}%,player_id.in.(${matchingPlayerIds.join(',')})`)
    } else {
      dataQuery = dataQuery.ilike('reference_code', `%${query}%`)
    }
  }

  const dataResult = await dataQuery
  if (dataResult.error) {
    return { error: dataResult.error.message, logs: [], total: 0 }
  }

  const rawLogs = dataResult.data || []
  const playerIds = [...new Set(rawLogs.map(l => l.player_id))]
  const skillIds = [...new Set(rawLogs.map(l => l.skill_id))]

  const [playersRes, skillsRes] = await Promise.all([
    playerIds.length > 0
      ? supabase.from('profiles').select('id, display_name, avatar_url').in('id', playerIds)
      : { data: [] },
    skillIds.length > 0
      ? supabase.from('skills').select('id, name').in('id', skillIds)
      : { data: [] },
  ])

  const playerMap = new Map((playersRes.data || []).map(p => [p.id, p]))
  const skillMap = new Map((skillsRes.data || []).map(s => [s.id, s]))

  const logs = rawLogs.map((row: any) => {
    const player = playerMap.get(row.player_id)
    const skill = skillMap.get(row.skill_id)
    return {
      id: row.id,
      player_id: row.player_id,
      skill_id: row.skill_id,
      spirit_cost: row.spirit_cost,
      reference_code: row.reference_code || '—',
      note: row.note || null,
      used_at: row.used_at,
      player_name: player?.display_name || 'ไม่ทราบชื่อ',
      player_avatar: player?.avatar_url || null,
      skill_name: skill?.name || 'ไม่ทราบสกิล',
      success_rate: row.success_rate ?? null,
      roll: row.roll ?? null,
      outcome: row.outcome ?? null,
    }
  })

  return {
    logs,
    total: totalCount,
    page,
    totalPages: Math.ceil(totalCount / LOGS_PER_PAGE),
    isAdmin,
  }
}

/* ══════════════════════════════════════════════
   SKILL TYPES (กลุ่ม)
   ══════════════════════════════════════════════ */

export async function createSkillType(formData: FormData) {
  const { supabase } = await requireAdmin()
  
  const name = formData.get('name') as string
  const description = formData.get('description') as string | null
  const overview = formData.get('overview') as string | null

  if (!name?.trim()) return { error: 'Name is required' }

  const { error } = await supabase
    .from('skill_types')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      overview: overview?.trim() || null
    })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/skills')
  return { success: true }
}

export async function updateSkillType(id: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  
  const name = formData.get('name') as string
  const description = formData.get('description') as string | null
  const overview = formData.get('overview') as string | null

  if (!name?.trim()) return { error: 'Name is required' }

  const { error } = await supabase
    .from('skill_types')
    .update({
      name: name.trim(),
      description: description?.trim() || null,
      overview: overview?.trim() || null
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/skills')
  return { success: true }
}

export async function deleteSkillType(id: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('skill_types')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/skills')
  return { success: true }
}

/* ══════════════════════════════════════════════
   SKILL PATHWAYS (เส้นทาง)
   ══════════════════════════════════════════════ */

export async function createSkillPathway(formData: FormData) {
  const { supabase } = await requireAdmin()
  
  const name = formData.get('name') as string
  const type_id = formData.get('type_id') as string
  const description = formData.get('description') as string | null
  const overview = formData.get('overview') as string | null
  const bg_url = formData.get('bg_url') as string | null
  const logo_url = formData.get('logo_url') as string | null
  const video_url = formData.get('video_url') as string | null

  if (!name?.trim() || !type_id) return { error: 'Name and type are required' }

  const { error } = await supabase
    .from('skill_pathways')
    .insert({
      name: name.trim(),
      type_id,
      description: description?.trim() || null,
      overview: overview?.trim() || null,
      bg_url: bg_url?.trim() || null,
      logo_url: logo_url?.trim() || null,
      video_url: video_url?.trim() || null
    })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/skills')
  return { success: true }
}

export async function updateSkillPathway(id: string, formData: FormData) {
  const { supabase } = await requireAdmin()

  const name = formData.get('name') as string
  const description = formData.get('description') as string | null
  const overview = formData.get('overview') as string | null
  const bg_url = formData.get('bg_url') as string | null
  const logo_url = formData.get('logo_url') as string | null
  const video_url = formData.get('video_url') as string | null

  if (!name?.trim()) return { error: 'Name is required' }

  const { error } = await supabase
    .from('skill_pathways')
    .update({
      name: name.trim(),
      description: description?.trim() || null,
      overview: overview?.trim() || null,
      bg_url: bg_url?.trim() || null,
      logo_url: logo_url?.trim() || null,
      video_url: video_url?.trim() || null
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/skills')
  return { success: true }
}

export async function deleteSkillPathway(id: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('skill_pathways')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/skills')
  return { success: true }
}

/* ══════════════════════════════════════════════
   SKILL SEQUENCES (ลำดับ)
   ══════════════════════════════════════════════ */

export async function createSkillSequence(formData: FormData) {
  const { supabase } = await requireAdmin()
  
  const name = formData.get('name') as string
  const pathway_id = formData.get('pathway_id') as string
  const seq_number = parseInt(formData.get('seq_number') as string)
  const roleplay_keywords = formData.get('roleplay_keywords') as string | null

  if (!name?.trim() || !pathway_id || isNaN(seq_number)) {
    return { error: 'Name, pathway, and sequence number are required' }
  }

  if (seq_number < 0 || seq_number > 9) {
    return { error: 'ลำดับต้องอยู่ระหว่าง 0–9 (9=อ่อนแอที่สุด, 0=แข็งแกร่งที่สุด)' }
  }

  const { error } = await supabase
    .from('skill_sequences')
    .insert({
      name: name.trim(),
      pathway_id,
      seq_number,
      roleplay_keywords: roleplay_keywords?.trim() || null
    })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/skills')
  return { success: true }
}

export async function updateSkillSequence(id: string, formData: FormData) {
  const { supabase } = await requireAdmin()

  const name = formData.get('name') as string
  const seq_number = parseInt(formData.get('seq_number') as string)
  const roleplay_keywords = formData.get('roleplay_keywords') as string | null

  if (!name?.trim()) return { error: 'Name is required' }
  if (isNaN(seq_number) || seq_number < 0 || seq_number > 9) {
    return { error: 'ลำดับต้องอยู่ระหว่าง 0–9 (9=อ่อนแอที่สุด, 0=แข็งแกร่งที่สุด)' }
  }

  const { error } = await supabase
    .from('skill_sequences')
    .update({
      name: name.trim(),
      seq_number,
      roleplay_keywords: roleplay_keywords?.trim() || null
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/skills')
  return { success: true }
}

export async function deleteSkillSequence(id: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('skill_sequences')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/skills')
  return { success: true }
}

/* ══════════════════════════════════════════════
   SKILLS (สกิล)
   ══════════════════════════════════════════════ */

export async function createSkill(formData: FormData) {
  const { supabase } = await requireAdmin()
  
  const name = formData.get('name') as string
  const description = formData.get('description') as string | null
  const pathway_id = formData.get('pathway_id') as string
  const sequence_id = formData.get('sequence_id') as string
  const spirit_cost = parseInt(formData.get('spirit_cost') as string) || 0

  if (!name?.trim() || !pathway_id || !sequence_id) {
    return { error: 'Name, pathway, and sequence are required' }
  }

  const { error } = await supabase
    .from('skills')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      pathway_id,
      sequence_id,
      spirit_cost
    })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/skills')
  return { success: true }
}

export async function updateSkill(id: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  
  const name = formData.get('name') as string
  const description = formData.get('description') as string | null
  const sequence_id = formData.get('sequence_id') as string
  const spirit_cost = parseInt(formData.get('spirit_cost') as string) || 0

  if (!name?.trim()) return { error: 'Name is required' }

  const { error } = await supabase
    .from('skills')
    .update({
      name: name.trim(),
      description: description?.trim() || null,
      sequence_id,
      spirit_cost
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/skills')
  return { success: true }
}

export async function deleteSkill(id: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('skills')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/skills')
  return { success: true }
}

/* ══════════════════════════════════════════════
   PLAYER PATHWAYS (ความก้าวหน้าผู้เล่น)
   ══════════════════════════════════════════════ */

export async function assignPlayerPathway(playerId: string, pathwayId: string, sequenceId: string | null) {
  const { supabase, user } = await requireAdmin()

  // Upsert: update if exists, insert if not
  const { data: existing } = await supabase
    .from('player_pathways')
    .select('id')
    .eq('player_id', playerId)
    .eq('pathway_id', pathwayId)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('player_pathways')
      .update({ sequence_id: sequenceId })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('player_pathways')
      .insert({ player_id: playerId, pathway_id: pathwayId, sequence_id: sequenceId })
    if (error) return { error: error.message }
  }

  // Notification: player gets notified about pathway assignment
  const adminName = await getDisplayName(supabase, user.id)
  const { data: pw } = await supabase.from('skill_pathways').select('name').eq('id', pathwayId).single()
  await createNotification(supabase, {
    targetUserId: playerId,
    actorId: user.id,
    actorName: adminName,
    type: 'pathway_granted',
    title: `ทีมงานมอบเส้นทาง ${pw?.name || ''} ให้คุณ`,
    link: '/dashboard/skills',
  })

  revalidatePath('/dashboard/skills')
  revalidatePath('/dashboard/players')
  return { success: true }
}

export async function removePlayerPathway(playerId: string, pathwayId: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('player_pathways')
    .delete()
    .eq('player_id', playerId)
    .eq('pathway_id', pathwayId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/skills')
  revalidatePath('/dashboard/players')
  return { success: true }
}

/* ══════════════════════════════════════════════
   USE SKILL (ผู้เล่นใช้สกิล — หักแต้ม Spirituality)
   ══════════════════════════════════════════════ */

export async function castSkill(skillId: string, successRate: number, roll: number, note?: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const normalizedRate = Math.floor(successRate)
  const normalizedRoll = Math.floor(roll)
  const normalizedNote = note?.trim() ? note.trim() : null
  if (!Number.isFinite(normalizedRate) || normalizedRate < 1 || normalizedRate > 20) {
    return { error: 'กรุณาระบุอัตราสำเร็จระหว่าง 1-20' }
  }
  if (!Number.isFinite(normalizedRoll) || normalizedRoll < 1 || normalizedRoll > 20) {
    return { error: 'ผลลัพธ์สุ่มไม่ถูกต้อง' }
  }

  // 1) Fetch skill info
  const { data: skill } = await supabase
    .from('skills')
    .select('id, name, description, spirit_cost, pathway_id, sequence_id')
    .eq('id', skillId)
    .single()

  if (!skill) return { error: 'ไม่พบสกิลนี้' }

  // 2) Fetch player profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('spirituality')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: 'ไม่พบโปรไฟล์ผู้เล่น' }

  // 3) Check if player has enough spirituality
  if (profile.spirituality < skill.spirit_cost) {
    return { error: `พลังวิญญาณไม่เพียงพอ (ต้องการ ${skill.spirit_cost} แต่มี ${profile.spirituality})` }
  }

  // 4) Check player has access to this skill's pathway & sequence
  const { data: pp } = await supabase
    .from('player_pathways')
    .select('id, sequence_id')
    .eq('player_id', user.id)
    .eq('pathway_id', skill.pathway_id)
    .single()

  if (!pp || !pp.sequence_id) return { error: 'คุณไม่มีสิทธิ์ใช้สกิลในเส้นทางนี้' }

  // 5) Check sequence level access
  const { data: playerSeq } = await supabase
    .from('skill_sequences')
    .select('seq_number')
    .eq('id', pp.sequence_id)
    .single()

  const { data: skillSeq } = await supabase
    .from('skill_sequences')
    .select('seq_number')
    .eq('id', skill.sequence_id)
    .single()

  if (!playerSeq || !skillSeq) return { error: 'ข้อมูลลำดับผิดพลาด' }

  // Inverted: 9=weakest, 0=strongest. Player at 7 can use skills at 9,8,7
  if (skillSeq.seq_number < playerSeq.seq_number) {
    return { error: `ลำดับของคุณยังไม่ถึง (ต้องการลำดับ ${skillSeq.seq_number} หรือต่ำกว่า)` }
  }

  // 6) Deduct spirituality
  const { error: deductErr } = await supabase
    .from('profiles')
    .update({ spirituality: profile.spirituality - skill.spirit_cost })
    .eq('id', user.id)

  if (deductErr) return { error: deductErr.message }

  // 7) Generate reference code: uid last 4 chars + ddmmyyyy
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = String(now.getFullYear())
  const uidSuffix = user.id.replace(/-/g, '').slice(-4).toUpperCase()
  const outcome = normalizedRoll >= normalizedRate ? 'S' : 'F'
  const outcomeLabel: 'success' | 'fail' = outcome === 'S' ? 'success' : 'fail'
  const referenceCode = `SKL-${uidSuffix}${dd}${mm}${yyyy}-T${normalizedRate}-R${normalizedRoll}-${outcome}`

  // 8) Log usage with reference code
  await supabase
    .from('skill_usage_logs')
    .insert({
      player_id: user.id,
      skill_id: skillId,
      spirit_cost: skill.spirit_cost,
      reference_code: referenceCode,
      note: normalizedNote,
      success_rate: normalizedRate,
      roll: normalizedRoll,
      outcome: outcomeLabel
    })

  // Notification: admin sees skill usage
  const playerName = await getDisplayName(supabase, user.id)
  await createNotification(supabase, {
    targetUserId: null,
    actorId: user.id,
    actorName: playerName,
    type: 'skill_used',
    title: `${playerName} ใช้สกิล "${skill.name}"`,
    message: `ผลลัพธ์: ${outcomeLabel === 'success' ? 'สำเร็จ' : 'ล้มเหลว'} (${normalizedRoll}/${normalizedRate}) รหัส: ${referenceCode}`,
    link: '/dashboard/skills',
  })

  revalidatePath('/dashboard/skills')
  return {
    success: true,
    remaining: profile.spirituality - skill.spirit_cost,
    skillName: skill.name,
    skillDescription: skill.description || null,
    referenceCode,
    successRate: normalizedRate,
    roll: normalizedRoll,
    outcome: outcomeLabel,
    note: normalizedNote
  }
}
