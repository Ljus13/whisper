'use client'

import { WrenchIcon } from 'lucide-react'

interface Props {
  reason: string | null
}

export default function OfflineBanner({ reason }: Props) {
  return (
    <div className="sticky top-0 z-50 w-full bg-nouveau-ruby/90 border-b border-nouveau-ruby text-white px-4 py-2.5">
      <div className="max-w-screen-2xl mx-auto flex items-center justify-center gap-3 text-sm">
        <WrenchIcon className="w-4 h-4 shrink-0" />
        <span className="font-display font-bold tracking-wide">
          ⚠️ เว็บอยู่ในโหมดปิดปรับปรุง — ผู้เล่นไม่สามารถเข้าถึงได้
        </span>
        {reason && (
          <span className="text-white/70 hidden sm:inline">
            — {reason}
          </span>
        )}
      </div>
    </div>
  )
}
