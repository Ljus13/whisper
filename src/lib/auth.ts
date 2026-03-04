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
 *
 * JWT Custom Claims optimization:
 * If the Supabase Auth Hook (custom_access_token_hook) is enabled,
 * the role is embedded in the JWT token — no profiles query needed.
 * Falls back to DB query if JWT claims are not available.
 */
export const getAuth = cache(async (): Promise<AuthResult> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, role: null, isAdmin: false, isStaff: false, discordLinked: false, userId: null }
  }

  // Try JWT custom claims first (fast path — no DB query needed)
  // Custom claims from Supabase Auth Hook are in the decoded JWT payload
  let role: string | undefined
  let discordLinked: boolean | undefined

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      const payload = JSON.parse(atob(session.access_token.split('.')[1]))
      if (payload.user_role !== undefined) {
        // ⚡ Fast path: role from JWT claims (~0ms, no DB query)
        role = payload.user_role ?? 'player'
        discordLinked = payload.discord_linked ?? false
      }
    }
  } catch {
    // JWT decode failed — fall through to DB query
  }

  if (role === undefined) {
    // Fallback: query profiles table (~100-200ms)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, discord_user_id')
      .eq('id', user.id)
      .single()

    role = profile?.role ?? 'player'
    discordLinked = !!profile?.discord_user_id
  }

  const isAdmin = role === 'admin'
  const isStaff = role === 'admin' || role === 'dm'

  return {
    user,
    role: role ?? null,
    isAdmin,
    isStaff,
    discordLinked: discordLinked ?? false,
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
