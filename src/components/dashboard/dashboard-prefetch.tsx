'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardPrefetch() {
  const router = useRouter()

  useEffect(() => {
    const routes = [
      '/dashboard',
      '/dashboard/skills',
      '/dashboard/skills/logs',
      '/dashboard/players',
      '/dashboard/maps',
      '/dashboard/action-quest',
      '/dashboard/bio-templates',
    ]

    const run = () => {
      routes.forEach(route => router.prefetch(route))
    }

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 1500 })
      return () => window.cancelIdleCallback(id)
    }

    const id = setTimeout(run, 300)
    return () => clearTimeout(id)
  }, [router])

  return null
}
