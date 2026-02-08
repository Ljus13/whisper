'use client'

import { adminUpdatePlayer } from '@/app/actions/players'
import { assignPlayerPathway, removePlayerPathway } from '@/app/actions/skills'
import { X, Save, Crown, Shield, Swords, Plus, Minus, GitBranch, Trash2 } from 'lucide-react'
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

interface PathwayInfo {
  id: string
  name: string
}

interface SequenceInfo {
  id: string
  pathway_id: string
  seq_number: number
  name: string
}

interface PlayerPathwayInfo {
  id: string
  player_id: string
  pathway_id: string | null
  sequence_id: string | null
}

export default function AdminEditModal({
  player,
  onClose,
  onSaved,
  pathways = [],
  sequences = [],
  playerPathways = [],
}: {
  player: PlayerProfile
  onClose: () => void
  onSaved?: () => void
  pathways?: PathwayInfo[]
  sequences?: SequenceInfo[]
  playerPathways?: PlayerPathwayInfo[]
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showAddPathway, setShowAddPathway] = useState(false)
  const [newPathwayId, setNewPathwayId] = useState('')
  const [newSequenceId, setNewSequenceId] = useState('')

  // Get current player pathways
  const currentPPs = playerPathways.filter(pp => pp.player_id === player.id)

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

          {/* Ornament Divider */}
          <div className="ornament-divider !my-4" />

          {/* ═══ Pathway & Sequence Management ═══ */}
          {pathways.length > 0 && (
            <div>
              <label className="block text-sm text-gold-400 mb-2 font-display tracking-wider uppercase flex items-center gap-2">
                <GitBranch className="w-4 h-4" /> เส้นทางและลำดับ
              </label>

              {/* Current Pathways */}
              {currentPPs.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {currentPPs.map(pp => {
                    const pw = pathways.find(p => p.id === pp.pathway_id)
                    const pathSeqs = sequences.filter(s => s.pathway_id === pp.pathway_id).sort((a, b) => b.seq_number - a.seq_number)
                    const currentSeq = sequences.find(s => s.id === pp.sequence_id)
                    if (!pw) return null
                    return (
                      <div key={pp.id} className="p-3 bg-victorian-950/60 border border-gold-400/10 rounded-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-nouveau-cream/80 text-sm font-display">{pw.name}</span>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => {
                              startTransition(async () => {
                                const result = await removePlayerPathway(player.id, pw.id)
                                if (result?.error) setError(result.error)
                                else onSaved?.()
                              })
                            }}
                            className="p-1 text-red-400/40 hover:text-red-400 rounded transition-colors"
                            title="ลบเส้นทาง"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {/* Sequence selector */}
                        <div className="flex items-center gap-2">
                          <span className="text-victorian-400 text-xs">ลำดับ:</span>
                          <select
                            className="input-victorian !py-1 !px-2 !text-sm flex-1"
                            defaultValue={pp.sequence_id || ''}
                            onChange={(e) => {
                              const seqId = e.target.value || null
                              startTransition(async () => {
                                const result = await assignPlayerPathway(player.id, pw.id, seqId)
                                if (result?.error) setError(result.error)
                                else onSaved?.()
                              })
                            }}
                          >
                            <option value="">— ยังไม่กำหนด —</option>
                            {pathSeqs.map(s => (
                              <option key={s.id} value={s.id}>#{s.seq_number} {s.name}</option>
                            ))}
                          </select>
                          {currentSeq && (
                            <span className="text-gold-400 text-xs font-mono">#{currentSeq.seq_number}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-victorian-500 text-sm italic mb-3">ยังไม่มีเส้นทาง</p>
              )}

              {/* Add Pathway */}
              {showAddPathway ? (
                <div className="p-3 bg-victorian-900/30 border border-gold-400/10 rounded-sm space-y-2">
                  <div>
                    <label className="text-victorian-400 text-xs block mb-1">เลือกเส้นทาง</label>
                    <select
                      className="input-victorian !py-1.5 !px-2 !text-sm w-full"
                      value={newPathwayId}
                      onChange={(e) => { setNewPathwayId(e.target.value); setNewSequenceId('') }}
                    >
                      <option value="">— เลือก —</option>
                      {pathways
                        .filter(pw => !currentPPs.some(pp => pp.pathway_id === pw.id))
                        .map(pw => (
                          <option key={pw.id} value={pw.id}>{pw.name}</option>
                        ))}
                    </select>
                  </div>
                  {newPathwayId && (
                    <div>
                      <label className="text-victorian-400 text-xs block mb-1">ลำดับเริ่มต้น</label>
                      <select
                        className="input-victorian !py-1.5 !px-2 !text-sm w-full"
                        value={newSequenceId}
                        onChange={(e) => setNewSequenceId(e.target.value)}
                      >
                        <option value="">— ยังไม่กำหนด —</option>
                        {sequences
                          .filter(s => s.pathway_id === newPathwayId)
                          .sort((a, b) => b.seq_number - a.seq_number)
                          .map(s => (
                            <option key={s.id} value={s.id}>#{s.seq_number} {s.name}</option>
                          ))}
                      </select>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isPending || !newPathwayId}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await assignPlayerPathway(player.id, newPathwayId, newSequenceId || null)
                          if (result?.error) setError(result.error)
                          else {
                            setShowAddPathway(false)
                            setNewPathwayId('')
                            setNewSequenceId('')
                            onSaved?.()
                          }
                        })
                      }}
                      className="btn-gold px-3 py-1 text-xs"
                    >
                      บันทึก
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddPathway(false); setNewPathwayId(''); setNewSequenceId('') }}
                      className="btn-victorian px-3 py-1 text-xs"
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddPathway(true)}
                  className="text-sm text-gold-400 hover:text-gold-300 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> เพิ่มเส้นทาง
                </button>
              )}
            </div>
          )}

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
