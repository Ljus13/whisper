'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/* ── Helper: get user + role ── */
async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, travel_points, max_travel_points, display_name, avatar_url')
    .eq('id', user.id)
    .single()

  if (!profile) throw new Error('Profile not found')

  const isAdmin = profile.role === 'admin' || profile.role === 'dm'
  return { supabase, user, profile, isAdmin }
}

/* ── Helper: require admin/dm ── */
async function requireAdmin() {
  const ctx = await getAuthUser()
  if (!ctx.isAdmin) throw new Error('Admin or DM role required')
  return ctx
}

/* ══════════════════════════════════════════════
   GET: All tokens on a map (with profile data)
   ══════════════════════════════════════════════ */
export async function getMapTokens(mapId: string) {
  const supabase = await createClient()

  // Fetch tokens
  const { data: tokens, error } = await supabase
    .from('map_tokens')
    .select('*')
    .eq('map_id', mapId)

  if (error) throw new Error(error.message)
  if (!tokens || tokens.length === 0) return []

  // Get profile data for player tokens
  const playerIds = tokens
    .filter(t => t.token_type === 'player' && t.user_id)
    .map(t => t.user_id!)

  let profileMap: Record<string, { display_name: string | null; avatar_url: string | null; role: string }> = {}
  if (playerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, role')
      .in('id', playerIds)

    if (profiles) {
      profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))
    }
  }

  // Merge
  return tokens.map(t => ({
    ...t,
    display_name: t.user_id ? (profileMap[t.user_id]?.display_name ?? null) : t.npc_name,
    avatar_url: t.user_id ? (profileMap[t.user_id]?.avatar_url ?? null) : t.npc_image_url,
    role: t.user_id ? (profileMap[t.user_id]?.role ?? null) : null,
  }))
}

/* ══════════════════════════════════════════════
   GET: All locked zones on a map
   ══════════════════════════════════════════════ */
export async function getMapLockedZones(mapId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('map_locked_zones')
    .select('*')
    .eq('map_id', mapId)

  if (error) throw new Error(error.message)
  return data ?? []
}

/* ══════════════════════════════════════════════
   GET: Find which map the current user is on
   ══════════════════════════════════════════════ */
export async function getMyTokenLocation() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('map_tokens')
    .select('id, map_id, position_x, position_y')
    .eq('user_id', user.id)
    .single()

  return data ?? null
}

/* ══════════════════════════════════════════════
   ADD PLAYER TO MAP
   - Player adds self (free first time)
   - Admin/DM adds anyone
   ══════════════════════════════════════════════ */
export async function addPlayerToMap(mapId: string, targetUserId?: string) {
  const { supabase, user, profile, isAdmin } = await getAuthUser()

  const userId = targetUserId ?? user.id
  const isSelf = userId === user.id

  // Only admin/dm can add others
  if (!isSelf && !isAdmin) {
    return { error: 'ต้องเป็นแอดมินหรือ DM เท่านั้น' }
  }

  // Check if player already has a token somewhere
  const { data: existing } = await supabase
    .from('map_tokens')
    .select('id, map_id')
    .eq('user_id', userId)
    .single()

  if (existing) {
    if (existing.map_id === mapId) {
      return { error: 'ตัวละครอยู่ในแมพนี้แล้ว' }
    }

    // Moving to different map — costs 3 travel points (unless admin/dm)
    if (isSelf && !isAdmin) {
      if (profile.travel_points < 3) {
        return { error: `แต้มเดินทางไม่พอ (ต้องการ 3 แต้ม, มี ${profile.travel_points} แต้ม)` }
      }

      // Deduct travel points
      const { error: tpError } = await supabase
        .from('profiles')
        .update({ travel_points: profile.travel_points - 3 })
        .eq('id', userId)

      if (tpError) return { error: tpError.message }
    }

    // Update existing token to new map
    const { error: moveErr } = await supabase
      .from('map_tokens')
      .update({ map_id: mapId, position_x: 50, position_y: 50 })
      .eq('id', existing.id)

    if (moveErr) return { error: moveErr.message }
  } else {
    // First time placing — free
    const { error: insertErr } = await supabase
      .from('map_tokens')
      .insert({
        map_id: mapId,
        user_id: userId,
        token_type: 'player',
        position_x: 50,
        position_y: 50,
        created_by: user.id,
      })

    if (insertErr) return { error: insertErr.message }
  }

  revalidatePath('/dashboard/maps', 'layout')
  return { success: true }
}

/* ══════════════════════════════════════════════
   ADD NPC TO MAP (admin/dm only)
   ══════════════════════════════════════════════ */
export async function addNpcToMap(mapId: string, name: string, imageUrl: string) {
  const { supabase, user } = await requireAdmin()

  if (!name?.trim()) return { error: 'ชื่อ NPC ห้ามว่าง' }
  if (!imageUrl?.trim()) return { error: 'URL รูป NPC ห้ามว่าง' }

  const { error } = await supabase
    .from('map_tokens')
    .insert({
      map_id: mapId,
      npc_name: name.trim(),
      npc_image_url: imageUrl.trim(),
      token_type: 'npc',
      position_x: 50,
      position_y: 50,
      created_by: user.id,
    })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/maps', 'layout')
  return { success: true }
}

/* ══════════════════════════════════════════════
   MOVE TOKEN (drag-and-drop)
   - Same map: costs 1 travel point
   - Different map: costs 3 travel points
   - Admin/DM: free
   ══════════════════════════════════════════════ */
export async function moveToken(
  tokenId: string,
  newX: number,
  newY: number,
  targetMapId?: string
) {
  const { supabase, user, profile, isAdmin } = await getAuthUser()

  // Get the token
  const { data: token, error: fetchErr } = await supabase
    .from('map_tokens')
    .select('*')
    .eq('id', tokenId)
    .single()

  if (fetchErr || !token) return { error: 'ไม่พบ Token' }

  // Check permission: own token or admin
  const isOwnToken = token.user_id === user.id
  if (!isOwnToken && !isAdmin) {
    return { error: 'ไม่มีสิทธิ์ย้ายตัวละครนี้' }
  }

  const isCrossMap = targetMapId && targetMapId !== token.map_id
  const moveCost = isCrossMap ? 3 : 1
  const useMapId = targetMapId ?? token.map_id

  // Check locked zones at destination (unless admin/dm)
  if (!isAdmin) {
    const { data: zones } = await supabase
      .from('map_locked_zones')
      .select('*')
      .eq('map_id', useMapId)

    if (zones) {
      for (const z of zones) {
        const inZone =
          newX >= z.zone_x &&
          newX <= z.zone_x + z.zone_width &&
          newY >= z.zone_y &&
          newY <= z.zone_y + z.zone_height

        if (inZone) {
          // Check if user is allowed
          const allowed = z.allowed_user_ids?.includes(user.id)
          if (!allowed) {
            return { error: z.message || 'พื้นที่นี้ถูกล็อค' }
          }
        }
      }
    }

    // Check travel points (only for player's own token)
    if (isOwnToken) {
      if (profile.travel_points < moveCost) {
        return {
          error: `แต้มเดินทางไม่พอ (ต้องการ ${moveCost} แต้ม, มี ${profile.travel_points} แต้ม)`,
        }
      }

      // Deduct travel points
      const { error: tpErr } = await supabase
        .from('profiles')
        .update({ travel_points: profile.travel_points - moveCost })
        .eq('id', user.id)

      if (tpErr) return { error: tpErr.message }
    }
  }

  // Clamp position
  const clampedX = Math.max(0, Math.min(100, newX))
  const clampedY = Math.max(0, Math.min(100, newY))

  // Update token position (and map if cross-map)
  const updateData: Record<string, unknown> = {
    position_x: clampedX,
    position_y: clampedY,
  }
  if (isCrossMap) {
    updateData.map_id = targetMapId
  }

  const { error: updateErr } = await supabase
    .from('map_tokens')
    .update(updateData)
    .eq('id', tokenId)

  if (updateErr) return { error: updateErr.message }

  revalidatePath('/dashboard/maps', 'layout')
  return { success: true, cost: isAdmin ? 0 : moveCost }
}

/* ══════════════════════════════════════════════
   REMOVE TOKEN FROM MAP (admin/dm only)
   ══════════════════════════════════════════════ */
export async function removeTokenFromMap(tokenId: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('map_tokens')
    .delete()
    .eq('id', tokenId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/maps', 'layout')
  return { success: true }
}

/* ══════════════════════════════════════════════
   LOCKED ZONE: Create
   ══════════════════════════════════════════════ */
export async function createLockedZone(
  mapId: string,
  zone: { zone_x: number; zone_y: number; zone_width: number; zone_height: number; message?: string; allowed_user_ids?: string[] }
) {
  const { supabase, user } = await requireAdmin()

  const { error } = await supabase
    .from('map_locked_zones')
    .insert({
      map_id: mapId,
      zone_x: zone.zone_x,
      zone_y: zone.zone_y,
      zone_width: zone.zone_width,
      zone_height: zone.zone_height,
      message: zone.message || 'พื้นที่นี้ถูกล็อค',
      allowed_user_ids: zone.allowed_user_ids ?? [],
      created_by: user.id,
    })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/maps', 'layout')
  return { success: true }
}

/* ══════════════════════════════════════════════
   LOCKED ZONE: Update
   ══════════════════════════════════════════════ */
export async function updateLockedZone(
  zoneId: string,
  zone: { zone_x?: number; zone_y?: number; zone_width?: number; zone_height?: number; message?: string; allowed_user_ids?: string[] }
) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('map_locked_zones')
    .update(zone)
    .eq('id', zoneId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/maps', 'layout')
  return { success: true }
}

/* ══════════════════════════════════════════════
   LOCKED ZONE: Delete
   ══════════════════════════════════════════════ */
export async function deleteLockedZone(zoneId: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('map_locked_zones')
    .delete()
    .eq('id', zoneId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/maps', 'layout')
  return { success: true }
}

/* ══════════════════════════════════════════════
   TOGGLE EMBED (admin/dm only)
   ══════════════════════════════════════════════ */
export async function toggleMapEmbed(mapId: string, enabled: boolean) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('maps')
    .update({ embed_enabled: enabled })
    .eq('id', mapId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/maps', 'layout')
  return { success: true }
}

/* ══════════════════════════════════════════════
   UPDATE NPC INTERACTION RADIUS (admin/dm only)
   ══════════════════════════════════════════════ */
export async function updateNpcRadius(tokenId: string, radius: number) {
  const { supabase } = await requireAdmin()

  if (radius < 0 || radius > 50) return { error: 'รัศมีต้องอยู่ระหว่าง 0-50%' }

  const { data: token } = await supabase
    .from('map_tokens')
    .select('token_type')
    .eq('id', tokenId)
    .single()

  if (!token) return { error: 'ไม่พบ Token' }
  if (token.token_type !== 'npc') return { error: 'เฉพาะ NPC เท่านั้นที่ตั้งค่ารัศมีได้' }

  const { error } = await supabase
    .from('map_tokens')
    .update({ interaction_radius: radius })
    .eq('id', tokenId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/maps', 'layout')
  return { success: true }
}

/* ══════════════════════════════════════════════
   GET ALL PLAYERS (for admin add-to-map UI)
   ══════════════════════════════════════════════ */
export async function getAllPlayers() {
  const { supabase } = await getAuthUser()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, role')
    .order('display_name')

  if (error) throw new Error(error.message)
  return data ?? []
}
