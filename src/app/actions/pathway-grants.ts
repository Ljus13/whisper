'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotification } from '@/app/actions/notifications'
import { notifyPathwayAccepted } from '@/lib/discord-notify'

/* ── Helper: get display name ── */
async function getDisplayName(supabase: any, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single()
  return data?.display_name || 'ผู้เล่น'
}

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

export async function grantPathwayChoices(playerId: string, pathwayIds: string[]) {
  const { supabase, user } = await requireAdmin()
  if (!playerId) return { error: 'ไม่พบผู้เล่นที่ต้องการมอบโอสถ' }
  if (!pathwayIds || pathwayIds.length === 0) return { error: 'กรุณาเลือกเส้นทางอย่างน้อย 1 รายการ' }

  await supabase.from('pathway_grants').delete().eq('player_id', playerId)
  const rows = pathwayIds.map((pathwayId) => ({
    player_id: playerId,
    pathway_id: pathwayId,
    granted_by: user.id,
  }))

  const { error } = await supabase.from('pathway_grants').insert(rows)
  if (error) return { error: error.message }

  // Notification: player gets notified about pathway grant
  const adminName = await getDisplayName(supabase, user.id)
  await createNotification(supabase, {
    targetUserId: playerId,
    actorId: user.id,
    actorName: adminName,
    type: 'pathway_granted',
    title: 'คุณได้รับโอสถเส้นทางแล้ว!',
    message: `ทีมงานมอบโอสถเส้นทาง ${pathwayIds.length} รายการให้เลือก`,
    link: '/dashboard/skills',
  })

  revalidatePath('/dashboard/pathways-grant')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function acceptPathwayGrant(pathwayId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!pathwayId) return { error: 'กรุณาเลือกเส้นทาง' }

  const { data: grant } = await supabase
    .from('pathway_grants')
    .select('id')
    .eq('player_id', user.id)
    .eq('pathway_id', pathwayId)
    .maybeSingle()

  if (!grant) return { error: 'คุณยังไม่ได้รับโอสถเส้นทางนี้' }

  const { data: existingPathways } = await supabase
    .from('player_pathways')
    .select('id, pathway_id')
    .eq('player_id', user.id)
    .not('pathway_id', 'is', null)

  if (existingPathways && existingPathways.length > 0) {
    return { error: 'คุณได้ตัดสินใจเส้นทางไปแล้ว' }
  }

  const { data: sequence } = await supabase
    .from('skill_sequences')
    .select('id')
    .eq('pathway_id', pathwayId)
    .eq('seq_number', 9)
    .single()

  if (!sequence) return { error: 'ไม่พบลำดับที่ 9 ของเส้นทางนี้' }

  const { error: upsertError } = await supabase
    .from('player_pathways')
    .upsert(
      { player_id: user.id, pathway_id: pathwayId, sequence_id: sequence.id },
      { onConflict: 'player_id,pathway_id' }
    )

  if (upsertError) return { error: upsertError.message }

  await supabase.from('pathway_grants').delete().eq('player_id', user.id)

  const { data: pathway } = await supabase
    .from('skill_pathways')
    .select('id, name, logo_url, bg_url, overview, description, video_url')
    .eq('id', pathwayId)
    .single()

  // Discord notification — player chose a pathway
  const playerName = await getDisplayName(supabase, user.id)
  notifyPathwayAccepted({
    playerName,
    pathwayName: pathway?.name ?? 'เส้นทางที่เลือก',
  }).catch(() => {})

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/skills')
  revalidatePath('/dashboard/pathways-grant')
  return { success: true, pathway }
}
