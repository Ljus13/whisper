'use client'

import { useState } from 'react'
import { X, Plus, Minus, Zap } from 'lucide-react'

interface StatAdjustmentModalProps {
  participantName: string
  statName: string
  currentValue: number
  onConfirm: (delta: number, reason: string) => void
  onClose: () => void
}

export default function StatAdjustmentModal({
  participantName,
  statName,
  currentValue,
  onConfirm,
  onClose,
}: StatAdjustmentModalProps) {
  const [mode, setMode] = useState<'increase' | 'decrease'>('decrease')
  const [amount, setAmount] = useState('1')
  const [reason, setReason] = useState('')

  const handleSubmit = () => {
    const delta = mode === 'increase' ? parseInt(amount) || 0 : -(parseInt(amount) || 0)
    if (delta === 0) return
    if (!reason.trim()) {
      alert('กรุณาระบุเหตุผล')
      return
    }
    onConfirm(delta, reason.trim())
  }

  const newValue = mode === 'increase' 
    ? currentValue + (parseInt(amount) || 0)
    : Math.max(0, currentValue - (parseInt(amount) || 0))

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div 
        className="relative bg-gradient-to-b from-victorian-900 to-victorian-950 border border-gold-400/20 rounded-2xl shadow-2xl shadow-black/50 w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-4 border-b border-victorian-700/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-gold-400" />
              </div>
              <div>
                <h3 className="heading-victorian text-lg">ปรับค่า {statName}</h3>
                <p className="text-victorian-500 text-[10px] mt-0.5">{participantName}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg bg-victorian-800 border border-victorian-600/30 flex items-center justify-center text-victorian-400 hover:text-gold-400 cursor-pointer transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Current value display */}
          <div className="text-center py-3">
            <p className="text-victorian-500 text-[10px] font-bold uppercase tracking-wider mb-1">{statName} ปัจจุบัน</p>
            <p className="text-gold-300 text-4xl font-bold">{currentValue}</p>
          </div>

          {/* Mode Selection */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('decrease')}
              className={`flex-1 px-4 py-3 rounded-xl border font-bold text-sm cursor-pointer transition-all ${
                mode === 'decrease'
                  ? 'bg-red-600/15 border-red-500/40 text-red-300 shadow-sm shadow-red-500/10'
                  : 'bg-victorian-800/40 border-victorian-700/20 text-victorian-400 hover:border-red-500/20'
              }`}
            >
              <Minus className="w-4 h-4 inline mr-1.5" />
              ลดค่า
            </button>
            <button
              type="button"
              onClick={() => setMode('increase')}
              className={`flex-1 px-4 py-3 rounded-xl border font-bold text-sm cursor-pointer transition-all ${
                mode === 'increase'
                  ? 'bg-green-600/15 border-green-500/40 text-green-300 shadow-sm shadow-green-500/10'
                  : 'bg-victorian-800/40 border-victorian-700/20 text-victorian-400 hover:border-green-500/20'
              }`}
            >
              <Plus className="w-4 h-4 inline mr-1.5" />
              เพิ่มค่า
            </button>
          </div>

          {/* Amount Input */}
          <div>
            <label className="text-victorian-400 text-[10px] font-bold uppercase tracking-wider block mb-2 px-0.5">จำนวน</label>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="input-victorian w-full !rounded-xl !py-3"
              placeholder="ระบุจำนวน"
            />
          </div>

          {/* Preview */}
          <div className={`p-4 rounded-xl border ${
            mode === 'decrease' ? 'bg-red-950/20 border-red-500/15' : 'bg-green-950/20 border-green-500/15'
          }`}>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-victorian-500 text-[9px] font-bold uppercase">ก่อน</p>
                <p className="text-nouveau-cream text-2xl font-bold">{currentValue}</p>
              </div>
              <span className={`text-xl font-bold ${
                mode === 'increase' ? 'text-green-400' : 'text-red-400'
              }`}>→</span>
              <div className="text-center">
                <p className="text-victorian-500 text-[9px] font-bold uppercase">หลัง</p>
                <p className={`text-2xl font-bold ${mode === 'increase' ? 'text-green-400' : 'text-red-400'}`}>
                  {newValue}
                </p>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                mode === 'increase'
                  ? 'bg-green-500/15 text-green-400'
                  : 'bg-red-500/15 text-red-400'
              }`}>
                {mode === 'increase' ? '+' : '-'}{amount || 0}
              </span>
            </div>
          </div>

          {/* Reason Input */}
          <div>
            <label className="text-victorian-400 text-[10px] font-bold uppercase tracking-wider block mb-2 px-0.5">เหตุผล *</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="input-victorian w-full !rounded-xl"
              rows={2}
              placeholder="เช่น ถูกโจมตี, ใช้สกิล, ฟื้นฟู..."
              required
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 pt-0 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-victorian-800 border border-victorian-600/30 text-victorian-300 text-sm hover:text-nouveau-cream cursor-pointer transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!reason.trim() || !amount || parseInt(amount) <= 0}
            className="px-5 py-2.5 rounded-xl bg-gold-400/15 border border-gold-400/30 text-gold-300 text-sm font-bold hover:bg-gold-400/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            ✓ ยืนยัน
          </button>
        </div>
      </div>
    </div>
  )
}
