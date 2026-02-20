'use client'

import { signOut } from '@/app/actions/auth'
import { Wrench, RefreshCcw, LogOut } from 'lucide-react'
import { useTransition } from 'react'

interface MaintenanceWallProps {
  webNote: string
}

export default function MaintenanceWall({ webNote }: MaintenanceWallProps) {
  const [isSigningOut, startTransition] = useTransition()

  const handleSignOut = () => {
    startTransition(async () => {
      await signOut()
    })
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      {/* Background subtle glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-[600px] h-[600px] rounded-full
                        bg-amber-400/[0.02] blur-3xl" />
      </div>

      <div className="relative z-10 max-w-md w-full text-center space-y-8 animate-fade-in">
        {/* Maintenance Icon */}
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 rounded-full bg-amber-500/10 border-2 border-amber-500/30 animate-pulse" />
          <div className="relative w-full h-full rounded-full flex items-center justify-center">
            <Wrench className="w-12 h-12 text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.4)]" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-3">
          <h1 className="font-display text-2xl md:text-3xl bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(212,175,55,0.3)]">
            ปิดปรับปรุงชั่วคราว
          </h1>
          <div className="ornament-divider" />
          <p className="text-victorian-400 text-sm font-body leading-relaxed">
            ขณะนี้เว็บไซต์กำลังอยู่ในระหว่างการปรับปรุง
            <br />
            กรุณากลับมาใหม่ในภายหลัง
          </p>
        </div>

        {/* Web Note */}
        {webNote && (
          <div className="card-victorian p-5 text-left space-y-2">
            <p className="text-amber-400 text-xs font-bold tracking-wider uppercase flex items-center gap-2">
              <span>📝</span> ข้อความจาก DM
            </p>
            <p className="text-nouveau-cream/90 text-sm font-body whitespace-pre-wrap leading-relaxed">
              {webNote}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-victorian px-5 py-2.5 text-sm flex items-center gap-2 cursor-pointer"
          >
            <RefreshCcw className="w-4 h-4" />
            ลองอีกครั้ง
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="px-5 py-2.5 text-sm rounded-md border border-red-500/30 text-red-400 
                       hover:bg-red-500/10 transition-colors flex items-center gap-2 
                       disabled:opacity-50 cursor-pointer"
          >
            {isSigningOut ? (
              <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            ออกจากระบบ
          </button>
        </div>
      </div>
    </main>
  )
}
