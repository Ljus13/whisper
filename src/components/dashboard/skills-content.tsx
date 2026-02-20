'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import type { Profile, SkillType, SkillPathway, SkillSequence, Skill, PlayerPathway } from '@/lib/types/database'
import {
  ArrowLeft, ChevronDown, ChevronRight, Plus, Trash2, Sparkles, Zap,
  GitBranch, Layers, Shield, Lock, BookOpen, Pencil, Copy, Check, X, ScrollText,
  Gift, Clock, Infinity, Send, Users, LockKeyhole, Search
} from 'lucide-react'
import {
  createSkillType, updateSkillType, deleteSkillType,
  createSkillPathway, deleteSkillPathway, updateSkillPathway,
  createSkillSequence, deleteSkillSequence, updateSkillSequence,
  createSkill, updateSkill, deleteSkill,
  castSkill
} from '@/app/actions/skills'
import { getGrantedSkillsForPlayer, useGrantedSkill as castGrantedSkill, transferGrantedSkill, getPlayersForTransfer } from '@/app/actions/granted-skills'
import SanityLockOverlay from '@/components/sanity-lock-overlay'
import { OrnamentedCard } from '@/components/ui/ornaments'
import { createClient } from '@/lib/supabase/client'
import { getCached, setCache, REF_TTL } from '@/lib/client-cache'


/* ─── Props ─── */
interface SkillsContentProps {
  userId: string
}

/* ═══════════════════════════════════════
   ADMIN PANEL: Manage the skill hierarchy
   ═══════════════════════════════════════ */
function AdminPanel({
  skillTypes, pathways, sequences, skills, onRefresh
}: {
  skillTypes: SkillType[]
  pathways: SkillPathway[]
  sequences: SkillSequence[]
  skills: Skill[]
  onRefresh: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [openType, setOpenType] = useState<string | null>(null)
  const [openPathway, setOpenPathway] = useState<string | null>(null)
  const [showAddType, setShowAddType] = useState(false)
  const [showAddPathway, setShowAddPathway] = useState<string | null>(null)
  const [showAddSequence, setShowAddSequence] = useState<string | null>(null)
  const [showAddSkill, setShowAddSkill] = useState<string | null>(null)
  const [editTypeId, setEditTypeId] = useState<string | null>(null)
  const [editPathwayId, setEditPathwayId] = useState<string | null>(null)
  const [editSequenceId, setEditSequenceId] = useState<string | null>(null)
  const [editSkillId, setEditSkillId] = useState<string | null>(null)
  const [editSkillName, setEditSkillName] = useState('')
  const [editSkillDesc, setEditSkillDesc] = useState('')
  const [editSkillCost, setEditSkillCost] = useState('0')
  const [editSkillSequenceId, setEditSkillSequenceId] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleAction(action: () => Promise<{ error?: string; success?: boolean }>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result?.error) setError(result.error)
      else onRefresh()
    })
  }

  return (
    <OrnamentedCard className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="heading-victorian text-2xl flex items-center gap-3">
          <Shield className="w-6 h-6 text-gold-400" />
          จัดการระบบสกิล (Admin)
        </h2>
        <button
          onClick={() => setShowAddType(true)}
          className="btn-gold px-4 py-2 text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> เพิ่มกลุ่ม
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Add Type Form */}
      {showAddType && (
        <form
          className="mb-6 p-4 bg-victorian-800/30 border border-gold-400/10 rounded-lg space-y-3"
          action={(fd) => { handleAction(() => createSkillType(fd)); setShowAddType(false) }}
        >
          <h3 className="text-gold-300 font-semibold">เพิ่มกลุ่มใหม่ (Type)</h3>
          <input name="name" placeholder="ชื่อกลุ่ม" required className="input-victorian w-full" />
          <textarea name="description" placeholder="คำอธิบาย (ไม่บังคับ)" className="input-victorian w-full" rows={2} />
          <textarea name="overview" placeholder="ภาพรวมของกลุ่ม" className="input-victorian w-full" rows={3} />
          <div className="flex gap-2">
            <button type="submit" disabled={isPending} className="btn-gold px-4 py-2 text-sm">บันทึก</button>
            <button type="button" onClick={() => setShowAddType(false)} className="btn-victorian px-4 py-2 text-sm">ยกเลิก</button>
          </div>
        </form>
      )}

      {/* Skill Types List */}
      <div className="space-y-3">
        {skillTypes.length === 0 && (
          <p className="text-victorian-400 text-center py-8">ยังไม่มีกลุ่มสกิล — กดปุ่ม &ldquo;เพิ่มกลุ่ม&rdquo; เพื่อเริ่มต้น</p>
        )}
        {skillTypes.map(type => {
          const typePathways = pathways.filter(p => p.type_id === type.id)
          const isOpen = openType === type.id
          return (
            <div key={type.id} className="border border-gold-400/10 rounded-lg overflow-hidden">
              {/* Type Header */}
              <div
                className="flex items-center justify-between p-4 bg-victorian-800/40 cursor-pointer hover:bg-victorian-800/60 transition-colors"
                onClick={() => setOpenType(isOpen ? null : type.id)}
              >
                <div className="flex items-center gap-3">
                  {isOpen ? <ChevronDown className="w-5 h-5 text-gold-400" /> : <ChevronRight className="w-5 h-5 text-gold-400" />}
                  <Layers className="w-5 h-5 text-gold-400" />
                  <div>
                    <span className="text-gold-300 font-semibold text-lg">{type.name}</span>
                    {type.description && <p className="text-victorian-400 text-sm">{type.description}</p>}
                    {type.overview && <p className="text-victorian-300 text-sm mt-1">ภาพรวม: {type.overview}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-victorian-400 text-sm">{typePathways.length} เส้นทาง</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditTypeId(type.id) }}
                    className="p-1.5 text-gold-400/50 hover:text-gold-400 hover:bg-gold-400/10 rounded transition-colors"
                    title="แก้ไขกลุ่ม"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAction(() => deleteSkillType(type.id)) }}
                    className="p-1.5 text-red-400/60 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                    title="ลบกลุ่ม"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Pathways under this Type */}
              {isOpen && (
                <div className="p-4 pt-2 space-y-3 border-t border-gold-400/5">
                  {editTypeId === type.id && (
                    <form
                      className="p-3 bg-victorian-900/30 border border-gold-400/10 rounded space-y-2"
                      action={(fd) => { handleAction(() => updateSkillType(type.id, fd)); setEditTypeId(null) }}
                    >
                      <h4 className="text-gold-300 text-sm font-semibold flex items-center gap-2"><Pencil className="w-3.5 h-3.5" /> แก้ไขกลุ่ม</h4>
                      <input name="name" defaultValue={type.name} placeholder="ชื่อกลุ่ม" required className="input-victorian w-full text-sm" />
                      <textarea name="description" defaultValue={type.description || ''} placeholder="คำอธิบาย" className="input-victorian w-full text-sm" rows={2} />
                      <textarea name="overview" defaultValue={type.overview || ''} placeholder="ภาพรวมของกลุ่ม" className="input-victorian w-full text-sm" rows={3} />
                      <div className="flex gap-2">
                        <button type="submit" disabled={isPending} className="btn-gold px-3 py-1.5 text-xs">บันทึก</button>
                        <button type="button" onClick={() => setEditTypeId(null)} className="btn-victorian px-3 py-1.5 text-xs">ยกเลิก</button>
                      </div>
                    </form>
                  )}
                  <button
                    onClick={() => setShowAddPathway(type.id)}
                    className="text-sm text-gold-400 hover:text-gold-300 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มเส้นทาง
                  </button>

                  {showAddPathway === type.id && (
                    <form
                      className="p-3 bg-victorian-900/30 border border-gold-400/10 rounded space-y-2"
                      action={(fd) => { handleAction(() => createSkillPathway(fd)); setShowAddPathway(null) }}
                    >
                      <input type="hidden" name="type_id" value={type.id} />
                      <input name="name" placeholder="ชื่อเส้นทาง" required className="input-victorian w-full text-sm" />
                      <textarea name="description" placeholder="คำอธิบาย" className="input-victorian w-full text-sm" rows={2} />
                      <textarea name="overview" placeholder="ภาพรวมของเส้นทาง" className="input-victorian w-full text-sm" rows={3} />
                      <input name="bg_url" placeholder="URL ภาพพื้นหลัง (5:4)" className="input-victorian w-full text-sm" />
                      <input name="logo_url" placeholder="URL โลโก้ (1:1 PNG)" className="input-victorian w-full text-sm" />
                      <input name="video_url" placeholder="URL วิดีโอ (1:1 MP4)" className="input-victorian w-full text-sm" />
                      <div className="flex gap-2">
                        <button type="submit" disabled={isPending} className="btn-gold px-3 py-1.5 text-xs">บันทึก</button>
                        <button type="button" onClick={() => setShowAddPathway(null)} className="btn-victorian px-3 py-1.5 text-xs">ยกเลิก</button>
                      </div>
                    </form>
                  )}

                  {typePathways.map(pathway => {
                    const pathSeqs = sequences.filter(s => s.pathway_id === pathway.id).sort((a, b) => b.seq_number - a.seq_number)
                    const pathSkills = skills.filter(s => s.pathway_id === pathway.id)
                    const isPathOpen = openPathway === pathway.id
                    const isEditing = editPathwayId === pathway.id
                    return (
                      <div key={pathway.id} className="ml-4 border-l-2 border-gold-400/10 pl-4">
                        {isEditing ? (
                          /* ── Inline Edit Pathway Form ── */
                          <form
                            className="p-3 bg-victorian-900/30 border border-gold-400/10 rounded space-y-2 my-2"
                            action={(fd) => { handleAction(() => updateSkillPathway(pathway.id, fd)); setEditPathwayId(null) }}
                          >
                            <h4 className="text-gold-300 text-sm font-semibold flex items-center gap-2"><Pencil className="w-3.5 h-3.5" /> แก้ไขเส้นทาง</h4>
                            <input name="name" defaultValue={pathway.name} placeholder="ชื่อเส้นทาง" required className="input-victorian w-full text-sm" />
                            <textarea name="description" defaultValue={pathway.description || ''} placeholder="คำอธิบาย" className="input-victorian w-full text-sm" rows={2} />
                            <textarea name="overview" defaultValue={pathway.overview || ''} placeholder="ภาพรวมของเส้นทาง" className="input-victorian w-full text-sm" rows={3} />
                            <input name="bg_url" defaultValue={pathway.bg_url || ''} placeholder="URL ภาพพื้นหลัง (5:4)" className="input-victorian w-full text-sm" />
                            <input name="logo_url" defaultValue={pathway.logo_url || ''} placeholder="URL โลโก้ (1:1 PNG)" className="input-victorian w-full text-sm" />
                            <input name="video_url" defaultValue={pathway.video_url || ''} placeholder="URL วิดีโอ (1:1 MP4)" className="input-victorian w-full text-sm" />
                            <div className="flex gap-2">
                              <button type="submit" disabled={isPending} className="btn-gold px-3 py-1.5 text-xs">บันทึก</button>
                              <button type="button" onClick={() => setEditPathwayId(null)} className="btn-victorian px-3 py-1.5 text-xs">ยกเลิก</button>
                            </div>
                          </form>
                        ) : (
                        <div
                          className="flex items-center justify-between py-2 cursor-pointer"
                          onClick={() => setOpenPathway(isPathOpen ? null : pathway.id)}
                        >
                          <div className="flex items-center gap-2">
                            {isPathOpen ? <ChevronDown className="w-4 h-4 text-gold-400" /> : <ChevronRight className="w-4 h-4 text-gold-400" />}
                            <GitBranch className="w-4 h-4 text-gold-400" />
                            <span className="text-gold-200">{pathway.name}</span>
                            <span className="text-victorian-500 text-xs">({pathSeqs.length} ลำดับ, {pathSkills.length} สกิล)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditPathwayId(pathway.id) }}
                              className="p-1 text-gold-400/40 hover:text-gold-400 rounded transition-colors"
                              title="แก้ไขเส้นทาง"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAction(() => deleteSkillPathway(pathway.id)) }}
                              className="p-1 text-red-400/60 hover:text-red-400 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        )}

                        {isPathOpen && (
                          <div className="ml-4 space-y-3 py-2">
                            {pathway.overview && (
                              <div className="text-victorian-300 text-sm">ภาพรวม: {pathway.overview}</div>
                            )}
                            {/* Sequences */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-victorian-300 text-sm font-medium">ลำดับ (Sequences)</span>
                                <button
                                  onClick={() => setShowAddSequence(pathway.id)}
                                  className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> เพิ่มลำดับ
                                </button>
                              </div>

                              {showAddSequence === pathway.id && (
                                <form
                                  className="mb-2 p-2 bg-victorian-900/30 border border-gold-400/10 rounded space-y-2"
                                  action={(fd) => { handleAction(() => createSkillSequence(fd)); setShowAddSequence(null) }}
                                >
                                  <input type="hidden" name="pathway_id" value={pathway.id} />
                                  <div className="flex gap-2">
                                    <div className="w-20">
                                      <input name="seq_number" type="number" min="0" max="9" placeholder="0-9" required className="input-victorian w-full text-sm" />
                                      <span className="text-victorian-500 text-[10px]">9=อ่อน, 0=แกร่ง</span>
                                    </div>
                                    <input name="name" placeholder="ชื่อลำดับ" required className="input-victorian flex-1 text-sm" />
                                  </div>
                                  <input name="roleplay_keywords" placeholder="คีย์เวิร์ด/คอนเซปต์การสวมบทบาท" className="input-victorian w-full text-sm" />
                                  <div className="flex gap-2">
                                    <button type="submit" disabled={isPending} className="btn-gold px-3 py-1 text-xs">บันทึก</button>
                                    <button type="button" onClick={() => setShowAddSequence(null)} className="btn-victorian px-3 py-1 text-xs">ยกเลิก</button>
                                  </div>
                                </form>
                              )}

                              {pathSeqs.map(seq => (
                                <div key={seq.id}>
                                  {editSequenceId === seq.id ? (
                                    /* ── Inline Edit Sequence Form ── */
                                    <form
                                      className="p-2 bg-victorian-900/30 border border-gold-400/10 rounded space-y-2 my-1"
                                      action={(fd) => { handleAction(() => updateSkillSequence(seq.id, fd)); setEditSequenceId(null) }}
                                    >
                                      <h4 className="text-gold-300 text-xs font-semibold flex items-center gap-1"><Pencil className="w-3 h-3" /> แก้ไขลำดับ</h4>
                                      <div className="flex gap-2">
                                        <div className="w-20">
                                          <input name="seq_number" type="number" min="0" max="9" defaultValue={seq.seq_number} required className="input-victorian w-full text-sm" />
                                          <span className="text-victorian-500 text-[10px]">9=อ่อน, 0=แกร่ง</span>
                                        </div>
                                        <input name="name" defaultValue={seq.name} placeholder="ชื่อลำดับ" required className="input-victorian flex-1 text-sm" />
                                      </div>
                                      <input name="roleplay_keywords" defaultValue={seq.roleplay_keywords || ''} placeholder="คีย์เวิร์ด/คอนเซปต์การสวมบทบาท" className="input-victorian w-full text-sm" />
                                      <div className="flex gap-2">
                                        <button type="submit" disabled={isPending} className="btn-gold px-3 py-1 text-xs">บันทึก</button>
                                        <button type="button" onClick={() => setEditSequenceId(null)} className="btn-victorian px-3 py-1 text-xs">ยกเลิก</button>
                                      </div>
                                    </form>
                                  ) : (
                                    <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-victorian-800/20 text-sm">
                                      <span className="text-victorian-300">
                                        <span className={`font-mono mr-2 ${seq.seq_number <= 2 ? 'text-red-400' : seq.seq_number <= 5 ? 'text-amber-400' : 'text-gold-400'}`}>
                                          ลำดับ {seq.seq_number}
                                        </span>
                                        {seq.name}
                                        {seq.seq_number === 9 && <span className="text-victorian-500 text-xs ml-2">(เริ่มต้น)</span>}
                                        {seq.seq_number === 0 && <span className="text-red-400 text-xs ml-2">(สูงสุด)</span>}
                                        {seq.roleplay_keywords && <span className="text-victorian-500 text-xs ml-2">คีย์เวิร์ด: {seq.roleplay_keywords}</span>}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => setEditSequenceId(seq.id)}
                                          className="p-1 text-gold-400/40 hover:text-gold-400 rounded transition-colors"
                                          title="แก้ไขลำดับ"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => handleAction(() => deleteSkillSequence(seq.id))}
                                          className="p-1 text-red-400/40 hover:text-red-400 rounded transition-colors"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Skills */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-victorian-300 text-sm font-medium">สกิล (Skills)</span>
                                <button
                                  onClick={() => setShowAddSkill(pathway.id)}
                                  className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> เพิ่มสกิล
                                </button>
                              </div>

                              {showAddSkill === pathway.id && (
                                <form
                                  className="mb-2 p-2 bg-victorian-900/30 border border-gold-400/10 rounded space-y-2"
                                  action={(fd) => { handleAction(() => createSkill(fd)); setShowAddSkill(null) }}
                                >
                                  <input type="hidden" name="pathway_id" value={pathway.id} />
                                  <input name="name" placeholder="ชื่อสกิล" required className="input-victorian w-full text-sm" />
                                  <textarea name="description" placeholder="คำอธิบายสกิล" className="input-victorian w-full text-sm" rows={2} />
                                  <div className="flex gap-2">
                                    <div className="flex-1">
                                      <label className="text-victorian-400 text-xs block mb-1">ต้นทุนพลังวิญญาณ</label>
                                      <input name="spirit_cost" type="number" min="0" defaultValue="0" className="input-victorian w-full text-sm" />
                                    </div>
                                    <div className="flex-1">
                                      <label className="text-victorian-400 text-xs block mb-1">ลำดับที่จำเป็น</label>
                                      <select name="sequence_id" required className="input-victorian w-full text-sm">
                                        <option value="">เลือกลำดับ</option>
                                        {pathSeqs.map(seq => (
                                          <option key={seq.id} value={seq.id}>#{seq.seq_number} {seq.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button type="submit" disabled={isPending} className="btn-gold px-3 py-1 text-xs">บันทึก</button>
                                    <button type="button" onClick={() => setShowAddSkill(null)} className="btn-victorian px-3 py-1 text-xs">ยกเลิก</button>
                                  </div>
                                </form>
                              )}

                              {pathSkills.map(skill => {
                                const seq = sequences.find(s => s.id === skill.sequence_id)
                                return (
                                  <div key={skill.id} className="py-2 px-2 rounded hover:bg-victorian-800/20 text-sm">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex items-start gap-2">
                                        <Sparkles className="w-3.5 h-3.5 text-gold-400 mt-0.5" />
                                        <div>
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-victorian-200">{skill.name}</span>
                                            {seq && <span className="text-victorian-500 text-xs">(ลำดับ {seq.seq_number})</span>}
                                            <span className="text-blue-400/60 text-xs flex items-center gap-0.5">
                                              <Zap className="w-3 h-3" />{skill.spirit_cost}
                                            </span>
                                          </div>
                                          <div className="text-victorian-400 text-xs mt-1 whitespace-pre-line">
                                            {skill.description || '—'}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => {
                                            setEditSkillId(skill.id)
                                            setEditSkillName(skill.name)
                                            setEditSkillDesc(skill.description || '')
                                            setEditSkillCost(String(skill.spirit_cost ?? 0))
                                            setEditSkillSequenceId(skill.sequence_id || '')
                                          }}
                                          className="p-1 text-gold-400/50 hover:text-gold-400 rounded transition-colors"
                                          title="แก้ไขสกิล"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleAction(() => deleteSkill(skill.id))}
                                          className="p-1 text-red-400/40 hover:text-red-400 rounded transition-colors"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                    {editSkillId === skill.id && (
                                      <form
                                        className="mt-3 p-3 bg-victorian-900/40 border border-gold-400/10 rounded space-y-2"
                                        action={(fd) => { handleAction(() => updateSkill(skill.id, fd)); setEditSkillId(null) }}
                                      >
                                        <input name="name" value={editSkillName} onChange={e => setEditSkillName(e.target.value)} required className="input-victorian w-full text-sm" />
                                        <textarea name="description" value={editSkillDesc} onChange={e => setEditSkillDesc(e.target.value)} className="input-victorian w-full text-sm" rows={2} />
                                        <div className="flex gap-2">
                                          <div className="flex-1">
                                            <label className="text-victorian-400 text-xs block mb-1">ต้นทุนพลังวิญญาณ</label>
                                            <input name="spirit_cost" type="number" min="0" value={editSkillCost} onChange={e => setEditSkillCost(e.target.value)} className="input-victorian w-full text-sm" />
                                          </div>
                                          <div className="flex-1">
                                            <label className="text-victorian-400 text-xs block mb-1">ลำดับที่จำเป็น</label>
                                            <select name="sequence_id" value={editSkillSequenceId} onChange={e => setEditSkillSequenceId(e.target.value)} required className="input-victorian w-full text-sm">
                                              <option value="">เลือกลำดับ</option>
                                              {pathSeqs.map(seq => (
                                                <option key={seq.id} value={seq.id}>#{seq.seq_number} {seq.name}</option>
                                              ))}
                                            </select>
                                          </div>
                                        </div>
                                        <div className="flex gap-2">
                                          <button type="submit" disabled={isPending} className="btn-gold px-3 py-1 text-xs">บันทึก</button>
                                          <button type="button" onClick={() => setEditSkillId(null)} className="btn-victorian px-3 py-1 text-xs">ยกเลิก</button>
                                        </div>
                                      </form>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </OrnamentedCard>
  )
}

/* ═══════════════════════════════════════
   PLAYER VIEW: Two-column pathway + skills
   ═══════════════════════════════════════ */
function PlayerSkillView({
  profile, skillTypes, pathways, sequences, skills, playerPathways, grantedSkills, onRefresh
}: {
  profile: Profile | null
  skillTypes: SkillType[]
  pathways: SkillPathway[]
  sequences: SkillSequence[]
  skills: Skill[]
  playerPathways: PlayerPathway[]
  grantedSkills: any[]
  onRefresh: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [rollPhase, setRollPhase] = useState<'input' | 'rolling' | 'result'>('input')
  const [successRate, setSuccessRate] = useState('')
  const [rollNote, setRollNote] = useState('')
  const [rollingValue, setRollingValue] = useState(1)
  const [skillResult, setSkillResult] = useState<{
    name: string
    description: string | null
    remaining: number
    referenceCode: string
    successRate: number
    roll: number
    outcome: 'success' | 'fail'
    pathwayName: string
    sequenceName: string
    note: string | null
  } | null>(null)
  const [skillError, setSkillError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // Optimistic spirituality for instant UI feedback
  const [optimisticSpirit, setOptimisticSpirit] = useState<number | null>(null)
  const [origin, setOrigin] = useState('')
  const displaySpirit = optimisticSpirit ?? profile?.spirituality ?? 0

  // Granted skill usage state
  const [selectedGranted, setSelectedGranted] = useState<any | null>(null)
  const [grantedRollPhase, setGrantedRollPhase] = useState<'input' | 'rolling' | 'result'>('input')
  const [grantedSuccessRate, setGrantedSuccessRate] = useState('')
  const [grantedRollNote, setGrantedRollNote] = useState('')
  const [grantedRollingValue, setGrantedRollingValue] = useState(1)
  const [grantedResult, setGrantedResult] = useState<any | null>(null)
  const [grantedError, setGrantedError] = useState<string | null>(null)
  const [grantedCopied, setGrantedCopied] = useState(false)
  const [grantedShowAll, setGrantedShowAll] = useState(false)
  const [grantedSearch, setGrantedSearch] = useState('')

  // Transfer state
  const [transferringGrant, setTransferringGrant] = useState<any | null>(null)
  const [transferPlayers, setTransferPlayers] = useState<{ id: string; display_name: string | null; avatar_url: string | null }[]>([])
  const [transferSearch, setTransferSearch] = useState('')
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferMsg, setTransferMsg] = useState<string | null>(null)
  const [transferConfirmTarget, setTransferConfirmTarget] = useState<{ id: string; display_name: string | null; avatar_url: string | null } | null>(null)
  const [isPendingTransfer, startTransferTransition] = useTransition()

  // Transfer handlers
  function handleOpenTransfer(gs: any) {
    setTransferringGrant(gs)
    setTransferSearch('')
    setTransferMsg(null)
    setTransferConfirmTarget(null)
    setTransferLoading(true)
    getPlayersForTransfer().then(r => {
      setTransferPlayers(r.players || [])
      setTransferLoading(false)
    })
  }

  function handleConfirmTransfer(targetId: string) {
    if (!transferringGrant) return
    startTransferTransition(async () => {
      const r = await transferGrantedSkill(transferringGrant.id, targetId)
      if (r.error) {
        setTransferMsg(r.error)
      } else {
        setTransferMsg(`ส่งมอบให้ ${r.targetName} สำเร็จ!`)
        setTransferringGrant(null)
        // Refresh data
        onRefresh()
      }
    })
  }

  // Determine which skills the player can access
  function canAccessSkill(skill: Skill): boolean {
    const pp = playerPathways.find(pp => pp.pathway_id === skill.pathway_id)
    if (!pp || !pp.sequence_id) return false
    const playerSeq = sequences.find(s => s.id === pp.sequence_id)
    const skillSeq = sequences.find(s => s.id === skill.sequence_id)
    if (!playerSeq || !skillSeq) return false
    return skillSeq.seq_number >= playerSeq.seq_number
  }

  function handleUseSkill(skillId: string) {
    setSkillError(null)
    setCopied(false)
    setSkillResult(null)
    setRollPhase('input')
    setSuccessRate('')
    setRollNote('')
    setRollingValue(1)

    const skill = skills.find(s => s.id === skillId)
    if (skill) {
      setSelectedSkill(skill)
    }
  }

  function handleCopyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Reset optimistic spirit when profile updates from realtime
  useEffect(() => {
    if (profile?.spirituality !== undefined) {
      setOptimisticSpirit(null)
    }
  }, [profile?.spirituality])
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])

  async function runRollAnimation() {
    return new Promise<number>((resolve) => {
      const delays = [40, 60, 80, 100, 120, 160, 200, 260, 340, 420]
      let index = 0
      const tick = () => {
        const value = Math.floor(Math.random() * 20) + 1
        setRollingValue(value)
        if (index >= delays.length - 1) {
          resolve(value)
          return
        }
        index += 1
        setTimeout(tick, delays[index])
      }
      setTimeout(tick, delays[0])
    })
  }

  function closeSkillModal() {
    setSelectedSkill(null)
    setSkillResult(null)
    setRollPhase('input')
  }

  // ─── Granted skill handlers ───
  function handleUseGranted(gs: any) {
    setGrantedError(null)
    setGrantedCopied(false)
    setGrantedResult(null)
    setGrantedRollPhase('input')
    setGrantedSuccessRate('')
    setGrantedRollNote('')
    setGrantedRollingValue(1)
    setSelectedGranted(gs)
  }

  function closeGrantedModal() {
    setSelectedGranted(null)
    setGrantedResult(null)
    setGrantedRollPhase('input')
  }

  async function runGrantedRollAnimation() {
    return new Promise<number>((resolve) => {
      const delays = [40, 60, 80, 100, 120, 160, 200, 260, 340, 420]
      let index = 0
      const tick = () => {
        const value = Math.floor(Math.random() * 20) + 1
        setGrantedRollingValue(value)
        if (index >= delays.length - 1) { resolve(value); return }
        index += 1
        setTimeout(tick, delays[index])
      }
      setTimeout(tick, delays[0])
    })
  }

  async function handleGrantedConfirmRoll() {
    if (!selectedGranted) return
    const rate = parseInt(grantedSuccessRate, 10)
    if (!rate || rate < 1 || rate > 20) {
      setGrantedError('กรุณาระบุอัตราสำเร็จระหว่าง 1-20')
      return
    }
    setGrantedError(null)
    setGrantedRollPhase('rolling')
    const spiritCost = selectedGranted.skills?.spirit_cost ?? 0
    setOptimisticSpirit(displaySpirit - spiritCost)
    const rollValue = await runGrantedRollAnimation()
    startTransition(async () => {
      const result = await castGrantedSkill(selectedGranted.id, rate, rollValue, grantedRollNote)
      if (result.error) {
        setOptimisticSpirit(null)
        setGrantedError(result.error)
        setGrantedRollPhase('input')
        return
      }
      if (result.success) {
        setOptimisticSpirit(result.remaining ?? null)
        setGrantedResult(result)
        setGrantedRollPhase('result')
        onRefresh()
      }
    })
  }

  function handleGrantedCopyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setGrantedCopied(true)
      setTimeout(() => setGrantedCopied(false), 2000)
    })
  }

  function getGrantedCooldownStatus(gs: any): { canUse: boolean; remainingMin: number } {
    if (gs.reuse_policy === 'once' && gs.times_used > 0) return { canUse: false, remainingMin: 0 }
    if (gs.reuse_policy === 'cooldown' && gs.last_used_at && gs.cooldown_minutes) {
      const cooldownEnd = new Date(gs.last_used_at)
      cooldownEnd.setMinutes(cooldownEnd.getMinutes() + gs.cooldown_minutes)
      if (new Date() < cooldownEnd) {
        return { canUse: false, remainingMin: Math.ceil((cooldownEnd.getTime() - Date.now()) / 60000) }
      }
    }
    if (gs.expires_at && new Date(gs.expires_at) < new Date()) return { canUse: false, remainingMin: 0 }
    if (!gs.is_active) return { canUse: false, remainingMin: 0 }
    return { canUse: true, remainingMin: 0 }
  }

  // Filter active granted skills
  const activeGrantedSkills = grantedSkills.filter(gs => gs.is_active && (!gs.expires_at || new Date(gs.expires_at) > new Date()))

  function getSkillMeta(skill: Skill) {
    const pathway = pathways.find(p => p.id === skill.pathway_id)
    const sequence = sequences.find(s => s.id === skill.sequence_id)
    return {
      pathwayName: pathway?.name || 'ไม่ทราบเส้นทาง',
      sequenceName: sequence ? `#${sequence.seq_number} ${sequence.name}` : 'ไม่ทราบลำดับ'
    }
  }

  async function handleConfirmRoll() {
    if (!selectedSkill) return
    const rate = parseInt(successRate, 10)
    if (!rate || rate < 1 || rate > 20) {
      setSkillError('กรุณาระบุอัตราสำเร็จระหว่าง 1-20')
      return
    }
    setSkillError(null)
    setRollPhase('rolling')
    setOptimisticSpirit(displaySpirit - selectedSkill.spirit_cost)
    const rollValue = await runRollAnimation()
    const { pathwayName, sequenceName } = getSkillMeta(selectedSkill)
    startTransition(async () => {
      const result = await castSkill(selectedSkill.id, rate, rollValue, rollNote)
      if (result.error) {
        setOptimisticSpirit(null)
        setSkillError(result.error)
        setRollPhase('input')
        return
      }
      if (result.success) {
        setOptimisticSpirit(result.remaining!)
        setSkillResult({
          name: result.skillName!,
          description: result.skillDescription ?? null,
          remaining: result.remaining!,
          referenceCode: result.referenceCode!,
          successRate: result.successRate!,
          roll: result.roll!,
          outcome: result.outcome!,
          pathwayName,
          sequenceName,
          note: result.note ?? (rollNote.trim() ? rollNote.trim() : null)
        })
        setRollPhase('result')
      }
    })
  }

  // Get player's accessible pathways
  const accessiblePathways = pathways.filter(p =>
    playerPathways.some(pp => pp.pathway_id === p.id && pp.sequence_id)
  )

  if (accessiblePathways.length === 0) {
    return (
      <OrnamentedCard className="p-10 text-center">
        <BookOpen className="w-16 h-16 text-gold-400/40 mx-auto mb-4" />
        <p className="text-victorian-400 text-2xl heading-victorian">ยังไม่มีเส้นทางสกิลที่เข้าถึงได้</p>
        <p className="text-victorian-500 text-lg mt-2">รอผู้ดูแลกำหนดเส้นทางให้กับคุณ</p>
      </OrnamentedCard>
    )
  }

  return (
    <div className="space-y-6">
      {/* Spirituality Bar */}
      <OrnamentedCard className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gold-300 text-xl font-semibold flex items-center gap-2">
            <Sparkles className="w-6 h-6" /> พลังวิญญาณ
          </span>
          <span className="text-3xl font-bold text-gold-200">
            {displaySpirit} <span className="text-lg text-victorian-400">/ {profile?.max_spirituality ?? 0}</span>
          </span>
        </div>
        <div className="w-full h-4 bg-victorian-900 rounded-full overflow-hidden border border-gold-400/20">
          <div
            className="h-full bg-gradient-to-r from-blue-600 via-purple-500 to-gold-400 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, (displaySpirit / Math.max(1, profile?.max_spirituality ?? 1)) * 100)}%` }}
          />
        </div>
      </OrnamentedCard>

      {/* Error message */}
      {skillError && (
        <div className="p-4 bg-red-900/40 border-2 border-red-500/40 rounded-xl text-red-300 text-lg text-center font-semibold animate-pulse">
          ⚠️ {skillError}
        </div>
      )}

      {/* ═══ Success Modal with Reference Code ═══ */}
      {selectedSkill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={closeSkillModal}
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
        >
          <div
            className="w-full max-w-2xl rounded-xl border-2 border-gold-400/30 p-6 md:p-8 space-y-5 animate-in fade-in zoom-in duration-300"
            style={{ backgroundColor: '#1A1612' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={closeSkillModal}
                className="text-victorian-400 hover:text-gold-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {rollPhase === 'input' && (
              <div className="space-y-5">
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-2 text-gold-300 text-lg font-semibold">
                    <Sparkles className="w-5 h-5" /> ใช้สกิล
                  </div>
                  <h3 className="heading-victorian text-3xl">{selectedSkill.name}</h3>
                  {selectedSkill.description && (
                    <p className="text-victorian-300 text-sm">{selectedSkill.description}</p>
                  )}
                </div>
                <div className="rounded-xl border border-gold-400/20 bg-victorian-900/60 p-4 text-victorian-200 text-sm space-y-1">
                  <p className="text-gold-300 font-semibold">คำแนะนำสำคัญ</p>
                  <p>โปรดระบุอัตราสำเร็จตามที่ได้รับแจ้งจากทีมงาน หรือระบุ 1 หากทีมงานไม่มีเงื่อนไขพิเศาอะไร แล้วกดยืนยันเพื่อสุ่มผลลัพธ์</p>
                  <p>ระบบจะตัดแต้มทุกครั้ง ไม่ว่าจะสำเร็จหรือไม่</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-victorian-300 mb-1.5">อัตราสำเร็จ (1-20) <span className="text-nouveau-ruby">*</span></label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={successRate}
                      onChange={(e) => setSuccessRate(e.target.value)}
                      className="input-victorian w-full !py-2 !text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-victorian-300 mb-1.5">หมายเหตุ (ถ้ามี)</label>
                    <input
                      type="text"
                      value={rollNote}
                      onChange={(e) => setRollNote(e.target.value)}
                      className="input-victorian w-full !py-2 !text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-victorian-400 text-sm">
                  <span>ค่าใช้สกิล: <span className="text-gold-300 font-semibold">{selectedSkill.spirit_cost}</span> Spirit</span>
                  <span>พลังวิญญาณคงเหลือหลังใช้โดยประมาณ: <span className="text-gold-300 font-semibold">{displaySpirit - selectedSkill.spirit_cost}</span></span>
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={closeSkillModal} className="btn-victorian px-5 py-2 text-sm">ยกเลิก</button>
                  <button type="button" onClick={handleConfirmRoll} disabled={isPending} className="btn-gold px-6 py-2 text-sm">
                    {isPending ? 'กำลังดำเนินการ...' : 'ยืนยันการใช้สกิล'}
                  </button>
                </div>
              </div>
            )}

            {rollPhase === 'rolling' && (
              <div className="space-y-5 text-center">
                <div className="text-gold-300 text-lg font-semibold">กำลังสุ่มผลลัพธ์</div>
                <div className="text-6xl md:text-7xl font-mono text-gold-200 animate-pulse">
                  {rollingValue}
                </div>
                <div className="text-victorian-400 text-sm">ระบบกำลังประมวลผล…</div>
              </div>
            )}

            {rollPhase === 'result' && skillResult && (() => {
              const isSuccess = skillResult.outcome === 'success'
              const embedUrl = origin ? `${origin}/embed/skills/${skillResult.referenceCode}` : ''
              return (
                <div className="space-y-5">
                  <div className="flex justify-center">
                    <div className={`w-20 h-20 rounded-full border-2 flex items-center justify-center ${isSuccess ? 'bg-green-500/10 border-green-400/30' : 'bg-red-500/10 border-red-400/30'}`}>
                      <Sparkles className={`w-10 h-10 ${isSuccess ? 'text-green-400' : 'text-red-400'}`} />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className={`text-sm ${isSuccess ? 'text-green-300' : 'text-red-300'}`}>{isSuccess ? 'ใช้สกิลสำเร็จ' : 'ใช้สกิลไม่สำเร็จ'}</p>
                    <h3 className="heading-victorian text-3xl mt-1">{skillResult.name}</h3>
                    {skillResult.description && (
                      <p className="text-victorian-300 text-base mt-2">{skillResult.description}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-victorian-200">
                    <div className="rounded-lg border border-gold-400/20 bg-victorian-900/70 p-3 text-center">
                      ผลสุ่ม: <span className="text-gold-300 font-bold">{skillResult.roll}</span>
                    </div>
                    <div className="rounded-lg border border-gold-400/20 bg-victorian-900/70 p-3 text-center">
                      อัตราสำเร็จ: <span className="text-gold-300 font-bold">{skillResult.successRate}</span>
                    </div>
                  </div>
                  {skillResult.note && (
                    <div className="rounded-lg border border-gold-400/10 bg-victorian-900/60 p-3 text-victorian-300 text-sm">
                      หมายเหตุ: {skillResult.note}
                    </div>
                  )}
                  <div className="bg-victorian-900/80 border border-gold-400/20 rounded-lg p-4 space-y-2">
                    <p className="text-victorian-400 text-xs uppercase tracking-wider text-center">โค้ด Iframe</p>
                    <div className="flex items-center justify-center gap-3">
                      <code className="text-gold-300 text-xs md:text-sm font-mono tracking-wider select-all break-all text-center">
                        {embedUrl ? `<iframe src="${embedUrl}" width="560" height="60" style="border:0"></iframe>` : skillResult.referenceCode}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(embedUrl ? `<iframe src="${embedUrl}" width="560" height="60" style="border:0"></iframe>` : skillResult.referenceCode)}
                        className="p-2 rounded-lg border border-gold-400/20 text-gold-400 hover:bg-gold-400/10 transition-colors cursor-pointer"
                        title="คัดลอก"
                      >
                        {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                    <p className="text-victorian-500 text-xs text-center mt-2">
                      คัดลอกโค้ดนี้ไปวางในโพสต์โรลเพลย์เพื่อแสดงกล่อง Embed
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href={embedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-victorian w-full py-3 text-base flex items-center justify-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      เปิด Embed
                    </a>
                    <button
                      type="button"
                      onClick={closeSkillModal}
                      className="btn-gold w-full py-3 text-base"
                    >
                      ปิด
                    </button>
                  </div>
                  <div className="text-center text-victorian-400 text-sm">
                    พลังวิญญาณคงเหลือ: <span className="text-gold-300 font-bold text-lg">{skillResult.remaining}</span>
                  </div>
                  <div className="text-center text-xs text-victorian-500">
                    {skillResult.pathwayName} • {skillResult.sequenceName}
                  </div>
                </div>
              )
            })()}

          </div>
        </div>
      )}

      {/* Pathway Cards — two-column layout */}
      {accessiblePathways.map(pathway => {
        const type = skillTypes.find(t => t.id === pathway.type_id)
        const pp = playerPathways.find(pp => pp.pathway_id === pathway.id)
        const playerSeq = pp?.sequence_id ? sequences.find(s => s.id === pp.sequence_id) : null
        const pathwaySkills = skills.filter(s => s.pathway_id === pathway.id)
        const pathSeqs = sequences.filter(s => s.pathway_id === pathway.id).sort((a, b) => b.seq_number - a.seq_number)

        return (
          <div key={pathway.id} className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-0 rounded-2xl overflow-hidden border-2 border-gold-400/20 bg-victorian-900/60">
            {/* LEFT: Pathway Card with BG + Logo */}
            <div className="relative min-h-[320px] lg:min-h-[400px] flex flex-col justify-end p-6 overflow-hidden">
              {/* Background image */}
              {pathway.bg_url ? (
                <div className="absolute inset-0">
                  <img src={pathway.bg_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30" />
                </div>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-t from-victorian-950 via-victorian-900 to-victorian-800" />
              )}

              {/* Logo overlay */}
              {pathway.logo_url && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <img
                    src={pathway.logo_url}
                    alt={pathway.name}
                    className="w-32 h-32 lg:w-40 lg:h-40 object-contain drop-shadow-[0_0_30px_rgba(212,175,55,0.3)]"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              )}

              {/* Info */}
              <div className="relative z-20">
                {type && (
                  <span className="inline-block text-xs px-3 py-1 rounded-full bg-gold-400/20 text-gold-300 mb-2">
                    {type.name}
                  </span>
                )}
                <h3 className="heading-victorian text-3xl lg:text-4xl text-gold-200 drop-shadow-lg">{pathway.name}</h3>
                {pathway.description && (
                  <p className="text-victorian-300 text-base mt-2 line-clamp-3 drop-shadow">{pathway.description}</p>
                )}
                {playerSeq && (
                  <div className={`mt-3 inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full font-bold ${
                    playerSeq.seq_number <= 2 ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                    playerSeq.seq_number <= 5 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    'bg-gold-400/20 text-gold-300 border border-gold-400/30'
                  }`}>
                    <Shield className="w-4 h-4" />
                    ลำดับ {playerSeq.seq_number} — {playerSeq.name}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Skills List */}
            <div className="p-5 lg:p-6 space-y-4 bg-victorian-950/80 overflow-y-auto max-h-[600px]">
              <h4 className="text-gold-300 text-xl font-semibold flex items-center gap-2 border-b border-gold-400/10 pb-3">
                <Sparkles className="w-5 h-5" /> สกิลที่ใช้ได้
              </h4>

              {pathSeqs.map(seq => {
                const seqSkills = pathwaySkills.filter(s => s.sequence_id === seq.id)
                if (seqSkills.length === 0) return null
                
                // Check if player has reached this sequence
                const playerSeqNum = playerSeq?.seq_number ?? 0
                const isSequenceAccessible = seq.seq_number >= playerSeqNum

                return (
                  <div key={seq.id}>
                    <div className={`text-sm font-bold mb-2 px-2 py-1 rounded ${
                      seq.seq_number <= 2 ? 'text-red-400 bg-red-400/5' :
                      seq.seq_number <= 5 ? 'text-amber-400 bg-amber-400/5' :
                      'text-gold-400 bg-gold-400/5'
                    } ${
                      !isSequenceAccessible ? 'blur-sm select-none' : ''
                    }`}>
                      ลำดับ {seq.seq_number}: {isSequenceAccessible ? seq.name : '???'}
                    </div>

                    <div className="space-y-2">
                      {seqSkills.map(skill => {
                        const accessible = canAccessSkill(skill)
                        const canAfford = displaySpirit >= skill.spirit_cost

                        return (
                          <div
                            key={skill.id}
                            className={`p-4 rounded-xl border-2 transition-all ${
                              accessible
                                ? 'bg-victorian-800/50 border-gold-400/20 hover:border-gold-400/40'
                                : 'bg-victorian-900/50 border-victorian-700/20 opacity-40'
                            }`}
                          >
                            {/* Mobile-friendly vertical layout */}
                            <div className="flex flex-col space-y-3">
                              {/* Row 1: Skill name + Spirit cost */}
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {accessible ? (
                                    <Sparkles className="w-5 h-5 text-gold-400 flex-shrink-0" />
                                  ) : (
                                    <Lock className="w-5 h-5 text-victorian-600 flex-shrink-0" />
                                  )}
                                  <span className={`text-lg font-semibold truncate ${
                                    accessible ? 'text-gold-200' : 'text-victorian-500 blur-sm select-none'
                                  }`}>
                                    {accessible ? skill.name : '???'}
                                  </span>
                                </div>
                                
                                {/* Spirit cost badge */}
                                <div className={`flex items-center gap-1 text-sm md:text-base px-2 md:px-3 py-1 rounded-full font-bold flex-shrink-0 ${
                                  accessible && canAfford
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    : accessible && !canAfford
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    : 'bg-victorian-800/50 text-victorian-600'
                                } ${!accessible ? 'blur-sm select-none' : ''}`}>
                                  <Zap className="w-3 h-3 md:w-4 md:h-4" />{accessible ? skill.spirit_cost : '?'}
                                </div>
                              </div>

                              {/* Row 2: Description */}
                              {accessible && skill.description && (
                                <p className="text-sm text-victorian-400 leading-relaxed">
                                  {skill.description}
                                </p>
                              )}
                              {!accessible && (
                                <p className="text-sm text-victorian-600 italic">
                                  สกิลถูกปิดผนึก...
                                </p>
                              )}

                              {/* Row 3: Use button (full width on mobile) */}
                              {accessible && (
                                <button
                                  onClick={() => handleUseSkill(skill.id)}
                                  disabled={isPending || !canAfford}
                                  className={`w-full px-5 py-2.5 rounded-xl text-base font-bold transition-all ${
                                    canAfford
                                      ? 'btn-gold hover:scale-105 active:scale-95'
                                      : 'bg-victorian-800 text-victorian-500 border border-victorian-700 cursor-not-allowed'
                                  }`}
                                >
                                  {isPending ? '...' : canAfford ? 'ใช้สกิล' : 'พลังไม่พอ'}
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {pathwaySkills.length === 0 && (
                <p className="text-victorian-500 text-center py-6 text-lg">ยังไม่มีสกิลในเส้นทางนี้</p>
              )}
            </div>
          </div>
        )
      })}

      {/* ═══ อื่น ๆ — Granted Skills Section ═══ */}
      {activeGrantedSkills.length > 0 && (() => {
        const filtered = grantedSearch.trim()
          ? activeGrantedSkills.filter((gs: any) =>
              gs.title?.toLowerCase().includes(grantedSearch.toLowerCase()) ||
              gs.detail?.toLowerCase().includes(grantedSearch.toLowerCase()) ||
              gs.skills?.name?.toLowerCase().includes(grantedSearch.toLowerCase())
            )
          : activeGrantedSkills
        return (
        <OrnamentedCard className="p-5 md:p-6">
          {/* Header + search */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
            <h3 className="heading-victorian text-2xl flex items-center gap-3 flex-1 min-w-0">
              <Gift className="w-6 h-6 text-gold-400 flex-shrink-0" /> อื่น ๆ
              <span className="text-sm text-victorian-400 font-normal truncate">สมบัติ / ของวิเศษ / ม้วนคัมภีร์ / น้ำยา</span>
            </h3>
            <div className="relative flex-shrink-0 w-full sm:w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-victorian-500" />
              <input
                type="text"
                placeholder="ค้นหา..."
                value={grantedSearch}
                onChange={e => setGrantedSearch(e.target.value)}
                className="input-victorian w-full !pl-9 !py-1.5 text-sm"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-victorian-500 text-sm py-6">ไม่พบรายการที่ค้นหา</p>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((gs: any) => {
              const skillInfo = gs.skills || {}
              const { canUse, remainingMin } = getGrantedCooldownStatus(gs)
              const hasEffects = gs.effect_hp || gs.effect_sanity || gs.effect_max_sanity || gs.effect_travel || gs.effect_max_travel || gs.effect_spirituality || gs.effect_max_spirituality || gs.effect_potion_digest

              return (
                <div key={gs.id} className="rounded-xl border-2 border-gold-400/20 bg-victorian-800/50 hover:border-gold-400/40 transition-all overflow-hidden flex flex-col">
                  {/* Image or plain header */}
                  {gs.image_url ? (
                    <div className="relative w-full h-32 flex-shrink-0">
                      <img
                        src={gs.image_url}
                        alt={gs.title}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-victorian-900/95 via-victorian-900/30 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 px-3 pb-2 flex items-end gap-1.5">
                        <Gift className="w-4 h-4 text-gold-400 flex-shrink-0 drop-shadow" />
                        <span className="text-sm font-semibold text-gold-100 drop-shadow leading-tight line-clamp-2">{gs.title}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="px-3 pt-3 pb-2 flex items-start gap-2">
                      <Gift className="w-4 h-4 text-gold-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm font-semibold text-gold-200 leading-tight">{gs.title}</span>
                      {gs.reuse_policy === 'cooldown' && (
                        <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1 flex-shrink-0">
                          <Clock className="w-3 h-3" /> {gs.cooldown_minutes >= 60 ? `${Math.floor(gs.cooldown_minutes / 60)}h` : `${gs.cooldown_minutes}m`}
                        </span>
                      )}
                      {gs.reuse_policy === 'unlimited' && (
                        <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30 flex items-center gap-1 flex-shrink-0">
                          <Infinity className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  )}

                  {/* Body */}
                  <div className="px-3 pb-3 flex flex-col flex-1 gap-2">
                    {/* Detail */}
                    {gs.detail && (
                      <p className="text-xs text-victorian-400 leading-relaxed line-clamp-3">{gs.detail}</p>
                    )}

                    {/* Skill + spirit cost */}
                    <div className="flex items-center justify-between gap-2 py-1.5 border-t border-gold-400/10">
                      <span className="text-xs text-victorian-300 font-medium truncate">{skillInfo.name || '—'}</span>
                      <span className="text-xs text-purple-300 flex items-center gap-1 bg-purple-500/15 px-1.5 py-0.5 rounded-full border border-purple-500/30 flex-shrink-0">
                        <Zap className="w-3 h-3" /> {skillInfo.spirit_cost ?? 0}
                      </span>
                    </div>

                    {/* Effects */}
                    {hasEffects && (
                      <div className="flex flex-wrap gap-1">
                        {gs.effect_hp !== 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${gs.effect_hp > 0 ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>{gs.effect_hp > 0 ? '+' : ''}{gs.effect_hp} HP</span>}
                        {gs.effect_sanity !== 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${gs.effect_sanity > 0 ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>{gs.effect_sanity > 0 ? '+' : ''}{gs.effect_sanity} San</span>}
                        {gs.effect_max_sanity !== 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${gs.effect_max_sanity > 0 ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>{gs.effect_max_sanity > 0 ? '+' : ''}{gs.effect_max_sanity} MaxSan</span>}
                        {gs.effect_travel !== 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${gs.effect_travel > 0 ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>{gs.effect_travel > 0 ? '+' : ''}{gs.effect_travel} Trv</span>}
                        {gs.effect_max_travel !== 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${gs.effect_max_travel > 0 ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>{gs.effect_max_travel > 0 ? '+' : ''}{gs.effect_max_travel} MaxTrv</span>}
                        {gs.effect_spirituality !== 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${gs.effect_spirituality > 0 ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>{gs.effect_spirituality > 0 ? '+' : ''}{gs.effect_spirituality} Spr</span>}
                        {gs.effect_max_spirituality !== 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${gs.effect_max_spirituality > 0 ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>{gs.effect_max_spirituality > 0 ? '+' : ''}{gs.effect_max_spirituality} MaxSpr</span>}
                        {gs.effect_potion_digest !== 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${gs.effect_potion_digest > 0 ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>{gs.effect_potion_digest > 0 ? '+' : ''}{gs.effect_potion_digest} Dig</span>}
                      </div>
                    )}

                    {/* Expiry */}
                    {gs.expires_at && (
                      <div className="text-xs text-victorian-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(gs.expires_at).toLocaleDateString('th-TH')}
                      </div>
                    )}

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Use button */}
                    <button
                      onClick={() => handleUseGranted(gs)}
                      disabled={isPending || !canUse}
                      className={`w-full px-3 py-2 rounded-lg text-sm font-bold transition-all mt-1 ${
                        canUse
                          ? 'btn-gold hover:scale-105 active:scale-95'
                          : 'bg-victorian-800 text-victorian-500 border border-victorian-700 cursor-not-allowed'
                      }`}
                    >
                      {isPending ? '...' : !canUse
                        ? (gs.reuse_policy === 'once' && gs.times_used > 0 ? 'ใช้แล้ว' : remainingMin > 0 ? `พัก ${remainingMin} นาที` : 'ไม่สามารถใช้ได้')
                        : 'ใช้งาน'}
                    </button>

                    {/* Transfer / Bound */}
                    <div className="pt-1 border-t border-gold-400/10">
                      {gs.is_transferable ? (
                        <button
                          onClick={() => handleOpenTransfer(gs)}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-500/30 bg-green-500/10 text-green-300 hover:bg-green-500/20 text-xs font-medium transition-all"
                        >
                          <Send className="w-3.5 h-3.5" /> ส่งมอบ
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-victorian-600 justify-center py-0.5">
                          <LockKeyhole className="w-3 h-3" />
                          <span>ผูกมัดกับ <span className="text-victorian-400">{profile?.display_name || 'คุณ'}</span></span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          )}
        </OrnamentedCard>
        )
      })()}

      {/* ═══ Granted Skill Usage Modal ═══ */}
      {selectedGranted && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={closeGrantedModal}
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
        >
          <div
            className="w-full max-w-2xl rounded-xl border-2 border-gold-400/30 p-6 md:p-8 space-y-5 animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: '#1A1612' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end">
              <button type="button" onClick={closeGrantedModal} className="text-victorian-400 hover:text-gold-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {grantedRollPhase === 'input' && (() => {
              const skillInfo = selectedGranted.skills || {}
              const spiritCost = skillInfo.spirit_cost ?? 0
              return (
              <div className="space-y-5">
                {/* Grant title & detail */}
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-2 text-gold-300 text-lg font-semibold">
                    <Gift className="w-5 h-5" /> ใช้งาน
                  </div>
                  <h3 className="heading-victorian text-3xl">{selectedGranted.title}</h3>
                  {selectedGranted.detail && <p className="text-victorian-300 text-sm">{selectedGranted.detail}</p>}
                </div>

                {/* Original skill info */}
                <div className="p-4 rounded-xl bg-victorian-800/60 border border-gold-400/15 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-gold-400" />
                      <span className="text-gold-200 font-semibold">{skillInfo.name || '—'}</span>
                    </div>
                    <span className="text-xs text-purple-300 flex items-center gap-1 bg-purple-500/15 px-2 py-0.5 rounded-full border border-purple-500/30">
                      <Zap className="w-3 h-3" /> {spiritCost} พลังวิญญาณ
                    </span>
                  </div>
                  {skillInfo.description && (
                    <p className="text-sm text-victorian-300 leading-relaxed">{skillInfo.description}</p>
                  )}
                </div>

                {/* Spirit cost warning */}
                {spiritCost > 0 && (
                  <div className="rounded-xl border border-purple-400/20 bg-purple-900/20 p-3 text-sm flex items-center justify-between">
                    <span className="text-purple-300">พลังวิญญาณที่ต้องใช้: <strong>{spiritCost}</strong></span>
                    <span className="text-victorian-400">คงเหลือ: <strong className="text-purple-200">{displaySpirit}</strong></span>
                  </div>
                )}

                {/* Show effects warning */}
                {(selectedGranted.effect_hp || selectedGranted.effect_sanity || selectedGranted.effect_max_sanity || selectedGranted.effect_travel || selectedGranted.effect_max_travel || selectedGranted.effect_spirituality || selectedGranted.effect_max_spirituality || selectedGranted.effect_potion_digest) && (
                  <div className="rounded-xl border border-amber-400/20 bg-amber-900/20 p-4 text-sm space-y-2">
                    <p className="text-amber-300 font-semibold">ผลกระทบเพิ่มเติมเมื่อใช้งาน</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedGranted.effect_hp !== 0 && <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${selectedGranted.effect_hp > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{selectedGranted.effect_hp > 0 ? '+' : ''}{selectedGranted.effect_hp} HP</span>}
                      {selectedGranted.effect_sanity !== 0 && <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${selectedGranted.effect_sanity > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{selectedGranted.effect_sanity > 0 ? '+' : ''}{selectedGranted.effect_sanity} Sanity</span>}
                      {selectedGranted.effect_max_sanity !== 0 && <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${selectedGranted.effect_max_sanity > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{selectedGranted.effect_max_sanity > 0 ? '+' : ''}{selectedGranted.effect_max_sanity} Max Sanity</span>}
                      {selectedGranted.effect_travel !== 0 && <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${selectedGranted.effect_travel > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{selectedGranted.effect_travel > 0 ? '+' : ''}{selectedGranted.effect_travel} Travel</span>}
                      {selectedGranted.effect_max_travel !== 0 && <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${selectedGranted.effect_max_travel > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{selectedGranted.effect_max_travel > 0 ? '+' : ''}{selectedGranted.effect_max_travel} Max Travel</span>}
                      {selectedGranted.effect_spirituality !== 0 && <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${selectedGranted.effect_spirituality > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{selectedGranted.effect_spirituality > 0 ? '+' : ''}{selectedGranted.effect_spirituality} Spirit</span>}
                      {selectedGranted.effect_max_spirituality !== 0 && <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${selectedGranted.effect_max_spirituality > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{selectedGranted.effect_max_spirituality > 0 ? '+' : ''}{selectedGranted.effect_max_spirituality} Max Spirit</span>}
                      {selectedGranted.effect_potion_digest !== 0 && <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${selectedGranted.effect_potion_digest > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{selectedGranted.effect_potion_digest > 0 ? '+' : ''}{selectedGranted.effect_potion_digest} Digest</span>}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-gold-400/20 bg-victorian-900/60 p-4 text-victorian-200 text-sm space-y-1">
                  <p className="text-gold-300 font-semibold">คำแนะนำ</p>
                  <p>โปรดระบุอัตราสำเร็จตามที่ได้รับแจ้งจากทีมงาน แล้วกดยืนยันเพื่อสุ่มผลลัพธ์ หรือระบุ 1 หากทีมงานไม่มีเงื่อนไขพิเศษอะไร</p>
                  <p>พลังวิญญาณจะถูกหักตามค่าสกิลต้นฉบับ และผลกระทบเพิ่มเติมจะถูกนำไปใช้ทันที</p>
                </div>

                {grantedError && (
                  <div className="p-3 bg-red-900/40 border border-red-500/40 rounded-lg text-red-300 text-sm">{grantedError}</div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-victorian-300 mb-1.5">อัตราสำเร็จ (1-20) <span className="text-nouveau-ruby">*</span></label>
                    <input type="number" min={1} max={20} value={grantedSuccessRate} onChange={e => setGrantedSuccessRate(e.target.value)} className="input-victorian w-full !py-2 !text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-victorian-300 mb-1.5">หมายเหตุ (ถ้ามี)</label>
                    <input type="text" value={grantedRollNote} onChange={e => setGrantedRollNote(e.target.value)} className="input-victorian w-full !py-2 !text-sm" />
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button type="button" onClick={closeGrantedModal} className="btn-victorian px-5 py-2 text-sm">ยกเลิก</button>
                  <button type="button" onClick={handleGrantedConfirmRoll} disabled={isPending} className="btn-gold px-6 py-2 text-sm">
                    {isPending ? 'กำลังดำเนินการ...' : 'ยืนยันการใช้สกิล'}
                  </button>
                </div>
              </div>
              )
            })()}

            {grantedRollPhase === 'rolling' && (
              <div className="space-y-5 text-center">
                <div className="text-gold-300 text-lg font-semibold">กำลังสุ่มผลลัพธ์</div>
                <div className="text-6xl md:text-7xl font-mono text-gold-200 animate-pulse">{grantedRollingValue}</div>
                <div className="text-victorian-400 text-sm">ระบบกำลังประมวลผล…</div>
              </div>
            )}

            {grantedRollPhase === 'result' && grantedResult && (() => {
              const isSuccess = grantedResult.outcome === 'success'
              const embedUrl = origin ? `${origin}/embed/skills/${grantedResult.referenceCode}` : ''
              return (
                <div className="space-y-5">
                  <div className="flex justify-center">
                    <div className={`w-20 h-20 rounded-full border-2 flex items-center justify-center ${isSuccess ? 'bg-green-500/10 border-green-400/30' : 'bg-red-500/10 border-red-400/30'}`}>
                      <Gift className={`w-10 h-10 ${isSuccess ? 'text-green-400' : 'text-red-400'}`} />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className={`text-sm ${isSuccess ? 'text-green-300' : 'text-red-300'}`}>{isSuccess ? 'ใช้สกิลสำเร็จ' : 'ใช้สกิลไม่สำเร็จ'}</p>
                    <h3 className="heading-victorian text-3xl mt-1">{grantedResult.grantTitle}</h3>
                    <p className="text-victorian-400 text-sm">สกิล: {grantedResult.skillName}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm text-victorian-200">
                    <div className="rounded-lg border border-gold-400/20 bg-victorian-900/70 p-3 text-center">
                      ผลสุ่ม: <span className="text-gold-300 font-bold">{grantedResult.roll}</span>
                    </div>
                    <div className="rounded-lg border border-gold-400/20 bg-victorian-900/70 p-3 text-center">
                      อัตราสำเร็จ: <span className="text-gold-300 font-bold">{grantedResult.successRate}</span>
                    </div>
                    <div className="rounded-lg border border-purple-400/20 bg-purple-900/20 p-3 text-center">
                      หัก: <span className="text-purple-300 font-bold">{grantedResult.spiritCost ?? 0}</span>
                    </div>
                    <div className="rounded-lg border border-purple-400/20 bg-purple-900/20 p-3 text-center">
                      คงเหลือ: <span className="text-purple-300 font-bold">{grantedResult.remaining ?? '—'}</span>
                    </div>
                  </div>

                  {/* Effects applied */}
                  {grantedResult.effects && (
                    <div className="rounded-lg border border-gold-400/10 bg-victorian-900/60 p-3 space-y-1">
                      <p className="text-xs text-victorian-400 uppercase tracking-wider">ผลกระทบที่ได้รับ</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(grantedResult.effects).map(([key, val]) => {
                          if (val === 0) return null
                          const labels: Record<string, string> = { effect_hp: 'HP', effect_sanity: 'Sanity', effect_max_sanity: 'Max Sanity', effect_travel: 'Travel', effect_max_travel: 'Max Travel', effect_spirituality: 'Spirit', effect_max_spirituality: 'Max Spirit', effect_potion_digest: 'Digest' }
                          return <span key={key} className={`text-xs px-2 py-0.5 rounded-full font-bold ${(val as number) > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{(val as number) > 0 ? '+' : ''}{val as number} {labels[key] || key}</span>
                        })}
                      </div>
                    </div>
                  )}

                  {grantedResult.note && (
                    <div className="rounded-lg border border-gold-400/10 bg-victorian-900/60 p-3 text-victorian-300 text-sm">
                      หมายเหตุ: {grantedResult.note}
                    </div>
                  )}

                  <div className="bg-victorian-900/80 border border-gold-400/20 rounded-lg p-4 space-y-2">
                    <p className="text-victorian-400 text-xs uppercase tracking-wider text-center">โค้ด Iframe</p>
                    <div className="flex items-center justify-center gap-3">
                      <code className="text-gold-300 text-xs md:text-sm font-mono tracking-wider select-all break-all text-center">
                        {embedUrl ? `<iframe src="${embedUrl}" width="560" height="60" style="border:0"></iframe>` : grantedResult.referenceCode}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleGrantedCopyCode(embedUrl ? `<iframe src="${embedUrl}" width="560" height="60" style="border:0"></iframe>` : grantedResult.referenceCode)}
                        className="p-2 rounded-lg border border-gold-400/20 text-gold-400 hover:bg-gold-400/10 transition-colors cursor-pointer"
                      >
                        {grantedCopied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <button type="button" onClick={closeGrantedModal} className="btn-gold w-full py-3 text-base">ปิด</button>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ═══ Transfer Modal ═══ */}
      {transferringGrant && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setTransferringGrant(null)}
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
        >
          <div
            className="w-full max-w-md rounded-xl border-2 border-green-500/30 p-6 space-y-4 max-h-[80vh] flex flex-col"
            style={{ backgroundColor: '#1A1612' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-green-300 flex items-center gap-2">
                <Send className="w-5 h-5" /> ส่งมอบ
              </h3>
              <button onClick={() => setTransferringGrant(null)} className="text-victorian-400 hover:text-gold-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Item being transferred */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-victorian-900/50 border border-gold-400/10">
              {transferringGrant.image_url ? (
                <img src={transferringGrant.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-gold-400/20 flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-victorian-800 border border-gold-400/10 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-5 h-5 text-victorian-600" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gold-200 truncate">{transferringGrant.title}</p>
                <p className="text-xs text-victorian-500 truncate">{transferringGrant.skills?.name || '—'}</p>
              </div>
            </div>

            {transferMsg && (
              <div className={`p-3 rounded-lg text-sm ${transferMsg.includes('สำเร็จ') ? 'bg-green-900/30 border border-green-500/30 text-green-300' : 'bg-red-900/30 border border-red-500/30 text-red-300'}`}>
                {transferMsg}
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-victorian-500" />
              <input
                type="text"
                placeholder="ค้นหาผู้เล่น..."
                value={transferSearch}
                onChange={e => setTransferSearch(e.target.value)}
                className="input-victorian w-full !pl-9"
              />
            </div>

            {/* Confirm panel — shown after selecting a player */}
            {transferConfirmTarget ? (
              <div className="rounded-xl border-2 border-amber-500/40 bg-amber-900/20 p-4 space-y-4">
                <p className="text-sm text-amber-200 font-semibold text-center">ยืนยันการส่งมอบ</p>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-victorian-900/60 border border-gold-400/10">
                  {transferConfirmTarget.avatar_url ? (
                    <img src={transferConfirmTarget.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-victorian-800 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-victorian-500" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gold-200 truncate">{transferConfirmTarget.display_name || 'ไม่ระบุชื่อ'}</p>
                    <p className="text-xs text-victorian-500">ผู้รับโอน</p>
                  </div>
                </div>
                <p className="text-xs text-amber-300/80 text-center leading-relaxed">เมื่อส่งมอบแล้ว <span className="font-semibold text-amber-200">{transferringGrant?.title}</span> จะหายไปจากคลังแอบของคุณทันที</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTransferConfirmTarget(null)}
                    disabled={isPendingTransfer}
                    className="flex-1 py-2 rounded-lg border border-victorian-700 text-victorian-400 hover:border-victorian-500 text-sm transition-all disabled:opacity-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => handleConfirmTransfer(transferConfirmTarget.id)}
                    disabled={isPendingTransfer}
                    className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isPendingTransfer ? (
                      <span className="animate-pulse">กำลังส่ง...</span>
                    ) : (
                      <><Send className="w-4 h-4" /> ยืนยันส่งมอบ</>
                    )}
                  </button>
                </div>
              </div>
            ) : (
            <>
            {/* Player list */}
            <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
              {transferLoading ? (
                <div className="space-y-2 py-4">{[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded bg-victorian-900/50 animate-pulse" />)}</div>
              ) : (() => {
                const filtered = transferSearch.trim()
                  ? transferPlayers.filter(p => p.display_name?.toLowerCase().includes(transferSearch.toLowerCase()))
                  : transferPlayers
                return filtered.length === 0 ? (
                  <p className="text-center text-victorian-500 text-sm py-4">ไม่พบผู้เล่น</p>
                ) : (
                  filtered.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setTransferConfirmTarget(p)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-victorian-800 hover:border-green-500/30 hover:bg-green-500/5 text-left transition-all"
                    >
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-victorian-800 flex items-center justify-center flex-shrink-0">
                          <Users className="w-4 h-4 text-victorian-500" />
                        </div>
                      )}
                      <span className="text-sm text-victorian-200 truncate">{p.display_name || 'ไม่ระบุชื่อ'}</span>
                      <ChevronRight className="w-4 h-4 text-victorian-600 ml-auto flex-shrink-0" />
                    </button>
                  ))
                )
              })()}
            </div>
            </>)}
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════ */
export default function SkillsContent({ userId }: SkillsContentProps) {
  const [profile, setProfile] = useState<Profile | null>(getCached<Profile>('skills:profile'))
  const [skillTypes, setSkillTypes] = useState<SkillType[]>(getCached<SkillType[]>('skills:types') ?? [])
  const [pathways, setPathways] = useState<SkillPathway[]>(getCached<SkillPathway[]>('skills:pathways') ?? [])
  const [sequences, setSequences] = useState<SkillSequence[]>(getCached<SkillSequence[]>('skills:sequences') ?? [])
  const [skills, setSkills] = useState<Skill[]>(getCached<Skill[]>('skills:skills') ?? [])
  const [playerPathways, setPlayerPathways] = useState<PlayerPathway[]>(getCached<PlayerPathway[]>(`skills:pp:${userId}`) ?? [])
  const [grantedSkills, setGrantedSkills] = useState<any[]>(getCached<any[]>(`skills:granted:${userId}`) ?? [])
  const [loaded, setLoaded] = useState(!!getCached('skills:profile'))

  const fetchData = useCallback(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('skill_types').select('*').order('name'),
      supabase.from('skill_pathways').select('*').order('name'),
      supabase.from('skill_sequences').select('*').order('seq_number', { ascending: false }),
      supabase.from('skills').select('*').order('name'),
      supabase.from('player_pathways').select('*').eq('player_id', userId),
      getGrantedSkillsForPlayer(),
    ]).then(([pRes, tRes, pwRes, sqRes, skRes, ppRes, gsRes]) => {
      if (pRes.data) { setProfile(pRes.data); setCache('skills:profile', pRes.data) }
      if (tRes.data) { setSkillTypes(tRes.data); setCache('skills:types', tRes.data, REF_TTL) }
      if (pwRes.data) { setPathways(pwRes.data); setCache('skills:pathways', pwRes.data, REF_TTL) }
      if (sqRes.data) { setSequences(sqRes.data); setCache('skills:sequences', sqRes.data, REF_TTL) }
      if (skRes.data) { setSkills(skRes.data); setCache('skills:skills', skRes.data, REF_TTL) }
      if (ppRes.data) { setPlayerPathways(ppRes.data); setCache(`skills:pp:${userId}`, ppRes.data) }
      if (gsRes && !gsRes.error) { setGrantedSkills(gsRes.skills); setCache(`skills:granted:${userId}`, gsRes.skills) }
      setLoaded(true)
    })
  }, [userId])

  useEffect(() => {
    fetchData()

    // ─── Realtime Subscription ───
    const supabase = createClient()
    const channel = supabase
      .channel('skills_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'skill_types' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'skill_pathways' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'skill_sequences' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'skills' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_pathways' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'granted_skills' }, () => fetchData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, fetchData])

  const isAdmin = profile?.role === 'admin' || profile?.role === 'dm'
  const [showAdmin, setShowAdmin] = useState(false)
  
  // ตรวจสอบว่าสติเหลือ 0 หรือไม่
  const isSanityLocked = (profile?.sanity ?? 10) === 0

  if (!loaded) return (
    <div className="min-h-screen" style={{ backgroundColor: '#0F0D0A' }}>
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-9 h-9 rounded border border-[#D4AF37]/10 bg-[#2A2520] animate-pulse" />
          <div className="space-y-2">
            <div className="h-10 w-24 rounded bg-[#2A2520] animate-pulse" />
            <div className="h-3 w-48 rounded bg-[#2A2520] animate-pulse" />
          </div>
        </div>
        <div className="h-px bg-[#D4AF37]/10 mb-8" />
        <div className="border border-[#D4AF37]/10 rounded-sm p-5 mb-6" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
          <div className="flex items-center justify-between">
            <div className="h-5 w-32 rounded bg-[#2A2520] animate-pulse" />
            <div className="h-8 w-16 rounded bg-[#2A2520] animate-pulse" />
          </div>
        </div>
        <div className="space-y-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="border border-[#D4AF37]/10 rounded-sm overflow-hidden" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
              <div className="h-48 bg-[#2A2520] animate-pulse" />
              <div className="p-5 space-y-3">
                <div className="h-5 w-32 rounded bg-[#2A2520] animate-pulse" />
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="p-4 rounded border border-[#D4AF37]/5" style={{ backgroundColor: 'rgba(26,22,18,0.5)' }}>
                    <div className="h-5 w-36 rounded bg-[#2A2520] animate-pulse mb-2" />
                    <div className="h-3 w-full rounded bg-[#2A2520] animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-victorian-950 text-victorian-100">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 opacity-5" style={{
        backgroundImage: `radial-gradient(circle at 25% 25%, #D4AF37 1px, transparent 1px),
                          radial-gradient(circle at 75% 75%, #D4AF37 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      <div className="relative z-10 max-w-5xl mx-auto p-6 md:p-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a
              href="/dashboard"
              className="p-2 rounded-lg border border-gold-400/10 text-gold-400 hover:bg-victorian-800/50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </a>
            <div>
              <h1 className="heading-victorian text-4xl">ระบบสกิล</h1>
              <p className="text-victorian-400 text-sm mt-1">ทักษะและความสามารถพิเศษ</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <a
                href="/dashboard/skills/codex"
                className="btn-victorian px-4 py-2 text-sm flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Codex</span>
              </a>
            )}
            <a
              href="/dashboard/skills/logs"
              className="btn-victorian px-4 py-2 text-sm flex items-center gap-2"
            >
              <ScrollText className="w-4 h-4" />
              <span className="hidden sm:inline">ประวัติ</span>
            </a>
            {isAdmin && (
              <button
                onClick={() => setShowAdmin(!showAdmin)}
                className={`btn-victorian px-4 py-2 text-sm flex items-center gap-2 ${showAdmin ? 'border-gold-400/40 text-gold-300' : ''}`}
              >
                <Shield className="w-4 h-4" />
                {showAdmin ? 'ดูแบบผู้เล่น' : 'จัดการสกิล'}
              </button>
            )}
          </div>
        </div>

        {/* Ornamental divider */}
        <div className="ornament-divider" />

        {/* Admin Panel */}
        {isAdmin && showAdmin && (
          <AdminPanel
            skillTypes={skillTypes}
            pathways={pathways}
            sequences={sequences}
            skills={skills}
            onRefresh={fetchData}
          />
        )}

        {/* Player View (or default admin view) */}
        {(!isAdmin || !showAdmin) && (
          <PlayerSkillView
            profile={profile}
            skillTypes={skillTypes}
            pathways={pathways}
            sequences={sequences}
            skills={skills}
            playerPathways={playerPathways}
            grantedSkills={grantedSkills}
            onRefresh={fetchData}
          />
        )}
      </div>
      
      {/* Sanity Lock Overlay */}
      {isSanityLocked && <SanityLockOverlay />}
    </div>
  )
}
