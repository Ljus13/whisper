'use client'

import { useState, useEffect, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Zap, Search, Gift, Users, ScrollText, X, ChevronLeft, ChevronRight,
  Clock, CheckCircle, Sparkles, Shield, Crown, Swords, Calendar, Repeat, Infinity,
  Pencil, Trash2, Settings, LockKeyhole
} from 'lucide-react'
import {
  getPlayersForGrantSkill,
  getAllSkillsGrouped,
  grantSkillToPlayer,
  updateGrantedSkill,
  deleteGrantedSkill,
  getGrantedSkillsForPlayer,
  getGrantSkillLogs,
  type GrantSkillInput,
  type UpdateGrantSkillInput,
} from '@/app/actions/granted-skills'

/* ─── Types ─── */
interface PlayerRow {
  id: string
  display_name: string | null
  avatar_url: string | null
  role: string
  pathways: { pathwayName: string; seqName: string; seqNumber: number }[]
}

interface SkillOption {
  id: string
  pathway_id: string
  sequence_id: string
  name: string
  description: string | null
  spirit_cost: number
}

interface LogEntry {
  id: string
  action: string
  title: string
  detail: string | null
  skill_id: string
  player_id: string
  player_name: string
  player_avatar: string | null
  granter_name: string
  skill_name: string
  effects_json: Record<string, number> | null
  reference_code: string | null
  note: string | null
  created_at: string
}

interface GrantFormInitialValues {
  title: string
  detail: string
  effectHp: number
  effectSanity: number
  effectMaxSanity: number
  effectTravel: number
  effectMaxTravel: number
  effectSpirituality: number
  effectMaxSpirituality: number
  effectPotionDigest: number
}

/* ─── Helpers ─── */
function fmtDate(d: string) {
  const x = new Date(d)
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()} ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`
}

function RoleIcon({ role }: { role: string }) {
  if (role === 'admin') return <Crown className="w-4 h-4 text-gold-300" />
  if (role === 'dm') return <Shield className="w-4 h-4 text-nouveau-emerald" />
  return <Swords className="w-4 h-4 text-metal-silver" />
}

function EffectBadge({ label, value }: { label: string; value: number }) {
  if (value === 0) return null
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold ${
      value > 0 ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
    }`}>
      {value > 0 ? '+' : ''}{value} {label}
    </span>
  )
}

const EFFECT_LABELS: Record<string, string> = {
  effect_hp: 'HP',
  effect_sanity: 'Sanity',
  effect_max_sanity: 'Max Sanity',
  effect_travel: 'Travel',
  effect_max_travel: 'Max Travel',
  effect_spirituality: 'Spirit',
  effect_max_spirituality: 'Max Spirit',
  effect_potion_digest: 'Digest',
}

/* ═══════════════════════════════════════
   MODAL WRAPPER
   ═══════════════════════════════════════ */
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose} style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-2xl rounded-xl border-2 border-gold-400/15 p-6 md:p-8 space-y-5 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: '#1A1612' }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════
   SKILL SELECTOR
   ═══════════════════════════════════════ */
function SkillSelector({
  types, pathways, sequences, skills, onSelect, onClose
}: {
  types: { id: string; name: string }[]
  pathways: { id: string; type_id: string; name: string }[]
  sequences: { id: string; pathway_id: string; seq_number: number; name: string }[]
  skills: SkillOption[]
  onSelect: (skill: SkillOption) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterPathway, setFilterPathway] = useState('')

  const filteredPathways = useMemo(() =>
    filterType ? pathways.filter(p => p.type_id === filterType) : pathways
  , [pathways, filterType])

  const filtered = useMemo(() => {
    let list = skills
    if (filterPathway) list = list.filter(s => s.pathway_id === filterPathway)
    else if (filterType) {
      const pwIds = new Set(filteredPathways.map(p => p.id))
      list = list.filter(s => pwIds.has(s.pathway_id))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q))
    }
    return list
  }, [skills, filterType, filterPathway, filteredPathways, search])

  const pathwayMap = useMemo(() => new Map(pathways.map(p => [p.id, p.name])), [pathways])
  const seqMap = useMemo(() => new Map(sequences.map(s => [s.id, s])), [sequences])

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between">
        <h3 className="heading-victorian text-xl flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-gold-400" /> เลือกสกิล
        </h3>
        <button onClick={onClose} className="text-victorian-400 hover:text-gold-400"><X className="w-5 h-5" /></button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-victorian-500" />
        <input
          type="text"
          placeholder="ค้นหาสกิล..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-victorian w-full !pl-10"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setFilterPathway('') }}
          className="input-victorian text-sm !py-1.5"
        >
          <option value="">ทุกประเภท</option>
          {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select
          value={filterPathway}
          onChange={e => setFilterPathway(e.target.value)}
          className="input-victorian text-sm !py-1.5"
        >
          <option value="">ทุกเส้นทาง</option>
          {filteredPathways.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
        {filtered.length === 0 && (
          <p className="text-victorian-500 text-center py-6">ไม่พบสกิล</p>
        )}
        {filtered.map(skill => {
          const pw = pathwayMap.get(skill.pathway_id) || '—'
          const sq = seqMap.get(skill.sequence_id)
          return (
            <button
              key={skill.id}
              onClick={() => onSelect(skill)}
              className="w-full text-left p-3 rounded-lg border border-gold-400/10 bg-victorian-900/50 hover:border-gold-400/30 hover:bg-victorian-800/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-gold-200 font-semibold">{skill.name}</span>
                <span className="text-xs text-victorian-400 flex items-center gap-1">
                  <Zap className="w-3 h-3" />{skill.spirit_cost}
                </span>
              </div>
              <div className="text-xs text-victorian-500 mt-1">
                {pw} {sq ? `• ลำดับ ${sq.seq_number}: ${sq.name}` : ''}
              </div>
              {skill.description && (
                <p className="text-xs text-victorian-400 mt-1 line-clamp-2">{skill.description}</p>
              )}
            </button>
          )
        })}
      </div>
    </Modal>
  )
}

/* ═══════════════════════════════════════
   GRANT FORM
   ═══════════════════════════════════════ */
function GrantForm({
  players, skill, initialValues, onClose, onSuccess
}: {
  players: PlayerRow[]
  skill: SkillOption
  initialValues?: GrantFormInitialValues
  onClose: () => void
  onSuccess: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState(initialValues?.title ?? '')
  const [detail, setDetail] = useState(initialValues?.detail ?? '')
  const [imageUrl, setImageUrl] = useState('')
  const [isTransferable, setIsTransferable] = useState(false)
  const [reusePolicy, setReusePolicy] = useState<'once' | 'cooldown' | 'unlimited'>('once')
  const [cooldownValue, setCooldownValue] = useState('60')
  const [cooldownUnit, setCooldownUnit] = useState<'min' | 'hr'>('min')
  const [hasExpiry, setHasExpiry] = useState(false)
  const [expiryDate, setExpiryDate] = useState('')
  const [expiryTime, setExpiryTime] = useState('23:59')

  const [effectHp, setEffectHp] = useState(initialValues?.effectHp ?? 0)
  const [effectSanity, setEffectSanity] = useState(initialValues?.effectSanity ?? 0)
  const [effectMaxSanity, setEffectMaxSanity] = useState(initialValues?.effectMaxSanity ?? 0)
  const [effectTravel, setEffectTravel] = useState(initialValues?.effectTravel ?? 0)
  const [effectMaxTravel, setEffectMaxTravel] = useState(initialValues?.effectMaxTravel ?? 0)
  const [effectSpirituality, setEffectSpirituality] = useState(initialValues?.effectSpirituality ?? 0)
  const [effectMaxSpirituality, setEffectMaxSpirituality] = useState(initialValues?.effectMaxSpirituality ?? 0)
  const [effectPotionDigest, setEffectPotionDigest] = useState(initialValues?.effectPotionDigest ?? 0)

  function handleSubmit() {
    setError(null)
    if (!title.trim()) { setError('กรุณากรอกชื่อ'); return }

    let expiresAt: string | null = null
    if (hasExpiry && expiryDate) {
      expiresAt = new Date(`${expiryDate}T${expiryTime || '23:59'}`).toISOString()
    }

    let cooldownMinutes: number | undefined
    if (reusePolicy === 'cooldown') {
      const val = parseInt(cooldownValue) || 60
      cooldownMinutes = cooldownUnit === 'hr' ? val * 60 : val
    }

    const baseInput = {
      skillId: skill.id,
      title: title.trim(),
      detail: detail.trim() || undefined,
      imageUrl: imageUrl.trim() || null,
      isTransferable,
      reusePolicy,
      cooldownMinutes,
      expiresAt,
      effectHp,
      effectSanity,
      effectMaxSanity,
      effectTravel,
      effectMaxTravel,
      effectSpirituality,
      effectMaxSpirituality,
      effectPotionDigest,
    }

    startTransition(async () => {
      const errors: string[] = []
      for (const p of players) {
        const r = await grantSkillToPlayer({ ...baseInput, playerId: p.id })
        if (r.error) errors.push(`${p.display_name || '?'}: ${r.error}`)
      }
      if (errors.length) setError(errors.join(' | '))
      else onSuccess()
    })
  }

  function EffectInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
    return (
      <div>
        <label className="block text-xs text-victorian-400 mb-1">{label}</label>
        <input
          type="number"
          value={value}
          onChange={e => onChange(parseInt(e.target.value) || 0)}
          className="input-victorian w-full !py-1.5 !text-sm text-center"
        />
      </div>
    )
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between">
        <h3 className="heading-victorian text-xl flex items-center gap-2">
          <Gift className="w-5 h-5 text-gold-400" />
          {players.length > 1 ? `มอบพลัง (${players.length} คน)` : 'มอบพลัง'}
        </h3>
        <button onClick={onClose} className="text-victorian-400 hover:text-gold-400"><X className="w-5 h-5" /></button>
      </div>

      {/* Target info */}
      {players.length === 1 ? (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-victorian-900/50 border border-gold-400/10">
          {players[0].avatar_url ? (
            <img src={players[0].avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-gold-400/20" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-victorian-800 border border-gold-400/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-victorian-500" />
            </div>
          )}
          <div>
            <div className="text-gold-200 font-semibold">{players[0].display_name || 'ไม่ระบุชื่อ'}</div>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg bg-victorian-900/50 border border-gold-400/10 space-y-2">
          <div className="text-xs text-victorian-400 font-semibold uppercase tracking-wider">ผู้รับพลัง {players.length} คน</div>
          <div className="flex flex-wrap gap-2">
            {players.map(p => (
              <div key={p.id} className="flex items-center gap-1.5 bg-victorian-800/60 border border-gold-400/15 rounded-full px-2 py-1">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-victorian-700 flex items-center justify-center">
                    <Users className="w-3 h-3 text-victorian-500" />
                  </div>
                )}
                <span className="text-xs text-gold-200">{p.display_name || 'ไม่ระบุชื่อ'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skill info (full) */}
      <div className="p-4 rounded-lg bg-victorian-800/60 border border-gold-400/15 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold-400" />
            <span className="text-gold-200 font-semibold">{skill.name}</span>
          </div>
          <span className="text-xs text-purple-300 flex items-center gap-1 bg-purple-500/15 px-2 py-0.5 rounded-full border border-purple-500/30">
            <Zap className="w-3 h-3" /> {skill.spirit_cost} พลังวิญญาณ
          </span>
        </div>
        {skill.description && (
          <p className="text-sm text-victorian-300 leading-relaxed">{skill.description}</p>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-300 text-sm">{error}</div>
      )}

      {/* 5.1 Title */}
      <div>
        <label className="block text-sm text-victorian-300 mb-1">ชื่อ (Title) <span className="text-nouveau-ruby">*</span></label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="input-victorian w-full" />
      </div>

      {/* 5.2 Detail */}
      <div>
        <label className="block text-sm text-victorian-300 mb-1">รายละเอียด (Detail)</label>
        <textarea value={detail} onChange={e => setDetail(e.target.value)} className="input-victorian w-full" rows={3} />
      </div>

      {/* 5.2b Image URL */}
      <div>
        <label className="block text-sm text-victorian-300 mb-1">รูปภาพสกิล (Image URL) <span className="text-xs text-victorian-500">ไม่บังคับ</span></label>
        <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." className="input-victorian w-full" />
        {imageUrl.trim() && (
          <div className="mt-2 flex items-center gap-3">
            <img src={imageUrl.trim()} alt="preview" className="w-16 h-16 rounded-lg object-cover border border-gold-400/20" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <span className="text-xs text-victorian-500">Preview</span>
          </div>
        )}
      </div>

      {/* 5.2c Transferable toggle */}
      <div>
        <label className="block text-sm text-victorian-300 mb-2">การส่งมอบ</label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setIsTransferable(false)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all flex items-center gap-1.5 ${
              !isTransferable ? 'border-red-400/50 bg-red-400/10 text-red-300' : 'border-victorian-700 text-victorian-400 hover:border-victorian-500'
            }`}>
            <LockKeyhole className="w-3.5 h-3.5" /> โอนไม่ได้
          </button>
          <button type="button" onClick={() => setIsTransferable(true)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all flex items-center gap-1.5 ${
              isTransferable ? 'border-green-400/50 bg-green-400/10 text-green-300' : 'border-victorian-700 text-victorian-400 hover:border-victorian-500'
            }`}>
            <Repeat className="w-3.5 h-3.5" /> โอนได้
          </button>
        </div>
        <p className="text-xs text-victorian-500 mt-1">{isTransferable ? 'ผู้เล่นสามารถส่งมอบให้ผู้เล่นอื่นได้' : 'ผูกมัดกับผู้เล่นคนนี้ ไม่สามารถส่งมอบได้'}</p>
      </div>

      {/* 5.3 Reuse policy */}
      <div>
        <label className="block text-sm text-victorian-300 mb-2">การใช้ซ้ำ</label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setReusePolicy('once')}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all flex items-center gap-1.5 ${
              reusePolicy === 'once' ? 'border-gold-400/50 bg-gold-400/10 text-gold-300' : 'border-victorian-700 text-victorian-400 hover:border-victorian-500'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" /> ครั้งเดียว
          </button>
          <button
            type="button"
            onClick={() => setReusePolicy('cooldown')}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all flex items-center gap-1.5 ${
              reusePolicy === 'cooldown' ? 'border-gold-400/50 bg-gold-400/10 text-gold-300' : 'border-victorian-700 text-victorian-400 hover:border-victorian-500'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> ใช้ซ้ำได้ (มี Cooldown)
          </button>
          <button
            type="button"
            onClick={() => setReusePolicy('unlimited')}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all flex items-center gap-1.5 ${
              reusePolicy === 'unlimited' ? 'border-gold-400/50 bg-gold-400/10 text-gold-300' : 'border-victorian-700 text-victorian-400 hover:border-victorian-500'
            }`}
          >
            <Infinity className="w-3.5 h-3.5" /> ไม่จำกัด
          </button>
        </div>
        {reusePolicy === 'cooldown' && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-victorian-400">พักตัว</span>
            <input
              type="number"
              min={1}
              value={cooldownValue}
              onChange={e => setCooldownValue(e.target.value)}
              className="input-victorian w-20 !py-1.5 !text-sm text-center"
            />
            <select
              value={cooldownUnit}
              onChange={e => setCooldownUnit(e.target.value as 'min' | 'hr')}
              className="input-victorian !py-1.5 !text-sm"
            >
              <option value="min">นาที</option>
              <option value="hr">ชั่วโมง</option>
            </select>
          </div>
        )}
      </div>

      {/* 5.4 Possession duration */}
      <div>
        <label className="block text-sm text-victorian-300 mb-2">ระยะเวลาครอบครอง</label>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-victorian-400 cursor-pointer">
            <input
              type="checkbox"
              checked={!hasExpiry}
              onChange={e => setHasExpiry(!e.target.checked)}
              className="accent-gold-400"
            />
            ตลอดไป
          </label>
        </div>
        {hasExpiry && (
          <div className="flex items-center gap-2 mt-2">
            <input
              type="date"
              value={expiryDate}
              onChange={e => setExpiryDate(e.target.value)}
              className="input-victorian !py-1.5 !text-sm flex-1"
            />
            <input
              type="time"
              value={expiryTime}
              onChange={e => setExpiryTime(e.target.value)}
              className="input-victorian !py-1.5 !text-sm w-32"
            />
          </div>
        )}
      </div>

      {/* 5.5 Effects */}
      <div>
        <label className="block text-sm text-victorian-300 mb-2">ผลกระทบเมื่อใช้งาน <span className="text-xs text-victorian-500">(+ เพิ่ม, - ลด)</span></label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <EffectInput label="HP" value={effectHp} onChange={setEffectHp} />
          <EffectInput label="Sanity" value={effectSanity} onChange={setEffectSanity} />
          <EffectInput label="Max Sanity" value={effectMaxSanity} onChange={setEffectMaxSanity} />
          <EffectInput label="Travel" value={effectTravel} onChange={setEffectTravel} />
          <EffectInput label="Max Travel" value={effectMaxTravel} onChange={setEffectMaxTravel} />
          <EffectInput label="Spirituality" value={effectSpirituality} onChange={setEffectSpirituality} />
          <EffectInput label="Max Spirit" value={effectMaxSpirituality} onChange={setEffectMaxSpirituality} />
          <EffectInput label="Potion Digest" value={effectPotionDigest} onChange={setEffectPotionDigest} />
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-victorian px-5 py-2 text-sm">ยกเลิก</button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="btn-gold px-6 py-2 text-sm flex items-center gap-2"
        >
          <Gift className="w-4 h-4" />
          {isPending ? 'กำลังมอบ...' : players.length > 1 ? `ยืนยันมอบ (${players.length} คน)` : 'ยืนยันมอบพลัง'}
        </button>
      </div>
    </Modal>
  )
}

/* ... */

/* ═══════════════════════════════════════
   EDIT GRANT FORM
   ═══════════════════════════════════════ */
interface GrantedSkillRow {
  id: string
  title: string
  detail: string | null
  image_url: string | null
  reuse_policy: 'once' | 'cooldown' | 'unlimited'
  cooldown_minutes: number | null
  expires_at: string | null
  is_transferable: boolean
  is_active: boolean
  times_used: number
  effect_hp: number
  effect_sanity: number
  effect_max_sanity: number
  effect_travel: number
  effect_max_travel: number
  effect_spirituality: number
  effect_max_spirituality: number
  effect_potion_digest: number
  skills: { id: string; name: string; spirit_cost: number } | null
}

function EditGrantForm({
  gs, onClose, onSuccess
}: {
  gs: GrantedSkillRow
  onClose: () => void
  onSuccess: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState(gs.title)
  const [detail, setDetail] = useState(gs.detail || '')
  const [imageUrl, setImageUrl] = useState(gs.image_url || '')
  const [isTransferable, setIsTransferable] = useState(gs.is_transferable)
  const [reusePolicy, setReusePolicy] = useState<'once' | 'cooldown' | 'unlimited'>(gs.reuse_policy)
  const [cooldownValue, setCooldownValue] = useState(
    gs.cooldown_minutes ? (gs.cooldown_minutes >= 60 ? String(gs.cooldown_minutes / 60) : String(gs.cooldown_minutes)) : '60'
  )
  const [cooldownUnit, setCooldownUnit] = useState<'min' | 'hr'>(gs.cooldown_minutes && gs.cooldown_minutes >= 60 ? 'hr' : 'min')
  const [hasExpiry, setHasExpiry] = useState(!!gs.expires_at)
  const [expiryDate, setExpiryDate] = useState(gs.expires_at ? gs.expires_at.slice(0, 10) : '')
  const [expiryTime, setExpiryTime] = useState(gs.expires_at ? gs.expires_at.slice(11, 16) : '23:59')
  const [isActive, setIsActive] = useState(gs.is_active)

  const [effectHp, setEffectHp] = useState(gs.effect_hp)
  const [effectSanity, setEffectSanity] = useState(gs.effect_sanity)
  const [effectMaxSanity, setEffectMaxSanity] = useState(gs.effect_max_sanity)
  const [effectTravel, setEffectTravel] = useState(gs.effect_travel)
  const [effectMaxTravel, setEffectMaxTravel] = useState(gs.effect_max_travel)
  const [effectSpirituality, setEffectSpirituality] = useState(gs.effect_spirituality)
  const [effectMaxSpirituality, setEffectMaxSpirituality] = useState(gs.effect_max_spirituality)
  const [effectPotionDigest, setEffectPotionDigest] = useState(gs.effect_potion_digest)

  function handleSubmit() {
    setError(null)
    if (!title.trim()) { setError('กรุณากรอกชื่อ'); return }

    let expiresAt: string | null = null
    if (hasExpiry && expiryDate) {
      expiresAt = new Date(`${expiryDate}T${expiryTime || '23:59'}`).toISOString()
    }
    let cooldownMinutes: number | null = null
    if (reusePolicy === 'cooldown') {
      const val = parseInt(cooldownValue) || 60
      cooldownMinutes = cooldownUnit === 'hr' ? val * 60 : val
    }

    const input: UpdateGrantSkillInput = {
      grantedSkillId: gs.id,
      title: title.trim(),
      detail: detail.trim() || null,
      imageUrl: imageUrl.trim() || null,
      isTransferable,
      reusePolicy,
      cooldownMinutes,
      expiresAt,
      effectHp,
      effectSanity,
      effectMaxSanity,
      effectTravel,
      effectMaxTravel,
      effectSpirituality,
      effectMaxSpirituality,
      effectPotionDigest,
      isActive,
    }
    startTransition(async () => {
      const r = await updateGrantedSkill(input)
      if (r.error) setError(r.error)
      else onSuccess()
    })
  }

  function EffectInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
    return (
      <div>
        <label className="block text-xs text-victorian-400 mb-1">{label}</label>
        <input type="number" value={value} onChange={e => onChange(parseInt(e.target.value) || 0)} className="input-victorian w-full !py-1.5 !text-sm text-center" />
      </div>
    )
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between">
        <h3 className="heading-victorian text-xl flex items-center gap-2">
          <Pencil className="w-5 h-5 text-gold-400" /> แก้ไขพลังที่มอบ
        </h3>
        <button onClick={onClose} className="text-victorian-400 hover:text-gold-400"><X className="w-5 h-5" /></button>
      </div>

      {/* Skill reference */}
      {gs.skills && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-victorian-900/50 border border-gold-400/10">
          <Sparkles className="w-4 h-4 text-gold-400 flex-shrink-0" />
          <span className="text-gold-200 text-sm font-medium">{gs.skills.name}</span>
          <span className="ml-auto text-xs text-purple-300 flex items-center gap-1 bg-purple-500/15 px-2 py-0.5 rounded-full border border-purple-500/30">
            <Zap className="w-3 h-3" /> {gs.skills.spirit_cost}
          </span>
        </div>
      )}

      {error && <div className="p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-300 text-sm">{error}</div>}

      {/* Active toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => setIsActive(v => !v)}
          className={`w-10 h-5 rounded-full transition-colors relative ${isActive ? 'bg-green-500' : 'bg-victorian-700'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${isActive ? 'left-5' : 'left-0.5'}`} />
        </div>
        <span className="text-sm text-victorian-300">{isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span>
      </label>

      <div>
        <label className="block text-sm text-victorian-300 mb-1">ชื่อ <span className="text-nouveau-ruby">*</span></label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="input-victorian w-full" />
      </div>

      <div>
        <label className="block text-sm text-victorian-300 mb-1">รายละเอียด</label>
        <textarea value={detail} onChange={e => setDetail(e.target.value)} className="input-victorian w-full" rows={3} />
      </div>

      <div>
        <label className="block text-sm text-victorian-300 mb-1">รูปภาพสกิล (Image URL)</label>
        <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." className="input-victorian w-full" />
        {imageUrl.trim() && (
          <div className="mt-2 flex items-center gap-3">
            <img src={imageUrl.trim()} alt="preview" className="w-16 h-16 rounded-lg object-cover border border-gold-400/20" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <span className="text-xs text-victorian-500">Preview</span>
          </div>
        )}
      </div>

      {/* Transferable toggle */}
      <div>
        <label className="block text-sm text-victorian-300 mb-2">การส่งมอบ</label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setIsTransferable(false)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all flex items-center gap-1.5 ${
              !isTransferable ? 'border-red-400/50 bg-red-400/10 text-red-300' : 'border-victorian-700 text-victorian-400 hover:border-victorian-500'
            }`}>
            <LockKeyhole className="w-3.5 h-3.5" /> โอนไม่ได้
          </button>
          <button type="button" onClick={() => setIsTransferable(true)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all flex items-center gap-1.5 ${
              isTransferable ? 'border-green-400/50 bg-green-400/10 text-green-300' : 'border-victorian-700 text-victorian-400 hover:border-victorian-500'
            }`}>
            <Repeat className="w-3.5 h-3.5" /> โอนได้
          </button>
        </div>
        <p className="text-xs text-victorian-500 mt-1">{isTransferable ? 'ผู้เล่นสามารถส่งมอบให้ผู้เล่นอื่นได้' : 'ผูกมัดกับผู้เล่นคนนี้'}</p>
      </div>

      {/* Reuse policy */}
      <div>
        <label className="block text-sm text-victorian-300 mb-2">การใช้ซ้ำ</label>
        <div className="flex flex-wrap gap-2">
          {(['once', 'cooldown', 'unlimited'] as const).map(p => (
            <button key={p} type="button" onClick={() => setReusePolicy(p)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-all flex items-center gap-1.5 ${
                reusePolicy === p ? 'border-gold-400/50 bg-gold-400/10 text-gold-300' : 'border-victorian-700 text-victorian-400 hover:border-victorian-500'
              }`}>
              {p === 'once' ? <><CheckCircle className="w-3.5 h-3.5" /> ครั้งเดียว</> :
               p === 'cooldown' ? <><Clock className="w-3.5 h-3.5" /> Cooldown</> :
               <><Infinity className="w-3.5 h-3.5" /> ไม่จำกัด</>}
            </button>
          ))}
        </div>
        {reusePolicy === 'cooldown' && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-victorian-400">พักตัว</span>
            <input type="number" min={1} value={cooldownValue} onChange={e => setCooldownValue(e.target.value)} className="input-victorian w-20 !py-1.5 !text-sm text-center" />
            <select value={cooldownUnit} onChange={e => setCooldownUnit(e.target.value as 'min' | 'hr')} className="input-victorian !py-1.5 !text-sm">
              <option value="min">นาที</option>
              <option value="hr">ชั่วโมง</option>
            </select>
          </div>
        )}
      </div>

      {/* Expiry */}
      <div>
        <label className="block text-sm text-victorian-300 mb-2">ระยะเวลาครอบครอง</label>
        <label className="flex items-center gap-2 text-sm text-victorian-400 cursor-pointer">
          <input type="checkbox" checked={!hasExpiry} onChange={e => setHasExpiry(!e.target.checked)} className="accent-gold-400" />
          ตลอดไป
        </label>
        {hasExpiry && (
          <div className="flex items-center gap-2 mt-2">
            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="input-victorian !py-1.5 !text-sm flex-1" />
            <input type="time" value={expiryTime} onChange={e => setExpiryTime(e.target.value)} className="input-victorian !py-1.5 !text-sm w-32" />
          </div>
        )}
      </div>

      {/* Effects */}
      <div>
        <label className="block text-sm text-victorian-300 mb-2">ผลกระทบ <span className="text-xs text-victorian-500">(+ เพิ่ม, - ลด)</span></label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <EffectInput label="HP" value={effectHp} onChange={setEffectHp} />
          <EffectInput label="Sanity" value={effectSanity} onChange={setEffectSanity} />
          <EffectInput label="Max Sanity" value={effectMaxSanity} onChange={setEffectMaxSanity} />
          <EffectInput label="Travel" value={effectTravel} onChange={setEffectTravel} />
          <EffectInput label="Max Travel" value={effectMaxTravel} onChange={setEffectMaxTravel} />
          <EffectInput label="Spirituality" value={effectSpirituality} onChange={setEffectSpirituality} />
          <EffectInput label="Max Spirit" value={effectMaxSpirituality} onChange={setEffectMaxSpirituality} />
          <EffectInput label="Potion Digest" value={effectPotionDigest} onChange={setEffectPotionDigest} />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-victorian px-5 py-2 text-sm">ยกเลิก</button>
        <button type="button" onClick={handleSubmit} disabled={isPending} className="btn-gold px-6 py-2 text-sm flex items-center gap-2">
          <Pencil className="w-4 h-4" />
          {isPending ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
        </button>
      </div>
    </Modal>
  )
}

/* ═══════════════════════
   MAIN COMPONENT
   ═══════════════════════ */
export default function GrantSkillsContent({ userId }: { userId: string }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'players' | 'logs' | 'manage'>('players')

  // Players data
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [playerSearch, setPlayerSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Skill data (for selector)
  const [skillData, setSkillData] = useState<{
    types: { id: string; name: string }[]
    pathways: { id: string; type_id: string; name: string }[]
    sequences: { id: string; pathway_id: string; seq_number: number; name: string }[]
    skills: SkillOption[]
  } | null>(null)

  // Grant flow
  const [grantingPlayers, setGrantingPlayers] = useState<PlayerRow[]>([])
  const [showSkillSelector, setShowSkillSelector] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<SkillOption | null>(null)
  const [grantInitialValues, setGrantInitialValues] = useState<GrantFormInitialValues | undefined>(undefined)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Multi-select (players tab)
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set())

  // Repeat from history
  const [repeatLog, setRepeatLog] = useState<LogEntry | null>(null)
  const [repeatPlayerIds, setRepeatPlayerIds] = useState<Set<string>>(new Set())
  const [showRepeatPlayerSelect, setShowRepeatPlayerSelect] = useState(false)

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logPage, setLogPage] = useState(1)
  const [logTotalPages, setLogTotalPages] = useState(1)
  const [logSearch, setLogSearch] = useState('')
  const [logLoading, setLogLoading] = useState(false)

  // Manage tab
  const [managePlayer, setManagePlayer] = useState<PlayerRow | null>(null)
  const [manageGrants, setManageGrants] = useState<GrantedSkillRow[]>([])
  const [manageLoading, setManageLoading] = useState(false)
  const [editingGrant, setEditingGrant] = useState<GrantedSkillRow | null>(null)
  const [deletingGrantId, setDeletingGrantId] = useState<string | null>(null)
  const [manageMsg, setManageMsg] = useState<string | null>(null)
  const [isPendingDelete, startDeleteTransition] = useTransition()

  // Fetch players
  useEffect(() => {
    setLoading(true)
    getPlayersForGrantSkill().then(r => {
      if (r.players) setPlayers(r.players as PlayerRow[])
      setLoading(false)
    })
  }, [])

  // Fetch skills when needed
  function ensureSkillData() {
    if (skillData) return Promise.resolve(skillData)
    return getAllSkillsGrouped().then(r => {
      const data = { types: r.types, pathways: r.pathways, sequences: r.sequences, skills: r.skills as SkillOption[] }
      setSkillData(data)
      return data
    })
  }

  // Fetch logs
  function fetchLogs(page: number, search?: string) {
    setLogLoading(true)
    getGrantSkillLogs(page, search).then(r => {
      setLogs((r.logs || []) as LogEntry[])
      setLogPage(r.page || 1)
      setLogTotalPages(r.totalPages || 1)
      setLogLoading(false)
    })
  }

  useEffect(() => {
    if (activeTab === 'logs') fetchLogs(1, logSearch)
  }, [activeTab])

  // Player search filter
  const filteredPlayers = useMemo(() => {
    if (!playerSearch.trim()) return players
    const q = playerSearch.toLowerCase()
    return players.filter(p =>
      p.display_name?.toLowerCase().includes(q) ||
      p.pathways.some(pw => pw.pathwayName.toLowerCase().includes(q))
    )
  }, [players, playerSearch])

  // Start grant flow for a single player
  function handleGrantClick(player: PlayerRow) {
    setGrantingPlayers([player])
    setSelectedSkill(null)
    setGrantInitialValues(undefined)
    setSuccessMsg(null)
    ensureSkillData().then(() => setShowSkillSelector(true))
  }

  // Start grant flow for all currently selected players
  function handleBatchGrantClick() {
    const selected = players.filter(p => selectedPlayerIds.has(p.id))
    if (selected.length === 0) return
    setGrantingPlayers(selected)
    setSelectedSkill(null)
    setGrantInitialValues(undefined)
    setSuccessMsg(null)
    ensureSkillData().then(() => setShowSkillSelector(true))
  }

  function handleSkillSelected(skill: SkillOption) {
    setSelectedSkill(skill)
    setShowSkillSelector(false)
  }

  function handleGrantSuccess() {
    setSelectedSkill(null)
    setGrantingPlayers([])
    setGrantInitialValues(undefined)
    setSelectedPlayerIds(new Set())
    setRepeatLog(null)
    setSuccessMsg('มอบพลังสำเร็จ!')
    setTimeout(() => setSuccessMsg(null), 3000)
    if (activeTab === 'logs') fetchLogs(1, logSearch)
  }

  // Open repeat player-select for a log entry
  function handleRepeatClick(log: LogEntry) {
    setRepeatLog(log)
    setRepeatPlayerIds(new Set())
    setShowRepeatPlayerSelect(true)
    ensureSkillData()
  }

  // Confirm player selection for repeat → open GrantForm pre-filled
  function handleRepeatConfirm() {
    if (!repeatLog || repeatPlayerIds.size === 0) return
    const selected = players.filter(p => repeatPlayerIds.has(p.id))
    const skill = skillData?.skills.find(s => s.id === repeatLog.skill_id)
    if (!skill) {
      setShowRepeatPlayerSelect(false)
      setSuccessMsg('ไม่พบสกิลต้นฉบับในระบบ')
      setTimeout(() => setSuccessMsg(null), 3000)
      return
    }
    const fx = repeatLog.effects_json || {}
    setGrantInitialValues({
      title: repeatLog.title,
      detail: repeatLog.detail || '',
      effectHp: fx.effect_hp || 0,
      effectSanity: fx.effect_sanity || 0,
      effectMaxSanity: fx.effect_max_sanity || 0,
      effectTravel: fx.effect_travel || 0,
      effectMaxTravel: fx.effect_max_travel || 0,
      effectSpirituality: fx.effect_spirituality || 0,
      effectMaxSpirituality: fx.effect_max_spirituality || 0,
      effectPotionDigest: fx.effect_potion_digest || 0,
    })
    setGrantingPlayers(selected)
    setSelectedSkill(skill)
    setShowRepeatPlayerSelect(false)
  }

  function handleManagePlayer(player: PlayerRow) {
    setManagePlayer(player)
    setManageGrants([])
    setManageMsg(null)
    setManageLoading(true)
    getGrantedSkillsForPlayer(player.id).then(r => {
      setManageGrants((r.skills || []) as GrantedSkillRow[])
      setManageLoading(false)
    })
  }

  function handleEditSuccess() {
    setEditingGrant(null)
    setManageMsg('บันทึกสำเร็จ!')
    setTimeout(() => setManageMsg(null), 3000)
    if (managePlayer) handleManagePlayer(managePlayer)
  }

  function handleDeleteConfirm(grantId: string) {
    startDeleteTransition(async () => {
      const r = await deleteGrantedSkill(grantId)
      setDeletingGrantId(null)
      if (r.error) setManageMsg(`เกิดข้อผิดพลาด: ${r.error}`)
      else {
        setManageMsg('ลบสำเร็จ!')
        setTimeout(() => setManageMsg(null), 3000)
        if (managePlayer) handleManagePlayer(managePlayer)
      }
    })
  }

  return (
    <div className="min-h-screen bg-victorian-950 text-victorian-100">
      <div className="fixed inset-0 opacity-5" style={{
        backgroundImage: `radial-gradient(circle at 25% 25%, #D4AF37 1px, transparent 1px),
                          radial-gradient(circle at 75% 75%, #D4AF37 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      <div className="relative z-10 max-w-6xl mx-auto p-6 md:p-10 space-y-6">
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
              <h1 className="heading-victorian text-4xl">มอบพลัง</h1>
              <p className="text-victorian-400 text-sm mt-1">มอบสกิลพิเศษให้ผู้เล่นโดยไม่สนเงื่อนไข</p>
            </div>
          </div>
        </div>

        <div className="ornament-divider" />

        {/* Success toast */}
        {successMsg && (
          <div className="p-4 bg-green-900/40 border-2 border-green-500/40 rounded-xl text-green-300 text-center font-semibold animate-pulse">
            ✨ {successMsg}
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('players')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'players'
                ? 'bg-gold-400/15 text-gold-300 border border-gold-400/30'
                : 'text-victorian-400 border border-victorian-700 hover:border-victorian-500'
            }`}
          >
            <Users className="w-4 h-4" /> ผู้เล่น
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'bg-gold-400/15 text-gold-300 border border-gold-400/30'
                : 'text-victorian-400 border border-victorian-700 hover:border-victorian-500'
            }`}
          >
            <ScrollText className="w-4 h-4" /> ประวัติ
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'manage'
                ? 'bg-gold-400/15 text-gold-300 border border-gold-400/30'
                : 'text-victorian-400 border border-victorian-700 hover:border-victorian-500'
            }`}
          >
            <Settings className="w-4 h-4" /> จัดการ
          </button>
        </div>

        {/* ═══ Players Tab ═══ */}
        {activeTab === 'players' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-victorian-500" />
                <input
                  type="text"
                  placeholder="ค้นหาผู้เล่น..."
                  value={playerSearch}
                  onChange={e => { setPlayerSearch(e.target.value); setSelectedPlayerIds(new Set()) }}
                  className="input-victorian w-full !pl-10"
                />
              </div>
            </div>

            {/* Batch action bar */}
            {selectedPlayerIds.size > 0 && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-gold-400/10 border border-gold-400/30">
                <span className="text-gold-300 text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4" /> เลือกแล้ว {selectedPlayerIds.size} คน
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedPlayerIds(new Set())}
                    className="px-3 py-1.5 rounded-lg text-xs border border-victorian-600 text-victorian-400 hover:border-victorian-500"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleBatchGrantClick}
                    className="btn-gold px-4 py-1.5 text-xs flex items-center gap-1.5"
                  >
                    <Gift className="w-3.5 h-3.5" /> มอบพลัง ({selectedPlayerIds.size} คน)
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 rounded-lg bg-victorian-900/50 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-gold-400/10 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-victorian-900/80 text-victorian-400 text-xs uppercase tracking-wider">
                        <th className="px-3 py-3 text-center w-10">
                          <input
                            type="checkbox"
                            className="accent-gold-400 cursor-pointer"
                            checked={filteredPlayers.length > 0 && filteredPlayers.every(p => selectedPlayerIds.has(p.id))}
                            onChange={e => {
                              if (e.target.checked) setSelectedPlayerIds(new Set(filteredPlayers.map(p => p.id)))
                              else setSelectedPlayerIds(new Set())
                            }}
                          />
                        </th>
                        <th className="px-4 py-3 text-left">ผู้เล่น</th>
                        <th className="px-4 py-3 text-left hidden md:table-cell">เส้นทาง</th>
                        <th className="px-4 py-3 text-left hidden md:table-cell">ลำดับ</th>
                        <th className="px-4 py-3 text-center w-32">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gold-400/5">
                      {filteredPlayers.map(player => {
                        const isChecked = selectedPlayerIds.has(player.id)
                        return (
                          <tr
                            key={player.id}
                            className={`transition-colors cursor-pointer ${isChecked ? 'bg-gold-400/5' : 'hover:bg-victorian-900/40'}`}
                            onClick={() => {
                              setSelectedPlayerIds(prev => {
                                const next = new Set(prev)
                                isChecked ? next.delete(player.id) : next.add(player.id)
                                return next
                              })
                            }}
                          >
                            <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="accent-gold-400 cursor-pointer"
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedPlayerIds(prev => {
                                    const next = new Set(prev)
                                    isChecked ? next.delete(player.id) : next.add(player.id)
                                    return next
                                  })
                                }}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {player.avatar_url ? (
                                  <img src={player.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-gold-400/20" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-victorian-800 border border-gold-400/20 flex items-center justify-center">
                                    <Users className="w-4 h-4 text-victorian-500" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <RoleIcon role={player.role} />
                                    <span className="text-gold-200 font-medium truncate">{player.display_name || 'ไม่ระบุชื่อ'}</span>
                                  </div>
                                  {/* Mobile: show pathway inline */}
                                  <div className="md:hidden text-xs text-victorian-500 mt-0.5">
                                    {player.pathways.length > 0
                                      ? player.pathways.map(pw => `${pw.pathwayName} (ลำดับ ${pw.seqNumber})`).join(', ')
                                      : 'ยังไม่มีเส้นทาง'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell text-victorian-300">
                              {player.pathways.length > 0
                                ? player.pathways.map(pw => pw.pathwayName).join(', ')
                                : <span className="text-victorian-600">—</span>}
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell text-victorian-300">
                              {player.pathways.length > 0
                                ? player.pathways.map(pw => `${pw.seqNumber}: ${pw.seqName}`).join(', ')
                                : <span className="text-victorian-600">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => handleGrantClick(player)}
                                className="btn-gold px-3 py-1.5 text-xs flex items-center gap-1.5 mx-auto"
                              >
                                <Gift className="w-3.5 h-3.5" /> มอบพลัง
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {filteredPlayers.length === 0 && (
                  <div className="p-8 text-center text-victorian-500">ไม่พบผู้เล่น</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ Logs Tab ═══ */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-victorian-500" />
              <input
                type="text"
                placeholder="ค้นหาประวัติ..."
                value={logSearch}
                onChange={e => setLogSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') fetchLogs(1, logSearch) }}
                className="input-victorian w-full !pl-10"
              />
            </div>

            {logLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 rounded bg-victorian-900/50 animate-pulse" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-victorian-500 border border-gold-400/10 rounded-xl">ยังไม่มีประวัติ</div>
            ) : (
              <div className="space-y-3">
                {/* Desktop table */}
                <div className="hidden md:block rounded-xl border border-gold-400/10 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-victorian-900/80 text-victorian-400 text-xs uppercase tracking-wider">
                        <th className="px-4 py-2.5 text-left">วันที่</th>
                        <th className="px-4 py-2.5 text-left">ผู้เล่น</th>
                        <th className="px-4 py-2.5 text-left">ประเภท</th>
                        <th className="px-4 py-2.5 text-left">ชื่อ / สกิล</th>
                        <th className="px-4 py-2.5 text-left">โดย</th>
                        <th className="px-4 py-2.5 text-left">หมายเหตุ / โค้ด</th>
                        <th className="px-4 py-2.5 text-center w-20">ทำซ้ำ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gold-400/5">
                      {logs.map(log => (
                        <tr key={log.id} className="hover:bg-victorian-900/40 transition-colors">
                          <td className="px-4 py-2.5 text-victorian-500 text-xs whitespace-nowrap">{fmtDate(log.created_at)}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              {log.player_avatar ? (
                                <img src={log.player_avatar} alt="" className="w-6 h-6 rounded-full object-cover border border-gold-400/20 flex-shrink-0" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-victorian-800 border border-gold-400/20 flex items-center justify-center flex-shrink-0">
                                  <Users className="w-3 h-3 text-victorian-500" />
                                </div>
                              )}
                              <span className="text-victorian-200 text-xs">{log.player_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${
                              log.action === 'grant' ? 'bg-blue-500/20 text-blue-300' :
                              log.action === 'use' ? 'bg-green-500/20 text-green-300' :
                              log.action === 'revoke' ? 'bg-red-500/20 text-red-300' :
                              'bg-victorian-700/50 text-victorian-400'
                            }`}>
                              {log.action === 'grant' ? 'มอบพลัง' : log.action === 'use' ? 'ใช้งาน' : log.action === 'revoke' ? 'เพิกถอน' : log.action}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="text-gold-300 font-medium text-xs">{log.title}</div>
                            <div className="text-victorian-500 text-xs">{log.skill_name}</div>
                          </td>
                          <td className="px-4 py-2.5 text-victorian-400 text-xs">{log.granter_name}</td>
                          <td className="px-4 py-2.5 max-w-[200px]">
                            {log.note && <p className="text-victorian-400 text-xs truncate">{log.note}</p>}
                            {log.reference_code && <p className="text-victorian-600 text-xs font-mono truncate">{log.reference_code}</p>}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {log.action === 'grant' && (
                              <button
                                onClick={() => handleRepeatClick(log)}
                                className="px-2 py-1 text-xs rounded-lg border border-gold-400/25 text-gold-400 hover:bg-gold-400/10 transition-colors flex items-center gap-1 mx-auto"
                                title="ทำซ้ำการมอบพลังนี้"
                              >
                                <Repeat className="w-3 h-3" /> ทำซ้ำ
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: simple rows */}
                <div className="md:hidden space-y-2">
                  {logs.map(log => (
                    <div key={log.id} className="border border-gold-400/10 rounded-lg p-3 space-y-1 bg-victorian-900/30">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${
                            log.action === 'grant' ? 'bg-blue-500/20 text-blue-300' :
                            log.action === 'use' ? 'bg-green-500/20 text-green-300' :
                            log.action === 'revoke' ? 'bg-red-500/20 text-red-300' :
                            'bg-victorian-700/50 text-victorian-400'
                          }`}>
                            {log.action === 'grant' ? 'มอบ' : log.action === 'use' ? 'ใช้' : log.action === 'revoke' ? 'เพิก' : log.action}
                          </span>
                          <span className="text-gold-300 text-xs font-medium truncate">{log.title}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {log.action === 'grant' && (
                            <button
                              onClick={() => handleRepeatClick(log)}
                              className="px-2 py-0.5 text-xs rounded border border-gold-400/25 text-gold-400 hover:bg-gold-400/10 transition-colors flex items-center gap-1"
                            >
                              <Repeat className="w-3 h-3" /> ซ้ำ
                            </button>
                          )}
                          <span className="text-victorian-600 text-xs">{fmtDate(log.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-victorian-400">
                        <span>{log.player_name}</span>
                        <span className="text-victorian-600">•</span>
                        <span className="text-victorian-500">{log.skill_name}</span>
                      </div>
                      {log.note && <p className="text-xs text-victorian-500 truncate">{log.note}</p>}
                      {log.reference_code && <p className="text-xs text-victorian-600 font-mono truncate">{log.reference_code}</p>}
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {logTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={() => fetchLogs(logPage - 1, logSearch)}
                      disabled={logPage <= 1}
                      className="btn-victorian px-3 py-1.5 text-sm disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-victorian-400 text-sm">{logPage} / {logTotalPages}</span>
                    <button
                      onClick={() => fetchLogs(logPage + 1, logSearch)}
                      disabled={logPage >= logTotalPages}
                      className="btn-victorian px-3 py-1.5 text-sm disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {/* ═══ Manage Tab ═══ */}
        {activeTab === 'manage' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Left: player list */}
            <div className="space-y-2">
              <p className="text-xs text-victorian-500 uppercase tracking-wider font-semibold">เลือกผู้เล่น</p>
              {loading ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded bg-victorian-900/50 animate-pulse" />)}</div>
              ) : (
                <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
                  {players.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleManagePlayer(p)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all ${
                        managePlayer?.id === p.id
                          ? 'bg-gold-400/15 border border-gold-400/30 text-gold-300'
                          : 'border border-victorian-800 text-victorian-300 hover:border-victorian-600 hover:bg-victorian-900/50'
                      }`}
                    >
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-victorian-800 flex items-center justify-center flex-shrink-0">
                          <Users className="w-3 h-3 text-victorian-500" />
                        </div>
                      )}
                      <span className="truncate">{p.display_name || 'ไม่ระบุชื่อ'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: granted skills for selected player */}
            <div className="md:col-span-2 space-y-3">
              {!managePlayer ? (
                <div className="p-8 text-center text-victorian-500 border border-gold-400/10 rounded-xl">เลือกผู้เล่นเพื่อดูพลังที่มอบให้</div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-victorian-300 font-semibold">
                      พลังที่มอบให้ <span className="text-gold-300">{managePlayer.display_name}</span>
                    </p>
                    {manageMsg && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${manageMsg.startsWith('เกิด') ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
                        {manageMsg}
                      </span>
                    )}
                  </div>

                  {manageLoading ? (
                    <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded bg-victorian-900/50 animate-pulse" />)}</div>
                  ) : manageGrants.length === 0 ? (
                    <div className="p-6 text-center text-victorian-500 border border-gold-400/10 rounded-xl text-sm">ยังไม่มีพลังที่มอบให้ผู้เล่นนี้</div>
                  ) : (
                    <div className="space-y-2">
                      {manageGrants.map(gs => (
                        <div key={gs.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${gs.is_active ? 'border-gold-400/15 bg-victorian-900/40' : 'border-victorian-800/50 bg-victorian-900/20 opacity-60'}`}>
                          {/* Image */}
                          {gs.image_url ? (
                            <img src={gs.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-gold-400/20 flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-victorian-800 border border-gold-400/10 flex items-center justify-center flex-shrink-0">
                              <Gift className="w-5 h-5 text-victorian-600" />
                            </div>
                          )}

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gold-200 truncate">{gs.title}</span>
                              {!gs.is_active && <span className="text-xs text-victorian-500 bg-victorian-800 px-1.5 py-0.5 rounded flex-shrink-0">ปิด</span>}
                            </div>
                            <div className="text-xs text-victorian-500 truncate">{gs.skills?.name || '—'} · ใช้แล้ว {gs.times_used} ครั้ง</div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => setEditingGrant(gs)}
                              className="p-1.5 rounded-lg border border-gold-400/20 text-gold-400 hover:bg-gold-400/10 transition-colors"
                              title="แก้ไข"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingGrantId(gs.id)}
                              className="p-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                              title="ลบ"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ Modals ═══ */}

      {/* Skill Selector Modal */}
      {showSkillSelector && skillData && grantingPlayers.length > 0 && (
        <SkillSelector
          types={skillData.types}
          pathways={skillData.pathways}
          sequences={skillData.sequences}
          skills={skillData.skills}
          onSelect={handleSkillSelected}
          onClose={() => { setShowSkillSelector(false); setGrantingPlayers([]) }}
        />
      )}

      {/* Grant Form Modal */}
      {selectedSkill && grantingPlayers.length > 0 && (
        <GrantForm
          players={grantingPlayers}
          skill={selectedSkill}
          initialValues={grantInitialValues}
          onClose={() => { setSelectedSkill(null); setGrantingPlayers([]); setGrantInitialValues(undefined) }}
          onSuccess={handleGrantSuccess}
        />
      )}

      {/* Repeat: Player Select Modal */}
      {showRepeatPlayerSelect && repeatLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
          onClick={() => setShowRepeatPlayerSelect(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border-2 border-gold-400/15 p-6 space-y-4 max-h-[80vh] flex flex-col"
            style={{ backgroundColor: '#1A1612' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="heading-victorian text-lg flex items-center gap-2">
                <Repeat className="w-5 h-5 text-gold-400" /> ทำซ้ำ — เลือกผู้รับ
              </h3>
              <button onClick={() => setShowRepeatPlayerSelect(false)} className="text-victorian-400 hover:text-gold-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Source info */}
            <div className="p-3 rounded-lg bg-victorian-900/50 border border-gold-400/10 text-sm space-y-0.5">
              <div className="text-gold-200 font-semibold">{repeatLog.title}</div>
              <div className="text-victorian-500 text-xs">{repeatLog.skill_name}</div>
            </div>

            {/* Player checklist */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {players.filter(p => p.role === 'player' || p.role === 'dm').map(p => {
                const sel = repeatPlayerIds.has(p.id)
                return (
                  <label
                    key={p.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all border ${
                      sel ? 'border-gold-400/30 bg-gold-400/8' : 'border-victorian-800 hover:border-victorian-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-gold-400"
                      checked={sel}
                      onChange={() => {
                        setRepeatPlayerIds(prev => {
                          const next = new Set(prev)
                          sel ? next.delete(p.id) : next.add(p.id)
                          return next
                        })
                      }}
                    />
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-victorian-800 flex items-center justify-center flex-shrink-0">
                        <Users className="w-4 h-4 text-victorian-500" />
                      </div>
                    )}
                    <span className="text-sm text-victorian-200">{p.display_name || 'ไม่ระบุชื่อ'}</span>
                  </label>
                )
              })}
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setShowRepeatPlayerSelect(false)} className="btn-victorian px-4 py-2 text-sm">
                ยกเลิก
              </button>
              <button
                onClick={handleRepeatConfirm}
                disabled={repeatPlayerIds.size === 0}
                className="btn-gold px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-40"
              >
                <Gift className="w-4 h-4" />
                {repeatPlayerIds.size > 0 ? `ดำเนินการ (${repeatPlayerIds.size} คน)` : 'เลือกผู้รับก่อน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Grant Modal */}
      {editingGrant && (
        <EditGrantForm
          gs={editingGrant}
          onClose={() => setEditingGrant(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Delete Confirm Modal */}
      {deletingGrantId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => setDeletingGrantId(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border-2 border-red-500/30 p-6 space-y-4"
            style={{ backgroundColor: '#1A1612' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <Trash2 className="w-6 h-6 text-red-400 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-red-300">ยืนยันการลบ</h3>
            </div>
            <p className="text-victorian-300 text-sm">ต้องการลบพลังที่มอบนี้ออกจากระบบ? การกระทำนี้ไม่สามารถย้อนกลับได้</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingGrantId(null)}
                className="btn-victorian px-4 py-2 text-sm"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => handleDeleteConfirm(deletingGrantId)}
                disabled={isPendingDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {isPendingDelete ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
