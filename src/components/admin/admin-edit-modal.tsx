'use client'

import { adminUpdatePlayer } from '@/app/actions/players'
import { X, Save, Crown, Shield, Swords, Plus, Minus } from 'lucide-react'
import { useState, useTransition } from 'react'

interface PlayerProfile {
  id: string
  display_name: string | null
  avatar_url: string | null
  role: 'player' | 'admin' | 'dm'
  hp: number
  sanity: number
  max_sanity: number
  spirituality: number
  max_spirituality: number
  travel_points: number
  max_travel_points: number
}

export default function AdminEditModal({
  player,
  onClose,
  onSaved,
}: {
  player: PlayerProfile
  onClose: () => void
  onSaved?: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await adminUpdatePlayer(player.id, formData)
      if (result?.error) {
        setError(result.error)
      } else {
        onSaved?.()
        onClose()
      }
    })
  }

  const roleOptions = [
    { value: 'player', label: 'ผู้เล่น', icon: Swords },
    { value: 'dm', label: 'Dungeon Master', icon: Shield },
    { value: 'admin', label: 'ผู้ดูแลระบบ', icon: Crown },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-sm border border-gold-400/20 p-6"
        style={{ backgroundColor: '#1A1612' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="heading-victorian text-xl">
            แก้ไขข้อมูล — {player.display_name || 'ไม่ระบุชื่อ'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-victorian-400 hover:text-gold-400 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-nouveau-ruby/10 border border-nouveau-ruby/30 rounded-sm text-nouveau-ruby text-sm">
            {error}
          </div>
        )}

        <form action={handleSubmit} className="space-y-5">
          {/* Display Name */}
          <div>
            <label className="block text-sm text-victorian-300 mb-1.5 font-display tracking-wider uppercase">
              ชื่อที่แสดง
            </label>
            <input
              name="display_name"
              type="text"
              defaultValue={player.display_name || ''}
              className="input-victorian !py-2.5 !px-4 !text-base"
            />
          </div>

          {/* Avatar URL */}
          <div>
            <label className="block text-sm text-victorian-300 mb-1.5 font-display tracking-wider uppercase">
              Avatar URL
            </label>
            <input
              name="avatar_url"
              type="url"
              defaultValue={player.avatar_url || ''}
              placeholder="https://..."
              className="input-victorian !py-2.5 !px-4 !text-base"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm text-victorian-300 mb-1.5 font-display tracking-wider uppercase">
              บทบาท
            </label>
            <select
              name="role"
              defaultValue={player.role}
              className="input-victorian !py-2.5 !px-4 !text-base cursor-pointer"
            >
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Ornament Divider */}
          <div className="ornament-divider !my-4" />

          {/* ตัวตายตัวแทน — ปรับ +/- จากค่าปัจจุบัน */}
          <div>
            <label className="block text-xs text-red-400 mb-1.5 font-display tracking-wider uppercase">
              ตัวตายตัวแทน
              <span className="text-red-400/50 ml-2 normal-case">ปัจจุบัน: {player.hp} ครั้ง</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-victorian-400 text-xs"><Plus className="w-3 h-3 inline" />/<Minus className="w-3 h-3 inline" /></span>
              <input
                name="hp_delta"
                type="number"
                defaultValue={0}
                placeholder="0"
                className="input-victorian !py-2 !px-3 !text-base flex-1"
              />
              <span className="text-red-400/40 text-xs font-display">ครั้ง</span>
            </div>
            <p className="text-victorian-500 text-[10px] mt-1">ใส่ + เพิ่ม, ใส่ - ลด (เช่น 2 = เพิ่ม 2, -1 = ลด 1)</p>
          </div>

          {/* สติ — ปรับ +/- จากค่าปัจจุบัน */}
          <div>
            <label className="block text-xs text-cyan-400 mb-1.5 font-display tracking-wider uppercase">
              สติ
              <span className="text-cyan-400/50 ml-2 normal-case">ปัจจุบัน: {player.sanity}/{player.max_sanity}</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-victorian-400 text-xs"><Plus className="w-3 h-3 inline" />/<Minus className="w-3 h-3 inline" /></span>
              <input
                name="sanity_delta"
                type="number"
                defaultValue={0}
                placeholder="0"
                className="input-victorian !py-2 !px-3 !text-base flex-1"
              />
            </div>
            <p className="text-victorian-500 text-[10px] mt-1">ใส่ + เพิ่ม, ใส่ - ลด (เช่น 3 = เพิ่ม 3, -2 = ลด 2)</p>
          </div>

          {/* สติสูงสุด */}
          <div className="w-1/2">
            <label className="block text-xs text-cyan-400/60 mb-1 font-display tracking-wider uppercase">
              สติสูงสุด
            </label>
            <input
              name="max_sanity"
              type="number"
              min="1"
              defaultValue={player.max_sanity}
              className="input-victorian !py-2 !px-3 !text-base"
            />
          </div>

          {/* Spirituality (พลังวิญญาณ) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-purple-400 mb-1 font-display tracking-wider uppercase">
                พลังวิญญาณ
              </label>
              <input
                name="spirituality"
                type="number"
                min="0"
                defaultValue={player.spirituality}
                className="input-victorian !py-2 !px-3 !text-base"
              />
            </div>
            <div>
              <label className="block text-xs text-purple-400/60 mb-1 font-display tracking-wider uppercase">
                สูงสุด
              </label>
              <input
                name="max_spirituality"
                type="number"
                min="1"
                defaultValue={player.max_spirituality}
                className="input-victorian !py-2 !px-3 !text-base"
              />
            </div>
          </div>

          {/* Travel Points (หน่วยการเดินทาง) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-emerald-400 mb-1 font-display tracking-wider uppercase">
                หน่วยการเดินทาง
              </label>
              <input
                name="travel_points"
                type="number"
                min="0"
                defaultValue={player.travel_points}
                className="input-victorian !py-2 !px-3 !text-base"
              />
            </div>
            <div>
              <label className="block text-xs text-emerald-400/60 mb-1 font-display tracking-wider uppercase">
                สูงสุด
              </label>
              <input
                name="max_travel_points"
                type="number"
                min="1"
                defaultValue={player.max_travel_points}
                className="input-victorian !py-2 !px-3 !text-base"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-victorian-400 hover:text-nouveau-cream cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="btn-gold !py-2.5 !px-6 !text-sm"
            >
              <Save className="w-4 h-4" />
              {isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
