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

/* ── Helper: require admin/dm ── */
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'dm'))
    throw new Error('Admin or DM role required')

  return { supabase, user }
}

/* ══════════════════════════════════════════════
   GET: All religions
   ══════════════════════════════════════════════ */
export async function getReligions() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('religions')
    .select('*')
    .order('name_th')

  if (error) return { error: error.message, religions: [] }
  return { religions: data ?? [] }
}

/* ══════════════════════════════════════════════
   CREATE religion (DM only)
   ══════════════════════════════════════════════ */
export async function createReligion(form: {
  name_th: string
  name_en: string
  deity_th?: string
  deity_en?: string
  overview?: string
  teachings?: string
  bg_url?: string
  logo_url?: string
}) {
  const { supabase, user } = await requireAdmin()

  if (!form.name_th.trim() || !form.name_en.trim()) {
    return { error: 'ต้องระบุชื่อไทยและอังกฤษ' }
  }

  const { error } = await supabase.from('religions').insert({
    name_th: form.name_th.trim(),
    name_en: form.name_en.trim(),
    deity_th: form.deity_th?.trim() || null,
    deity_en: form.deity_en?.trim() || null,
    overview: form.overview?.trim() || null,
    teachings: form.teachings?.trim() || null,
    bg_url: form.bg_url?.trim() || null,
    logo_url: form.logo_url?.trim() || null,
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/players')
  return { success: true }
}

/* ══════════════════════════════════════════════
   UPDATE religion (DM only)
   ══════════════════════════════════════════════ */
export async function updateReligion(id: string, form: {
  name_th: string
  name_en: string
  deity_th?: string
  deity_en?: string
  overview?: string
  teachings?: string
  bg_url?: string
  logo_url?: string
}) {
  const { supabase } = await requireAdmin()

  if (!form.name_th.trim() || !form.name_en.trim()) {
    return { error: 'ต้องระบุชื่อไทยและอังกฤษ' }
  }

  const { error } = await supabase.from('religions').update({
    name_th: form.name_th.trim(),
    name_en: form.name_en.trim(),
    deity_th: form.deity_th?.trim() || null,
    deity_en: form.deity_en?.trim() || null,
    overview: form.overview?.trim() || null,
    teachings: form.teachings?.trim() || null,
    bg_url: form.bg_url?.trim() || null,
    logo_url: form.logo_url?.trim() || null,
  }).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/players')
  return { success: true }
}

/* ══════════════════════════════════════════════
   DELETE religion (DM only)
   ══════════════════════════════════════════════ */
export async function deleteReligion(id: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase.from('religions').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/players')
  return { success: true }
}

/* ══════════════════════════════════════════════
   SET player religion (admin/player sets own)
   ══════════════════════════════════════════════ */
export async function setPlayerReligion(religionId: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .update({ religion_id: religionId })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/players')
  return { success: true }
}

/* ══════════════════════════════════════════════
   CHURCH: Add church to map (DM only)
   ══════════════════════════════════════════════ */
export async function addChurchToMap(mapId: string, religionId: string, radius: number) {
  const { supabase, user } = await requireAdmin()

  const { error } = await supabase.from('map_churches').insert({
    map_id: mapId,
    religion_id: religionId,
    position_x: 50,
    position_y: 50,
    radius: Math.max(1, Math.min(50, radius)),
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/maps')
  return { success: true }
}

/* ══════════════════════════════════════════════
   CHURCH: Move church position (DM only)
   ══════════════════════════════════════════════ */
export async function moveChurch(churchId: string, x: number, y: number) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase.from('map_churches').update({
    position_x: x,
    position_y: y,
  }).eq('id', churchId)

  if (error) return { error: error.message }
  return { success: true }
}

/* ══════════════════════════════════════════════
   CHURCH: Update radius (DM only)
   ══════════════════════════════════════════════ */
export async function updateChurchRadius(churchId: string, radius: number) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase.from('map_churches').update({
    radius: Math.max(1, Math.min(50, radius)),
  }).eq('id', churchId)

  if (error) return { error: error.message }
  return { success: true }
}

/* ══════════════════════════════════════════════
   CHURCH: Delete (DM only)
   ══════════════════════════════════════════════ */
export async function deleteChurch(churchId: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase.from('map_churches').delete().eq('id', churchId)
  if (error) return { error: error.message }
  return { success: true }
}

/* ══════════════════════════════════════════════
   PRAYER: Submit prayer (player)
   - Check: player has religion
   - Check: player is on map near a church of that religion
   - Grant: +1 sanity per URL, capped at max_sanity
   ══════════════════════════════════════════════ */
export async function submitPrayer(evidenceUrls: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Validate URLs (min 2)
  const urls = evidenceUrls.filter(u => u.trim())
  if (urls.length < 2) return { error: 'ต้องแนบ URL อย่างน้อย 2 ลิงก์' }

  // 1. Get player profile + religion
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, religion_id, sanity, max_sanity')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: 'ไม่พบโปรไฟล์' }
  if (!profile.religion_id) return { error: 'คุณยังไม่ได้เลือกศาสนา กรุณาตั้งค่าศาสนาก่อน' }

  // Already at max sanity?
  if (profile.sanity >= profile.max_sanity) {
    return { error: `สติเต็มแล้ว (${profile.sanity}/${profile.max_sanity})` }
  }

  // 2. Find player's current position on a map
  const { data: playerToken } = await supabase
    .from('map_tokens')
    .select('id, map_id, position_x, position_y')
    .eq('user_id', user.id)
    .single()

  if (!playerToken) return { error: 'คุณยังไม่ได้อยู่บนแผนที่ใด ๆ' }

  // 3. Find churches of the player's religion on the same map
  const { data: churches } = await supabase
    .from('map_churches')
    .select('id, position_x, position_y, radius')
    .eq('map_id', playerToken.map_id)
    .eq('religion_id', profile.religion_id)

  if (!churches || churches.length === 0) {
    return { error: 'ไม่พบโบสถ์ของศาสนาคุณในแผนที่นี้' }
  }

  // 4. Check if player is within range of any church
  const inRange = churches.find(c => {
    const dx = playerToken.position_x - c.position_x
    const dy = playerToken.position_y - c.position_y
    const dist = Math.sqrt(dx * dx + dy * dy)
    return dist <= c.radius
  })

  if (!inRange) {
    return { error: 'คุณอยู่นอกระยะทำการของโบสถ์ กรุณาเดินเข้าไปให้ใกล้ขึ้น' }
  }

  // 5. Calculate sanity gain: +1 per URL, capped at max_sanity
  const gain = Math.min(urls.length, profile.max_sanity - profile.sanity)

  // 6. Insert prayer log
  const { error: logError } = await supabase.from('prayer_logs').insert({
    player_id: user.id,
    church_id: inRange.id,
    evidence_urls: urls,
    sanity_gained: gain,
  })
  if (logError) return { error: logError.message }

  // 7. Update sanity
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ sanity: Math.min(profile.max_sanity, profile.sanity + gain) })
    .eq('id', user.id)

  if (updateError) return { error: updateError.message }

  // Notification: admin sees prayer submission
  const playerName = await getDisplayName(supabase, user.id)
  await createNotification(supabase, {
    targetUserId: null,
    actorId: user.id,
    actorName: playerName,
    type: 'prayer_submitted',
    title: `${playerName} สวดมนต์ที่โบสถ์`,
    message: `สติเพิ่ม +${gain} (ลิงก์ ${urls.length} รายการ)`,
    link: '/dashboard/action-quest',
  })

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/action-quest')
  return { success: true, gained: gain, newSanity: Math.min(profile.max_sanity, profile.sanity + gain) }
}

const PRAYER_PAGE_SIZE = 20

/* ══════════════════════════════════════════════
   GET: Prayer logs for current user (with pagination)
   ══════════════════════════════════════════════ */
export async function getPrayerLogs(page: number = 1) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { logs: [], total: 0, page: 1, totalPages: 1 }

  const offset = (page - 1) * PRAYER_PAGE_SIZE

  const { count } = await supabase
    .from('prayer_logs')
    .select('*', { count: 'exact', head: true })
    .eq('player_id', user.id)

  const { data } = await supabase
    .from('prayer_logs')
    .select(`
      *,
      map_churches (
        id, map_id, religion_id,
        maps ( name ),
        religions ( name_th, logo_url )
      )
    `)
    .eq('player_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + PRAYER_PAGE_SIZE - 1)

  return {
    logs: data ?? [],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / PRAYER_PAGE_SIZE),
  }
}

/* ══════════════════════════════════════════════
   GET: All prayer logs (admin/dm only)
   ══════════════════════════════════════════════ */
export async function getAllPrayerLogs(page: number = 1) {
  const { supabase } = await requireAdmin()

  const offset = (page - 1) * PRAYER_PAGE_SIZE

  const { count } = await supabase
    .from('prayer_logs')
    .select('*', { count: 'exact', head: true })

  // 1. Fetch logs with church details using implicit join involved with public tables
  // We avoid joining 'profiles' directly via SQL because the FK on prayer_logs 
  // currently points to auth.users, not profiles, which prevents PostgREST from joining.
  const { data: logs, error } = await supabase
    .from('prayer_logs')
    .select(`
      id,
      player_id,
      church_id,
      evidence_urls,
      sanity_gained,
      created_at,
      map_churches (
        id,
        map_id,
        religion_id,
        maps (
          id,
          name
        ),
        religions (
          id,
          name_th,
          name_en,
          logo_url
        )
      )
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + PRAYER_PAGE_SIZE - 1)

  if (error) {
    console.error('getAllPrayerLogs error:', error)
    return { error: error.message, logs: [], total: 0, page: 1, totalPages: 1 }
  }

  if (!logs || logs.length === 0) return { logs: [], total: count || 0, page, totalPages: Math.ceil((count || 0) / PRAYER_PAGE_SIZE) }

  // 2. Manual Join for Profiles
  const playerIds = Array.from(new Set(logs.map(l => l.player_id)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', playerIds)

  const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? [])

  // 3. Merge data
  const mergedLogs = logs.map(log => ({
    ...log,
    profiles: profileMap.get(log.player_id) || null
  }))

  return { logs: mergedLogs, total: count || 0, page, totalPages: Math.ceil((count || 0) / PRAYER_PAGE_SIZE) }
}
