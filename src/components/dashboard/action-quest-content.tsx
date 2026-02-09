'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import {
  ArrowLeft, Moon, ScrollText, Swords, Target, Shield, Plus, Copy,
  Check, X, ExternalLink, ChevronLeft, ChevronRight, Clock, CheckCircle,
  XCircle, Send, AlertTriangle, Trash2, Eye
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
} from '@/app/actions/action-quest'
import type { ActionRewards } from '@/app/actions/action-quest'
import { OrnamentedCard } from '@/components/ui/ornaments'
import { MapPin, Gift } from 'lucide-react'

/* ═══════════════════ Types ═══════════════════ */

interface MapOption { id: string; name: string }

interface CodeEntry {
  id: string; name: string; code: string; created_by_name: string; created_at: string
  map_id?: string | null; map_name?: string | null
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

function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 border-2 border-[#D4AF37]/20 rounded-full" />
        <div className="absolute inset-0 border-2 border-transparent border-t-[#D4AF37] rounded-full animate-spin" />
      </div>
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
  const [mapOptions, setMapOptions] = useState<MapOption[]>([])
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
        : await generateQuestCode(genName, genMapId || null)
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
                onClick={() => { setShowGenQuest(true); setGenName(''); setGenMapId(''); setGenResult(null); setGenError(null) }}
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

              {asLoading ? <Spinner /> : actionSubs.length === 0 ? (
                <Card className="p-8 text-center">
                  <Swords className="w-10 h-10 text-gold-400/30 mx-auto mb-2" />
                  <p className="text-victorian-400 heading-victorian">ยังไม่มีประวัติแอคชั่น</p>
                </Card>
              ) : (
                <>
                  {actionSubs.map(s => (
                    <SubmissionCard key={s.id} s={s} type="action" isAdmin={isAdmin} isPending={isPending}
                      onApprove={(id) => handleApprove(id, 'action')}
                      onReject={(id) => { setRejectTarget({ id, type: 'action' }); setRejectReason(''); setRejectError(null) }}
                      onViewRejection={(reason, name) => setViewRejection({ reason, name })} />
                  ))}
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

              {qsLoading ? <Spinner /> : questSubs.length === 0 ? (
                <Card className="p-8 text-center">
                  <Target className="w-10 h-10 text-gold-400/30 mx-auto mb-2" />
                  <p className="text-victorian-400 heading-victorian">ยังไม่มีประวัติภารกิจ</p>
                </Card>
              ) : (
                <>
                  {questSubs.map(s => (
                    <SubmissionCard key={s.id} s={s} type="quest" isAdmin={isAdmin} isPending={isPending}
                      onApprove={(id) => handleApprove(id, 'quest')}
                      onReject={(id) => { setRejectTarget({ id, type: 'quest' }); setRejectReason(''); setRejectError(null) }}
                      onViewRejection={(reason, name) => setViewRejection({ reason, name })} />
                  ))}
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

            {slLoading ? <Spinner /> : sleepLogs.length === 0 ? (
              <Card className="p-8 text-center">
                <Moon className="w-10 h-10 text-blue-400/30 mx-auto mb-2" />
                <p className="text-victorian-400 heading-victorian">ยังไม่มีประวัตินอนหลับ</p>
              </Card>
            ) : (
              <>
                {sleepLogs.map(log => (
                  <Card key={log.id} className="p-4 md:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {isAdmin && <Avatar name={log.player_name} url={log.player_avatar} />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Moon className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            <span className="text-blue-200 font-semibold text-sm">นอนหลับ</span>
                            <Badge status={log.status} />
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-victorian-500 flex-wrap">
                            {isAdmin && <span className="text-victorian-300">{log.player_name}</span>}
                            <span>{fmtDate(log.created_at)}</span>
                            {log.reviewed_by_name && <span className="text-victorian-600">ตรวจโดย: {log.reviewed_by_name}</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            <a href={log.meal_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-gold-400/70 hover:text-gold-400 transition-colors">
                              <ExternalLink className="w-3 h-3" /> ลิงก์มื้ออาหาร
                            </a>
                            <a href={log.sleep_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-gold-400/70 hover:text-gold-400 transition-colors">
                              <ExternalLink className="w-3 h-3" /> ลิงก์นอนหลับ
                            </a>
                          </div>
                          {/* Sleep recovery notification */}
                          {log.status === 'approved' && (
                            <div className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg bg-blue-900/30 border border-blue-500/30">
                              <CheckCircle className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                              <span className="text-blue-300 text-xs">✨ การนอนหลับเสร็จสิ้น — พลังวิญญาณฟื้นกลับมาเต็มที่แล้ว!</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {isAdmin && log.status === 'pending' && (
                        <div className="flex items-center gap-2 flex-shrink-0 sm:self-start">
                          <button type="button" onClick={() => handleApprove(log.id, 'sleep')} disabled={isPending}
                            className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-bold hover:bg-green-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> อนุมัติ
                          </button>
                          <button type="button" onClick={() => { setRejectTarget({ id: log.id, type: 'sleep' }); setRejectReason(''); setRejectError(null) }} disabled={isPending}
                            className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-1">
                            <X className="w-3.5 h-3.5" /> ปฏิเสธ
                          </button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
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
                  value={genMapId}
                  onChange={e => setGenMapId(e.target.value)}
                  className="input-victorian w-full !py-3 !text-sm"
                >
                  <option value="">— ไม่จำกัดสถานที่ —</option>
                  {mapOptions.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
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

function SubmissionCard({ s, type, isAdmin, isPending, onApprove, onReject, onViewRejection }: {
  s: Submission; type: 'action' | 'quest'; isAdmin: boolean; isPending: boolean
  onApprove: (id: string) => void; onReject: (id: string) => void
  onViewRejection: (reason: string, name: string) => void
}) {
  const name = type === 'action' ? s.action_name : s.quest_name
  const code = type === 'action' ? s.action_code : s.quest_code
  const TypeIcon = type === 'action' ? Swords : Target
  const color = type === 'action' ? 'amber' : 'emerald'

  return (
    <Card className="p-4 md:p-5">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {isAdmin && <Avatar name={s.player_name} url={s.player_avatar} />}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <TypeIcon className={`w-4 h-4 text-${color}-400 flex-shrink-0`} />
              <span className={`text-${color}-200 font-semibold text-sm`}>{name}</span>
              <span className="text-victorian-600 font-mono text-[11px]">{code}</span>
              <Badge status={s.status} />
            </div>
            <div className="flex items-center gap-3 text-xs text-victorian-500 flex-wrap">
              {isAdmin && <span className="text-victorian-300">{s.player_name}</span>}
              <span>{fmtDate(s.created_at)}</span>
              {s.reviewed_by_name && <span className="text-victorian-600">ตรวจโดย: {s.reviewed_by_name}</span>}
            </div>
            {/* Evidence URLs */}
            <div className="flex flex-wrap gap-2 mt-1">
              {s.evidence_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-gold-400/70 hover:text-gold-400 transition-colors">
                  <ExternalLink className="w-3 h-3" /> หลักฐาน {i + 1}
                </a>
              ))}
            </div>
            {/* Rejection reason badge */}
            {s.status === 'rejected' && s.rejection_reason && (
              <button type="button"
                onClick={() => onViewRejection(s.rejection_reason!, name || '')}
                className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg bg-red-950/50 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-900/50 transition-colors cursor-pointer">
                <Eye className="w-3.5 h-3.5" /> ดูเหตุผลที่ปฏิเสธ
              </button>
            )}
            {/* Rewards received (action only, approved) */}
            {type === 'action' && s.status === 'approved' && (
              (() => {
                const grants = [
                  s.reward_hp ? `❤️+${s.reward_hp}` : '',
                  s.reward_sanity ? `🧠+${s.reward_sanity}` : '',
                  s.reward_travel ? `🗺️+${s.reward_travel}` : '',
                  s.reward_spirituality ? `✨+${s.reward_spirituality}` : '',
                ].filter(Boolean)
                const caps = [
                  s.reward_max_sanity ? `🧠↑${s.reward_max_sanity}` : '',
                  s.reward_max_travel ? `🗺️↑${s.reward_max_travel}` : '',
                  s.reward_max_spirituality ? `✨↑${s.reward_max_spirituality}` : '',
                ].filter(Boolean)
                if (grants.length === 0 && caps.length === 0) return null
                return (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <Gift className="w-3.5 h-3.5 text-gold-400 flex-shrink-0" />
                    <span className="text-victorian-400 text-xs">รางวัลที่ได้รับ:</span>
                    {grants.map((g, i) => <span key={i} className="text-xs bg-emerald-900/40 text-emerald-300 px-1.5 py-0.5 rounded">{g}</span>)}
                    {caps.map((g, i) => <span key={i} className="text-xs bg-amber-900/40 text-amber-300 px-1.5 py-0.5 rounded">{g}</span>)}
                  </div>
                )
              })()
            )}
          </div>
        </div>
        {/* Admin approve/reject */}
        {isAdmin && s.status === 'pending' && (
          <div className="flex items-center gap-2 flex-shrink-0 sm:self-start">
            <button type="button" onClick={() => onApprove(s.id)} disabled={isPending}
              className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-bold hover:bg-green-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> อนุมัติ
            </button>
            <button type="button" onClick={() => onReject(s.id)} disabled={isPending}
              className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> ปฏิเสธ
            </button>
          </div>
        )}
      </div>
    </Card>
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
