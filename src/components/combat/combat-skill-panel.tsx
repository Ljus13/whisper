'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Sparkles, X, ChevronDown, ChevronUp, Loader2, Dice1, Copy, Check } from 'lucide-react'
import {
  getCombatSkills,
  useCombatSkill as castCombatSkill,
  useCombatGrantedSkill as castCombatGrantedSkill,
} from '@/app/actions/combat'

/* ═══════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════ */

interface CombatSkillItem {
  id: string
  name: string
  description: string | null
  spiritCost: number
  type: 'pathway' | 'granted'
  linkedSkillName?: string | null
}

interface Props {
  sessionId: string
  isMyTurn: boolean
  isDisabled: boolean
}

type Phase = 'idle' | 'input' | 'rolling' | 'result'

/* ═══════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════ */

export default function CombatSkillPanel({ sessionId, isMyTurn, isDisabled }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [skills, setSkills] = useState<CombatSkillItem[]>([])
  const [spirit, setSpirit] = useState(0)
  const [maxSpirit, setMaxSpirit] = useState(0)
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  // Cast state
  const [selectedSkill, setSelectedSkill] = useState<CombatSkillItem | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [successRate, setSuccessRate] = useState('')
  const [note, setNote] = useState('')
  const [rollDisplay, setRollDisplay] = useState(0)
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)

  // Result state
  const [result, setResult] = useState<{
    skillName: string
    outcome: string
    roll: number
    successRate: number
    referenceCode: string
    spiritCost: number
    remaining: number
    effects?: string[]
    error?: string
  } | null>(null)

  const rollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchSkills = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getCombatSkills()
      const all: CombatSkillItem[] = [
        ...res.pathwaySkills,
        ...res.grantedSkills,
      ]
      setSkills(all)
      setSpirit(res.spirit)
      setMaxSpirit(res.maxSpirit)
      setFetched(true)
    } catch {
      // fail silently
    }
    setLoading(false)
  }, [])

  // Fetch skills when panel is expanded
  useEffect(() => {
    if (expanded && !fetched) {
      fetchSkills()
    }
  }, [expanded, fetched, fetchSkills])

  // Re-fetch when turn comes
  useEffect(() => {
    if (isMyTurn && expanded) {
      fetchSkills()
    }
  }, [isMyTurn, expanded, fetchSkills])

  const handleSelectSkill = (skill: CombatSkillItem) => {
    setSelectedSkill(skill)
    setPhase('input')
    setSuccessRate('')
    setNote('')
    setResult(null)
  }

  const handleCancel = () => {
    setSelectedSkill(null)
    setPhase('idle')
    setResult(null)
    if (rollIntervalRef.current) clearInterval(rollIntervalRef.current)
  }

  const runRollAnimation = (): Promise<number> => {
    return new Promise(resolve => {
      let count = 0
      const max = 15
      rollIntervalRef.current = setInterval(() => {
        count++
        const val = Math.floor(Math.random() * 20) + 1
        setRollDisplay(val)
        if (count >= max) {
          if (rollIntervalRef.current) clearInterval(rollIntervalRef.current)
          const final = Math.floor(Math.random() * 20) + 1
          setRollDisplay(final)
          resolve(final)
        }
      }, 80)
    })
  }

  const handleCast = async () => {
    if (!selectedSkill) return
    const rate = parseInt(successRate)
    if (!Number.isFinite(rate) || rate < 1 || rate > 20) return

    setPhase('rolling')
    const finalRoll = await runRollAnimation()

    setPending(true)
    try {
      const res = selectedSkill.type === 'pathway'
        ? await castCombatSkill(sessionId, selectedSkill.id, rate, finalRoll, note || null)
        : await castCombatGrantedSkill(sessionId, selectedSkill.id, rate, finalRoll, note || null)

      if (res.error) {
        setResult({ skillName: selectedSkill.name, outcome: 'fail', roll: finalRoll, successRate: rate, referenceCode: '', spiritCost: 0, remaining: spirit, error: res.error })
      } else {
        setResult({
          skillName: res.skillName!,
          outcome: res.outcome!,
          roll: res.roll!,
          successRate: res.successRate!,
          referenceCode: res.referenceCode!,
          spiritCost: res.spiritCost!,
          remaining: res.remaining!,
          effects: (res as any).effects,
        })
        setSpirit(res.remaining!)
      }
    } catch {
      setResult({ skillName: selectedSkill.name, outcome: 'fail', roll: finalRoll, successRate: rate, referenceCode: '', spiritCost: 0, remaining: spirit, error: 'เกิดข้อผิดพลาด' })
    }
    setPending(false)
    setPhase('result')
  }

  const handleCopyRef = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* fail silently */ }
  }

  if (!isMyTurn && !expanded) return null

  const canUse = isMyTurn && !isDisabled

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-cyan-950/20 to-victorian-950/60 overflow-hidden">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-cyan-950/20 transition-colors cursor-pointer"
      >
        <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="heading-victorian text-sm text-cyan-300">⚔️ ใช้สกิลในสนามรบ</h3>
          <p className="text-victorian-500 text-[10px] mt-0.5">
            ✨ Spirit: {spirit}/{maxSpirit}
          </p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-victorian-500" /> : <ChevronDown className="w-4 h-4 text-victorian-500" />}
      </button>

      {expanded && (
        <div className="border-t border-cyan-500/10">
          {loading && !fetched ? (
            <div className="px-5 py-8 text-center">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400 mx-auto" />
              <p className="text-victorian-500 text-xs mt-2">กำลังโหลดสกิล...</p>
            </div>
          ) : phase === 'idle' ? (
            /* ── Skill List ── */
            <div className="p-4 space-y-2 max-h-[350px] overflow-y-auto custom-scrollbar">
              {!canUse && (
                <div className="px-3 py-2 rounded-xl bg-victorian-800/40 border border-victorian-700/20 text-victorian-500 text-xs text-center">
                  {isDisabled ? '🚫 คุณถูกสถานะผิดปกติ' : '⏳ รอให้ถึงเทิร์นของคุณก่อน'}
                </div>
              )}
              {skills.length === 0 ? (
                <div className="text-center py-6 text-victorian-500 text-xs">ไม่มีสกิลที่พร้อมใช้</div>
              ) : (
                skills.map(sk => (
                  <button
                    key={`${sk.type}-${sk.id}`}
                    type="button"
                    disabled={!canUse || spirit < sk.spiritCost}
                    onClick={() => handleSelectSkill(sk)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                      spirit < sk.spiritCost
                        ? 'border-victorian-700/20 bg-victorian-950/50 opacity-40 cursor-not-allowed'
                        : canUse
                          ? 'border-cyan-500/20 bg-victorian-900/50 hover:border-cyan-500/40 hover:bg-cyan-950/30 cursor-pointer'
                          : 'border-victorian-700/20 bg-victorian-900/30 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{sk.type === 'pathway' ? '⚔️' : '🎁'}</span>
                      <span className="text-nouveau-cream text-sm font-bold truncate flex-1">{sk.name}</span>
                      <span className="text-cyan-400 text-[10px] font-bold shrink-0">✨ {sk.spiritCost}</span>
                    </div>
                    {sk.description && (
                      <p className="text-victorian-500 text-[10px] mt-1 line-clamp-2 pl-5">{sk.description}</p>
                    )}
                    {sk.type === 'granted' && sk.linkedSkillName && (
                      <p className="text-purple-400 text-[10px] mt-0.5 pl-5">🎁 {sk.linkedSkillName}</p>
                    )}
                  </button>
                ))
              )}
            </div>
          ) : phase === 'input' && selectedSkill ? (
            /* ── Input Phase: Success Rate + Note ── */
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-lg">{selectedSkill.type === 'pathway' ? '⚔️' : '🎁'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-nouveau-cream font-bold text-sm truncate">{selectedSkill.name}</p>
                  <p className="text-cyan-400 text-[10px]">✨ Spirit: {selectedSkill.spiritCost}</p>
                </div>
                <button type="button" onClick={handleCancel} className="w-8 h-8 rounded-lg bg-victorian-800 border border-victorian-600/30 flex items-center justify-center text-victorian-400 hover:text-red-400 cursor-pointer transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="text-victorian-400 text-[10px] font-bold uppercase tracking-wider">🎲 Success Rate (1-20)</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={successRate}
                    onChange={e => setSuccessRate(e.target.value)}
                    placeholder="เลขที่ DM กำหนด"
                    className="mt-1 w-full bg-victorian-950/60 border border-cyan-500/30 rounded-xl px-4 py-2.5 text-nouveau-cream text-sm outline-none focus:border-cyan-500/60 transition-all placeholder:text-victorian-600"
                  />
                </label>
                <label className="block">
                  <span className="text-victorian-400 text-[10px] font-bold uppercase tracking-wider">📝 หมายเหตุ (ไม่บังคับ)</span>
                  <input
                    type="text"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Roleplay context"
                    maxLength={200}
                    className="mt-1 w-full bg-victorian-950/60 border border-victorian-700/30 rounded-xl px-4 py-2.5 text-nouveau-cream text-sm outline-none focus:border-victorian-600/60 transition-all placeholder:text-victorian-600"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleCast}
                disabled={!successRate || parseInt(successRate) < 1 || parseInt(successRate) > 20}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/40 text-cyan-300 font-bold text-sm hover:from-cyan-600/30 hover:to-blue-600/30 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                <Dice1 className="w-4 h-4" /> ทอยเลย!
              </button>
            </div>
          ) : phase === 'rolling' ? (
            /* ── Rolling Animation ── */
            <div className="p-8 flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-2 border-cyan-500/40 flex items-center justify-center animate-bounce">
                  <span className="text-4xl font-black text-cyan-300 tabular-nums">{rollDisplay}</span>
                </div>
                <div className="absolute inset-0 bg-cyan-400/10 blur-2xl rounded-full animate-pulse" />
              </div>
              <p className="text-victorian-400 text-sm animate-pulse">🎲 กำลังทอยลูกเต๋า...</p>
            </div>
          ) : phase === 'result' && result ? (
            /* ── Result ── */
            <div className="p-5 space-y-4">
              {result.error ? (
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                    <span className="text-3xl">❌</span>
                  </div>
                  <p className="text-red-400 text-sm font-bold">{result.error}</p>
                  <button type="button" onClick={handleCancel}
                    className="px-5 py-2.5 rounded-xl bg-victorian-800 border border-victorian-600/30 text-victorian-300 text-sm cursor-pointer hover:text-nouveau-cream transition-colors">
                    ปิด
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center border ${
                    result.outcome === 'success'
                      ? 'bg-green-500/15 border-green-500/30'
                      : 'bg-red-500/15 border-red-500/30'
                  }`}>
                    <span className="text-3xl">{result.outcome === 'success' ? '✅' : '❌'}</span>
                  </div>

                  <div>
                    <p className={`text-lg font-black ${result.outcome === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                      {result.outcome === 'success' ? 'สำเร็จ!' : 'พลาด'}
                    </p>
                    <p className="text-nouveau-cream text-sm font-bold mt-1">{result.skillName}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="px-3 py-2 rounded-xl bg-victorian-800/40 border border-victorian-700/20">
                      <span className="text-victorian-500">🎲 Roll</span>
                      <p className="text-nouveau-cream font-bold">{result.roll} / {result.successRate}</p>
                    </div>
                    <div className="px-3 py-2 rounded-xl bg-victorian-800/40 border border-victorian-700/20">
                      <span className="text-victorian-500">✨ Spirit</span>
                      <p className="text-nouveau-cream font-bold">{result.remaining} <span className="text-victorian-500">(-{result.spiritCost})</span></p>
                    </div>
                  </div>

                  {result.effects && result.effects.length > 0 && (
                    <div className="px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200">
                      <span className="font-bold">⚡ Effects: </span>
                      {result.effects.join(' · ')}
                    </div>
                  )}

                  {result.referenceCode && (
                    <button
                      type="button"
                      onClick={() => handleCopyRef(result.referenceCode)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-victorian-800/40 border border-victorian-700/20 text-victorian-400 text-[10px] hover:text-nouveau-cream cursor-pointer transition-colors"
                    >
                      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      <span className="font-mono">{result.referenceCode}</span>
                    </button>
                  )}

                  <button type="button" onClick={handleCancel}
                    className="px-5 py-2.5 rounded-xl bg-victorian-800 border border-victorian-600/30 text-victorian-300 text-sm cursor-pointer hover:text-nouveau-cream transition-colors">
                    ปิด
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
