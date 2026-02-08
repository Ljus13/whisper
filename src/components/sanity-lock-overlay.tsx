'use client'

import { Lock } from 'lucide-react'

/**
 * Sanity Lock Overlay
 * แสดงเมื่อตัวละครมีค่าสติเหลือ 0 
 * จะล็อคการเข้าถึงเนื้อหา พร้อมแจ้งเตือนว่ากำลังบ้าคลั่ง
 */
export default function SanityLockOverlay() {
  return (
    <>
      {/* Warning Banner - ติดด้านบนตลอดเวลา */}
      <div className="fixed top-0 left-0 right-0 z-[100] pointer-events-none">
        <div className="bg-gradient-to-b from-red-900/95 via-red-800/90 to-red-900/80 border-b-4 border-red-600 
                        shadow-[0_8px_32px_rgba(0,0,0,0.9)] backdrop-blur-sm animate-pulse">
          <div className="max-w-screen-2xl mx-auto px-8 py-6 flex items-center justify-center gap-4">
            <Lock className="w-8 h-8 text-red-200 animate-bounce" />
            <p className="font-display text-3xl md:text-4xl text-red-100 tracking-wider uppercase text-shadow-[0_0_20px_rgba(220,38,38,0.8)]">
              คุณกำลังบ้าคลั่งและเสียสติ
            </p>
            <Lock className="w-8 h-8 text-red-200 animate-bounce" style={{ animationDelay: '0.2s' }} />
          </div>
        </div>
      </div>

      {/* Full Screen Black Overlay with Lock Icon */}
      <div className="fixed inset-0 z-[99] flex items-center justify-center bg-black/95 backdrop-blur-md pointer-events-auto">
        <div className="flex flex-col items-center gap-8 px-8 animate-fade-in">
          {/* Giant Lock Icon */}
          <div className="relative">
            <div className="absolute inset-0 blur-3xl bg-red-600/50 animate-pulse" />
            <Lock className="relative w-48 h-48 md:w-64 md:h-64 text-red-500" strokeWidth={1.5} />
          </div>

          {/* Message */}
          <div className="text-center space-y-4 max-w-2xl">
            <h2 className="font-display text-5xl md:text-6xl text-red-400 text-shadow-[0_0_30px_rgba(239,68,68,0.8)]">
              ถูกล็อค
            </h2>
            <p className="text-2xl md:text-3xl text-red-300/90 font-body leading-relaxed">
              ค่าสติของคุณเหลือ <span className="font-bold text-red-200">0</span>
            </p>
            <p className="text-xl md:text-2xl text-victorian-400 font-body leading-relaxed">
              คุณไม่สามารถดำเนินการใดๆ ได้จนกว่าสติจะฟื้นคืน
            </p>
          </div>

          {/* Breathing effect overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-radial from-transparent via-red-950/20 to-red-950/40 animate-pulse" 
                 style={{ animationDuration: '3s' }} />
          </div>
        </div>
      </div>
    </>
  )
}
