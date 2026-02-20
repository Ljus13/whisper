'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { SkillPathway, SkillSequence, SkillType } from '@/lib/types/database'
import { Search, ScrollText, ChevronDown, ChevronRight, Copy, CheckCircle } from 'lucide-react'

interface RoleplayGuideContentProps {
  types: SkillType[]
  pathways: SkillPathway[]
  sequences: SkillSequence[]
}

export default function RoleplayGuideContent({ types, pathways, sequences }: RoleplayGuideContentProps) {
  const [query, setQuery] = useState('')
  const [openType, setOpenType] = useState<string | null>(null)
  const [openPathway, setOpenPathway] = useState<string | null>(null)
  const [promptCopied, setPromptCopied] = useState(false)
  const [keywordCopiedId, setKeywordCopiedId] = useState<string | null>(null)
  const promptText = `Role: Roleplay Content Auditor
Objective: ประเมินความสอดคล้องระหว่างเนื้อหาและคีย์เวิร์ด พร้อมสรุปผลตามเกณฑ์ของกิจกรรม

Input:
Target Keywords: [ใส่คีย์เวิร์ดที่นี่]
Roleplay Text: [ใส่เนื้อหาที่นี่]

Instructions:
Alignment Scoring: คำนวณคะแนน 0-100% โดยอิงจากความสอดคล้องกับคีย์เวิร์ด

Classification: จัดกลุ่มผลลัพธ์ตามเกณฑ์:
0-25%: ไม่สอดคล้อง
26-50%: สอดคล้องน้อย
51-75%: ปานกลาง
76-100%: สอดคล้องสูง

Output Format:
คะแนนสุทธิ: [X]%
ระดับความสอดคล้อง: [ระบุระดับตามเกณฑ์ด้านบน]
สรุปวิเคราะห์: (อธิบายว่าทำไมถึงได้ระดับนี้ และจุดไหนที่ตรง/ไม่ตรงกับคีย์เวิร์ด)`

  const normalizedQuery = query.trim().toLowerCase()
  const hasQuery = normalizedQuery.length > 0
  const view = useMemo(() => {
    const matchText = (value?: string | null) => (value || '').toLowerCase().includes(normalizedQuery)
    const matchNumber = (value?: number | null) => (value ?? '').toString().includes(normalizedQuery)
    const typeBlocks = types.map(type => {
      const typeMatch = !hasQuery || matchText(type.name) || matchText(type.description) || matchText(type.overview)
      const typePathways = pathways.filter(p => p.type_id === type.id)
      const pathwayBlocks = typePathways.map(pathway => {
        const pathwayMatch = typeMatch || matchText(pathway.name) || matchText(pathway.description) || matchText(pathway.overview)
        const pathwaySequences = sequences
          .filter(seq => seq.pathway_id === pathway.id)
          .filter(seq => {
            if (!hasQuery) return true
            return (
              pathwayMatch ||
              matchText(seq.name) ||
              matchNumber(seq.seq_number) ||
              matchText(seq.roleplay_keywords)
            )
          })
          .sort((a, b) => b.seq_number - a.seq_number)
        const includePathway = !hasQuery || pathwayMatch || pathwaySequences.length > 0
        return { pathway, sequences: pathwaySequences, includePathway }
      }).filter(block => block.includePathway)
      const includeType = !hasQuery || typeMatch || pathwayBlocks.length > 0
      return { type, pathways: pathwayBlocks, includeType }
    }).filter(block => block.includeType)

    return { typeBlocks }
  }, [types, pathways, sequences, hasQuery, normalizedQuery])

  return (
    <div className="min-h-screen bg-victorian-950 text-victorian-100">
      <div className="fixed inset-0 opacity-5" style={{
        backgroundImage: `radial-gradient(circle at 25% 25%, #D4AF37 1px, transparent 1px),
                          radial-gradient(circle at 75% 75%, #D4AF37 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      <div className="relative z-10 max-w-6xl mx-auto p-6 md:p-10 space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/action-quest/quests"
            className="p-2 rounded-lg border border-gold-400/10 text-gold-400 hover:bg-victorian-800/50 transition-colors"
          >
            ←
          </Link>
          <div>
            <h1 className="heading-victorian text-3xl md:text-4xl flex items-center gap-3">
              <ScrollText className="w-6 h-6 text-gold-400" /> แนวทางการสวมบทบาท
            </h1>
            <p className="text-victorian-400 text-sm mt-1">ข้อมูลกลุ่ม / เส้นทาง / ลำดับ สำหรับทีมงาน</p>
          </div>
        </div>

        <div className="ornament-divider" />

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 md:p-6 text-amber-100">
          <div className="text-amber-200 font-semibold mb-2">หลักการพิจารณาลิงก์สวมบทบาท</div>
          <div className="text-sm md:text-base leading-relaxed">
            ในลิงก์โรลเพลย์ที่ผู้ใช้ส่งมา การอนุมัติย่อยโอสถมากหรือน้อย ให้พิจารณาว่ามีข้อความตรงตามคีย์เวิร์ดหรือคอนเซปต์ของลำดับนั้นมากน้อยแค่ไหน
          </div>
        </div>

        <div className="rounded-xl border border-gold-400/20 bg-victorian-900/60 p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="text-gold-300 font-semibold">Prompt แนะนำสำหรับ Gemini</div>
              <div className="text-victorian-400 text-sm mt-1">ทีมงานใช้เป็นมาตรฐานในการประเมินความสอดคล้อง</div>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(promptText)
                setPromptCopied(true)
                setTimeout(() => setPromptCopied(false), 2000)
              }}
              className="btn-victorian px-4 py-2 text-sm inline-flex items-center gap-2 cursor-pointer"
              aria-label="คัดลอก Prompt"
            >
              {promptCopied ? <CheckCircle className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              {promptCopied ? 'คัดลอกแล้ว' : 'คัดลอก Prompt'}
            </button>
          </div>
          <pre className="mt-4 text-sm md:text-base whitespace-pre-wrap leading-relaxed text-victorian-100 bg-victorian-950/70 border border-gold-400/10 rounded-lg p-4">
            {promptText}
          </pre>
          <div className="mt-3 text-victorian-400 text-sm">
            เกณฑ์สุดท้ายให้ทีมงานมนุษย์พิจารณา อย่าให้การประเมินอัตโนมัติตัดสินแทนทั้งหมด
          </div>
        </div>

        <div className="relative w-full md:max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-victorian-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="ค้นหา กลุ่ม / เส้นทาง / ลำดับ / คีย์เวิร์ด"
            className="w-full pl-10 pr-3 py-2.5 rounded-md bg-victorian-900/60 border border-gold-400/10 text-base text-victorian-100 placeholder:text-victorian-500 focus:outline-none focus:ring-2 focus:ring-gold-400/40"
          />
        </div>

        <div className="space-y-5">
          {view.typeBlocks.length === 0 && (
            <div className="p-8 text-center border border-gold-400/10 rounded-sm" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
              <p className="text-victorian-400 heading-victorian">ไม่พบข้อมูลที่ค้นหา</p>
            </div>
          )}
          {view.typeBlocks.map(typeBlock => {
            const isOpen = openType === typeBlock.type.id || hasQuery
            return (
              <div key={typeBlock.type.id} className="border border-gold-400/10 rounded-sm overflow-hidden" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
                <button
                  type="button"
                  onClick={() => setOpenType(isOpen ? null : typeBlock.type.id)}
                  className="w-full text-left p-4 md:p-5 border-b border-gold-400/10 flex items-center justify-between"
                >
                  <div>
                    <div className="text-gold-300 font-semibold text-xl">{typeBlock.type.name}</div>
                    {typeBlock.type.description && <div className="text-victorian-300 text-base">{typeBlock.type.description}</div>}
                    {typeBlock.type.overview && <div className="text-victorian-200 text-base mt-2">ภาพรวม: {typeBlock.type.overview}</div>}
                  </div>
                  {isOpen ? <ChevronDown className="w-5 h-5 text-gold-400" /> : <ChevronRight className="w-5 h-5 text-gold-400" />}
                </button>
                {isOpen && (
                  <div className="p-4 md:p-6 space-y-4">
                    {typeBlock.pathways.length === 0 && (
                      <div className="text-victorian-500 text-sm italic">ยังไม่มีเส้นทางในกลุ่มนี้</div>
                    )}
                    {typeBlock.pathways.map(pathBlock => {
                      const isPathOpen = openPathway === pathBlock.pathway.id || hasQuery
                      return (
                        <div key={pathBlock.pathway.id} className="border border-gold-400/10 rounded-lg overflow-hidden bg-victorian-950/40">
                          <button
                            type="button"
                            onClick={() => setOpenPathway(isPathOpen ? null : pathBlock.pathway.id)}
                            className="w-full text-left p-4 flex items-center justify-between"
                          >
                            <div>
                              <div className="text-gold-200 font-semibold text-lg">{pathBlock.pathway.name}</div>
                              {pathBlock.pathway.description && <div className="text-victorian-300 text-sm">{pathBlock.pathway.description}</div>}
                              {pathBlock.pathway.overview && <div className="text-victorian-200 text-sm mt-1">ภาพรวม: {pathBlock.pathway.overview}</div>}
                            </div>
                            {isPathOpen ? <ChevronDown className="w-4 h-4 text-gold-400" /> : <ChevronRight className="w-4 h-4 text-gold-400" />}
                          </button>
                          {isPathOpen && (
                            <div className="p-4 border-t border-gold-400/10">
                              {pathBlock.sequences.length === 0 && (
                                <div className="text-victorian-500 text-sm italic">ยังไม่มีลำดับในเส้นทางนี้</div>
                              )}
                              {pathBlock.sequences.map(seq => (
                                <div key={seq.id} className="py-2 border-b border-victorian-800/40 last:border-b-0">
                                  <div className="text-amber-200 text-sm font-semibold">ลำดับ #{seq.seq_number} {seq.name}</div>
                                  <div className="mt-2 rounded-lg border border-gold-400/10 bg-victorian-900/60 p-3">
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                      <div className="text-victorian-400 text-xs">คีย์เวิร์ด/คอนเซปต์การสวมบทบาท</div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(seq.roleplay_keywords || '')
                                          setKeywordCopiedId(seq.id)
                                          setTimeout(() => setKeywordCopiedId(null), 2000)
                                        }}
                                        className="inline-flex items-center gap-2 text-xs text-gold-300 hover:text-gold-200 cursor-pointer"
                                        aria-label="คัดลอกคีย์เวิร์ด"
                                      >
                                        {keywordCopiedId === seq.id ? <CheckCircle className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                                        {keywordCopiedId === seq.id ? 'คัดลอกแล้ว' : 'คัดลอกคีย์เวิร์ด'}
                                      </button>
                                    </div>
                                    <div className="mt-2 text-victorian-100 text-sm md:text-base leading-relaxed whitespace-pre-wrap">
                                      {seq.roleplay_keywords || '—'}
                                    </div>
                                  </div>
                                </div>
                              ))}
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
      </div>
    </div>
  )
}
