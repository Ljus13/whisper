import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getMaintenanceStatus } from '@/app/actions/maintenance'
import { Wrench } from 'lucide-react'
import Link from 'next/link'

export default async function MaintenancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const maintenance = await getMaintenanceStatus()

  // If maintenance is off, no reason to be here → go to appropriate page
  if (!maintenance.enabled) {
    redirect(user ? '/dashboard' : '/')
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-[800px] h-[800px] rounded-full
                        bg-amber-400/[0.02] blur-3xl" />

        <div className="absolute top-0 left-0 w-64 h-64 opacity-5">
          <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
            <path d="M0 0 C80 0, 200 80, 200 200" stroke="#D4AF37" strokeWidth="0.5" />
            <path d="M0 30 C60 30, 170 80, 170 200" stroke="#D4AF37" strokeWidth="0.3" />
            <path d="M30 0 C30 60, 80 170, 200 170" stroke="#D4AF37" strokeWidth="0.3" />
          </svg>
        </div>
        <div className="absolute bottom-0 right-0 w-64 h-64 opacity-5 rotate-180">
          <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
            <path d="M0 0 C80 0, 200 80, 200 200" stroke="#D4AF37" strokeWidth="0.5" />
            <path d="M0 30 C60 30, 170 80, 170 200" stroke="#D4AF37" strokeWidth="0.3" />
            <path d="M30 0 C30 60, 80 170, 200 170" stroke="#D4AF37" strokeWidth="0.3" />
          </svg>
        </div>

        <div className="absolute inset-0 opacity-[0.015]"
             style={{
               backgroundImage: `
                 linear-gradient(rgba(212,175,55,1) 1px, transparent 1px),
                 linear-gradient(90deg, rgba(212,175,55,1) 1px, transparent 1px)
               `,
               backgroundSize: '100px 100px',
             }} />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-md w-full text-center space-y-8 animate-fade-in">
        {/* Maintenance Icon */}
        <div className="relative mx-auto w-28 h-28">
          <div className="absolute inset-0 rounded-full bg-amber-500/10 border-2 border-amber-500/30 animate-pulse" />
          <div className="relative w-full h-full rounded-full flex items-center justify-center">
            <Wrench className="w-14 h-14 text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.4)]" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-3">
          <h1 className="font-display text-3xl md:text-4xl bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(212,175,55,0.3)]">
            ปิดปรับปรุงชั่วคราว
          </h1>
          <div className="ornament-divider" />
          <p className="text-victorian-400 text-sm md:text-base font-body leading-relaxed">
            ขณะนี้เว็บไซต์กำลังอยู่ในระหว่างการปรับปรุง
            <br />
            กรุณากลับมาใหม่ในภายหลัง
          </p>
        </div>

        {/* Web Note */}
        {maintenance.web_note && (
          <div className="card-victorian p-5 text-left space-y-2">
            <p className="text-amber-400 text-xs font-bold tracking-wider uppercase flex items-center gap-2">
              <span>📝</span> ข้อความจาก DM
            </p>
            <p className="text-nouveau-cream/90 text-sm font-body whitespace-pre-wrap leading-relaxed">
              {maintenance.web_note}
            </p>
          </div>
        )}

        {/* Login Button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 btn-victorian px-6 py-3 text-sm"
        >
          เข้าสู่ระบบ
        </Link>
      </div>

      {/* Bottom attribution */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-victorian-600 text-sm font-body tracking-widest uppercase">
          Whisper — Campaign Companion
        </p>
      </div>
    </main>
  )
}
