'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getMaintenanceStatus(): Promise<{
  enabled: boolean
  web_note: string
}> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'maintenance_mode')
    .single()

  if (error || !data) {
    return { enabled: false, web_note: '' }
  }

  const value = data.value as { enabled?: boolean; web_note?: string } | null
  return {
    enabled: value?.enabled ?? false,
    web_note: value?.web_note ?? '',
  }
}

export async function toggleMaintenanceMode(enabled: boolean, webNote: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'dm') {
    return { error: 'เฉพาะ DM เท่านั้นที่สามารถจัดการโหมดปิดปรับปรุงได้' }
  }

  const { error } = await supabase
    .from('site_settings')
    .upsert({
      key: 'maintenance_mode',
      value: { enabled, web_note: webNote },
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function updateMaintenanceNote(webNote: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'dm') {
    return { error: 'เฉพาะ DM เท่านั้น' }
  }

  // Get current status
  const current = await getMaintenanceStatus()

  const { error } = await supabase
    .from('site_settings')
    .upsert({
      key: 'maintenance_mode',
      value: { enabled: current.enabled, web_note: webNote },
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}
