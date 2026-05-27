'use client'

import { createBrowserClient } from '@supabase/ssr'

// Memoize a single browser client for the whole tab. Each `createBrowserClient`
// call spins up its own auth listener and (on first realtime use) its own
// WebSocket; without this singleton every component that calls createClient()
// opened a separate socket (the production HAR showed 9 concurrent sockets).
let browserClient: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  if (browserClient) return browserClient
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return browserClient
}
