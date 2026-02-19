import { createClient } from '@/lib/supabase/server'
import { WrenchIcon } from 'lucide-react'

export default async function MaintenancePage() {
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('site_settings')
    .select('offline_reason, offline_at')
    .eq('id', 'main')
    .single()

  const reason = settings?.offline_reason || null
  const offlineAt = settings?.offline_at
    ? new Date(settings.offline_at).toLocaleString('th-TH', {
        dateStyle: 'long',
        timeStyle: 'short',
      })
    : null

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-[800px] h-[800px] rounded-full
                        bg-gold-400/[0.02] blur-3xl" />
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

      <div className="relative z-10 animate-fade-in max-w-lg w-full mx-4">
        <div className="card-victorian relative overflow-hidden">
          <div className="relative z-10 px-6 py-10 sm:px-10 text-center">
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-24 h-24 mb-6
                            border border-gold-400/30 rounded-full
                            bg-victorian-800/50 shadow-gold">
              <WrenchIcon className="w-10 h-10 text-gold-400" />
            </div>

            <h1 className="heading-victorian text-3xl mb-3 md:text-4xl">
              ปิดปรับปรุงชั่วคราว
            </h1>
            <p className="text-victorian-300 font-body text-lg tracking-wide mb-6">
              ระบบกำลังอยู่ระหว่างการปรับปรุง กรุณากลับมาใหม่ภายหลัง
            </p>

            <div className="ornament-divider !my-6" />

            {/* Reason */}
            {reason && (
              <div className="mb-6 p-4 rounded-sm border border-gold-400/20 bg-victorian-800/30">
                <p className="text-sm text-victorian-400 mb-1 uppercase tracking-wider font-display">เหตุผล</p>
                <p className="text-nouveau-cream/80 font-body text-base leading-relaxed">{reason}</p>
              </div>
            )}

            {/* Skeleton content to show "site is loading" feel */}
            <div className="space-y-4 mb-6">
              <div className="h-4 w-3/4 mx-auto rounded bg-victorian-800/60 animate-pulse" />
              <div className="h-4 w-1/2 mx-auto rounded bg-victorian-800/60 animate-pulse" />
              <div className="h-4 w-2/3 mx-auto rounded bg-victorian-800/60 animate-pulse" />
            </div>

            <div className="ornament-divider !my-6" />

            {offlineAt && (
              <p className="text-victorian-600 text-xs font-body">
                ปิดปรับปรุงตั้งแต่: {offlineAt}
              </p>
            )}

            <p className="text-victorian-500 text-sm font-body tracking-wide mt-4">
              Whisper — Campaign Companion
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
