'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/* ── Helper: require DM role ── */
async function requireDM() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'dm') throw new Error('DM role required')
  return { supabase, user }
}

/* ══════════════════════════════════════════════
   GET: Site settings (public — no auth needed)
   ══════════════════════════════════════════════ */
export async function getSiteSettings() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .eq('id', 'main')
    .single()

  if (error || !data) return { is_offline: false, offline_reason: null }
  return data as {
    id: string
    is_offline: boolean
    offline_reason: string | null
    offline_by: string | null
    offline_at: string | null
  }
}

/* ══════════════════════════════════════════════
   TOGGLE: Set offline mode (DM only)
   ══════════════════════════════════════════════ */
export async function toggleOfflineMode(offline: boolean, reason?: string) {
  const { supabase, user } = await requireDM()

  const { error } = await supabase
    .from('site_settings')
    .update({
      is_offline: offline,
      offline_reason: offline ? (reason?.trim() || null) : null,
      offline_by: offline ? user.id : null,
      offline_at: offline ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'main')

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}
