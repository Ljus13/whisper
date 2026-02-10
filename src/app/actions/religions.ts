'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/action-quest')
  return { success: true, gained: gain, newSanity: Math.min(profile.max_sanity, profile.sanity + gain) }
}

/* ══════════════════════════════════════════════
   GET: Prayer logs for current user
   ══════════════════════════════════════════════ */
export async function getPrayerLogs() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('prayer_logs')
    .select('*')
    .eq('player_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return data ?? []
}
