'use client'

import { toggleMaintenanceMode, updateMaintenanceNote } from '@/app/actions/maintenance'
import { Wrench, X, AlertTriangle, Check } from 'lucide-react'
import { useState, useTransition } from 'react'

interface MaintenanceToggleProps {
  initialEnabled: boolean
  initialWebNote: string
}

export default function MaintenanceToggle({ initialEnabled, initialWebNote }: MaintenanceToggleProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [enabled, setEnabled] = useState(initialEnabled)
  const [webNote, setWebNote] = useState(initialWebNote)
  const [confirmText, setConfirmText] = useState('')
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const handleEnable = () => {
    if (confirmText !== 'ยืนยัน') return
    setFeedback(null)
    startTransition(async () => {
      const result = await toggleMaintenanceMode(true, webNote)
      if (result.success) {
        setEnabled(true)
        setConfirmText('')
        setFeedback({ type: 'success', msg: 'เปิดโหมดปิดปรับปรุงแล้ว' })
        // Auto-close after 1.5s
        setTimeout(() => {
          setIsOpen(false)
          setFeedback(null)
          window.location.reload()
        }, 1500)
      } else {
        setFeedback({ type: 'error', msg: result.error || 'เกิดข้อผิดพลาด' })
      }
    })
  }

  const handleDisable = () => {
    setFeedback(null)
    startTransition(async () => {
      const result = await toggleMaintenanceMode(false, '')
      if (result.success) {
        setEnabled(false)
        setWebNote('')
        setConfirmText('')
        setFeedback({ type: 'success', msg: 'ปิดโหมดปรับปรุงแล้ว — เว็บกลับมาเปิดใช้งานตามปกติ' })
        setTimeout(() => {
          setIsOpen(false)
          setFeedback(null)
          window.location.reload()
        }, 1500)
      } else {
        setFeedback({ type: 'error', msg: result.error || 'เกิดข้อผิดพลาด' })
      }
    })
  }

  const handleUpdateNote = () => {
    setFeedback(null)
    startTransition(async () => {
      const result = await updateMaintenanceNote(webNote)
      if (result.success) {
        setFeedback({ type: 'success', msg: 'อัพเดทข้อความแล้ว' })
        setTimeout(() => setFeedback(null), 2000)
      } else {
        setFeedback({ type: 'error', msg: result.error || 'เกิดข้อผิดพลาด' })
      }
    })
  }

  return (
    <>
      {/* Floating Wrench Button — bottom-left */}
      <button
        type="button"
        onClick={() => { setIsOpen(true); setFeedback(null) }}
        className={`fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 cursor-pointer group
          ${enabled
            ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/30 border-2 border-amber-400/50'
            : 'bg-victorian-800 hover:bg-victorian-700 shadow-gold/10 border-2 border-gold-400/20 hover:border-gold-400/40'
          }`}
        title="โหมดปิดปรับปรุง"
      >
        <Wrench className={`w-6 h-6 transition-transform duration-300 group-hover:rotate-45 ${enabled ? 'text-white' : 'text-gold-400'}`} />
        {enabled && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-victorian-950 animate-pulse" />
        )}
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          onClick={() => { setIsOpen(false); setFeedback(null) }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative bg-victorian-900 border border-gold-400/20 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${enabled ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-victorian-800 border border-gold-400/20'}`}>
                  <Wrench className={`w-5 h-5 ${enabled ? 'text-amber-400' : 'text-gold-400'}`} />
                </div>
                <div>
                  <h2 className="text-nouveau-cream font-display text-lg">โหมดปิดปรับปรุง</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-block w-2 h-2 rounded-full ${enabled ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                    <span className={`text-xs font-body ${enabled ? 'text-amber-300' : 'text-emerald-300'}`}>
                      {enabled ? 'กำลังปิดปรับปรุง' : 'เว็บเปิดใช้งานปกติ'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setIsOpen(false); setFeedback(null) }}
                className="p-2 text-victorian-400 hover:text-nouveau-cream transition-colors rounded-lg hover:bg-victorian-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Feedback */}
            {feedback && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm font-body ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/50 border border-emerald-500/30 text-emerald-300'
                  : 'bg-red-950/50 border border-red-500/30 text-red-300'
              }`}>
                {feedback.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                {feedback.msg}
              </div>
            )}

            {/* Web Note Textarea */}
            <div className="space-y-2">
              <label className="block text-victorian-300 text-sm font-body">
                ข้อความแจ้งผู้เล่น (web_note)
              </label>
              <textarea
                value={webNote}
                onChange={e => setWebNote(e.target.value)}
                placeholder="เช่น: ปิดปรับปรุงถึง 20:00 น. | อัพเดทระบบเควส..."
                className="input-victorian w-full h-28 resize-none text-sm font-body"
                disabled={isPending}
              />
            </div>

            {enabled ? (
              /* ─── Currently ON: show update note + disable buttons ─── */
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleUpdateNote}
                  disabled={isPending}
                  className="w-full py-2.5 rounded-lg text-sm font-bold font-body border border-gold-400/30 text-gold-300 
                             hover:bg-gold-400/10 transition-colors disabled:opacity-50 cursor-pointer
                             flex items-center justify-center gap-2"
                >
                  {isPending && <div className="w-4 h-4 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />}
                  อัพเดทข้อความ
                </button>

                <div className="ornament-divider" />

                <button
                  type="button"
                  onClick={handleDisable}
                  disabled={isPending}
                  className="w-full py-3 rounded-lg text-sm font-bold font-body
                             bg-gradient-to-r from-emerald-600 to-emerald-500 text-white
                             hover:from-emerald-500 hover:to-emerald-400
                             shadow-lg shadow-emerald-500/20
                             disabled:opacity-50 cursor-pointer
                             flex items-center justify-center gap-2 transition-all"
                >
                  {isPending && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  ปิดโหมดปรับปรุง — เปิดเว็บตามปกติ
                </button>
              </div>
            ) : (
              /* ─── Currently OFF: show enable flow with confirmation ─── */
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/20 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-amber-200/80 text-xs font-body leading-relaxed">
                      การเปิดโหมดปิดปรับปรุงจะ:
                    </p>
                  </div>
                  <ul className="text-amber-200/60 text-xs font-body space-y-1 ml-6 list-disc">
                    <li>บล็อกผู้เล่นทุกคนจากการเข้าใช้งานแดชบอร์ด</li>
                    <li>ปิดการเข้าสู่ระบบสำหรับผู้ใช้ใหม่</li>
                    <li>DM และ Admin ยังเข้าใช้งานได้ตามปกติ</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <label className="block text-victorian-300 text-sm font-body">
                    พิมพ์ &ldquo;<span className="text-amber-400 font-bold">ยืนยัน</span>&rdquo; เพื่อเปิดโหมดปรับปรุง
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={e => setConfirmText(e.target.value)}
                    placeholder="ยืนยัน"
                    className="input-victorian w-full text-sm font-body"
                    disabled={isPending}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleEnable}
                  disabled={isPending || confirmText !== 'ยืนยัน'}
                  className="w-full py-3 rounded-lg text-sm font-bold font-body
                             bg-gradient-to-r from-amber-600 to-red-600 text-white
                             hover:from-amber-500 hover:to-red-500
                             shadow-lg shadow-amber-500/20
                             disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer
                             flex items-center justify-center gap-2 transition-all"
                >
                  {isPending && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  เปิดโหมดปิดปรับปรุง
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
