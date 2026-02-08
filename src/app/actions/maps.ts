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
   GET: Fetch all maps (any authenticated user)
   ══════════════════════════════════════════════ */
export async function getAllMaps() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('maps')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

/* ══════════════════════════════════════════════
   GET: Fetch single map by ID
   ══════════════════════════════════════════════ */
export async function getMapById(mapId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('maps')
    .select('*')
    .eq('id', mapId)
    .single()

  if (error) throw new Error(error.message)
  return data
}

/* ══════════════════════════════════════════════
   CREATE: Add a new map (admin/dm only)
   ══════════════════════════════════════════════ */
export async function createMap(formData: FormData) {
  const { supabase, user } = await requireAdmin()

  const name = formData.get('name') as string
  const description = formData.get('description') as string | null
  const image_url = formData.get('image_url') as string

  if (!name?.trim()) return { error: 'ชื่อแผนที่ห้ามว่าง' }
  if (!image_url?.trim()) return { error: 'URL รูปแผนที่ห้ามว่าง' }

  // Get next sort_order
  const { data: lastMap } = await supabase
    .from('maps')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = (lastMap?.sort_order ?? 0) + 10

  const { error } = await supabase
    .from('maps')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      image_url: image_url.trim(),
      sort_order: nextOrder,
      created_by: user.id,
    })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/maps')
  return { success: true }
}

/* ══════════════════════════════════════════════
   UPDATE: Edit an existing map (admin/dm only)
   ══════════════════════════════════════════════ */
export async function updateMap(mapId: string, formData: FormData) {
  const { supabase } = await requireAdmin()

  const name = formData.get('name') as string
  const description = formData.get('description') as string | null
  const image_url = formData.get('image_url') as string

  if (!name?.trim()) return { error: 'ชื่อแผนที่ห้ามว่าง' }
  if (!image_url?.trim()) return { error: 'URL รูปแผนที่ห้ามว่าง' }

  const { error } = await supabase
    .from('maps')
    .update({
      name: name.trim(),
      description: description?.trim() || null,
      image_url: image_url.trim(),
    })
    .eq('id', mapId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/maps')
  return { success: true }
}

/* ══════════════════════════════════════════════
   DELETE: Remove a map (admin only)
   ══════════════════════════════════════════════ */
export async function deleteMap(mapId: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('maps')
    .delete()
    .eq('id', mapId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/maps')
  return { success: true }
}
