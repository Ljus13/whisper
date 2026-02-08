'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/* ── Helper: verify admin/dm role ── */
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
   ADMIN: Update any player's profile fields
   ══════════════════════════════════════════════ */
export async function adminUpdatePlayer(playerId: string, formData: FormData) {
  const { supabase } = await requireAdmin()

  const display_name = formData.get('display_name') as string | null
  const avatar_url = formData.get('avatar_url') as string | null
  const role = formData.get('role') as string | null
  const hp_delta = formData.get('hp_delta')
  const sanity_delta = formData.get('sanity_delta')
  const max_sanity = formData.get('max_sanity')
  const spirituality = formData.get('spirituality')
  const max_spirituality = formData.get('max_spirituality')
  const travel_points = formData.get('travel_points')
  const max_travel_points = formData.get('max_travel_points')

  // Build update object — only include fields that were provided
  const updates: Record<string, unknown> = {}

  if (display_name !== null && display_name !== '') {
    updates.display_name = display_name.trim()
  }
  if (avatar_url !== null) {
    updates.avatar_url = avatar_url.trim() || null
  }
  if (role && ['player', 'admin', 'dm'].includes(role)) {
    updates.role = role
  }
  // HP & Sanity use delta (add/subtract from current value)
  let hpDelta = 0
  let sanityDelta = 0
  if (hp_delta !== null && hp_delta !== '' && hp_delta !== '0') {
    const val = parseInt(hp_delta as string)
    if (!isNaN(val)) hpDelta = val
  }
  if (sanity_delta !== null && sanity_delta !== '' && sanity_delta !== '0') {
    const val = parseInt(sanity_delta as string)
    if (!isNaN(val)) sanityDelta = val
  }
  if (max_sanity !== null && max_sanity !== '') {
    const val = parseInt(max_sanity as string)
    if (!isNaN(val) && val >= 1) updates.max_sanity = val
  }
  if (spirituality !== null && spirituality !== '') {
    const val = parseInt(spirituality as string)
    if (!isNaN(val) && val >= 0) updates.spirituality = val
  }
  if (max_spirituality !== null && max_spirituality !== '') {
    const val = parseInt(max_spirituality as string)
    if (!isNaN(val) && val >= 1) updates.max_spirituality = val
  }
  if (travel_points !== null && travel_points !== '') {
    const val = parseInt(travel_points as string)
    if (!isNaN(val) && val >= 0) updates.travel_points = val
  }
  if (max_travel_points !== null && max_travel_points !== '') {
    const val = parseInt(max_travel_points as string)
    if (!isNaN(val) && val >= 1) updates.max_travel_points = val
  }

  const hasDelta = hpDelta !== 0 || sanityDelta !== 0

  if (Object.keys(updates).length === 0 && !hasDelta) {
    return { error: 'No fields to update' }
  }

  // If we have deltas, fetch current values first
  if (hasDelta) {
    const { data: current } = await supabase
      .from('profiles')
      .select('hp, sanity, max_sanity')
      .eq('id', playerId)
      .single()

    if (current) {
      if (hpDelta !== 0) {
        updates.hp = Math.max(0, (current.hp ?? 0) + hpDelta)
      }
      if (sanityDelta !== 0) {
        const maxSan = (updates.max_sanity as number) ?? current.max_sanity ?? 10
        updates.sanity = Math.max(0, Math.min(maxSan, (current.sanity ?? 0) + sanityDelta))
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return { error: 'No fields to update' }
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', playerId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/players')
  return { success: true }
}

/* ══════════════════════════════════════════════
   FETCH: Get all players with their pathways
   ══════════════════════════════════════════════ */
export async function getAllPlayers() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', players: [] }

  const { data: players, error } = await supabase
    .from('profiles')
    .select('*')
    .order('display_name')

  if (error) return { error: error.message, players: [] }
  return { players: players || [] }
}

/* ══════════════════════════════════════════════
   SANITY: Apply daily decay for current user
   ══════════════════════════════════════════════ */
export async function applySanityDecay() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .rpc('apply_sanity_decay', { player_uuid: user.id })

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { sanity: data }
}
