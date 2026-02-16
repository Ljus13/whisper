'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import type { Skill, SkillPathway, SkillSequence, SkillType } from '@/lib/types/database'
import { ChevronDown, ChevronUp, Search } from 'lucide-react'

interface SkillsCodexContentProps {
  types: SkillType[]
  pathways: SkillPathway[]
  sequences: SkillSequence[]
  skills: Skill[]
}

export default function SkillsCodexContent({ types, pathways, sequences, skills }: SkillsCodexContentProps) {
  const [query, setQuery] = useState('')
  const [expandedPathways, setExpandedPathways] = useState<Set<string>>(new Set())
  const [fontScale, setFontScale] = useState(1)

  const normalizedQuery = query.trim().toLowerCase()
  const hasQuery = normalizedQuery.length > 0

  const sequenceById = useMemo(() => new Map(sequences.map(seq => [seq.id, seq])), [sequences])
  const skillsByPathway = useMemo(() => {
    const map = new Map<string, Skill[]>()
    for (const skill of skills) {
      const list = map.get(skill.pathway_id) || []
      list.push(skill)
      map.set(skill.pathway_id, list)
    }
    return map
  }, [skills])

  const view = useMemo(() => {
    const visiblePathwayIds: string[] = []
    const matchText = (value?: string | null) => (value || '').toLowerCase().includes(normalizedQuery)
    const matchNumber = (value?: number | null) => (value ?? '').toString().includes(normalizedQuery)

    const typeBlocks = types.map(type => {
      const typeMatch = hasQuery && (matchText(type.name) || matchText(type.description) || matchText(type.overview))
      const typePathways = pathways.filter(p => p.type_id === type.id)

      const pathwayBlocks = typePathways.map(pathway => {
        const pathwayMatch = typeMatch || matchText(pathway.name) || matchText(pathway.description) || matchText(pathway.overview)
        const allSkills = skillsByPathway.get(pathway.id) || []
        const matchingSkills = hasQuery
          ? allSkills.filter(skill => {
              const seq = sequenceById.get(skill.sequence_id)
              return (
                matchText(skill.name) ||
                matchText(skill.description) ||
                matchNumber(skill.spirit_cost) ||
                (seq ? matchText(seq.name) || matchNumber(seq.seq_number) || matchText(seq.roleplay_keywords) : false)
              )
            })
          : allSkills

        const skillsToShow = hasQuery ? (pathwayMatch ? allSkills : matchingSkills) : allSkills
        const skillsBySequence = new Map<string, Skill[]>()
        for (const skill of skillsToShow) {
          const list = skillsBySequence.get(skill.sequence_id) || []
          list.push(skill)
          skillsBySequence.set(skill.sequence_id, list)
        }
        const sequenceGroups = Array.from(skillsBySequence.entries()).map(([sequenceId, list]) => {
          const seq = sequenceById.get(sequenceId) || null
          const sortedSkills = [...list].sort((a, b) => {
            const costA = a.spirit_cost ?? 0
            const costB = b.spirit_cost ?? 0
            if (costA !== costB) return costA - costB
            return a.name.localeCompare(b.name)
          })
          return { sequenceId, seq, skills: sortedSkills }
        }).sort((a, b) => {
          const aNum = a.seq?.seq_number ?? -1
          const bNum = b.seq?.seq_number ?? -1
          if (aNum !== bNum) return bNum - aNum
          return (a.seq?.name || '').localeCompare(b.seq?.name || '')
        })
        const includePathway = !hasQuery || pathwayMatch || matchingSkills.length > 0
        if (includePathway) visiblePathwayIds.push(pathway.id)

        return {
          pathway,
          allSkillsCount: allSkills.length,
          skillsToShow,
          sequenceGroups,
          includePathway,
        }
      }).filter(block => block.includePathway)

      const includeType = !hasQuery || typeMatch || pathwayBlocks.length > 0
      return { type, pathwayBlocks, includeType }
    }).filter(block => block.includeType)

    return { typeBlocks, visiblePathwayIds }
  }, [types, pathways, skillsByPathway, sequenceById, normalizedQuery, hasQuery])

  const visiblePathwayIds = view.visiblePathwayIds
  const visiblePathwayIdsKey = useMemo(() => visiblePathwayIds.join('|'), [visiblePathwayIds])

  useEffect(() => {
    if (!hasQuery) return
    setExpandedPathways(prev => {
      const next = new Set(visiblePathwayIds)
      if (prev.size === next.size && Array.from(prev).every(id => next.has(id))) {
        return prev
      }
      return next
    })
  }, [hasQuery, visiblePathwayIdsKey, visiblePathwayIds])

  const allExpanded = visiblePathwayIds.length > 0 && visiblePathwayIds.every(id => expandedPathways.has(id))

  function toggleAll() {
    if (allExpanded) {
      setExpandedPathways(new Set())
    } else {
      setExpandedPathways(new Set(visiblePathwayIds))
    }
  }

  function togglePathway(id: string) {
    setExpandedPathways(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const canZoomOut = fontScale > 0.9
  const canZoomIn = fontScale < 1.4

  function zoomOut() {
    if (canZoomOut) setFontScale(prev => Math.max(0.9, Math.round((prev - 0.1) * 10) / 10))
  }

  function zoomIn() {
    if (canZoomIn) setFontScale(prev => Math.min(1.4, Math.round((prev + 0.1) * 10) / 10))
  }

  return (
    <div className="min-h-screen bg-victorian-950 text-victorian-100">
      <div className="fixed inset-0 opacity-5" style={{
        backgroundImage: `radial-gradient(circle at 25% 25%, #D4AF37 1px, transparent 1px),
                          radial-gradient(circle at 75% 75%, #D4AF37 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      <div className="relative z-10 max-w-6xl mx-auto p-6 md:p-10 space-y-6" style={{ zoom: fontScale }}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <a
              href="/dashboard/skills"
              className="p-2 rounded-lg border border-gold-400/10 text-gold-400 hover:bg-victorian-800/50 transition-colors"
            >
              ←
            </a>
            <div>
              <h1 className="heading-victorian text-4xl">Codex</h1>
              <p className="text-victorian-400 text-sm mt-1">ข้อมูลระบบสกิลสำหรับทีมงาน</p>
            </div>
          </div>
          <div className="text-victorian-500 text-xs">เฉพาะทีมงาน</div>
        </div>

        <div className="ornament-divider" />

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-victorian-500" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="ค้นหา กลุ่ม / เส้นทาง / สกิล / ลำดับ / พลังวิญญาณ"
              className="w-full pl-10 pr-3 py-2.5 rounded-md bg-victorian-900/60 border border-gold-400/10 text-base text-victorian-100 placeholder:text-victorian-500 focus:outline-none focus:ring-2 focus:ring-gold-400/40"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-victorian-500 text-xs">
              พบ {view.visiblePathwayIds.length} / {pathways.length} เส้นทาง
            </div>
            <button
              type="button"
              onClick={toggleAll}
              className="btn-victorian px-4 py-2 text-sm flex items-center gap-2"
            >
              {allExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {allExpanded ? 'ปิดทั้งหมด' : 'เปิดทั้งหมด'}
            </button>
            <div className="flex items-center gap-1">
              <button type="button" onClick={zoomOut} disabled={!canZoomOut} className="btn-victorian px-3 py-2 text-sm disabled:opacity-50">−</button>
              <div className="text-victorian-400 text-xs w-12 text-center">{Math.round(fontScale * 100)}%</div>
              <button type="button" onClick={zoomIn} disabled={!canZoomIn} className="btn-victorian px-3 py-2 text-sm disabled:opacity-50">+</button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {view.typeBlocks.length === 0 && (
            <div className="p-8 text-center border border-gold-400/10 rounded-sm" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
              <p className="text-victorian-400 heading-victorian">ไม่พบข้อมูลที่ค้นหา</p>
            </div>
          )}
          {view.typeBlocks.map(typeBlock => {
            const typePathways = typeBlock.pathwayBlocks
            return (
              <div key={typeBlock.type.id} className="border border-gold-400/10 rounded-sm overflow-hidden" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
                <div className="p-4 md:p-5 border-b border-gold-400/10">
                  <div className="text-gold-300 font-semibold text-xl">{typeBlock.type.name}</div>
                  {typeBlock.type.description && <div className="text-victorian-300 text-base">{typeBlock.type.description}</div>}
                  {typeBlock.type.overview && <div className="text-victorian-200 text-base mt-2">ภาพรวม: {typeBlock.type.overview}</div>}
                </div>
                <div className="p-4 md:p-6 space-y-5">
                  {typePathways.length === 0 && (
                    <div className="text-victorian-500 text-sm italic">ยังไม่มีเส้นทางในกลุ่มนี้</div>
                  )}
                  {typePathways.map(block => {
                    const pathway = block.pathway
                    const isExpanded = expandedPathways.has(pathway.id)
                    return (
                      <div key={pathway.id} className="border border-gold-400/10 rounded-lg overflow-hidden bg-victorian-950/40">
                          <div className="relative p-4 md:p-5 flex flex-col gap-3">
                          {pathway.bg_url && (
                            <img src={pathway.bg_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-r from-victorian-950/90 via-victorian-900/70 to-victorian-950/90" />
                          <div className="relative flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-full aspect-square shrink-0 border border-gold-400/20 bg-victorian-900/80 overflow-hidden flex items-center justify-center">
                                {pathway.logo_url ? (
                                  <img src={pathway.logo_url} alt="" className="w-full h-full object-cover rounded-full" />
                                ) : (
                                  <span className="text-gold-300 text-sm">⛧</span>
                                )}
                              </div>
                              <div>
                                <div className="text-gold-200 font-semibold text-lg">{pathway.name}</div>
                                {pathway.description && <div className="text-victorian-300 text-sm">{pathway.description}</div>}
                                {pathway.overview && <div className="text-victorian-200 text-sm mt-1">ภาพรวม: {pathway.overview}</div>}
                                <div className="text-victorian-500 text-sm mt-1">สกิลทั้งหมด {block.allSkillsCount}</div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => togglePathway(pathway.id)}
                              className="btn-victorian px-3.5 py-2 text-sm flex items-center gap-2"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              {isExpanded ? 'ซ่อนรายละเอียด' : 'เปิดดูข้อมูลเต็ม'}
                            </button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="p-4 md:p-5">
                            <div className="md:hidden space-y-4">
                              {block.sequenceGroups.length === 0 && (
                                <div className="text-victorian-500 text-sm">ยังไม่มีสกิลในเส้นทางนี้</div>
                              )}
                              {block.sequenceGroups.map(group => (
                                <Fragment key={group.sequenceId}>
                                  <div className="text-gold-200 text-sm font-semibold bg-victorian-900/60 rounded px-3 py-2">
                                    {group.seq ? `ลำดับ #${group.seq.seq_number} ${group.seq.name}` : 'ลำดับไม่ระบุ'}
                                  </div>
                                  {group.skills.map(skill => (
                                    <div key={skill.id} className="border border-gold-400/10 rounded-md p-3 bg-victorian-900/30">
                                      <div className="flex items-baseline justify-between gap-3">
                                        <div className="text-victorian-100 font-semibold">{skill.name}</div>
                                        <div className="text-amber-200 text-sm">{skill.spirit_cost ?? 0}</div>
                                      </div>
                                      <div className="text-victorian-400 text-xs mt-1">
                                        {group.seq ? `#${group.seq.seq_number} ${group.seq.name}` : '—'}
                                      </div>
                                      <div className="text-victorian-300 text-sm mt-2 whitespace-pre-line leading-6">
                                        {skill.description || '—'}
                                      </div>
                                    </div>
                                  ))}
                                </Fragment>
                              ))}
                            </div>
                            <div className="hidden md:block overflow-x-auto">
                              <table className="w-full text-base">
                                <thead>
                                  <tr className="text-victorian-500 text-left border-b border-gold-400/10">
                                    <th className="pb-2 pr-3">สกิล</th>
                                    <th className="pb-2 pr-3">ลำดับ</th>
                                    <th className="pb-2 pr-3">พลังวิญญาณ</th>
                                    <th className="pb-2">คำอธิบาย</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {block.sequenceGroups.length === 0 && (
                                    <tr>
                                      <td colSpan={4} className="py-3 text-victorian-500 text-sm">ยังไม่มีสกิลในเส้นทางนี้</td>
                                    </tr>
                                  )}
                                  {block.sequenceGroups.map(group => (
                                    <Fragment key={group.sequenceId}>
                                      <tr className="bg-victorian-900/60">
                                        <td colSpan={4} className="py-3 px-3 text-gold-200 text-sm font-semibold">
                                          {group.seq ? `ลำดับ #${group.seq.seq_number} ${group.seq.name}` : 'ลำดับไม่ระบุ'}
                                        </td>
                                      </tr>
                                      {group.skills.map(skill => (
                                        <tr key={skill.id} className="border-b border-victorian-800/50 hover:bg-victorian-800/20">
                                          <td className="py-3 pr-3 text-victorian-100 text-sm">{skill.name}</td>
                                          <td className="py-3 pr-3 text-victorian-400 text-sm">
                                            {group.seq ? `#${group.seq.seq_number} ${group.seq.name}` : '—'}
                                          </td>
                                          <td className="py-3 pr-3 text-amber-200 text-sm">{skill.spirit_cost ?? 0}</td>
                                          <td className="py-3 text-victorian-300 text-sm">{skill.description || '—'}</td>
                                        </tr>
                                      ))}
                                    </Fragment>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
