'use server'

import { createClient } from '@/lib/supabase/server'
import { normalizePathwayRows, resolveTravelRule } from '@/lib/travel-rules'
import { revalidatePath } from 'next/cache'

/* ── Helper: get user + role ── */
async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, travel_points, max_travel_points, spirituality, max_spirituality, display_name, avatar_url')
    .eq('id', user.id)
    .single()

  if (!profile) throw new Error('Profile not found')

  const isAdmin = profile.role === 'admin' || profile.role === 'dm'
  return { supabase, user, profile, isAdmin }
}

async function getTravelRuleForUser(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('player_pathways')
    .select('pathway:skill_pathways(name), sequence:skill_sequences(seq_number)')
    .eq('player_id', userId)
  const entries = normalizePathwayRows(data ?? [])
  return resolveTravelRule(entries)
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
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
export async function addPlayerToMap(mapId: string, targetUserId?: string, positionX?: number, positionY?: number) {
  const { supabase, user, profile, isAdmin } = await getAuthUser()

  const userId = targetUserId ?? user.id
  const isSelf = userId === user.id

  // Use provided position or default to center
  const startX = positionX ?? 50
  const startY = positionY ?? 50

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
      const rule = await getTravelRuleForUser(supabase, userId)
      const useSpirit = rule.resource === 'spirit'
      const moveCost = rule.crossMapCost
      const currentPoints = useSpirit ? (profile.spirituality ?? 0) : (profile.travel_points ?? 0)
      if (currentPoints < moveCost) {
        const label = useSpirit ? 'พลังวิญญาณ' : 'แต้มเดินทาง'
        return { error: `${label}ไม่พอ (ต้องการ ${moveCost} แต้ม, มี ${currentPoints} แต้ม)` }
      }

      const update = useSpirit
        ? { spirituality: Math.max(0, currentPoints - moveCost) }
        : { travel_points: Math.max(0, currentPoints - moveCost) }

      const { error: tpError } = await supabase
        .from('profiles')
        .update(update)
        .eq('id', userId)

      if (tpError) return { error: tpError.message }
    }

    // Update existing token to new map
    const { error: moveErr } = await supabase
      .from('map_tokens')
      .update({ map_id: mapId, position_x: startX, position_y: startY })
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
        position_x: startX,
        position_y: startY,
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
  const rule = !isAdmin ? await getTravelRuleForUser(supabase, user.id) : null
  const useSpirit = rule?.resource === 'spirit'
  const moveCost = rule ? (isCrossMap ? rule.crossMapCost : rule.moveCost) : (isCrossMap ? 3 : 1)
  const useMapId = targetMapId ?? token.map_id

  // Check locked zones at destination (unless admin/dm)
  if (!isAdmin && !rule?.canBypassLockedZones) {
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
      const currentPoints = useSpirit ? (profile.spirituality ?? 0) : (profile.travel_points ?? 0)
      if (currentPoints < moveCost) {
        const label = useSpirit ? 'พลังวิญญาณ' : 'แต้มเดินทาง'
        return {
          error: `${label}ไม่พอ (ต้องการ ${moveCost} แต้ม, มี ${currentPoints} แต้ม)`,
        }
      }

      const update = useSpirit
        ? { spirituality: Math.max(0, currentPoints - moveCost) }
        : { travel_points: Math.max(0, currentPoints - moveCost) }

      const { error: tpErr } = await supabase
        .from('profiles')
        .update(update)
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
  return { success: true, cost: isAdmin ? 0 : moveCost, resource: isAdmin ? 'free' : (useSpirit ? 'spirit' : 'travel') }
}

export async function moveTokenWithRoleplay(
  tokenId: string,
  newX: number,
  newY: number,
  originUrl: string,
  destinationUrl: string,
  targetMapId?: string
) {
  const { supabase, user, isAdmin } = await getAuthUser()

  const origin = originUrl?.trim()
  const destination = destinationUrl?.trim()
  if (!origin || !destination) return { error: 'กรุณากรอกลิงก์ต้นทางและปลายทาง' }
  if (!isValidUrl(origin) || !isValidUrl(destination)) return { error: 'ลิงก์ต้องเป็น URL ที่ถูกต้อง' }

  const { data: token, error: fetchErr } = await supabase
    .from('map_tokens')
    .select('*')
    .eq('id', tokenId)
    .single()

  if (fetchErr || !token) return { error: 'ไม่พบ Token' }

  const isOwnToken = token.user_id === user.id
  if (!isOwnToken && !isAdmin) {
    return { error: 'ไม่มีสิทธิ์ย้ายตัวละครนี้' }
  }

  const isCrossMap = targetMapId && targetMapId !== token.map_id
  const rule = !isAdmin ? await getTravelRuleForUser(supabase, user.id) : null
  const useMapId = targetMapId ?? token.map_id

  if (!isAdmin && !rule?.canBypassLockedZones) {
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
          const allowed = z.allowed_user_ids?.includes(user.id)
          if (!allowed) {
            return { error: z.message || 'พื้นที่นี้ถูกล็อค' }
          }
        }
      }
    }
  }

  const clampedX = Math.max(0, Math.min(100, newX))
  const clampedY = Math.max(0, Math.min(100, newY))

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

  const { error: logErr } = await supabase
    .from('travel_roleplay_logs')
    .insert({
      player_id: token.user_id,
      token_id: token.id,
      from_map_id: token.map_id,
      to_map_id: isCrossMap ? targetMapId : token.map_id,
      from_x: token.position_x,
      from_y: token.position_y,
      to_x: clampedX,
      to_y: clampedY,
      origin_url: origin,
      destination_url: destination,
      move_type: isCrossMap ? 'cross_map' : 'same_map',
    })

  if (logErr) return { error: logErr.message }

  revalidatePath('/dashboard/maps', 'layout')
  return { success: true, cost: 0, resource: 'roleplay' }
}

export async function addPlayerToMapWithRoleplay(
  mapId: string,
  originUrl: string,
  destinationUrl: string,
  targetUserId?: string,
  positionX?: number,
  positionY?: number
) {
  const { supabase, user, isAdmin } = await getAuthUser()

  const origin = originUrl?.trim()
  const destination = destinationUrl?.trim()
  if (!origin || !destination) return { error: 'กรุณากรอกลิงก์ต้นทางและปลายทาง' }
  if (!isValidUrl(origin) || !isValidUrl(destination)) return { error: 'ลิงก์ต้องเป็น URL ที่ถูกต้อง' }

  const userId = targetUserId ?? user.id
  const isSelf = userId === user.id

  const startX = positionX ?? 50
  const startY = positionY ?? 50

  if (!isSelf && !isAdmin) {
    return { error: 'ต้องเป็นแอดมินหรือ DM เท่านั้น' }
  }

  const { data: existing } = await supabase
    .from('map_tokens')
    .select('id, map_id, position_x, position_y, user_id')
    .eq('user_id', userId)
    .single()

  const rule = !isAdmin ? await getTravelRuleForUser(supabase, userId) : null
  if (!isAdmin && !rule?.canBypassLockedZones) {
    const { data: zones } = await supabase
      .from('map_locked_zones')
      .select('*')
      .eq('map_id', mapId)

    if (zones) {
      for (const z of zones) {
        const inZone =
          startX >= z.zone_x &&
          startX <= z.zone_x + z.zone_width &&
          startY >= z.zone_y &&
          startY <= z.zone_y + z.zone_height

        if (inZone) {
          const allowed = z.allowed_user_ids?.includes(user.id)
          if (!allowed) {
            return { error: z.message || 'พื้นที่นี้ถูกล็อค' }
          }
        }
      }
    }
  }

  if (existing) {
    if (existing.map_id === mapId) {
      return { error: 'ตัวละครอยู่ในแมพนี้แล้ว' }
    }

    const { error: moveErr } = await supabase
      .from('map_tokens')
      .update({ map_id: mapId, position_x: startX, position_y: startY })
      .eq('id', existing.id)

    if (moveErr) return { error: moveErr.message }

    const { error: logErr } = await supabase
      .from('travel_roleplay_logs')
      .insert({
        player_id: existing.user_id,
        token_id: existing.id,
        from_map_id: existing.map_id,
        to_map_id: mapId,
        from_x: existing.position_x,
        from_y: existing.position_y,
        to_x: startX,
        to_y: startY,
        origin_url: origin,
        destination_url: destination,
        move_type: 'cross_map',
      })

    if (logErr) return { error: logErr.message }
  } else {
    const { data: insertRow, error: insertErr } = await supabase
      .from('map_tokens')
      .insert({
        map_id: mapId,
        user_id: userId,
        token_type: 'player',
        position_x: startX,
        position_y: startY,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (insertErr) return { error: insertErr.message }

    const { error: logErr } = await supabase
      .from('travel_roleplay_logs')
      .insert({
        player_id: userId,
        token_id: insertRow?.id ?? null,
        from_map_id: null,
        to_map_id: mapId,
        from_x: null,
        from_y: null,
        to_x: startX,
        to_y: startY,
        origin_url: origin,
        destination_url: destination,
        move_type: 'first_entry',
      })

    if (logErr) return { error: logErr.message }
  }

  revalidatePath('/dashboard/maps', 'layout')
  return { success: true }
}

const TRAVEL_ROLEPLAY_PAGE_SIZE = 50

export async function getTravelRoleplayLogs(page: number = 1) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { logs: [], total: 0, page: 1, totalPages: 1, isAdmin: false }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'dm'
  const offset = (page - 1) * TRAVEL_ROLEPLAY_PAGE_SIZE

  let countQuery = supabase.from('travel_roleplay_logs').select('id', { count: 'exact', head: true })
  if (!isAdmin) countQuery = countQuery.eq('player_id', user.id)
  const { count } = await countQuery

  let dataQuery = supabase
    .from('travel_roleplay_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + TRAVEL_ROLEPLAY_PAGE_SIZE - 1)
  if (!isAdmin) dataQuery = dataQuery.eq('player_id', user.id)
  const { data, error } = await dataQuery

  if (error) return { logs: [], total: 0, page, totalPages: 1, isAdmin }

  const rows = data || []
  const mapIds = Array.from(new Set(rows.flatMap(r => [r.from_map_id, r.to_map_id]).filter(Boolean)))
  const playerIds = Array.from(new Set(rows.map(r => r.player_id).filter(Boolean)))

  const [mapsRes, profilesRes] = await Promise.all([
    mapIds.length > 0
      ? supabase.from('maps').select('id, name').in('id', mapIds)
      : { data: [] },
    playerIds.length > 0
      ? supabase.from('profiles').select('id, display_name, avatar_url').in('id', playerIds)
      : { data: [] },
  ])

  const mapMap = new Map((mapsRes.data || []).map(m => [m.id, m]))
  const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p]))

  const logs = rows.map(r => {
    const profileRow = profileMap.get(r.player_id)
    return {
      id: r.id,
      player_id: r.player_id,
      player_name: profileRow?.display_name || 'ไม่ทราบชื่อ',
      player_avatar: profileRow?.avatar_url || null,
      token_id: r.token_id,
      from_map_id: r.from_map_id,
      to_map_id: r.to_map_id,
      from_map_name: r.from_map_id ? (mapMap.get(r.from_map_id)?.name || '—') : '—',
      to_map_name: r.to_map_id ? (mapMap.get(r.to_map_id)?.name || '—') : '—',
      from_x: r.from_x,
      from_y: r.from_y,
      to_x: r.to_x,
      to_y: r.to_y,
      origin_url: r.origin_url,
      destination_url: r.destination_url,
      move_type: r.move_type,
      created_at: r.created_at,
    }
  })

  return { logs, total: count || 0, page, totalPages: Math.ceil((count || 0) / TRAVEL_ROLEPLAY_PAGE_SIZE), isAdmin }
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
