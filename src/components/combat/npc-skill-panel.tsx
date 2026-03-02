'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Sparkles, X, Loader2, Dice1, Copy, Check, Plus, Trash2, Gift } from 'lucide-react'
import { getNpcCombatSkills, useNpcCombatSkill, useNpcGrantedSkill, addNpcGrantedSkill, removeNpcGrantedSkill } from '@/app/actions/combat'

/* ═══════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════ */

interface SkillItem {
  id: string
  name: string
  description: string | null
  spiritCost: number
  type: 'pathway' | 'granted'
}

interface Props {
  sessionId: string
  participantId: string
  participantName: string
  onClose: () => void
}

type Phase = 'idle' | 'input' | 'rolling' | 'result' | 'add-granted'

/* ═══════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════ */

export default function NpcSkillPanel({ sessionId, participantId, participantName, onClose }: Props) {
  const [pathwaySkills, setPathwaySkills] = useState<SkillItem[]>([])
  const [grantedSkills, setGrantedSkills] = useState<SkillItem[]>([])
  const [spirit, setSpirit] = useState(0)
  const [loading, setLoading] = useState(true)

  // Cast state
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [successRate, setSuccessRate] = useState('')
  const [note, setNote] = useState('')
  const [rollDisplay, setRollDisplay] = useState(0)
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)

  // Add granted skill form
  const [grantForm, setGrantForm] = useState({
    name: '', description: '', spiritCost: '0',
    reusePolicy: 'unlimited' as 'once' | 'cooldown' | 'unlimited',
    cooldownMinutes: '5',
    effectHp: '0', effectSanity: '0', effectSpirit: '0',
  })

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
      const res = await getNpcCombatSkills(sessionId, participantId)
      setPathwaySkills(res.pathwaySkills)
      setGrantedSkills(res.grantedSkills ?? [])
      setSpirit(res.spirit)
    } catch { /* fail silently */ }
    setLoading(false)
  }, [sessionId, participantId])

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  const handleSelectSkill = (skill: SkillItem) => {
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
        ? await useNpcCombatSkill(sessionId, participantId, selectedSkill.id, rate, finalRoll, note || null)
        : await useNpcGrantedSkill(sessionId, participantId, selectedSkill.id, rate, finalRoll, note || null)

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

  const handleAddGrantedSkill = async () => {
    if (!grantForm.name.trim()) return
    setPending(true)
    const res = await addNpcGrantedSkill(sessionId, participantId, {
      name: grantForm.name,
      description: grantForm.description || undefined,
      spiritCost: parseInt(grantForm.spiritCost) || 0,
      reusePolicy: grantForm.reusePolicy,
      cooldownMinutes: grantForm.reusePolicy === 'cooldown' ? (parseInt(grantForm.cooldownMinutes) || 5) : undefined,
      effectHp: parseInt(grantForm.effectHp) || 0,
      effectSanity: parseInt(grantForm.effectSanity) || 0,
      effectSpirit: parseInt(grantForm.effectSpirit) || 0,
    })
    if (!res.error) {
      setGrantForm({ name: '', description: '', spiritCost: '0', reusePolicy: 'unlimited', cooldownMinutes: '5', effectHp: '0', effectSanity: '0', effectSpirit: '0' })
      setPhase('idle')
      await fetchSkills()
    }
    setPending(false)
  }

  const handleRemoveGrantedSkill = async (skillId: string) => {
    setPending(true)
    await removeNpcGrantedSkill(sessionId, participantId, skillId)
    await fetchSkills()
    setPending(false)
  }

  const handleCopyRef = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* fail silently */ }
  }

  const allSkills = [...pathwaySkills, ...grantedSkills]

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-victorian-950/60 overflow-hidden mt-2">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-cyan-500/10">
        <Sparkles className="w-4 h-4 text-cyan-400" />
        <span className="text-cyan-300 text-xs font-bold flex-1">⚔️ สกิลของ {participantName}</span>
        <span className="text-victorian-500 text-[10px]">✨ {spirit}</span>
        <button type="button" onClick={onClose} className="w-6 h-6 rounded-lg bg-victorian-800 border border-victorian-600/30 flex items-center justify-center text-victorian-400 hover:text-red-400 cursor-pointer transition-colors">
          <X className="w-3 h-3" />
        </button>
      </div>

      {loading ? (
        <div className="px-4 py-6 text-center">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400 mx-auto" />
          <p className="text-victorian-500 text-xs mt-2">กำลังโหลดสกิล...</p>
        </div>
      ) : phase === 'idle' ? (
        /* ── Skill List ── */
        <div className="p-3 space-y-2 max-h-[350px] overflow-y-auto custom-scrollbar">
          {/* Pathway Skills */}
          {pathwaySkills.length > 0 && (
            <p className="text-victorian-500 text-[10px] font-bold uppercase tracking-wider px-1">⚔️ สกิลเส้นทาง</p>
          )}
          {pathwaySkills.map(sk => (
            <button key={sk.id} type="button" disabled={spirit < sk.spiritCost} onClick={() => handleSelectSkill(sk)}
              className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                spirit < sk.spiritCost
                  ? 'border-victorian-700/20 bg-victorian-950/50 opacity-40 cursor-not-allowed'
                  : 'border-cyan-500/20 bg-victorian-900/50 hover:border-cyan-500/40 hover:bg-cyan-950/30 cursor-pointer'
              }`}>
              <div className="flex items-center gap-2">
                <span className="text-xs">⚔️</span>
                <span className="text-nouveau-cream text-xs font-bold truncate flex-1">{sk.name}</span>
                <span className="text-cyan-400 text-[10px] font-bold shrink-0">✨ {sk.spiritCost}</span>
              </div>
              {sk.description && <p className="text-victorian-500 text-[10px] mt-1 line-clamp-2 pl-5">{sk.description}</p>}
            </button>
          ))}

          {/* Granted Skills */}
          {grantedSkills.length > 0 && (
            <p className="text-victorian-500 text-[10px] font-bold uppercase tracking-wider px-1 pt-2">🎁 สกิลพิเศษ (Granted)</p>
          )}
          {grantedSkills.map(sk => (
            <div key={sk.id} className="flex items-center gap-1.5">
              <button type="button" disabled={spirit < sk.spiritCost} onClick={() => handleSelectSkill(sk)}
                className={`flex-1 text-left px-3 py-2.5 rounded-xl border transition-all ${
                  spirit < sk.spiritCost
                    ? 'border-victorian-700/20 bg-victorian-950/50 opacity-40 cursor-not-allowed'
                    : 'border-purple-500/20 bg-victorian-900/50 hover:border-purple-500/40 hover:bg-purple-950/30 cursor-pointer'
                }`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs">🎁</span>
                  <span className="text-nouveau-cream text-xs font-bold truncate flex-1">{sk.name}</span>
                  <span className="text-cyan-400 text-[10px] font-bold shrink-0">✨ {sk.spiritCost}</span>
                </div>
                {sk.description && <p className="text-victorian-500 text-[10px] mt-1 line-clamp-2 pl-5">{sk.description}</p>}
              </button>
              <button type="button" onClick={() => handleRemoveGrantedSkill(sk.id)} disabled={pending}
                className="w-7 h-7 shrink-0 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 cursor-pointer disabled:opacity-40 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}

          {allSkills.length === 0 && (
            <div className="text-center py-4 text-victorian-500 text-xs">ไม่มีสกิลที่พร้อมใช้</div>
          )}

          {/* Add Granted Skill button */}
          <button type="button" onClick={() => setPhase('add-granted')}
            className="w-full px-3 py-2 rounded-xl border border-dashed border-purple-500/30 text-purple-400 text-xs font-bold hover:bg-purple-500/10 cursor-pointer transition-all flex items-center justify-center gap-1.5 mt-2">
            <Plus className="w-3 h-3" /> เพิ่มสกิลพิเศษ
          </button>
        </div>
      ) : phase === 'add-granted' ? (
        /* ── Add Granted Skill Form ── */
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-purple-400" />
            <span className="text-purple-300 text-xs font-bold flex-1">เพิ่มสกิลพิเศษให้ {participantName}</span>
            <button type="button" onClick={handleCancel} className="w-6 h-6 rounded-lg bg-victorian-800 border border-victorian-600/30 flex items-center justify-center text-victorian-400 hover:text-red-400 cursor-pointer transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block col-span-2">
              <span className="text-victorian-400 text-[10px] font-bold">ชื่อสกิล *</span>
              <input type="text" value={grantForm.name} onChange={e => setGrantForm({ ...grantForm, name: e.target.value })}
                placeholder="เช่น แสงมรณะ" className="mt-1 w-full bg-victorian-950/60 border border-purple-500/30 rounded-xl px-3 py-2 text-nouveau-cream text-xs outline-none focus:border-purple-500/60 transition-all placeholder:text-victorian-600" />
            </label>
            <label className="block col-span-2">
              <span className="text-victorian-400 text-[10px] font-bold">รายละเอียด</span>
              <input type="text" value={grantForm.description} onChange={e => setGrantForm({ ...grantForm, description: e.target.value })}
                placeholder="คำอธิบายสั้น ๆ" className="mt-1 w-full bg-victorian-950/60 border border-victorian-700/30 rounded-xl px-3 py-2 text-nouveau-cream text-xs outline-none focus:border-victorian-600/60 transition-all placeholder:text-victorian-600" />
            </label>
            <label className="block">
              <span className="text-cyan-400 text-[10px] font-bold">✨ Spirit Cost</span>
              <input type="number" min={0} value={grantForm.spiritCost} onChange={e => setGrantForm({ ...grantForm, spiritCost: e.target.value })}
                className="mt-1 w-full bg-victorian-950/60 border border-victorian-700/30 rounded-xl px-3 py-2 text-nouveau-cream text-xs outline-none" />
            </label>
            <label className="block">
              <span className="text-victorian-400 text-[10px] font-bold">การใช้ซ้ำ</span>
              <select value={grantForm.reusePolicy} onChange={e => setGrantForm({ ...grantForm, reusePolicy: e.target.value as any })}
                className="mt-1 w-full bg-victorian-950/60 border border-victorian-700/30 rounded-xl px-3 py-2 text-nouveau-cream text-xs outline-none">
                <option value="unlimited">ไม่จำกัด</option>
                <option value="once">ครั้งเดียว</option>
                <option value="cooldown">มีคูลดาวน์</option>
              </select>
            </label>
            {grantForm.reusePolicy === 'cooldown' && (
              <label className="block col-span-2">
                <span className="text-victorian-400 text-[10px] font-bold">⏱️ คูลดาวน์ (นาที)</span>
                <input type="number" min={1} value={grantForm.cooldownMinutes} onChange={e => setGrantForm({ ...grantForm, cooldownMinutes: e.target.value })}
                  className="mt-1 w-full bg-victorian-950/60 border border-victorian-700/30 rounded-xl px-3 py-2 text-nouveau-cream text-xs outline-none" />
              </label>
            )}
          </div>

          <div>
            <p className="text-victorian-400 text-[10px] font-bold mb-1.5">⚡ Effects เมื่อใช้ (บวก = เพิ่ม, ลบ = ลด)</p>
            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="text-red-400 text-[10px] font-bold">❤️ HP</span>
                <input type="number" value={grantForm.effectHp} onChange={e => setGrantForm({ ...grantForm, effectHp: e.target.value })}
                  className="mt-1 w-full bg-victorian-950/60 border border-victorian-700/30 rounded-xl px-3 py-2 text-nouveau-cream text-xs outline-none" />
              </label>
              <label className="block">
                <span className="text-yellow-400 text-[10px] font-bold">🧠 Sanity</span>
                <input type="number" value={grantForm.effectSanity} onChange={e => setGrantForm({ ...grantForm, effectSanity: e.target.value })}
                  className="mt-1 w-full bg-victorian-950/60 border border-victorian-700/30 rounded-xl px-3 py-2 text-nouveau-cream text-xs outline-none" />
              </label>
              <label className="block">
                <span className="text-blue-400 text-[10px] font-bold">✨ Spirit</span>
                <input type="number" value={grantForm.effectSpirit} onChange={e => setGrantForm({ ...grantForm, effectSpirit: e.target.value })}
                  className="mt-1 w-full bg-victorian-950/60 border border-victorian-700/30 rounded-xl px-3 py-2 text-nouveau-cream text-xs outline-none" />
              </label>
            </div>
          </div>

          <button type="button" onClick={handleAddGrantedSkill} disabled={pending || !grantForm.name.trim()}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/40 text-purple-300 font-bold text-xs hover:from-purple-600/30 hover:to-pink-600/30 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />} เพิ่มสกิลพิเศษ
          </button>
        </div>
      ) : phase === 'input' && selectedSkill ? (
        /* ── Input Phase ── */
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-lg">{selectedSkill.type === 'pathway' ? '⚔️' : '🎁'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-nouveau-cream font-bold text-xs truncate">{selectedSkill.name}</p>
              <p className="text-cyan-400 text-[10px]">✨ Spirit: {selectedSkill.spiritCost}</p>
            </div>
            <button type="button" onClick={handleCancel} className="w-7 h-7 rounded-lg bg-victorian-800 border border-victorian-600/30 flex items-center justify-center text-victorian-400 hover:text-red-400 cursor-pointer transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-victorian-400 text-[10px] font-bold uppercase tracking-wider">🎲 Success Rate (1-20)</span>
              <input type="number" min={1} max={20} value={successRate} onChange={e => setSuccessRate(e.target.value)}
                placeholder="1-20" className="mt-1 w-full bg-victorian-950/60 border border-cyan-500/30 rounded-xl px-3 py-2 text-nouveau-cream text-xs outline-none focus:border-cyan-500/60 transition-all placeholder:text-victorian-600" />
            </label>
            <label className="block">
              <span className="text-victorian-400 text-[10px] font-bold uppercase tracking-wider">📝 หมายเหตุ</span>
              <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="RP context"
                maxLength={200} className="mt-1 w-full bg-victorian-950/60 border border-victorian-700/30 rounded-xl px-3 py-2 text-nouveau-cream text-xs outline-none focus:border-victorian-600/60 transition-all placeholder:text-victorian-600" />
            </label>
          </div>
          <button type="button" onClick={handleCast} disabled={!successRate || parseInt(successRate) < 1 || parseInt(successRate) > 20}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/40 text-cyan-300 font-bold text-xs hover:from-cyan-600/30 hover:to-blue-600/30 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
            <Dice1 className="w-3.5 h-3.5" /> ทอยเลย!
          </button>
        </div>
      ) : phase === 'rolling' ? (
        /* ── Rolling ── */
        <div className="p-6 flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-2 border-cyan-500/40 flex items-center justify-center animate-bounce">
              <span className="text-2xl font-black text-cyan-300 tabular-nums">{rollDisplay}</span>
            </div>
          </div>
          <p className="text-victorian-400 text-xs animate-pulse">🎲 กำลังทอยลูกเต๋า...</p>
        </div>
      ) : phase === 'result' && result ? (
        /* ── Result ── */
        <div className="p-4 text-center space-y-3">
          {result.error ? (
            <>
              <p className="text-red-400 text-xs font-bold">❌ {result.error}</p>
              <button type="button" onClick={handleCancel} className="px-4 py-2 rounded-xl bg-victorian-800 border border-victorian-600/30 text-victorian-300 text-xs cursor-pointer hover:text-nouveau-cream transition-colors">ปิด</button>
            </>
          ) : (
            <>
              <div className={`w-12 h-12 mx-auto rounded-xl flex items-center justify-center border ${
                result.outcome === 'success' ? 'bg-green-500/15 border-green-500/30' : 'bg-red-500/15 border-red-500/30'
              }`}>
                <span className="text-2xl">{result.outcome === 'success' ? '✅' : '❌'}</span>
              </div>
              <div>
                <p className={`text-sm font-black ${result.outcome === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {result.outcome === 'success' ? 'สำเร็จ!' : 'พลาด'}
                </p>
                <p className="text-nouveau-cream text-xs font-bold mt-0.5">{result.skillName}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="px-2 py-1.5 rounded-xl bg-victorian-800/40 border border-victorian-700/20">
                  <span className="text-victorian-500">🎲</span> <span className="text-nouveau-cream font-bold">{result.roll}/{result.successRate}</span>
                </div>
                <div className="px-2 py-1.5 rounded-xl bg-victorian-800/40 border border-victorian-700/20">
                  <span className="text-victorian-500">✨</span> <span className="text-nouveau-cream font-bold">{result.remaining} (-{result.spiritCost})</span>
                </div>
              </div>
              {result.effects && result.effects.length > 0 && (
                <div className="px-2 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200">
                  <span className="font-bold">⚡ </span>{result.effects.join(' · ')}
                </div>
              )}
              {result.referenceCode && (
                <button type="button" onClick={() => handleCopyRef(result.referenceCode)}
                  className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-victorian-800/40 border border-victorian-700/20 text-victorian-400 text-[10px] hover:text-nouveau-cream cursor-pointer transition-colors">
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  <span className="font-mono">{result.referenceCode}</span>
                </button>
              )}
              <br />
              <button type="button" onClick={handleCancel} className="px-4 py-2 rounded-xl bg-victorian-800 border border-victorian-600/30 text-victorian-300 text-xs cursor-pointer hover:text-nouveau-cream transition-colors">ปิด</button>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
