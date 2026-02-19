'use client'

import { useState, useTransition } from 'react'
import { toggleOfflineMode } from '@/app/actions/site-settings'
import { WrenchIcon, Power, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  initialOffline: boolean
  initialReason: string | null
  isDM: boolean
}

export default function OfflineToggle({ initialOffline, initialReason, isDM }: Props) {
  const [isOffline, setIsOffline] = useState(initialOffline)
  const [reason, setReason] = useState(initialReason || '')
  const [showConfirm, setShowConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  if (!isDM) return null

  function handleToggle() {
    if (!isOffline) {
      // Going offline → show confirmation
      setShowConfirm(true)
    } else {
      // Going online → do it immediately
      setError(null)
      startTransition(async () => {
        const result = await toggleOfflineMode(false)
        if (result.error) {
          setError(result.error)
        } else {
          setIsOffline(false)
          setReason('')
          router.refresh()
        }
      })
    }
  }

  function confirmGoOffline() {
    setError(null)
    startTransition(async () => {
      const result = await toggleOfflineMode(true, reason)
      if (result.error) {
        setError(result.error)
      } else {
        setIsOffline(true)
        setShowConfirm(false)
        router.refresh()
      }
    })
  }

  return (
    <>
      <div className={`p-4 rounded-sm border ${isOffline ? 'border-nouveau-ruby/40 bg-nouveau-ruby/5' : 'border-gold-400/20 bg-victorian-900/40'}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <WrenchIcon className={`w-4 h-4 ${isOffline ? 'text-nouveau-ruby' : 'text-victorian-400'}`} />
            <span className={`font-display text-sm tracking-wider uppercase ${isOffline ? 'text-nouveau-ruby' : 'text-victorian-300'}`}>
              โหมดปิดปรับปรุง
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggle}
            disabled={isPending}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
              isOffline ? 'bg-nouveau-ruby' : 'bg-victorian-700'
            }`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
              isOffline ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
        <p className="text-xs text-victorian-500">
          {isOffline
            ? 'เว็บปิดปรับปรุงอยู่ — ผู้เล่นไม่สามารถเข้าถึงได้'
            : 'เว็บเปิดให้บริการปกติ'}
        </p>
        {error && (
          <p className="text-xs text-nouveau-ruby mt-2">{error}</p>
        )}
      </div>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowConfirm(false)}
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-md rounded-sm border-2 border-nouveau-ruby/40 p-6 shadow-2xl"
            style={{ backgroundColor: '#1A1612' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-nouveau-ruby/10 rounded-full">
                <AlertTriangle className="w-6 h-6 text-nouveau-ruby" />
              </div>
              <h3 className="font-display text-xl text-nouveau-cream">ยืนยันปิดปรับปรุง</h3>
            </div>

            <p className="text-victorian-300 text-sm mb-4">
              ผู้เล่นทั้งหมดจะถูกเปลี่ยนเส้นทางไปหน้าปิดปรับปรุง
              และผู้ที่ยังไม่ได้ล็อกอินจะไม่สามารถล็อกอินได้
            </p>

            <div className="mb-5">
              <label className="block text-sm text-victorian-400 mb-2 font-display tracking-wider uppercase">
                เหตุผล (ไม่บังคับ)
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="เช่น อัปเดตระบบใหม่ / เตรียมอีเวนท์พิเศษ"
                rows={2}
                className="input-victorian w-full resize-none"
              />
              <p className="text-xs text-victorian-500 mt-1">ข้อความนี้จะแสดงให้ผู้เล่นเห็นในหน้าปิดปรับปรุง</p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2.5 text-sm text-victorian-400 hover:text-nouveau-cream border border-victorian-700 rounded-sm cursor-pointer transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmGoOffline}
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-nouveau-ruby/80 hover:bg-nouveau-ruby border border-nouveau-ruby/60 rounded-sm cursor-pointer transition-colors disabled:opacity-50"
              >
                <Power className="w-4 h-4" />
                {isPending ? 'กำลังปิด...' : 'ปิดปรับปรุงเลย'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
