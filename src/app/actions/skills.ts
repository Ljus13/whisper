'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
   SKILL TYPES (กลุ่ม)
   ══════════════════════════════════════════════ */

export async function createSkillType(formData: FormData) {
  const { supabase } = await requireAdmin()
  
  const name = formData.get('name') as string
  const description = formData.get('description') as string | null

  if (!name?.trim()) return { error: 'Name is required' }

  const { error } = await supabase
    .from('skill_types')
    .insert({ name: name.trim(), description: description?.trim() || null })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/skills')
  return { success: true }
}

export async function updateSkillType(id: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  
  const name = formData.get('name') as string
  const description = formData.get('description') as string | null

  if (!name?.trim()) return { error: 'Name is required' }

  const { error } = await supabase
    .from('skill_types')
    .update({ name: name.trim(), description: description?.trim() || null })
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

  if (!name?.trim() || !type_id) return { error: 'Name and type are required' }

  const { error } = await supabase
    .from('skill_pathways')
    .insert({ name: name.trim(), type_id, description: description?.trim() || null })

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

  if (!name?.trim() || !pathway_id || isNaN(seq_number)) {
    return { error: 'Name, pathway, and sequence number are required' }
  }

  if (seq_number < 0 || seq_number > 9) {
    return { error: 'ลำดับต้องอยู่ระหว่าง 0–9 (9=อ่อนแอที่สุด, 0=แข็งแกร่งที่สุด)' }
  }

  const { error } = await supabase
    .from('skill_sequences')
    .insert({ name: name.trim(), pathway_id, seq_number })

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
  const { supabase } = await requireAdmin()

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

  revalidatePath('/dashboard/skills')
  return { success: true }
}
