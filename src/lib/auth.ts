import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export type AuthResult = {
  user: Awaited<ReturnType<Awaited<ReturnType<typeof createClient>>['auth']['getUser']>>['data']['user']
  role: string | null
  isAdmin: boolean
  isStaff: boolean
  discordLinked: boolean
  userId: string | null
}

/**
 * Cached auth helper — deduplicates across layout + page within a single request.
 * Uses React.cache() so calling getAuth() multiple times in the same render
 * only makes ONE network call to Supabase Auth + ONE profiles query.
 */
export const getAuth = cache(async (): Promise<AuthResult> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, role: null, isAdmin: false, isStaff: false, discordLinked: false, userId: null }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, discord_user_id')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'player'
  const isAdmin = role === 'admin'
  const isStaff = role === 'admin' || role === 'dm'

  return {
    user,
    role,
    isAdmin,
    isStaff,
    discordLinked: !!profile?.discord_user_id,
    userId: user.id,
  }
})

/**
 * Cached maintenance status — deduplicates across layout + page within a single request.
 */
export const getMaintenanceStatusCached = cache(async (): Promise<{
  enabled: boolean
  web_note: string
}> => {
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
})
