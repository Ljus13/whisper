'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ── Helper: check admin/dm role ──
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('ไม่ได้เข้าสู่ระบบ')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !['admin', 'dm'].includes(profile.role)) {
    throw new Error('ไม่มีสิทธิ์เข้าถึง')
  }
  return { supabase, userId: user.id }
}

// ═══════════════════════════════════════
// TIMELINE ENTRIES (Main)
// ═══════════════════════════════════════

export async function getTimelineEntries(includeUnpublished = false) {
  // Use service-role client so RLS never hides unpublished rows;
  // the UI decides what to show per-role (LockedBox vs real content).
  const supabase = createAdminClient()

  const query = supabase
    .from('timeline_entries')
    .select(`
      *,
      timeline_side_stories (
        *,
        timeline_sub_stories (
          *,
          timeline_sub_story_moderators ( profile_id, profiles:profile_id ( id, display_name, avatar_url ) ),
          timeline_sub_story_participants ( profile_id, profiles:profile_id ( id, display_name, avatar_url ) )
        ),
        timeline_side_story_moderators ( profile_id, profiles:profile_id ( id, display_name, avatar_url ) ),
        timeline_side_story_participants ( profile_id, profiles:profile_id ( id, display_name, avatar_url ) ),
        timeline_side_story_punishments ( punishment_id, position_x, position_y, punishments:punishment_id ( id, name, description ) )
      )
    `)
    .order('sort_order', { ascending: true })

  // Always return all entries; UI handles visibility per role

  const { data, error } = await query
  if (error) throw error

  // Transform joined data into cleaner shapes
  type ProfileShape = { id: string; display_name: string; avatar_url: string | null }
  type PunishmentShape = { punishment_id: string; punishment_name: string; punishment_description: string | null; required_tasks: string[] | null; position_x: number; position_y: number }

  const entries = (data || []).map((entry: Record<string, unknown>) => ({
    ...entry,
    timeline_side_stories: ((entry.timeline_side_stories as Record<string, unknown>[]) || []).map((side: Record<string, unknown>) => {
      // Extract moderators
      const mods = (side.timeline_side_story_moderators as Record<string, unknown>[]) || []
      const moderators = mods.map((m: Record<string, unknown>) => m.profiles as ProfileShape).filter(Boolean) as ProfileShape[]

      // Extract participants
      const parts = (side.timeline_side_story_participants as Record<string, unknown>[]) || []
      const participants = parts.map((p: Record<string, unknown>) => p.profiles as ProfileShape).filter(Boolean) as ProfileShape[]

      // Extract punishment links with required tasks
      const punLinks = (side.timeline_side_story_punishments as Record<string, unknown>[]) || []
      const event_punishments: PunishmentShape[] = punLinks
        .map((pl: Record<string, unknown>) => {
          const pun = pl.punishments as Record<string, unknown> | null
          if (!pun) return null
          return {
            punishment_id: pun.id as string,
            punishment_name: pun.name as string,
            punishment_description: (pun.description as string | null),
            required_tasks: null as string[] | null,
            position_x: (pl.position_x as number) ?? 0,
            position_y: (pl.position_y as number) ?? 0,
          }
        })
        .filter((x): x is PunishmentShape => x !== null)

      return {
        ...side,
        moderators,
        participants,
        event_punishments,
        // Transform sub stories to include their moderators/participants
        timeline_sub_stories: ((side.timeline_sub_stories as Record<string, unknown>[]) || []).map((sub: Record<string, unknown>) => {
          const subMods = (sub.timeline_sub_story_moderators as Record<string, unknown>[]) || []
          const subParts = (sub.timeline_sub_story_participants as Record<string, unknown>[]) || []
          return {
            ...sub,
            moderators: subMods.map((m: Record<string, unknown>) => m.profiles as ProfileShape).filter(Boolean) as ProfileShape[],
            participants: subParts.map((p: Record<string, unknown>) => p.profiles as ProfileShape).filter(Boolean) as ProfileShape[],
            timeline_sub_story_moderators: undefined,
            timeline_sub_story_participants: undefined,
          }
        }),
        // Remove raw join tables from the object
        timeline_side_story_moderators: undefined,
        timeline_side_story_participants: undefined,
        timeline_side_story_punishments: undefined,
      }
    }),
  }))

  return entries
}

export async function createTimelineEntry(formData: FormData) {
  const { supabase, userId } = await requireAdmin()

  const title = formData.get('title') as string
  const description = formData.get('description') as string | null
  const full_detail = formData.get('full_detail') as string | null
  const goal = formData.get('goal') as string | null
  const image_url = formData.get('image_url') as string | null
  const sort_order = parseInt(formData.get('sort_order') as string || '0', 10)
  const started_at = (formData.get('started_at') as string | null) || null
  const ended_at   = (formData.get('ended_at')   as string | null) || null

  const { error } = await supabase.from('timeline_entries').insert({
    title,
    description,
    full_detail,
    goal,
    image_url,
    sort_order,
    started_at,
    ended_at,
    is_published: false,
    created_by: userId,
  })

  if (error) throw error
  revalidatePath('/timeline')
}

export async function updateTimelineEntry(id: string, formData: FormData) {
  const { supabase } = await requireAdmin()

  const title = formData.get('title') as string
  const description = formData.get('description') as string | null
  const full_detail = formData.get('full_detail') as string | null
  const goal = formData.get('goal') as string | null
  const image_url = formData.get('image_url') as string | null
  const sort_order = parseInt(formData.get('sort_order') as string || '0', 10)
  const started_at = (formData.get('started_at') as string | null) || null
  const ended_at   = (formData.get('ended_at')   as string | null) || null

  const { error } = await supabase
    .from('timeline_entries')
    .update({ title, description, full_detail, goal, image_url, sort_order, started_at, ended_at })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/timeline')
}

export async function toggleTimelinePublish(id: string, published: boolean) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('timeline_entries')
    .update({ is_published: published })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/timeline')
}

export async function deleteTimelineEntry(id: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('timeline_entries')
    .delete()
    .eq('id', id)

  if (error) throw error
  revalidatePath('/timeline')
}

// ═══════════════════════════════════════
// SIDE STORIES
// ═══════════════════════════════════════

export async function createSideStory(formData: FormData) {
  const { supabase, userId } = await requireAdmin()

  const timeline_id = formData.get('timeline_id') as string
  const title = formData.get('title') as string
  const description = formData.get('description') as string | null
  const full_detail = formData.get('full_detail') as string | null
  const goal = formData.get('goal') as string | null
  const image_url = formData.get('image_url') as string | null
  const sort_order = parseInt(formData.get('sort_order') as string || '0', 10)
  const started_at = (formData.get('started_at') as string | null) || null
  const ended_at   = (formData.get('ended_at')   as string | null) || null

  // Count existing side stories to determine which side the new card starts on
  const { count } = await supabase
    .from('timeline_side_stories')
    .select('*', { count: 'exact', head: true })
    .eq('timeline_id', timeline_id)
  const sideCount = count ?? 0
  // Even index → right (+260), odd index → left (-260), slight vertical stagger
  const position_x = sideCount % 2 === 0 ? 260 : -260
  const position_y = Math.floor(sideCount / 2) * 30  // stagger multiple cards on same side

  const { error } = await supabase.from('timeline_side_stories').insert({
    timeline_id,
    title,
    description,
    full_detail,
    goal,
    image_url,
    position_x,
    position_y,
    sort_order,
    started_at,
    ended_at,
    is_published: false,
    created_by: userId,
  })

  if (error) throw error
  revalidatePath('/timeline')
}

export async function updateSideStory(id: string, formData: FormData) {
  const { supabase } = await requireAdmin()

  const timeline_id = formData.get('timeline_id') as string
  const title = formData.get('title') as string
  const description = formData.get('description') as string | null
  const full_detail = formData.get('full_detail') as string | null
  const goal = formData.get('goal') as string | null
  const image_url = formData.get('image_url') as string | null
  const sort_order = parseInt(formData.get('sort_order') as string || '0', 10)
  const started_at = (formData.get('started_at') as string | null) || null
  const ended_at   = (formData.get('ended_at')   as string | null) || null

  const { error } = await supabase
    .from('timeline_side_stories')
    .update({ timeline_id, title, description, full_detail, goal, image_url, sort_order, started_at, ended_at })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/timeline')
}

export async function updateSideStoryPosition(id: string, x: number, y: number) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('timeline_side_stories')
    .update({ position_x: x, position_y: y })
    .eq('id', id)

  if (error) throw error
}

export async function toggleSideStoryPublish(id: string, published: boolean) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('timeline_side_stories')
    .update({ is_published: published })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/timeline')
}

export async function deleteSideStory(id: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('timeline_side_stories')
    .delete()
    .eq('id', id)

  if (error) throw error
  revalidatePath('/timeline')
}

// ═══════════════════════════════════════
// SUB STORIES
// ═══════════════════════════════════════

export async function createSubStory(formData: FormData) {
  const { supabase, userId } = await requireAdmin()

  const side_story_id = formData.get('side_story_id') as string
  const title = formData.get('title') as string
  const description = formData.get('description') as string | null
  const full_detail = formData.get('full_detail') as string | null
  const goal = formData.get('goal') as string | null
  const image_url = formData.get('image_url') as string | null
  const position_x = parseFloat(formData.get('position_x') as string || '0')
  const position_y = parseFloat(formData.get('position_y') as string || '0')
  const sort_order = parseInt(formData.get('sort_order') as string || '0', 10)
  const started_at = (formData.get('started_at') as string | null) || null
  const ended_at   = (formData.get('ended_at')   as string | null) || null

  const { error } = await supabase.from('timeline_sub_stories').insert({
    side_story_id,
    title,
    description,
    full_detail,
    goal,
    image_url,
    position_x,
    position_y,
    sort_order,
    started_at,
    ended_at,
    is_published: false,
    created_by: userId,
  })

  if (error) throw error
  revalidatePath('/timeline')
}

export async function updateSubStory(id: string, formData: FormData) {
  const { supabase } = await requireAdmin()

  const side_story_id = formData.get('side_story_id') as string
  const title = formData.get('title') as string
  const description = formData.get('description') as string | null
  const full_detail = formData.get('full_detail') as string | null
  const goal = formData.get('goal') as string | null
  const image_url = formData.get('image_url') as string | null
  const sort_order = parseInt(formData.get('sort_order') as string || '0', 10)
  const started_at = (formData.get('started_at') as string | null) || null
  const ended_at   = (formData.get('ended_at')   as string | null) || null

  const { error } = await supabase
    .from('timeline_sub_stories')
    .update({ side_story_id, title, description, full_detail, goal, image_url, sort_order, started_at, ended_at })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/timeline')
}

export async function updateSubStoryPosition(id: string, x: number, y: number) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('timeline_sub_stories')
    .update({ position_x: x, position_y: y })
    .eq('id', id)

  if (error) throw error
}

export async function toggleSubStoryPublish(id: string, published: boolean) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('timeline_sub_stories')
    .update({ is_published: published })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/timeline')
}

export async function deleteSubStory(id: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('timeline_sub_stories')
    .delete()
    .eq('id', id)

  if (error) throw error
  revalidatePath('/timeline')
}

// ═══════════════════════════════════════
// MODERATORS & PARTICIPANTS
// ═══════════════════════════════════════

export async function getAdminDmProfiles() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, role')
    .in('role', ['admin', 'dm'])
    .order('display_name')
  if (error) throw error
  return data ?? []
}

export async function getPlayerProfiles() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, role')
    .eq('role', 'player')
    .order('display_name')
  if (error) throw error
  return data ?? []
}

// Side Story Moderators
export async function setSideStoryModerators(sideStoryId: string, profileIds: string[]) {
  const { supabase } = await requireAdmin()

  // Delete existing
  await supabase.from('timeline_side_story_moderators').delete().eq('side_story_id', sideStoryId)

  // Insert new
  if (profileIds.length > 0) {
    const rows = profileIds.map(pid => ({ side_story_id: sideStoryId, profile_id: pid }))
    const { error } = await supabase.from('timeline_side_story_moderators').insert(rows)
    if (error) throw error
  }

  revalidatePath('/timeline')
}

// Side Story Participants
export async function setSideStoryParticipants(sideStoryId: string, profileIds: string[]) {
  const { supabase } = await requireAdmin()

  await supabase.from('timeline_side_story_participants').delete().eq('side_story_id', sideStoryId)

  if (profileIds.length > 0) {
    const rows = profileIds.map(pid => ({ side_story_id: sideStoryId, profile_id: pid }))
    const { error } = await supabase.from('timeline_side_story_participants').insert(rows)
    if (error) throw error
  }

  revalidatePath('/timeline')
}

// Sub Story Moderators
export async function setSubStoryModerators(subStoryId: string, profileIds: string[]) {
  const { supabase } = await requireAdmin()

  await supabase.from('timeline_sub_story_moderators').delete().eq('sub_story_id', subStoryId)

  if (profileIds.length > 0) {
    const rows = profileIds.map(pid => ({ sub_story_id: subStoryId, profile_id: pid }))
    const { error } = await supabase.from('timeline_sub_story_moderators').insert(rows)
    if (error) throw error
  }

  revalidatePath('/timeline')
}

// Sub Story Participants
export async function setSubStoryParticipants(subStoryId: string, profileIds: string[]) {
  const { supabase } = await requireAdmin()

  await supabase.from('timeline_sub_story_participants').delete().eq('sub_story_id', subStoryId)

  if (profileIds.length > 0) {
    const rows = profileIds.map(pid => ({ sub_story_id: subStoryId, profile_id: pid }))
    const { error } = await supabase.from('timeline_sub_story_participants').insert(rows)
    if (error) throw error
  }

  revalidatePath('/timeline')
}

// ═══════════════════════════════════════
// SIDE STORY PUNISHMENTS (Event Stories)
// ═══════════════════════════════════════

export async function getPunishmentsList() {
  const supabase = await createClient()
  // Include archived punishments too (so they remain selectable)
  const { data, error } = await supabase
    .from('punishments')
    .select('id, name, description, archived')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function setSideStoryPunishments(sideStoryId: string, punishmentIds: string[]) {
  const { supabase } = await requireAdmin()

  // Delete existing links
  await supabase.from('timeline_side_story_punishments').delete().eq('side_story_id', sideStoryId)

  // Insert new links
  if (punishmentIds.length > 0) {
    const rows = punishmentIds.map(pid => ({ side_story_id: sideStoryId, punishment_id: pid }))
    const { error } = await supabase.from('timeline_side_story_punishments').insert(rows)
    if (error) throw error
  }

  revalidatePath('/timeline')
}

export async function updateEventStoryPosition(sideStoryId: string, punishmentId: string, x: number, y: number) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('timeline_side_story_punishments')
    .update({ position_x: x, position_y: y })
    .eq('side_story_id', sideStoryId)
    .eq('punishment_id', punishmentId)

  if (error) throw error
}
