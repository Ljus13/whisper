'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import {
  ArrowLeft, Moon, ScrollText, Swords, Target, Shield, Plus, Copy,
  Check, X, ExternalLink, ChevronLeft, ChevronRight, Clock, CheckCircle,
  XCircle, Send, AlertTriangle, Trash2, Eye, Church
} from 'lucide-react'
import {
  submitSleepRequest, getTodaySleepStatus,
  approveSleepRequest, rejectSleepRequest,
  autoApproveExpiredRequests,
  generateActionCode, getActionCodes,
  generateQuestCode, getQuestCodes,
  submitAction, getActionSubmissions, approveActionSubmission, rejectActionSubmission,
  submitQuest, getQuestSubmissions, approveQuestSubmission, rejectQuestSubmission,
  getSleepLogs,
  getMapsForQuestDropdown,
  getNpcsForQuestDropdown,
} from '@/app/actions/action-quest'
import type { ActionRewards } from '@/app/actions/action-quest'
import { submitPrayer } from '@/app/actions/religions'
import { OrnamentedCard } from '@/components/ui/ornaments'
import { MapPin, Gift, Ghost } from 'lucide-react'

/* ═══════════════════ Types ═══════════════════ */

interface MapOption { id: string; name: string }
interface NpcOption { id: string; npc_name: string; npc_image_url: string | null; map_id: string; map_name: string | null; interaction_radius: number }

interface CodeEntry {
  id: string; name: string; code: string; created_by_name: string; created_at: string
  map_id?: string | null; map_name?: string | null
  npc_token_id?: string | null; npc_name?: string | null
  reward_hp?: number; reward_sanity?: number; reward_travel?: number; reward_spirituality?: number
  reward_max_sanity?: number; reward_max_travel?: number; reward_max_spirituality?: number
}
interface Submission {
  id: string; player_id: string; player_name: string; player_avatar: string | null
  action_name?: string; action_code?: string; quest_name?: string; quest_code?: string
  evidence_urls: string[]; status: string; rejection_reason: string | null
  reviewed_by_name: string | null; reviewed_at: string | null; created_at: string
  // Action rewards
  reward_hp?: number; reward_sanity?: number; reward_travel?: number; reward_spirituality?: number
  reward_max_sanity?: number; reward_max_travel?: number; reward_max_spirituality?: number
}
interface SleepLog {
  id: string; player_id: string; player_name: string; player_avatar: string | null
  meal_url: string; sleep_url: string; status: string
  reviewed_by_name: string | null; reviewed_at: string | null; created_at: string
}

type TabKey = 'actions' | 'quests' | 'sleep'

/* ═══════════════════ Shared UI ═══════════════════ */

const Card = OrnamentedCard

function Badge({ status }: { status: string }) {
  if (status === 'approved') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-500/20 text-green-300 border border-green-500/30">
      <CheckCircle className="w-3 h-3" /> อนุมัติ
    </span>
  )
  if (status === 'rejected') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
      <XCircle className="w-3 h-3" /> ปฏิเสธ
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
      <Clock className="w-3 h-3" /> รอตรวจ
    </span>
  )
}

function fmtDate(d: string) {
  const x = new Date(d)
  return `${String(x.getDate()).padStart(2,'0')}/${String(x.getMonth()+1).padStart(2,'0')}/${x.getFullYear()} ${String(x.getHours()).padStart(2,'0')}:${String(x.getMinutes()).padStart(2,'0')}`
}

function SkeletonTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-victorian-500 text-left border-b border-gold-400/10">
            <th className="pb-2 pr-3"><div className="h-3 w-16 bg-[#2A2520] animate-pulse rounded" /></th>
            <th className="pb-2 pr-3"><div className="h-3 w-12 bg-[#2A2520] animate-pulse rounded" /></th>
            <th className="pb-2 pr-3"><div className="h-3 w-20 bg-[#2A2520] animate-pulse rounded" /></th>
            <th className="pb-2"><div className="h-3 w-14 bg-[#2A2520] animate-pulse rounded" /></th>
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3].map(i => (
            <tr key={i} className="border-b border-victorian-800/50">
              <td className="py-2.5 pr-3"><div className="h-4 w-32 bg-[#2A2520] animate-pulse rounded" /></td>
              <td className="py-2.5 pr-3"><div className="h-5 w-16 bg-[#2A2520] animate-pulse rounded-full" /></td>
              <td className="py-2.5 pr-3"><div className="h-3 w-24 bg-[#2A2520] animate-pulse rounded" /></td>
              <td className="py-2.5"><div className="h-3 w-20 bg-[#2A2520] animate-pulse rounded" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-4 pt-2">
      <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1}
        className="p-2 rounded-lg border border-gold-400/20 text-gold-400 hover:bg-victorian-800/50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
        <ChevronLeft className="w-5 h-5" />
      </button>
      <span className="text-victorian-300 text-sm font-mono">{page} / {totalPages}</span>
      <button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages}
        className="p-2 rounded-lg border border-gold-400/20 text-gold-400 hover:bg-victorian-800/50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  )
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) return <img src={url} alt={name} className="w-9 h-9 rounded-full border border-gold-400/20 object-cover" loading="lazy" decoding="async" />
  return (
    <div className="w-9 h-9 rounded-full border border-gold-400/20 bg-victorian-800 flex items-center justify-center">
      <span className="text-gold-400 text-xs font-display">{name[0]?.toUpperCase()}</span>
    </div>
  )
}

/* ═══════════════════ Modal Overlay ═══════════════════ */

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose} style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-lg rounded-xl border-2 border-gold-400/15 p-6 md:p-8 space-y-5 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: '#1A1612' }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

/* ═══════════════════ Main Component ═══════════════════ */

export default function ActionQuestContent({ userId: _userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('actions')

  // ─── Sleep state ───
  const [showSleepForm, setShowSleepForm] = useState(false)
  const [mealUrl, setMealUrl] = useState('')
  const [sleepUrl, setSleepUrl] = useState('')
  const [sleepSubmitted, setSleepSubmitted] = useState(false)
  const [sleepStatus, setSleepStatus] = useState<string | null>(null)
  const [sleepError, setSleepError] = useState<string | null>(null)

  // ─── Code generation modals ───
  const [showGenAction, setShowGenAction] = useState(false)
  const [showGenQuest, setShowGenQuest] = useState(false)
  const [genName, setGenName] = useState('')
  const [genResult, setGenResult] = useState<{ code: string; name: string } | null>(null)
  const [genError, setGenError] = useState<string | null>(null)
  const [genMapId, setGenMapId] = useState<string>('')  // selected map for quest
  const [genNpcId, setGenNpcId] = useState<string>('')   // selected NPC for quest
  const [mapOptions, setMapOptions] = useState<MapOption[]>([])
  const [npcOptions, setNpcOptions] = useState<NpcOption[]>([])
  // ─── Action rewards state ───
  const [genRewards, setGenRewards] = useState<ActionRewards>({})

  // ─── Submit action/quest modals ───
  const [showSubmitAction, setShowSubmitAction] = useState(false)
  const [showSubmitQuest, setShowSubmitQuest] = useState(false)
  const [subCode, setSubCode] = useState('')
  const [subUrls, setSubUrls] = useState<string[]>([''])
  const [subError, setSubError] = useState<string | null>(null)
  const [subSuccess, setSubSuccess] = useState<string | null>(null)

  // ─── Reject modal ───
  const [rejectTarget, setRejectTarget] = useState<{ id: string; type: 'action' | 'quest' | 'sleep' } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState<string | null>(null)

  // ─── Rejection detail view ───
  const [viewRejection, setViewRejection] = useState<{ reason: string; name: string } | null>(null)

  // ─── Prayer state ───
  const [showPrayerForm, setShowPrayerForm] = useState(false)
  const [prayerUrls, setPrayerUrls] = useState<string[]>(['', ''])
  const [prayerError, setPrayerError] = useState<string | null>(null)
  const [prayerSuccess, setPrayerSuccess] = useState<{ gained: number; newSanity: number } | null>(null)

  // ─── Action codes list ───
  const [actionCodes, setActionCodes] = useState<CodeEntry[]>([])
  const [acPage, setAcPage] = useState(1)
  const [acTotalPages, setAcTotalPages] = useState(1)

  // ─── Quest codes list ───
  const [questCodes, setQuestCodes] = useState<CodeEntry[]>([])
  const [qcPage, setQcPage] = useState(1)
  const [qcTotalPages, setQcTotalPages] = useState(1)

  // ─── Action submissions ───
  const [actionSubs, setActionSubs] = useState<Submission[]>([])
  const [asPage, setAsPage] = useState(1)
  const [asTotalPages, setAsTotalPages] = useState(1)
  const [asTotal, setAsTotal] = useState(0)
  const [asLoading, setAsLoading] = useState(true)

  // ─── Quest submissions ───
  const [questSubs, setQuestSubs] = useState<Submission[]>([])
  const [qsPage, setQsPage] = useState(1)
  const [qsTotalPages, setQsTotalPages] = useState(1)
  const [qsTotal, setQsTotal] = useState(0)
  const [qsLoading, setQsLoading] = useState(true)

  // ─── Sleep logs ───
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([])
  const [slPage, setSlPage] = useState(1)
  const [slTotalPages, setSlTotalPages] = useState(1)
  const [slTotal, setSlTotal] = useState(0)
  const [slLoading, setSlLoading] = useState(true)

  // ─── Toast helper ───
  function toast(type: 'success' | 'error', text: string) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3500)
  }

  // ─── Fetch functions ───
  const fetchActionCodes = useCallback(async (p: number) => {
    const r = await getActionCodes(p)
    setActionCodes(r.codes as CodeEntry[])
    setAcPage(r.page || 1)
    setAcTotalPages(r.totalPages || 1)
  }, [])

  const fetchQuestCodes = useCallback(async (p: number) => {
    const r = await getQuestCodes(p)
    setQuestCodes(r.codes as CodeEntry[])
    setQcPage(r.page || 1)
    setQcTotalPages(r.totalPages || 1)
  }, [])

  const fetchActionSubs = useCallback(async (p: number) => {
    setAsLoading(true)
    const r = await getActionSubmissions(p)
    setActionSubs(r.submissions as Submission[])
    setAsPage(r.page || 1)
    setAsTotalPages(r.totalPages || 1)
    setAsTotal(r.total || 0)
    setAsLoading(false)
  }, [])

  const fetchQuestSubs = useCallback(async (p: number) => {
    setQsLoading(true)
    const r = await getQuestSubmissions(p)
    setQuestSubs(r.submissions as Submission[])
    setQsPage(r.page || 1)
    setQsTotalPages(r.totalPages || 1)
    setQsTotal(r.total || 0)
    setQsLoading(false)
  }, [])

  const fetchSleepLogs = useCallback(async (p: number) => {
    setSlLoading(true)
    const r = await getSleepLogs(p)
    setSleepLogs(r.logs as SleepLog[])
    setSlPage(r.page || 1)
    setSlTotalPages(r.totalPages || 1)
    setSlTotal(r.total || 0)
    setSlLoading(false)
  }, [])

  // ─── Init ───
  useEffect(() => {
    getTodaySleepStatus().then(r => { setSleepSubmitted(r.submitted); setSleepStatus(r.status || null) })
    if (isAdmin) {
      autoApproveExpiredRequests()
      getMapsForQuestDropdown().then(m => setMapOptions(m))
      getNpcsForQuestDropdown().then(n => setNpcOptions(n))
    }
    fetchActionCodes(1)
    fetchQuestCodes(1)
    fetchActionSubs(1)
    fetchQuestSubs(1)
    fetchSleepLogs(1)
  }, [isAdmin, fetchActionCodes, fetchQuestCodes, fetchActionSubs, fetchQuestSubs, fetchSleepLogs])

  // ─── Handlers ───
  function handleSleepSubmit() {
    setSleepError(null)
    if (!mealUrl.trim() || !sleepUrl.trim()) { setSleepError('กรุณากรอก URL ทั้ง 2 ลิงก์'); return }
    startTransition(async () => {
      const r = await submitSleepRequest(mealUrl.trim(), sleepUrl.trim())
      if (r.error) { setSleepError(r.error) } else {
        setSleepSubmitted(true); setSleepStatus('pending'); setShowSleepForm(false)
        setMealUrl(''); setSleepUrl(''); fetchSleepLogs(1)
      }
    })
  }

  function handleGenCode(type: 'action' | 'quest') {
    setGenError(null); setGenResult(null)
    if (!genName.trim()) { setGenError('กรุณากรอกชื่อ'); return }
    startTransition(async () => {
      const r = type === 'action'
        ? await generateActionCode(genName, genRewards)
        : await generateQuestCode(genName, genMapId || null, genNpcId || null)
      if (r.error) { setGenError(r.error) }
      else if (r.code && r.name) {
        setGenResult({ code: r.code, name: r.name })
        if (type === 'action') fetchActionCodes(1); else fetchQuestCodes(1)
      }
    })
  }

  function handleSubmitActionQuest(type: 'action' | 'quest') {
    setSubError(null); setSubSuccess(null)
    const urls = subUrls.filter(u => u.trim())
    if (!subCode.trim()) { setSubError('กรุณากรอกรหัส'); return }
    if (urls.length === 0) { setSubError('กรุณาแนบ URL หลักฐานอย่างน้อย 1 ลิงก์'); return }
    startTransition(async () => {
      const r = type === 'action'
        ? await submitAction(subCode.trim(), urls)
        : await submitQuest(subCode.trim(), urls)
      if (r.error) { setSubError(r.error) }
      else {
        const rName = type === 'action' ? (r as { actionName?: string }).actionName : (r as { questName?: string }).questName
        setSubSuccess(`ส่ง${type === 'action' ? 'แอคชั่น' : 'ภารกิจ'} "${rName}" สำเร็จ!`)
        if (type === 'action') fetchActionSubs(1); else fetchQuestSubs(1)
      }
    })
  }

  function handleApprove(id: string, type: 'action' | 'quest' | 'sleep') {
    startTransition(async () => {
      let r: { error?: string }
      if (type === 'action') r = await approveActionSubmission(id)
      else if (type === 'quest') r = await approveQuestSubmission(id)
      else r = await approveSleepRequest(id)
      if (r.error) toast('error', r.error)
      else {
        toast('success', type === 'sleep' ? 'อนุมัติแล้ว — รีเซ็ต Spirituality' : 'อนุมัติแล้ว')
        if (type === 'action') fetchActionSubs(asPage)
        else if (type === 'quest') fetchQuestSubs(qsPage)
        else fetchSleepLogs(slPage)
      }
    })
  }

  function handleRejectConfirm() {
    if (!rejectTarget) return
    setRejectError(null)
    if (rejectTarget.type !== 'sleep' && !rejectReason.trim()) { setRejectError('กรุณาระบุเหตุผล'); return }
    startTransition(async () => {
      let r: { error?: string }
      if (rejectTarget!.type === 'action') r = await rejectActionSubmission(rejectTarget!.id, rejectReason)
      else if (rejectTarget!.type === 'quest') r = await rejectQuestSubmission(rejectTarget!.id, rejectReason)
      else r = await rejectSleepRequest(rejectTarget!.id)
      if (r.error) { setRejectError(r.error) } else {
        toast('success', 'ปฏิเสธแล้ว')
        setRejectTarget(null); setRejectReason('')
        if (rejectTarget!.type === 'action') fetchActionSubs(asPage)
        else if (rejectTarget!.type === 'quest') fetchQuestSubs(qsPage)
        else fetchSleepLogs(slPage)
      }
    })
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    toast('success', `คัดลอก ${code} แล้ว`)
  }

  function handlePrayerSubmit() {
    setPrayerError(null); setPrayerSuccess(null)
    const urls = prayerUrls.filter(u => u.trim())
    if (urls.length < 2) { setPrayerError('ต้องแนบ URL อย่างน้อย 2 ลิงก์'); return }
    startTransition(async () => {
      const r = await submitPrayer(urls.map(u => u.trim()))
      if (r.error) { setPrayerError(r.error) }
      else { setPrayerSuccess({ gained: r.gained ?? 0, newSanity: r.newSanity ?? 0 }) }
    })
  }

  /* ═══════════════════ RENDER ═══════════════════ */
  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'actions', label: 'แอคชั่น', icon: <Swords className="w-4 h-4" /> },
    { key: 'quests', label: 'ภารกิจ', icon: <Target className="w-4 h-4" /> },
    { key: 'sleep', label: 'นอนหลับ', icon: <Moon className="w-4 h-4" /> },
  ]

  return (
    <div className="min-h-screen bg-victorian-950 text-victorian-100">
      <div className="fixed inset-0 opacity-5" style={{
        backgroundImage: `radial-gradient(circle at 25% 25%, #D4AF37 1px, transparent 1px),
                          radial-gradient(circle at 75% 75%, #D4AF37 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      <div className="relative z-10 max-w-5xl mx-auto p-4 md:p-10 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="p-2 rounded-lg border border-gold-400/10 text-gold-400 hover:bg-victorian-800/50 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </a>
          <div>
            <h1 className="heading-victorian text-2xl md:text-4xl">แอคชั่น & ภารกิจ</h1>
            <p className="text-victorian-400 text-xs md:text-sm mt-1">ส่งการกระทำ / ภารกิจ</p>
          </div>
        </div>

        <div className="ornament-divider" />

        {/* ══════ ADMIN TOOLS ══════ */}
        {isAdmin && (
          <Card className="p-5 md:p-8">
            <h2 className="heading-victorian text-xl md:text-2xl flex items-center gap-3 mb-5">
              <Shield className="w-5 h-5 text-gold-400" /> เครื่องมือ DM / Admin
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button type="button"
                onClick={() => { setShowGenAction(true); setGenName(''); setGenResult(null); setGenError(null); setGenRewards({}) }}
                className="btn-gold !px-5 !py-4 !text-sm flex items-center justify-center gap-2 cursor-pointer">
                <Swords className="w-5 h-5" /> สร้างโค้ดแอคชั่น
              </button>
              <button type="button"
                onClick={() => { setShowGenQuest(true); setGenName(''); setGenMapId(''); setGenNpcId(''); setGenResult(null); setGenError(null) }}
                className="btn-gold !px-5 !py-4 !text-sm flex items-center justify-center gap-2 cursor-pointer">
                <Target className="w-5 h-5" /> สร้างโค้ดภารกิจ
              </button>
            </div>
          </Card>
        )}

        {/* ══════ PLAYER ACTION BUTTONS ══════ */}
        <Card className="p-5 md:p-8">
          <h2 className="heading-victorian text-xl md:text-2xl flex items-center gap-3 mb-5">
            <Swords className="w-5 h-5 text-gold-400" /> การกระทำ
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* นอนหลับ */}
            <button type="button"
              onClick={() => { if (!sleepSubmitted) setShowSleepForm(true) }}
              disabled={sleepSubmitted || isPending}
              className={`relative px-5 py-4 rounded-lg border-2 text-base font-bold transition-all flex flex-col items-center gap-2
                ${sleepSubmitted
                  ? 'border-victorian-700/30 bg-victorian-900/40 text-victorian-500 cursor-not-allowed'
                  : 'border-blue-500/30 bg-blue-500/5 text-blue-300 hover:border-blue-400/50 hover:bg-blue-500/10 cursor-pointer'}`}>
              <Moon className={`w-8 h-8 ${sleepSubmitted ? 'text-victorian-600' : 'text-blue-400'}`} />
              <span>นอนหลับ</span>
              {sleepSubmitted && (
                <span className="text-[10px] text-victorian-500">
                  {sleepStatus === 'approved' ? '✅ อนุมัติแล้ว' : sleepStatus === 'rejected' ? '❌ ถูกปฏิเสธ' : '⏳ รอตรวจสอบ'}
                </span>
              )}
            </button>

            {/* ภาวนา (Prayer) */}
            <button type="button"
              onClick={() => { setShowPrayerForm(true); setPrayerUrls(['', '']); setPrayerError(null); setPrayerSuccess(null) }}
              className="px-5 py-4 rounded-lg border-2 border-purple-500/30 bg-purple-500/5 text-purple-300
                         hover:border-purple-400/50 hover:bg-purple-500/10 text-base font-bold flex flex-col items-center gap-2 cursor-pointer transition-all">
              <Church className="w-8 h-8 text-purple-400" />
              <span>ภาวนา</span>
            </button>

            {/* ส่งภารกิจ */}
            <button type="button"
              onClick={() => { setShowSubmitQuest(true); setSubCode(''); setSubUrls(['']); setSubError(null); setSubSuccess(null) }}
              className="px-5 py-4 rounded-lg border-2 border-emerald-500/30 bg-emerald-500/5 text-emerald-300
                         hover:border-emerald-400/50 hover:bg-emerald-500/10 text-base font-bold flex flex-col items-center gap-2 cursor-pointer transition-all">
              <Target className="w-8 h-8 text-emerald-400" />
              <span>ส่งภารกิจ</span>
            </button>

            {/* ส่งแอคชั่น */}
            <button type="button"
              onClick={() => { setShowSubmitAction(true); setSubCode(''); setSubUrls(['']); setSubError(null); setSubSuccess(null) }}
              className="px-5 py-4 rounded-lg border-2 border-amber-500/30 bg-amber-500/5 text-amber-300
                         hover:border-amber-400/50 hover:bg-amber-500/10 text-base font-bold flex flex-col items-center gap-2 cursor-pointer transition-all">
              <Send className="w-8 h-8 text-amber-400" />
              <span>ส่งแอคชั่น</span>
            </button>
          </div>
        </Card>

        {/* ══════ TOAST MESSAGE ══════ */}
        {msg && (
          <div className={`p-3 rounded-xl text-center text-sm font-semibold border-2 ${
            msg.type === 'success' ? 'bg-green-900/40 border-green-500/40 text-green-300' : 'bg-red-900/40 border-red-500/40 text-red-300'
          }`}>{msg.text}</div>
        )}

        {/* ══════ TABS ══════ */}
        <div className="flex gap-1 border-b border-gold-400/10 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} type="button"
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer
                ${activeTab === t.key
                  ? 'text-gold-400 border-b-2 border-gold-400'
                  : 'text-victorian-500 hover:text-victorian-300'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════ */}
        {/*  TAB: ACTIONS                           */}
        {/* ═══════════════════════════════════════ */}
        {activeTab === 'actions' && (
          <div className="space-y-6">
            {/* Admin: code history */}
            {isAdmin && actionCodes.length > 0 && (
              <div className="space-y-3">
                <h3 className="heading-victorian text-lg flex items-center gap-2">
                  <Swords className="w-4 h-4 text-gold-400" /> โค้ดแอคชั่นที่สร้างแล้ว
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-victorian-500 text-left border-b border-gold-400/10">
                        <th className="pb-2 pr-3">ชื่อ</th>
                        <th className="pb-2 pr-3">โค้ด</th>
                        <th className="pb-2 pr-3">รางวัล</th>
                        <th className="pb-2 pr-3">สร้างโดย</th>
                        <th className="pb-2">วันที่</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actionCodes.map(c => {
                        const grants = [
                          c.reward_hp ? `❤️+${c.reward_hp}` : '',
                          c.reward_sanity ? `🧠+${c.reward_sanity}` : '',
                          c.reward_travel ? `🗺️+${c.reward_travel}` : '',
                          c.reward_spirituality ? `✨+${c.reward_spirituality}` : '',
                        ].filter(Boolean)
                        const caps = [
                          c.reward_max_sanity ? `🧠↑${c.reward_max_sanity}` : '',
                          c.reward_max_travel ? `🗺️↑${c.reward_max_travel}` : '',
                          c.reward_max_spirituality ? `✨↑${c.reward_max_spirituality}` : '',
                        ].filter(Boolean)
                        return (
                        <tr key={c.id} className="border-b border-victorian-800/50 hover:bg-victorian-800/20">
                          <td className="py-2 pr-3 text-victorian-200">{c.name}</td>
                          <td className="py-2 pr-3">
                            <button type="button" onClick={() => copyCode(c.code)}
                              className="inline-flex items-center gap-1 text-gold-400 font-mono text-xs hover:text-gold-300 cursor-pointer">
                              {c.code} <Copy className="w-3 h-3" />
                            </button>
                          </td>
                          <td className="py-2 pr-3">
                            {grants.length === 0 && caps.length === 0 ? (
                              <span className="text-victorian-600 text-xs">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {grants.map((g, i) => <span key={i} className="text-xs bg-emerald-900/40 text-emerald-300 px-1.5 py-0.5 rounded">{g}</span>)}
                                {caps.map((g, i) => <span key={i} className="text-xs bg-amber-900/40 text-amber-300 px-1.5 py-0.5 rounded">{g}</span>)}
                              </div>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-victorian-400">{c.created_by_name}</td>
                          <td className="py-2 text-victorian-500 text-xs">{fmtDate(c.created_at)}</td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination page={acPage} totalPages={acTotalPages} onPage={fetchActionCodes} />
              </div>
            )}

            {/* Submission history */}
            <div className="space-y-3">
              <h3 className="heading-victorian text-lg flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-gold-400" /> ประวัติส่งแอคชั่น
                <span className="text-victorian-500 text-xs font-normal ml-1">({asTotal})</span>
              </h3>

              {asLoading ? <SkeletonTable /> : actionSubs.length === 0 ? (
                <div className="p-8 text-center border border-gold-400/10 rounded-sm" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
                  <p className="text-victorian-400 heading-victorian">ยังไม่มีประวัติแอคชั่น</p>
                </div>
              ) : (
                <>
                  <SubmissionTable subs={actionSubs} type="action" isAdmin={isAdmin} isPending={isPending}
                    onApprove={(id) => handleApprove(id, 'action')}
                    onReject={(id) => { setRejectTarget({ id, type: 'action' }); setRejectReason(''); setRejectError(null) }}
                    onViewRejection={(reason, name) => setViewRejection({ reason, name })} />
                  <Pagination page={asPage} totalPages={asTotalPages} onPage={fetchActionSubs} />
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/*  TAB: QUESTS                            */}
        {/* ═══════════════════════════════════════ */}
        {activeTab === 'quests' && (
          <div className="space-y-6">
            {isAdmin && questCodes.length > 0 && (
              <div className="space-y-3">
                <h3 className="heading-victorian text-lg flex items-center gap-2">
                  <Target className="w-4 h-4 text-gold-400" /> โค้ดภารกิจที่สร้างแล้ว
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-victorian-500 text-left border-b border-gold-400/10">
                        <th className="pb-2 pr-3">ชื่อ</th>
                        <th className="pb-2 pr-3">โค้ด</th>
                        <th className="pb-2 pr-3">สถานที่</th>
                        <th className="pb-2 pr-3">NPC</th>
                        <th className="pb-2 pr-3">สร้างโดย</th>
                        <th className="pb-2">วันที่</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questCodes.map(c => (
                        <tr key={c.id} className="border-b border-victorian-800/50 hover:bg-victorian-800/20">
                          <td className="py-2 pr-3 text-victorian-200">{c.name}</td>
                          <td className="py-2 pr-3">
                            <button type="button" onClick={() => copyCode(c.code)}
                              className="inline-flex items-center gap-1 text-gold-400 font-mono text-xs hover:text-gold-300 cursor-pointer">
                              {c.code} <Copy className="w-3 h-3" />
                            </button>
                          </td>
                          <td className="py-2 pr-3">
                            {c.map_name ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                                <MapPin className="w-3 h-3" /> {c.map_name}
                              </span>
                            ) : (
                              <span className="text-victorian-600 text-xs">— ไม่จำกัด</span>
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            {c.npc_name ? (
                              <span className="inline-flex items-center gap-1 text-nouveau-ruby text-xs">
                                <Ghost className="w-3 h-3" /> {c.npc_name}
                              </span>
                            ) : (
                              <span className="text-victorian-600 text-xs">—</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-victorian-400">{c.created_by_name}</td>
                          <td className="py-2 text-victorian-500 text-xs">{fmtDate(c.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={qcPage} totalPages={qcTotalPages} onPage={fetchQuestCodes} />
              </div>
            )}

            <div className="space-y-3">
              <h3 className="heading-victorian text-lg flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-gold-400" /> ประวัติส่งภารกิจ
                <span className="text-victorian-500 text-xs font-normal ml-1">({qsTotal})</span>
              </h3>

              {qsLoading ? <SkeletonTable /> : questSubs.length === 0 ? (
                <div className="p-8 text-center border border-gold-400/10 rounded-sm" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
                  <p className="text-victorian-400 heading-victorian">ยังไม่มีประวัติภารกิจ</p>
                </div>
              ) : (
                <>
                  <SubmissionTable subs={questSubs} type="quest" isAdmin={isAdmin} isPending={isPending}
                    onApprove={(id) => handleApprove(id, 'quest')}
                    onReject={(id) => { setRejectTarget({ id, type: 'quest' }); setRejectReason(''); setRejectError(null) }}
                    onViewRejection={(reason, name) => setViewRejection({ reason, name })} />
                  <Pagination page={qsPage} totalPages={qsTotalPages} onPage={fetchQuestSubs} />
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/*  TAB: SLEEP                             */}
        {/* ═══════════════════════════════════════ */}
        {activeTab === 'sleep' && (
          <div className="space-y-3">
            <h3 className="heading-victorian text-lg flex items-center gap-2">
              <Moon className="w-4 h-4 text-blue-400" /> ประวัตินอนหลับ
              <span className="text-victorian-500 text-xs font-normal ml-1">({slTotal})</span>
            </h3>

            {slLoading ? <SkeletonTable /> : sleepLogs.length === 0 ? (
              <div className="p-8 text-center border border-gold-400/10 rounded-sm" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
                <p className="text-victorian-400 heading-victorian">ยังไม่มีประวัตินอนหลับ</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-victorian-500 text-left border-b border-gold-400/10">
                        {isAdmin && <th className="pb-2 pr-3">ผู้เล่น</th>}
                        <th className="pb-2 pr-3">สถานะ</th>
                        <th className="pb-2 pr-3">หลักฐาน</th>
                        <th className="pb-2 pr-3">วันที่</th>
                        <th className="pb-2 pr-3">ตรวจโดย</th>
                        {isAdmin && <th className="pb-2">จัดการ</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sleepLogs.map(log => (
                        <tr key={log.id} className="border-b border-victorian-800/50 hover:bg-victorian-800/20">
                          {isAdmin && (
                            <td className="py-2.5 pr-3">
                              <div className="flex items-center gap-2">
                                <Avatar name={log.player_name} url={log.player_avatar} />
                                <span className="text-victorian-200 text-xs">{log.player_name}</span>
                              </div>
                            </td>
                          )}
                          <td className="py-2.5 pr-3"><Badge status={log.status} /></td>
                          <td className="py-2.5 pr-3">
                            <div className="flex items-center gap-2">
                              <a href={log.meal_url} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-gold-400/70 hover:text-gold-400 transition-colors">
                                🍖 มื้ออาหาร
                              </a>
                              <a href={log.sleep_url} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-gold-400/70 hover:text-gold-400 transition-colors">
                                🌙 นอนหลับ
                              </a>
                            </div>
                            {log.status === 'approved' && (
                              <span className="text-blue-400 text-[10px]">✨ พลังวิญญาณฟื้นกลับเต็มแล้ว</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 text-victorian-500 text-xs">{fmtDate(log.created_at)}</td>
                          <td className="py-2.5 pr-3 text-victorian-600 text-xs">{log.reviewed_by_name || '—'}</td>
                          {isAdmin && (
                            <td className="py-2.5">
                              {log.status === 'pending' ? (
                                <div className="flex items-center gap-1">
                                  <button type="button" onClick={() => handleApprove(log.id, 'sleep')} disabled={isPending}
                                    className="px-2 py-1 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-[11px] font-bold hover:bg-green-500/20 cursor-pointer disabled:opacity-50">
                                    อนุมัติ
                                  </button>
                                  <button type="button" onClick={() => { setRejectTarget({ id: log.id, type: 'sleep' }); setRejectReason(''); setRejectError(null) }} disabled={isPending}
                                    className="px-2 py-1 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-bold hover:bg-red-500/20 cursor-pointer disabled:opacity-50">
                                    ปฏิเสธ
                                  </button>
                                </div>
                              ) : (
                                <span className="text-victorian-600 text-xs">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={slPage} totalPages={slTotalPages} onPage={fetchSleepLogs} />
              </>
            )}
          </div>
        )}

      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/*  MODALS                                            */}
      {/* ═══════════════════════════════════════════════════ */}

      {/* --- Sleep form --- */}
      {showSleepForm && (
        <Modal onClose={() => setShowSleepForm(false)}>
          <div className="flex items-center justify-between">
            <h3 className="heading-victorian text-2xl flex items-center gap-3"><Moon className="w-6 h-6 text-blue-400" /> นอนหลับ</h3>
            <button type="button" onClick={() => setShowSleepForm(false)} className="text-victorian-400 hover:text-gold-400 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
          <p className="text-victorian-400 text-sm">กรุณาแนบลิงก์โรลเพลย์ 2 ลิงก์ เพื่อขอพักผ่อนและฟื้นฟูพลังวิญญาณ</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-victorian-300 mb-1.5">🍖 ลิงก์ที่ 1 — โรลเพลย์ทานอาหาร 1 มื้อ <span className="text-nouveau-ruby">*</span></label>
              <input type="url" value={mealUrl} onChange={e => setMealUrl(e.target.value)} placeholder="https://..." className="input-victorian w-full !py-3 !text-sm" />
            </div>
            <div>
              <label className="block text-sm text-victorian-300 mb-1.5">🌙 ลิงก์ที่ 2 — โรลเพลย์นอนหลับ <span className="text-nouveau-ruby">*</span></label>
              <input type="url" value={sleepUrl} onChange={e => setSleepUrl(e.target.value)} placeholder="https://..." className="input-victorian w-full !py-3 !text-sm" />
            </div>
          </div>
          {sleepError && <div className="p-3 bg-red-900/40 border border-red-500/30 rounded-lg text-red-300 text-sm text-center">{sleepError}</div>}
          <div className="p-3 bg-victorian-800/40 border border-gold-400/10 rounded-lg text-victorian-500 text-xs space-y-1">
            <p>• ส่งได้ 1 ครั้งต่อวัน</p><p>• เมื่ออนุมัติ พลังวิญญาณจะรีเซ็ตเต็มหลอด</p><p>• หากไม่มีผู้ตรวจก่อนเที่ยงคืน จะอนุมัติอัตโนมัติ (pg_cron)</p>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowSleepForm(false)} className="btn-victorian px-4 py-2 text-sm cursor-pointer">ยกเลิก</button>
            <button type="button" onClick={handleSleepSubmit} disabled={isPending || !mealUrl.trim() || !sleepUrl.trim()}
              className="btn-gold !px-6 !py-2 !text-sm disabled:opacity-50">{isPending ? 'กำลังส่ง...' : '🌙 นอนหลับ'}</button>
          </div>
        </Modal>
      )}

      {/* --- Generate action code --- */}
      {showGenAction && (
        <Modal onClose={() => setShowGenAction(false)}>
          <div className="flex items-center justify-between">
            <h3 className="heading-victorian text-2xl flex items-center gap-3"><Swords className="w-6 h-6 text-gold-400" /> สร้างโค้ดแอคชั่น</h3>
            <button type="button" onClick={() => setShowGenAction(false)} className="text-victorian-400 hover:text-gold-400 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
          {!genResult ? (
            <>
              <div>
                <label className="block text-sm text-victorian-300 mb-1.5">ชื่อแอคชั่น <span className="text-nouveau-ruby">*</span></label>
                <input type="text" value={genName} onChange={e => setGenName(e.target.value)} placeholder="เช่น ต่อสู้กับมังกร" className="input-victorian w-full !py-3 !text-sm" />
              </div>

              {/* ── Grant rewards ── */}
              <div className="space-y-2">
                <label className="block text-sm text-victorian-300 font-semibold flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-emerald-400" /> มอบรางวัล <span className="text-victorian-600 text-xs font-normal">(เพิ่มค่าปัจจุบัน)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['reward_hp', 'HP', '❤️'],
                    ['reward_sanity', 'Sanity', '🧠'],
                    ['reward_travel', 'Travel', '🗺️'],
                    ['reward_spirituality', 'Spirituality', '✨'],
                  ] as const).map(([key, lbl, ico]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <span className="text-sm">{ico}</span>
                      <input type="number" min={0} placeholder={lbl}
                        value={genRewards[key] || ''}
                        onChange={e => setGenRewards(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                        className="input-victorian w-full !py-1.5 !text-xs" />
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Max cap rewards ── */}
              <div className="space-y-2">
                <label className="block text-sm text-victorian-300 font-semibold flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-amber-400" /> เพิ่มค่าสูงสุด <span className="text-victorian-600 text-xs font-normal">(ขยายลิมิต)</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['reward_max_sanity', 'Max Sanity', '🧠'],
                    ['reward_max_travel', 'Max Travel', '🗺️'],
                    ['reward_max_spirituality', 'Max Spirit', '✨'],
                  ] as const).map(([key, lbl, ico]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <span className="text-sm">{ico}</span>
                      <input type="number" min={0} placeholder={lbl}
                        value={genRewards[key] || ''}
                        onChange={e => setGenRewards(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                        className="input-victorian w-full !py-1.5 !text-xs" />
                    </div>
                  ))}
                </div>
              </div>

              {genError && <div className="p-3 bg-red-900/40 border border-red-500/30 rounded-lg text-red-300 text-sm text-center">{genError}</div>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowGenAction(false)} className="btn-victorian px-4 py-2 text-sm cursor-pointer">ยกเลิก</button>
                <button type="button" onClick={() => handleGenCode('action')} disabled={isPending || !genName.trim()}
                  className="btn-gold !px-6 !py-2 !text-sm disabled:opacity-50">{isPending ? 'กำลังสร้าง...' : 'สร้างโค้ด'}</button>
              </div>
            </>
          ) : (
            <div className="text-center space-y-4">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
              <p className="text-victorian-300">สร้างโค้ดสำเร็จ!</p>
              <p className="text-victorian-400 text-sm">{genResult.name}</p>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-2xl text-gold-400 tracking-wider">{genResult.code}</span>
                <button type="button" onClick={() => copyCode(genResult.code)} className="p-2 hover:bg-victorian-800 rounded-lg cursor-pointer">
                  <Copy className="w-5 h-5 text-gold-400" />
                </button>
              </div>
              <button type="button" onClick={() => setShowGenAction(false)} className="btn-victorian px-6 py-2 text-sm cursor-pointer">ปิด</button>
            </div>
          )}
        </Modal>
      )}

      {/* --- Generate quest code --- */}
      {showGenQuest && (
        <Modal onClose={() => setShowGenQuest(false)}>
          <div className="flex items-center justify-between">
            <h3 className="heading-victorian text-2xl flex items-center gap-3"><Target className="w-6 h-6 text-gold-400" /> สร้างโค้ดภารกิจ</h3>
            <button type="button" onClick={() => setShowGenQuest(false)} className="text-victorian-400 hover:text-gold-400 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
          {!genResult ? (
            <>
              <div>
                <label className="block text-sm text-victorian-300 mb-1.5">ชื่อภารกิจ <span className="text-nouveau-ruby">*</span></label>
                <input type="text" value={genName} onChange={e => setGenName(e.target.value)} placeholder="เช่น ส่งของลับไปยังหมู่บ้าน" className="input-victorian w-full !py-3 !text-sm" />
              </div>
              <div>
                <label className="block text-sm text-victorian-300 mb-1.5">
                  <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-emerald-400" /> สถานที่ภารกิจ</span>
                  <span className="text-victorian-600 text-xs ml-2">(ไม่บังคับ — หากเลือก ผู้เล่นต้องอยู่ในแมพนี้ถึงจะส่งภารกิจได้)</span>
                </label>
                <select
                  value={genNpcId ? '' : genMapId}
                  onChange={e => setGenMapId(e.target.value)}
                  disabled={!!genNpcId}
                  className="input-victorian w-full !py-3 !text-sm disabled:opacity-50"
                >
                  <option value="">— ไม่จำกัดสถานที่ —</option>
                  {mapOptions.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                {genNpcId && (() => {
                  const npc = npcOptions.find(n => n.id === genNpcId)
                  return npc?.map_name ? (
                    <p className="text-emerald-400/70 text-xs mt-1">📍 สถานที่จะถูกตั้งอัตโนมัติเป็น &quot;{npc.map_name}&quot; ตามตำแหน่ง NPC</p>
                  ) : null
                })()}
              </div>
              <div>
                <label className="block text-sm text-victorian-300 mb-1.5">
                  <span className="inline-flex items-center gap-1"><Ghost className="w-3.5 h-3.5 text-nouveau-ruby" /> NPC ภารกิจ</span>
                  <span className="text-victorian-600 text-xs ml-2">(ไม่บังคับ — หากเลือก ผู้เล่นต้องอยู่ในเขตทำการ NPC)</span>
                </label>
                <select
                  value={genNpcId}
                  onChange={e => {
                    const val = e.target.value
                    setGenNpcId(val)
                    // Auto-set map when NPC is selected
                    if (val) {
                      const npc = npcOptions.find(n => n.id === val)
                      if (npc) setGenMapId(npc.map_id)
                    }
                  }}
                  className="input-victorian w-full !py-3 !text-sm"
                >
                  <option value="">— ไม่กำหนด NPC —</option>
                  {npcOptions.map(n => (
                    <option key={n.id} value={n.id}>
                      {n.npc_name}{n.map_name ? ` (${n.map_name})` : ''}{n.interaction_radius > 0 ? ` — รัศมี ${n.interaction_radius}%` : ' ⚠️ ยังไม่ตั้งรัศมี'}
                    </option>
                  ))}
                </select>
              </div>
              {genError && <div className="p-3 bg-red-900/40 border border-red-500/30 rounded-lg text-red-300 text-sm text-center">{genError}</div>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowGenQuest(false)} className="btn-victorian px-4 py-2 text-sm cursor-pointer">ยกเลิก</button>
                <button type="button" onClick={() => handleGenCode('quest')} disabled={isPending || !genName.trim()}
                  className="btn-gold !px-6 !py-2 !text-sm disabled:opacity-50">{isPending ? 'กำลังสร้าง...' : 'สร้างโค้ด'}</button>
              </div>
            </>
          ) : (
            <div className="text-center space-y-4">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
              <p className="text-victorian-300">สร้างโค้ดสำเร็จ!</p>
              <p className="text-victorian-400 text-sm">{genResult.name}</p>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-2xl text-gold-400 tracking-wider">{genResult.code}</span>
                <button type="button" onClick={() => copyCode(genResult.code)} className="p-2 hover:bg-victorian-800 rounded-lg cursor-pointer">
                  <Copy className="w-5 h-5 text-gold-400" />
                </button>
              </div>
              <button type="button" onClick={() => setShowGenQuest(false)} className="btn-victorian px-6 py-2 text-sm cursor-pointer">ปิด</button>
            </div>
          )}
        </Modal>
      )}

      {/* --- Submit action form --- */}
      {showSubmitAction && (
        <SubmitFormModal
          type="action"
          onClose={() => setShowSubmitAction(false)}
          code={subCode} setCode={setSubCode}
          urls={subUrls} setUrls={setSubUrls}
          error={subError} success={subSuccess}
          isPending={isPending}
          onSubmit={() => handleSubmitActionQuest('action')}
        />
      )}

      {/* --- Submit quest form --- */}
      {showSubmitQuest && (
        <SubmitFormModal
          type="quest"
          onClose={() => setShowSubmitQuest(false)}
          code={subCode} setCode={setSubCode}
          urls={subUrls} setUrls={setSubUrls}
          error={subError} success={subSuccess}
          isPending={isPending}
          onSubmit={() => handleSubmitActionQuest('quest')}
        />
      )}

      {/* --- Prayer modal --- */}
      {showPrayerForm && (
        <Modal onClose={() => setShowPrayerForm(false)}>
          <div className="flex items-center justify-between">
            <h3 className="heading-victorian text-2xl flex items-center gap-3"><Church className="w-6 h-6 text-purple-400" /> ภาวนา</h3>
            <button type="button" onClick={() => setShowPrayerForm(false)} className="text-victorian-400 hover:text-gold-400 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>

          {!prayerSuccess ? (
            <>
              <p className="text-victorian-400 text-sm">แนบลิงก์โรลเพลย์การสวดมนต์/ภาวนา (อย่างน้อย 2 ลิงก์) — จะได้รับ +1 สติต่อลิงก์</p>
              <div className="space-y-3">
                {prayerUrls.map((url, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-xs text-victorian-400 mb-1">ลิงก์ที่ {i + 1} {i < 2 && <span className="text-nouveau-ruby">*</span>}</label>
                      <input type="url" value={url}
                        onChange={e => {
                          const next = [...prayerUrls]
                          next[i] = e.target.value
                          setPrayerUrls(next)
                        }}
                        placeholder="https://..."
                        className="input-victorian w-full !py-2.5 !text-sm" />
                    </div>
                    {i >= 2 && (
                      <button type="button" onClick={() => setPrayerUrls(prev => prev.filter((_, j) => j !== i))}
                        className="mt-5 p-2 text-nouveau-ruby hover:text-red-400 cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button"
                  onClick={() => setPrayerUrls(prev => [...prev, ''])}
                  className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 cursor-pointer transition-colors">
                  <Plus className="w-4 h-4" /> เพิ่มลิงก์อีก (+1 สติ)
                </button>
              </div>
              {prayerError && <div className="p-3 bg-red-900/40 border border-red-500/30 rounded-lg text-red-300 text-sm text-center">{prayerError}</div>}
              <div className="p-3 bg-victorian-800/40 border border-gold-400/10 rounded-lg text-victorian-500 text-xs space-y-1">
                <p>• ต้องตั้งค่าศาสนาของตัวละครก่อน (หน้าผู้เล่น)</p>
                <p>• ต้องอยู่ในระยะเขตทำการของโบสถ์ศาสนาเดียวกันบนแมพ</p>
                <p>• +1 สติ ต่อ 1 ลิงก์ (สูงสุดไม่เกินสติเต็ม)</p>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowPrayerForm(false)} className="btn-victorian px-4 py-2 text-sm cursor-pointer">ยกเลิก</button>
                <button type="button" onClick={handlePrayerSubmit} disabled={isPending || prayerUrls.filter(u => u.trim()).length < 2}
                  className="btn-gold !px-6 !py-2 !text-sm disabled:opacity-50">{isPending ? 'กำลังภาวนา...' : '🙏 ภาวนา'}</button>
              </div>
            </>
          ) : (
            <div className="text-center space-y-4">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
              <p className="text-green-300 text-lg font-bold">ภาวนาสำเร็จ!</p>
              <p className="text-victorian-300">ได้รับ <span className="text-purple-400 font-bold">+{prayerSuccess.gained} สติ</span></p>
              <p className="text-victorian-400 text-sm">สติปัจจุบัน: {prayerSuccess.newSanity}</p>
              <button type="button" onClick={() => setShowPrayerForm(false)} className="btn-victorian px-6 py-2 text-sm cursor-pointer">ปิด</button>
            </div>
          )}
        </Modal>
      )}

      {/* --- Reject reason modal --- */}
      {rejectTarget && (
        <Modal onClose={() => setRejectTarget(null)}>
          <div className="flex items-center justify-between">
            <h3 className="heading-victorian text-xl flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-5 h-5" /> ปฏิเสธคำขอ
            </h3>
            <button type="button" onClick={() => setRejectTarget(null)} className="text-victorian-400 hover:text-gold-400 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
          {rejectTarget.type !== 'sleep' && (
            <div>
              <label className="block text-sm text-victorian-300 mb-1.5">เหตุผลการปฏิเสธ <span className="text-nouveau-ruby">*</span></label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="ระบุเหตุผล เช่น หลักฐานไม่ชัดเจน, ไม่ตรงกับภารกิจ..."
                rows={3}
                className="input-victorian w-full !py-3 !text-sm resize-none" />
            </div>
          )}
          {rejectTarget.type === 'sleep' && (
            <p className="text-victorian-400 text-sm">ยืนยันการปฏิเสธคำขอนอนหลับนี้?</p>
          )}
          {rejectError && <div className="p-3 bg-red-900/40 border border-red-500/30 rounded-lg text-red-300 text-sm text-center">{rejectError}</div>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setRejectTarget(null)} className="btn-victorian px-4 py-2 text-sm cursor-pointer">ยกเลิก</button>
            <button type="button" onClick={handleRejectConfirm} disabled={isPending || (rejectTarget.type !== 'sleep' && !rejectReason.trim())}
              className="px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-500 disabled:opacity-50 cursor-pointer transition-colors">
              {isPending ? 'กำลังดำเนินการ...' : 'ยืนยันปฏิเสธ'}
            </button>
          </div>
        </Modal>
      )}

      {/* --- View rejection reason --- */}
      {viewRejection && (
        <Modal onClose={() => setViewRejection(null)}>
          <div className="flex items-center justify-between">
            <h3 className="heading-victorian text-xl flex items-center gap-3 text-red-400">
              <XCircle className="w-5 h-5" /> เหตุผลการปฏิเสธ
            </h3>
            <button type="button" onClick={() => setViewRejection(null)} className="text-victorian-400 hover:text-gold-400 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
          {/* Red card — screenshot-friendly */}
          <div className="p-5 bg-red-950/60 border-2 border-red-500/40 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-red-400 font-bold text-lg">
              <XCircle className="w-6 h-6" /> ไม่สำเร็จ
            </div>
            <p className="text-red-200 text-sm font-semibold">{viewRejection.name}</p>
            <div className="border-t border-red-500/20 pt-3">
              <p className="text-victorian-400 text-xs mb-1">เหตุผล:</p>
              <p className="text-red-200 text-sm whitespace-pre-wrap">{viewRejection.reason}</p>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={() => setViewRejection(null)} className="btn-victorian px-6 py-2 text-sm cursor-pointer">ปิด</button>
          </div>
        </Modal>
      )}
    </div>
  )
}


/* ═══════════════════════════════════════════════════ */
/*  Sub-components                                     */
/* ═══════════════════════════════════════════════════ */

function SubmissionTable({ subs, type, isAdmin, isPending, onApprove, onReject, onViewRejection }: {
  subs: Submission[]; type: 'action' | 'quest'; isAdmin: boolean; isPending: boolean
  onApprove: (id: string) => void; onReject: (id: string) => void
  onViewRejection: (reason: string, name: string) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-victorian-500 text-left border-b border-gold-400/10">
            {isAdmin && <th className="pb-2 pr-3">ผู้เล่น</th>}
            <th className="pb-2 pr-3">ชื่อ</th>
            <th className="pb-2 pr-3">โค้ด</th>
            <th className="pb-2 pr-3">สถานะ</th>
            <th className="pb-2 pr-3">หลักฐาน</th>
            {type === 'action' && <th className="pb-2 pr-3">รางวัล</th>}
            <th className="pb-2 pr-3">วันที่</th>
            <th className="pb-2 pr-3">ตรวจโดย</th>
            {isAdmin && <th className="pb-2">จัดการ</th>}
          </tr>
        </thead>
        <tbody>
          {subs.map(s => {
            const name = type === 'action' ? s.action_name : s.quest_name
            const code = type === 'action' ? s.action_code : s.quest_code
            const grants = type === 'action' && s.status === 'approved' ? [
              s.reward_hp ? `❤️+${s.reward_hp}` : '',
              s.reward_sanity ? `🧠+${s.reward_sanity}` : '',
              s.reward_travel ? `🗺️+${s.reward_travel}` : '',
              s.reward_spirituality ? `✨+${s.reward_spirituality}` : '',
            ].filter(Boolean) : []
            const caps = type === 'action' && s.status === 'approved' ? [
              s.reward_max_sanity ? `🧠↑${s.reward_max_sanity}` : '',
              s.reward_max_travel ? `🗺️↑${s.reward_max_travel}` : '',
              s.reward_max_spirituality ? `✨↑${s.reward_max_spirituality}` : '',
            ].filter(Boolean) : []

            return (
              <tr key={s.id} className="border-b border-victorian-800/50 hover:bg-victorian-800/20">
                {isAdmin && (
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={s.player_name} url={s.player_avatar} />
                      <span className="text-victorian-200 text-xs">{s.player_name}</span>
                    </div>
                  </td>
                )}
                <td className="py-2.5 pr-3 text-victorian-200">{name}</td>
                <td className="py-2.5 pr-3 text-victorian-500 font-mono text-[11px]">{code}</td>
                <td className="py-2.5 pr-3">
                  <Badge status={s.status} />
                  {s.status === 'rejected' && s.rejection_reason && (
                    <button type="button"
                      onClick={() => onViewRejection(s.rejection_reason!, name || '')}
                      className="block mt-1 text-[10px] text-red-400 hover:text-red-300 cursor-pointer underline">
                      ดูเหตุผล
                    </button>
                  )}
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex flex-wrap gap-1">
                    {s.evidence_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] text-gold-400/70 hover:text-gold-400 transition-colors underline">
                        #{i + 1}
                      </a>
                    ))}
                  </div>
                </td>
                {type === 'action' && (
                  <td className="py-2.5 pr-3">
                    {grants.length === 0 && caps.length === 0 ? (
                      <span className="text-victorian-600 text-xs">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {grants.map((g, i) => <span key={i} className="text-[10px] bg-emerald-900/40 text-emerald-300 px-1 py-0.5 rounded">{g}</span>)}
                        {caps.map((g, i) => <span key={i} className="text-[10px] bg-amber-900/40 text-amber-300 px-1 py-0.5 rounded">{g}</span>)}
                      </div>
                    )}
                  </td>
                )}
                <td className="py-2.5 pr-3 text-victorian-500 text-xs">{fmtDate(s.created_at)}</td>
                <td className="py-2.5 pr-3 text-victorian-600 text-xs">{s.reviewed_by_name || '—'}</td>
                {isAdmin && (
                  <td className="py-2.5">
                    {s.status === 'pending' ? (
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => onApprove(s.id)} disabled={isPending}
                          className="px-2 py-1 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-[11px] font-bold hover:bg-green-500/20 cursor-pointer disabled:opacity-50">
                          อนุมัติ
                        </button>
                        <button type="button" onClick={() => onReject(s.id)} disabled={isPending}
                          className="px-2 py-1 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-bold hover:bg-red-500/20 cursor-pointer disabled:opacity-50">
                          ปฏิเสธ
                        </button>
                      </div>
                    ) : (
                      <span className="text-victorian-600 text-xs">—</span>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SubmitFormModal({ type, onClose, code, setCode, urls, setUrls, error, success, isPending, onSubmit }: {
  type: 'action' | 'quest'; onClose: () => void
  code: string; setCode: (v: string) => void
  urls: string[]; setUrls: (v: string[]) => void
  error: string | null; success: string | null
  isPending: boolean; onSubmit: () => void
}) {
  const isAction = type === 'action'
  const label = isAction ? 'แอคชั่น' : 'ภารกิจ'
  const Icon = isAction ? Swords : Target
  const color = isAction ? 'amber' : 'emerald'

  function addUrl() { setUrls([...urls, '']) }
  function removeUrl(i: number) { setUrls(urls.filter((_, idx) => idx !== i)) }
  function updateUrl(i: number, v: string) { const n = [...urls]; n[i] = v; setUrls(n) }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between">
        <h3 className="heading-victorian text-2xl flex items-center gap-3">
          <Icon className={`w-6 h-6 text-${color}-400`} /> ส่ง{label}
        </h3>
        <button type="button" onClick={onClose} className="text-victorian-400 hover:text-gold-400 cursor-pointer"><X className="w-5 h-5" /></button>
      </div>

      {success ? (
        <div className="text-center space-y-4 py-4">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
          <p className="text-green-300 font-semibold">{success}</p>
          <p className="text-victorian-500 text-sm">ทีมงานจะตรวจสอบหลักฐานของคุณ</p>
          <button type="button" onClick={onClose} className="btn-victorian px-6 py-2 text-sm cursor-pointer">ปิด</button>
        </div>
      ) : (
        <>
          <div>
            <label className="block text-sm text-victorian-300 mb-1.5">รหัส{label} <span className="text-nouveau-ruby">*</span></label>
            <input type="text" value={code} onChange={e => setCode(e.target.value)}
              placeholder="เช่น 09-02-26-abcd"
              className="input-victorian w-full !py-3 !text-sm font-mono" />
          </div>

          <div className="space-y-2">
            <label className="block text-sm text-victorian-300">หลักฐาน URL <span className="text-nouveau-ruby">*</span></label>
            {urls.map((url, i) => (
              <div key={i} className="flex gap-2">
                <input type="url" value={url} onChange={e => updateUrl(i, e.target.value)}
                  placeholder={`URL หลักฐาน ${i + 1}`}
                  className="input-victorian flex-1 !py-2.5 !text-sm" />
                {urls.length > 1 && (
                  <button type="button" onClick={() => removeUrl(i)}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addUrl}
              className="inline-flex items-center gap-1.5 text-xs text-gold-400 hover:text-gold-300 cursor-pointer mt-1">
              <Plus className="w-3.5 h-3.5" /> เพิ่ม URL
            </button>
          </div>

          {error && <div className="p-3 bg-red-900/40 border border-red-500/30 rounded-lg text-red-300 text-sm text-center">{error}</div>}

          <div className="p-3 bg-victorian-800/40 border border-gold-400/10 rounded-lg text-victorian-500 text-xs space-y-1">
            <p>• กรอกรหัสที่ได้จากทีมงาน ระบบจะตรวจสอบว่ารหัสถูกต้อง</p>
            <p>• แนบ URL หลักฐานการโรลเพลย์อย่างน้อย 1 ลิงก์ (เพิ่มได้เรื่อย ๆ)</p>
            <p>• ทีมงานจะตรวจสอบแล้วอนุมัติหรือปฏิเสธพร้อมเหตุผล</p>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-victorian px-4 py-2 text-sm cursor-pointer">ยกเลิก</button>
            <button type="button" onClick={onSubmit} disabled={isPending || !code.trim() || urls.filter(u => u.trim()).length === 0}
              className="btn-gold !px-6 !py-2 !text-sm disabled:opacity-50">
              {isPending ? 'กำลังส่ง...' : `ส่ง${label}`}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
