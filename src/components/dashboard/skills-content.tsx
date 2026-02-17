'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import type { Profile, SkillType, SkillPathway, SkillSequence, Skill, PlayerPathway } from '@/lib/types/database'
import {
  ArrowLeft, ChevronDown, ChevronRight, Plus, Trash2, Sparkles, Zap,
  GitBranch, Layers, Shield, Lock, BookOpen, Pencil, Copy, Check, X, ScrollText
} from 'lucide-react'
import {
  createSkillType, updateSkillType, deleteSkillType,
  createSkillPathway, deleteSkillPathway, updateSkillPathway,
  createSkillSequence, deleteSkillSequence, updateSkillSequence,
  createSkill, updateSkill, deleteSkill,
  castSkill
} from '@/app/actions/skills'
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
  profile, skillTypes, pathways, sequences, skills, playerPathways
}: {
  profile: Profile | null
  skillTypes: SkillType[]
  pathways: SkillPathway[]
  sequences: SkillSequence[]
  skills: Skill[]
  playerPathways: PlayerPathway[]
}) {
  const [isPending, startTransition] = useTransition()
  const [usedSkill, setUsedSkill] = useState<{
    name: string
    description: string | null
    remaining: number
    referenceCode: string
  } | null>(null)
  const [skillError, setSkillError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // Optimistic spirituality for instant UI feedback
  const [optimisticSpirit, setOptimisticSpirit] = useState<number | null>(null)
  const displaySpirit = optimisticSpirit ?? profile?.spirituality ?? 0

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
    setUsedSkill(null)
    setCopied(false)

    // Find skill for optimistic update
    const skill = skills.find(s => s.id === skillId)
    if (skill) {
      setOptimisticSpirit(displaySpirit - skill.spirit_cost)
    }

    startTransition(async () => {
      const result = await castSkill(skillId)
      if (result.error) {
        // Rollback optimistic update
        setOptimisticSpirit(null)
        setSkillError(result.error)
        setTimeout(() => setSkillError(null), 4000)
      } else if (result.success) {
        setOptimisticSpirit(result.remaining!)
        setUsedSkill({
          name: result.skillName!,
          description: result.skillDescription ?? null,
          remaining: result.remaining!,
          referenceCode: result.referenceCode!
        })
      }
    })
  }

  function handleCopyCode() {
    if (!usedSkill) return
    navigator.clipboard.writeText(usedSkill.referenceCode).then(() => {
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
      {usedSkill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setUsedSkill(null)}
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
        >
          <div
            className="w-full max-w-md rounded-xl border-2 border-gold-400/30 p-6 md:p-8 space-y-5 animate-in fade-in zoom-in duration-300"
            style={{ backgroundColor: '#1A1612' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setUsedSkill(null)}
                className="text-victorian-400 hover:text-gold-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-gold-400/10 border-2 border-gold-400/30 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-gold-400" />
              </div>
            </div>

            {/* Skill name */}
            <div className="text-center">
              <p className="text-victorian-400 text-sm">ใช้สกิลสำเร็จ</p>
              <h3 className="heading-victorian text-3xl mt-1">{usedSkill.name}</h3>
              {usedSkill.description && (
                <p className="text-victorian-300 text-base mt-2">{usedSkill.description}</p>
              )}
            </div>

            {/* Reference Code */}
            <div className="bg-victorian-900/80 border border-gold-400/20 rounded-lg p-4 space-y-2">
              <p className="text-victorian-400 text-xs uppercase tracking-wider text-center">รหัสอ้างอิง</p>
              <div className="flex items-center justify-center gap-3">
                <code className="text-gold-300 text-2xl md:text-3xl font-mono tracking-widest select-all">
                  {usedSkill.referenceCode}
                </code>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-2 rounded-lg border border-gold-400/20 text-gold-400 hover:bg-gold-400/10 transition-colors cursor-pointer"
                  title="คัดลอก"
                >
                  {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-victorian-500 text-xs text-center mt-2">
                📋 คัดลอกโค้ดนี้ไปอ้างอิงในการโรเพลย์
              </p>
            </div>

            {/* Remaining spirit */}
            <div className="text-center text-victorian-400 text-sm">
              พลังวิญญาณคงเหลือ: <span className="text-gold-300 font-bold text-lg">{usedSkill.remaining}</span>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={() => setUsedSkill(null)}
              className="w-full btn-victorian py-3 text-base cursor-pointer"
            >
              ปิด
            </button>
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
    ]).then(([pRes, tRes, pwRes, sqRes, skRes, ppRes]) => {
      if (pRes.data) { setProfile(pRes.data); setCache('skills:profile', pRes.data) }
      if (tRes.data) { setSkillTypes(tRes.data); setCache('skills:types', tRes.data, REF_TTL) }
      if (pwRes.data) { setPathways(pwRes.data); setCache('skills:pathways', pwRes.data, REF_TTL) }
      if (sqRes.data) { setSequences(sqRes.data); setCache('skills:sequences', sqRes.data, REF_TTL) }
      if (skRes.data) { setSkills(skRes.data); setCache('skills:skills', skRes.data, REF_TTL) }
      if (ppRes.data) { setPlayerPathways(ppRes.data); setCache(`skills:pp:${userId}`, ppRes.data) }
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
          />
        )}
      </div>
      
      {/* Sanity Lock Overlay */}
      {isSanityLocked && <SanityLockOverlay />}
    </div>
  )
}
