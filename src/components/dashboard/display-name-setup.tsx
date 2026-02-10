'use client'

import { updateDisplayName } from '@/app/actions/auth'
import { AlertTriangle } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DisplayNameSetup({
  currentName
}: {
  currentName: string
}) {
  const [name, setName] = useState(currentName)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmed = name.trim()
    if (!trimmed) {
      setError('กรุณากรอกชื่อที่แสดง')
      return
    }

    setSaving(true)
    const result = await updateDisplayName(trimmed)
    setSaving(false)

    if (result?.error) {
      setError(result.error)
    } else {
      router.refresh()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
    >
      <div
        className="w-full max-w-md rounded-sm border border-gold-400/30 p-8"
        style={{ backgroundColor: '#1A1612' }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="heading-victorian text-2xl md:text-3xl mb-2">
            ตั้งชื่อที่แสดง
          </h2>
          <p className="text-victorian-400 text-sm">
            กรุณาตั้งชื่อที่แสดงก่อนเข้าใช้งาน
          </p>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 p-4 mb-6 rounded-sm border border-nouveau-ruby/30 bg-nouveau-ruby/5">
          <AlertTriangle className="w-5 h-5 text-nouveau-ruby flex-shrink-0 mt-0.5" />
          <p className="text-sm text-nouveau-ruby/90 leading-relaxed">
            <strong>สำคัญ:</strong> โปรดใช้ชื่อเดียวกับที่ลงทะเบียนในกิจกรรมเท่านั้น
            เพื่อให้ทีมงานสามารถระบุตัวตนของคุณได้
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm text-victorian-300 mb-2">
              ชื่อที่แสดง (Display Name)
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ชื่อที่ลงทะเบียนในกิจกรรม"
              maxLength={100}
              className="input-victorian w-full text-lg"
              disabled={saving}
            />
            {error && (
              <p className="mt-2 text-sm text-nouveau-ruby">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="btn-gold w-full !py-3 !text-base disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก...' : 'ยืนยันชื่อ'}
          </button>
        </form>
      </div>
    </div>
  )
}
