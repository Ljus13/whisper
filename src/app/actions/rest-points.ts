'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/* ══════════════════════════════════════════
   Helper: require admin/dm
   ══════════════════════════════════════════ */
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'dm'].includes(profile.role)) throw new Error('Admin/DM required')
  return { supabase, user }
}

/* ══════════════════════════════════════════
   REST POINT: Add to map
   ══════════════════════════════════════════ */
export async function addRestPoint(mapId: string, name: string, radius: number, imageUrl?: string) {
  const { supabase, user } = await requireAdmin()

  if (!name.trim()) return { error: 'ต้องกรอกชื่อจุดพัก' }

  const { error } = await supabase.from('map_rest_points').insert({
    map_id: mapId,
    name: name.trim(),
    image_url: imageUrl?.trim() || null,
    radius: Math.max(1, Math.min(50, radius)),
    position_x: 50,
    position_y: 50,
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/maps')
  return { success: true }
}

/* ══════════════════════════════════════════
   REST POINT: Move position
   ══════════════════════════════════════════ */
export async function moveRestPoint(restPointId: string, x: number, y: number) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase.from('map_rest_points').update({
    position_x: x,
    position_y: y,
  }).eq('id', restPointId)

  if (error) return { error: error.message }
  return { success: true }
}

/* ══════════════════════════════════════════
   REST POINT: Update radius
   ══════════════════════════════════════════ */
export async function updateRestPointRadius(restPointId: string, radius: number) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase.from('map_rest_points').update({
    radius: Math.max(1, Math.min(50, radius)),
  }).eq('id', restPointId)

  if (error) return { error: error.message }
  return { success: true }
}

/* ══════════════════════════════════════════
   REST POINT: Delete
   ══════════════════════════════════════════ */
export async function deleteRestPoint(restPointId: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase.from('map_rest_points').delete().eq('id', restPointId)
  if (error) return { error: error.message }
  return { success: true }
}

/* ══════════════════════════════════════════
   REST POINT: Check if player is in a rest zone
   ══════════════════════════════════════════ */
export async function isPlayerInRestZone() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  // Get player's token position
  const { data: token } = await supabase
    .from('map_tokens')
    .select('position_x, position_y, map_id')
    .eq('user_id', user.id)
    .eq('token_type', 'player')
    .maybeSingle()

  if (!token) return false

  // Get rest points on the same map
  const { data: restPoints } = await supabase
    .from('map_rest_points')
    .select('position_x, position_y, radius')
    .eq('map_id', token.map_id)

  if (!restPoints || restPoints.length === 0) return false

  // Check if player is within any rest point radius
  for (const rp of restPoints) {
    const dx = token.position_x - rp.position_x
    const dy = token.position_y - rp.position_y
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance <= rp.radius) return true
  }

  return false
}

/* ══════════════════════════════════════════
   SLEEP STATUS: Check if player has pending sleep
   Returns { isSleeping, autoApproveTime }
   ══════════════════════════════════════════ */
export async function getPlayerSleepPendingStatus() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { isSleeping: false }

  // Check profile role
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role === 'admin' || profile?.role === 'dm') return { isSleeping: false }

  // Get the most recent sleep request
  const { data: latestSleep } = await supabase
    .from('sleep_requests')
    .select('id, status, created_at')
    .eq('player_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latestSleep || latestSleep.status !== 'pending') {
    return { isSleeping: false }
  }

  // Calculate auto-approve time (midnight tonight)
  const createdAt = new Date(latestSleep.created_at)
  const midnight = new Date(createdAt)
  midnight.setDate(midnight.getDate() + 1)
  midnight.setHours(0, 0, 0, 0)

  return {
    isSleeping: true,
    autoApproveTime: midnight.toISOString(),
    createdAt: latestSleep.created_at,
  }
}
