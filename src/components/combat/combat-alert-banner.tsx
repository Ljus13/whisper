'use client'

import { getPlayerActiveCombat } from '@/app/actions/combat'
import { createClient } from '@/lib/supabase/client'
import { debouncedCall } from '@/lib/client-cache'
import { Swords } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Global alert banner shown when a player is in an active combat session
 * but is browsing other pages. Reuses punishment-banner pattern.
 */
export default function CombatAlertBanner() {
  const [combat, setCombat] = useState<{ sessionId: string; sessionName: string } | null>(null)
  const pathname = usePathname()
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    const fetchData = () => {
      getPlayerActiveCombat().then(r => {
        if (!mountedRef.current) return
        if (r.inCombat && r.sessionId) {
          setCombat({ sessionId: r.sessionId, sessionName: r.sessionName || 'การต่อสู้' })
        } else {
          setCombat(null)
        }
      }).catch(() => {})
    }

    fetchData()

    const supabase = createClient()
    const debouncedFetch = () => debouncedCall('combat-alert', fetchData, 200)

    const channel = supabase
      .channel('combat_alert_banner', { config: { broadcast: { self: true } } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_sessions' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_participants' }, debouncedFetch)
      .subscribe()

    return () => {
      mountedRef.current = false
      supabase.removeChannel(channel)
    }
  }, [])

  // Don't show if already on the combat page
  if (!combat) return null
  if (pathname?.startsWith(`/dashboard/combat/${combat.sessionId}`)) return null

  return (
    <div className="rounded-xl border-2 border-red-500/60 bg-gradient-to-r from-red-950/90 via-red-900/70 to-red-950/90 p-3 md:p-4 animate-pulse-slow shadow-lg shadow-red-500/20">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
            <Swords className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <p className="text-red-300 font-bold text-sm">⚠️ คุณกำลังอยู่ในการต่อสู้!</p>
            <p className="text-red-400/70 text-xs">{combat.sessionName}</p>
          </div>
        </div>
        <Link
          href={`/dashboard/combat/${combat.sessionId}`}
          className="shrink-0 px-4 py-2 rounded-lg bg-red-600/30 border border-red-500/50 text-red-200 text-xs font-bold hover:bg-red-600/50 transition-colors"
        >
          กลับเข้าห้อง →
        </Link>
      </div>
    </div>
  )
}
