'use client'

import { useState } from 'react'
import { X, Plus, Minus } from 'lucide-react'

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
        className="relative bg-victorian-900 border border-gold-400/20 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="heading-victorian text-lg">ปรับค่า {statName}</h3>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-victorian-400 hover:text-gold-400 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Participant Info */}
        <div className="p-3 rounded-lg bg-victorian-800/50 border border-victorian-700/30">
          <p className="text-nouveau-cream text-sm font-semibold">{participantName}</p>
          <p className="text-victorian-400 text-xs mt-1">
            {statName} ปัจจุบัน: <span className="text-gold-400 font-bold">{currentValue}</span>
          </p>
        </div>

        {/* Mode Selection */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('decrease')}
            className={`flex-1 px-4 py-2 rounded-lg border font-bold text-sm transition-colors ${
              mode === 'decrease'
                ? 'bg-red-600/20 border-red-500/40 text-red-300'
                : 'bg-victorian-800/50 border-victorian-700/30 text-victorian-400 hover:border-red-500/20'
            }`}
          >
            <Minus className="w-4 h-4 inline mr-1" />
            ลด
          </button>
          <button
            type="button"
            onClick={() => setMode('increase')}
            className={`flex-1 px-4 py-2 rounded-lg border font-bold text-sm transition-colors ${
              mode === 'increase'
                ? 'bg-green-600/20 border-green-500/40 text-green-300'
                : 'bg-victorian-800/50 border-victorian-700/30 text-victorian-400 hover:border-green-500/20'
            }`}
          >
            <Plus className="w-4 h-4 inline mr-1" />
            เพิ่ม
          </button>
        </div>

        {/* Amount Input */}
        <div>
          <label className="text-victorian-400 text-xs block mb-2">จำนวน</label>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="input-victorian w-full"
            placeholder="ระบุจำนวน"
          />
        </div>

        {/* Preview */}
        <div className="p-3 rounded-lg bg-gold-400/5 border border-gold-400/20">
          <p className="text-gold-300 text-sm">
            ค่าใหม่: <span className="font-bold text-lg">{currentValue}</span>
            <span className={`mx-2 ${mode === 'increase' ? 'text-green-400' : 'text-red-400'}`}>
              {mode === 'increase' ? '→' : '→'}
            </span>
            <span className={`font-bold text-lg ${mode === 'increase' ? 'text-green-400' : 'text-red-400'}`}>
              {newValue}
            </span>
            <span className="text-victorian-400 text-xs ml-2">
              ({mode === 'increase' ? '+' : ''}{mode === 'increase' ? amount : `-${amount}`})
            </span>
          </p>
        </div>

        {/* Reason Input */}
        <div>
          <label className="text-victorian-400 text-xs block mb-2">เหตุผล *</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="input-victorian w-full"
            rows={3}
            placeholder="ระบุเหตุผลในการปรับค่า เช่น ถูกโจมตี, ใช้สกิล, ฟื้นฟู..."
            required
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-victorian-800 border border-victorian-600/40 text-victorian-300 text-sm hover:text-nouveau-cream cursor-pointer transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!reason.trim() || !amount || parseInt(amount) <= 0}
            className="px-4 py-2 rounded-lg bg-gold-400/20 border border-gold-400/40 text-gold-300 text-sm font-bold hover:bg-gold-400/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  )
}
