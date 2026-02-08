'use client'

import { useState, useTransition } from 'react'
import { User } from '@supabase/supabase-js'
import type { Profile, SkillType, SkillPathway, SkillSequence, Skill, PlayerPathway } from '@/lib/types/database'
import {
  ArrowLeft, ChevronDown, ChevronRight, Plus, Trash2, Sparkles, Zap,
  GitBranch, Layers, Shield, Lock, BookOpen
} from 'lucide-react'
import {
  createSkillType, deleteSkillType,
  createSkillPathway, deleteSkillPathway,
  createSkillSequence, deleteSkillSequence,
  createSkill, deleteSkill
} from '@/app/actions/skills'

/* ─── Art Nouveau Corner Ornament ─── */
function CornerOrnament({ className }: { className?: string }) {
  return (
    <svg className={className} width="60" height="60" viewBox="0 0 60 60" fill="none">
      <path d="M2 58V20C2 10 10 2 20 2H58" stroke="url(#gold-corner-s)" strokeWidth="1.5" fill="none" />
      <path d="M8 58V26C8 16 16 8 26 8H58" stroke="url(#gold-corner-s)" strokeWidth="0.5" opacity="0.4" fill="none" />
      <circle cx="20" cy="20" r="2" fill="#D4AF37" opacity="0.6"/>
      <defs>
        <linearGradient id="gold-corner-s" x1="2" y1="58" x2="58" y2="2">
          <stop stopColor="#D4AF37" stopOpacity="0.8"/>
          <stop offset="1" stopColor="#C5A55A" stopOpacity="0.2"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

function OrnamentedCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`card-victorian relative overflow-hidden ${className}`}>
      <CornerOrnament className="absolute top-0 left-0" />
      <CornerOrnament className="absolute top-0 right-0 -scale-x-100" />
      <CornerOrnament className="absolute bottom-0 left-0 -scale-y-100" />
      <CornerOrnament className="absolute bottom-0 right-0 scale-x-[-1] scale-y-[-1]" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

/* ─── Props ─── */
interface SkillsContentProps {
  user: User
  profile: Profile | null
  skillTypes: SkillType[]
  pathways: SkillPathway[]
  sequences: SkillSequence[]
  skills: Skill[]
  playerPathways: PlayerPathway[]
}

/* ═══════════════════════════════════════
   ADMIN PANEL: Manage the skill hierarchy
   ═══════════════════════════════════════ */
function AdminPanel({
  skillTypes, pathways, sequences, skills
}: {
  skillTypes: SkillType[]
  pathways: SkillPathway[]
  sequences: SkillSequence[]
  skills: Skill[]
}) {
  const [isPending, startTransition] = useTransition()
  const [openType, setOpenType] = useState<string | null>(null)
  const [openPathway, setOpenPathway] = useState<string | null>(null)
  const [showAddType, setShowAddType] = useState(false)
  const [showAddPathway, setShowAddPathway] = useState<string | null>(null)
  const [showAddSequence, setShowAddSequence] = useState<string | null>(null)
  const [showAddSkill, setShowAddSkill] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleAction(action: () => Promise<{ error?: string; success?: boolean }>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result?.error) setError(result.error)
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
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-victorian-400 text-sm">{typePathways.length} เส้นทาง</span>
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
                    return (
                      <div key={pathway.id} className="ml-4 border-l-2 border-gold-400/10 pl-4">
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
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAction(() => deleteSkillPathway(pathway.id)) }}
                            className="p-1 text-red-400/60 hover:text-red-400 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {isPathOpen && (
                          <div className="ml-4 space-y-3 py-2">
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
                                  <div className="flex gap-2">
                                    <button type="submit" disabled={isPending} className="btn-gold px-3 py-1 text-xs">บันทึก</button>
                                    <button type="button" onClick={() => setShowAddSequence(null)} className="btn-victorian px-3 py-1 text-xs">ยกเลิก</button>
                                  </div>
                                </form>
                              )}

                              {pathSeqs.map(seq => (
                                <div key={seq.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-victorian-800/20 text-sm">
                                  <span className="text-victorian-300">
                                    <span className={`font-mono mr-2 ${seq.seq_number <= 2 ? 'text-red-400' : seq.seq_number <= 5 ? 'text-amber-400' : 'text-gold-400'}`}>
                                      ลำดับ {seq.seq_number}
                                    </span>
                                    {seq.name}
                                    {seq.seq_number === 9 && <span className="text-victorian-500 text-xs ml-2">(เริ่มต้น)</span>}
                                    {seq.seq_number === 0 && <span className="text-red-400 text-xs ml-2">(สูงสุด)</span>}
                                  </span>
                                  <button
                                    onClick={() => handleAction(() => deleteSkillSequence(seq.id))}
                                    className="p-1 text-red-400/40 hover:text-red-400 rounded transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
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
                                  <div key={skill.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-victorian-800/20 text-sm">
                                    <div className="flex items-center gap-2">
                                      <Sparkles className="w-3.5 h-3.5 text-gold-400" />
                                      <span className="text-victorian-200">{skill.name}</span>
                                      {seq && <span className="text-victorian-500 text-xs">(ลำดับ {seq.seq_number})</span>}
                                      <span className="text-blue-400/60 text-xs flex items-center gap-0.5">
                                        <Zap className="w-3 h-3" />{skill.spirit_cost}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => handleAction(() => deleteSkill(skill.id))}
                                      className="p-1 text-red-400/40 hover:text-red-400 rounded transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
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
   PLAYER VIEW: Skills filtered by access
   ═══════════════════════════════════════ */
function PlayerSkillView({
  skillTypes, pathways, sequences, skills, playerPathways
}: {
  skillTypes: SkillType[]
  pathways: SkillPathway[]
  sequences: SkillSequence[]
  skills: Skill[]
  playerPathways: PlayerPathway[]
}) {
  const [expandedType, setExpandedType] = useState<string | null>(null)

  // Determine which skills the player can access
  function canAccessSkill(skill: Skill): boolean {
    // Find player's progression for this skill's pathway
    const pp = playerPathways.find(pp => pp.pathway_id === skill.pathway_id)
    if (!pp || !pp.sequence_id) return false

    // Find the player's current sequence and the skill's required sequence
    const playerSeq = sequences.find(s => s.id === pp.sequence_id)
    const skillSeq = sequences.find(s => s.id === skill.sequence_id)
    if (!playerSeq || !skillSeq) return false

    // Inverted system: 9=weakest, 0=strongest
    // Player at seq 7 can access skills at seq 9, 8, 7 (>= their level)
    return skillSeq.seq_number >= playerSeq.seq_number
  }

  // Check if player has any pathway in a given type
  function hasAccessToType(typeId: string): boolean {
    const typePathwayIds = pathways.filter(p => p.type_id === typeId).map(p => p.id)
    return playerPathways.some(pp => pp.pathway_id && typePathwayIds.includes(pp.pathway_id))
  }

  return (
    <div className="space-y-4">
      {skillTypes.length === 0 && (
        <OrnamentedCard className="p-8 text-center">
          <BookOpen className="w-12 h-12 text-gold-400/40 mx-auto mb-4" />
          <p className="text-victorian-400 text-lg">ยังไม่มีระบบสกิลใดถูกสร้างขึ้น</p>
          <p className="text-victorian-500 text-sm mt-1">รอผู้ดูแลเพิ่มสกิลเข้าสู่ระบบ</p>
        </OrnamentedCard>
      )}

      {skillTypes.map(type => {
        const typePathways = pathways.filter(p => p.type_id === type.id)
        const hasAccess = hasAccessToType(type.id)
        const isExpanded = expandedType === type.id

        return (
          <OrnamentedCard key={type.id} className="p-6">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedType(isExpanded ? null : type.id)}
            >
              <div className="flex items-center gap-3">
                {isExpanded ? <ChevronDown className="w-5 h-5 text-gold-400" /> : <ChevronRight className="w-5 h-5 text-gold-400" />}
                <Layers className="w-6 h-6 text-gold-400" />
                <div>
                  <h3 className="heading-victorian text-xl">{type.name}</h3>
                  {type.description && <p className="text-victorian-400 text-sm">{type.description}</p>}
                </div>
              </div>
              {!hasAccess && (
                <div className="flex items-center gap-1 text-victorian-500 text-sm">
                  <Lock className="w-4 h-4" /> ยังไม่มีสิทธิ์
                </div>
              )}
            </div>

            {isExpanded && (
              <div className="mt-4 space-y-4">
                {typePathways.map(pathway => {
                  const pp = playerPathways.find(pp => pp.pathway_id === pathway.id)
                  const hasPathwayAccess = !!pp && !!pp.pathway_id
                  const playerSeq = pp?.sequence_id ? sequences.find(s => s.id === pp.sequence_id) : null
                  const pathwaySkills = skills.filter(s => s.pathway_id === pathway.id)
                  const pathSeqs = sequences.filter(s => s.pathway_id === pathway.id).sort((a, b) => b.seq_number - a.seq_number)

                  return (
                    <div key={pathway.id} className="ml-4 border-l-2 border-gold-400/10 pl-4">
                      <div className="flex items-center gap-2 mb-3">
                        <GitBranch className="w-4 h-4 text-gold-400" />
                        <span className="text-gold-200 font-semibold">{pathway.name}</span>
                        {hasPathwayAccess && playerSeq && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            playerSeq.seq_number <= 2 ? 'bg-red-400/10 text-red-400' :
                            playerSeq.seq_number <= 5 ? 'bg-amber-400/10 text-amber-400' :
                            'bg-gold-400/10 text-gold-400'
                          }`}>
                            ลำดับ {playerSeq.seq_number} — {playerSeq.name}
                          </span>
                        )}
                        {!hasPathwayAccess && (
                          <span className="text-xs text-victorian-500 flex items-center gap-1">
                            <Lock className="w-3 h-3" /> ล็อค
                          </span>
                        )}
                      </div>

                      {/* Show skills per sequence */}
                      {pathSeqs.map(seq => {
                        const seqSkills = pathwaySkills.filter(s => s.sequence_id === seq.id)
                        if (seqSkills.length === 0) return null

                        return (
                          <div key={seq.id} className="mb-3 ml-4">
                            <div className={`text-xs font-mono mb-1.5 ${
                              seq.seq_number <= 2 ? 'text-red-400/80' :
                              seq.seq_number <= 5 ? 'text-amber-400/80' :
                              'text-victorian-400'
                            }`}>
                              ─── ลำดับ {seq.seq_number}: {seq.name} ───
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {seqSkills.map(skill => {
                                const accessible = canAccessSkill(skill)
                                return (
                                  <div
                                    key={skill.id}
                                    className={`p-3 rounded-lg border transition-all ${
                                      accessible
                                        ? 'bg-victorian-800/40 border-gold-400/20 hover:border-gold-400/40'
                                        : 'bg-victorian-900/40 border-victorian-700/20 opacity-50'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2">
                                        {accessible ? (
                                          <Sparkles className="w-4 h-4 text-gold-400" />
                                        ) : (
                                          <Lock className="w-4 h-4 text-victorian-600" />
                                        )}
                                        <span className={accessible ? 'text-gold-200 font-medium' : 'text-victorian-500'}>
                                          {skill.name}
                                        </span>
                                      </div>
                                      <span className={`text-xs flex items-center gap-0.5 ${accessible ? 'text-blue-400' : 'text-victorian-600'}`}>
                                        <Zap className="w-3 h-3" />{skill.spirit_cost}
                                      </span>
                                    </div>
                                    {skill.description && (
                                      <p className={`text-xs mt-1 ${accessible ? 'text-victorian-400' : 'text-victorian-600'}`}>
                                        {skill.description}
                                      </p>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </OrnamentedCard>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════ */
export default function SkillsContent({
  profile, skillTypes, pathways, sequences, skills, playerPathways
}: SkillsContentProps) {
  const isAdmin = profile?.role === 'admin' || profile?.role === 'dm'
  const [showAdmin, setShowAdmin] = useState(false)

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

        {/* Ornamental divider */}
        <div className="ornament-divider" />

        {/* Admin Panel */}
        {isAdmin && showAdmin && (
          <AdminPanel
            skillTypes={skillTypes}
            pathways={pathways}
            sequences={sequences}
            skills={skills}
          />
        )}

        {/* Player View (or default admin view) */}
        {(!isAdmin || !showAdmin) && (
          <PlayerSkillView
            skillTypes={skillTypes}
            pathways={pathways}
            sequences={sequences}
            skills={skills}
            playerPathways={playerPathways}
          />
        )}
      </div>
    </div>
  )
}
