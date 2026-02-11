'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import {
  ArrowLeft, Moon, ScrollText, Swords, Target, Shield, Plus, Copy,
  X, ExternalLink, ChevronLeft, ChevronRight, Clock, CheckCircle,
  XCircle, Send, AlertTriangle, Trash2, Church, Skull, Users, CalendarClock,
  Repeat, HandHeart, Pencil, Archive, Eye, Info
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
  getPlayersForDropdown,
  getAllActionAndQuestCodes,
  createPunishment,
  getPunishments,
  requestMercy,
  applyPenalty,
  getPunishmentLogs,
  checkPlayerTaskCompletion,
  updateActionCode,
  updateQuestCode,
  updatePunishment,
  autoApplyExpiredPunishments,
  archiveActionCode,
  archiveQuestCode,
  archivePunishment,
  getPlayerActivePunishments,
} from '@/app/actions/action-quest'
import type { ActionRewards, CodeExpiration } from '@/app/actions/action-quest'
import { submitPrayer, getPrayerLogs, getAllPrayerLogs } from '@/app/actions/religions'
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
  expires_at?: string | null; max_repeats?: number | null
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

interface PlayerOption { id: string; display_name: string; avatar_url: string | null }
interface TaskOption { id: string; name: string; code: string; type: 'action' | 'quest' }
interface PunishmentEntry {
  id: string; name: string; description: string | null
  penalty_sanity: number; penalty_hp: number; penalty_travel: number; penalty_spirituality: number
  penalty_max_sanity: number; penalty_max_travel: number; penalty_max_spirituality: number
  deadline: string | null; is_active: boolean; created_by_name: string; created_at: string
  required_tasks: { id: string; action_code_id: string | null; quest_code_id: string | null; action_name: string | null; action_code_str: string | null; quest_name: string | null; quest_code_str: string | null }[]
  assigned_players: { id: string; player_id: string; player_name: string; player_avatar: string | null; is_completed: boolean; penalty_applied: boolean; mercy_requested: boolean; mercy_requested_at: string | null; completed_at: string | null }[]
}
interface PunishmentLogEntry {
  id: string; punishment_id: string; punishment_name: string; player_id: string; player_name: string; player_avatar: string | null
  action: string; details: Record<string, unknown>; created_by_name: string | null; created_at: string
}

type TabKey = 'actions' | 'quests' | 'sleep' | 'prayer' | 'punishments'

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

/* ═══════════════════ Date/Time Split Input ═══════════════════ */

/** Splits an ISO datetime string into { date: 'YYYY-MM-DD', time: 'HH:MM' } */
function splitDateTime(isoOrLocal: string): { date: string; time: string } {
  if (!isoOrLocal) return { date: '', time: '' }
  try {
    const d = new Date(isoOrLocal)
    if (isNaN(d.getTime())) return { date: '', time: '' }
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    return { date, time }
  } catch { return { date: '', time: '' } }
}

/** Combines date ('YYYY-MM-DD') and time ('HH:MM') into a local datetime string */
function combineDateTime(date: string, time: string): string {
  if (!date) return ''
  return `${date}T${time || '00:00'}`
}

function DateTimeInput({ dateVal, timeVal, onDateChange, onTimeChange }: {
  dateVal: string; timeVal: string; onDateChange: (v: string) => void; onTimeChange: (v: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="block text-[10px] text-victorian-500 mb-0.5">วันที่ <span className="text-victorian-600">(วว/ดด/ปปปป)</span></label>
        <input type="date" value={dateVal} onChange={e => onDateChange(e.target.value)}
          className="input-victorian w-full !py-1.5 !text-xs" />
      </div>
      <div>
        <label className="block text-[10px] text-victorian-500 mb-0.5">เวลา <span className="text-victorian-600">(ชช:นน, 24 ชม.)</span></label>
        <input type="time" value={timeVal} onChange={e => onTimeChange(e.target.value)}
          className="input-victorian w-full !py-1.5 !text-xs" />
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
  // ─── Expiration state ───
  const [genExpiresDate, setGenExpiresDate] = useState<string>('')
  const [genExpiresTime, setGenExpiresTime] = useState<string>('')
  const [genMaxRepeats, setGenMaxRepeats] = useState<string>('')
  const [genNoExpiry, setGenNoExpiry] = useState(true)
  const [genUnlimitedRepeats, setGenUnlimitedRepeats] = useState(true)
  // ─── Quest expiration state ───
  const [genQuestExpiresDate, setGenQuestExpiresDate] = useState<string>('')
  const [genQuestExpiresTime, setGenQuestExpiresTime] = useState<string>('')
  const [genQuestMaxRepeats, setGenQuestMaxRepeats] = useState<string>('')
  const [genQuestNoExpiry, setGenQuestNoExpiry] = useState(true)
  const [genQuestUnlimitedRepeats, setGenQuestUnlimitedRepeats] = useState(true)

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

  // ─── Prayer logs ───
  const [prayerLogs, setPrayerLogs] = useState<any[]>([])
  const [plLoading, setPlLoading] = useState(true)
  const [plPage, setPlPage] = useState(1)
  const [plTotalPages, setPlTotalPages] = useState(1)
  const [plTotal, setPlTotal] = useState(0)

  // ─── Player active punishments (banner) ───
  const [activePunishmentsForPlayer, setActivePunishmentsForPlayer] = useState<any[]>([])
  const [showPunishmentDetail, setShowPunishmentDetail] = useState<any | null>(null)

  // ─── Archive confirm modal ───
  const [archiveConfirm, setArchiveConfirm] = useState<{ type: 'action' | 'quest' | 'punishment'; id: string; name: string } | null>(null)

  // ─── Punishment state ───
  const [showCreatePunishment, setShowCreatePunishment] = useState(false)
  const [punName, setPunName] = useState('')
  const [punDesc, setPunDesc] = useState('')
  const [punDeadlineDate, setPunDeadlineDate] = useState('')
  const [punDeadlineTime, setPunDeadlineTime] = useState('')
  const [punNoDeadline, setPunNoDeadline] = useState(true)
  const [punPenalties, setPunPenalties] = useState({
    penalty_sanity: 0, penalty_hp: 0, penalty_travel: 0, penalty_spirituality: 0,
    penalty_max_sanity: 0, penalty_max_travel: 0, penalty_max_spirituality: 0,
  })
  const [punSelectedTasks, setPunSelectedTasks] = useState<{ action_code_id?: string; quest_code_id?: string }[]>([])
  const [punSelectedPlayers, setPunSelectedPlayers] = useState<string[]>([])
  const [punError, setPunError] = useState<string | null>(null)
  const [punSuccess, setPunSuccess] = useState(false)
  const [playerOptions, setPlayerOptions] = useState<PlayerOption[]>([])
  const [taskOptions, setTaskOptions] = useState<TaskOption[]>([])

  // ─── Punishment list ───
  const [punishments, setPunishments] = useState<PunishmentEntry[]>([])
  const [punPage, setPunPage] = useState(1)
  const [punTotalPages, setPunTotalPages] = useState(1)
  const [punTotal, setPunTotal] = useState(0)
  const [punLoading, setPunLoading] = useState(true)

  // ─── Punishment logs ───
  const [punLogs, setPunLogs] = useState<PunishmentLogEntry[]>([])
  const [punLogPage, setPunLogPage] = useState(1)
  const [punLogTotalPages, setPunLogTotalPages] = useState(1)
  const [punLogTotal, setPunLogTotal] = useState(0)
  const [punLogLoading, setPunLogLoading] = useState(true)

  // ─── Edit modals ───
  const [editAction, setEditAction] = useState<CodeEntry | null>(null)
  const [editActionName, setEditActionName] = useState('')
  const [editActionRewards, setEditActionRewards] = useState<ActionRewards>({})
  const [editActionNoExpiry, setEditActionNoExpiry] = useState(true)
  const [editActionUnlimitedRepeats, setEditActionUnlimitedRepeats] = useState(true)
  const [editActionExpiresDate, setEditActionExpiresDate] = useState('')
  const [editActionExpiresTime, setEditActionExpiresTime] = useState('')
  const [editActionMaxRepeats, setEditActionMaxRepeats] = useState('')
  const [editActionError, setEditActionError] = useState<string | null>(null)

  const [editQuest, setEditQuest] = useState<CodeEntry | null>(null)
  const [editQuestName, setEditQuestName] = useState('')
  const [editQuestMapId, setEditQuestMapId] = useState('')
  const [editQuestNpcId, setEditQuestNpcId] = useState('')
  const [editQuestNoExpiry, setEditQuestNoExpiry] = useState(true)
  const [editQuestUnlimitedRepeats, setEditQuestUnlimitedRepeats] = useState(true)
  const [editQuestExpiresDate, setEditQuestExpiresDate] = useState('')
  const [editQuestExpiresTime, setEditQuestExpiresTime] = useState('')
  const [editQuestMaxRepeats, setEditQuestMaxRepeats] = useState('')
  const [editQuestError, setEditQuestError] = useState<string | null>(null)

  const [editPunishment, setEditPunishment] = useState<PunishmentEntry | null>(null)
  const [editPunName, setEditPunName] = useState('')
  const [editPunDesc, setEditPunDesc] = useState('')
  const [editPunDeadlineDate, setEditPunDeadlineDate] = useState('')
  const [editPunDeadlineTime, setEditPunDeadlineTime] = useState('')
  const [editPunNoDeadline, setEditPunNoDeadline] = useState(true)
  const [editPunPenalties, setEditPunPenalties] = useState({
    penalty_sanity: 0, penalty_hp: 0, penalty_travel: 0, penalty_spirituality: 0,
    penalty_max_sanity: 0, penalty_max_travel: 0, penalty_max_spirituality: 0,
  })
  const [editPunSelectedTasks, setEditPunSelectedTasks] = useState<{ action_code_id?: string; quest_code_id?: string }[]>([])
  const [editPunSelectedPlayers, setEditPunSelectedPlayers] = useState<string[]>([])
  const [editPunError, setEditPunError] = useState<string | null>(null)

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

  const fetchPrayerLogs = useCallback(async (p: number = 1) => {
    setPlLoading(true)
    let logs: any[] = []
    let total = 0
    let totalPages = 1
    if (isAdmin) {
      const res = await getAllPrayerLogs(p)
      if ('logs' in res && Array.isArray(res.logs)) {
        logs = res.logs
      }
      total = (res as any).total || 0
      totalPages = (res as any).totalPages || 1
    } else {
      const res = await getPrayerLogs(p)
      if ('logs' in res && Array.isArray(res.logs)) {
        logs = res.logs
      } else if (Array.isArray(res)) {
        logs = res
      }
      total = (res as any).total || logs.length
      totalPages = (res as any).totalPages || 1
    }
    setPrayerLogs(logs)
    setPlTotal(total)
    setPlPage(p)
    setPlTotalPages(totalPages)
    setPlLoading(false)
  }, [isAdmin])

  const fetchPunishments = useCallback(async (p: number) => {
    setPunLoading(true)
    const r = await getPunishments(p)
    setPunishments((r.punishments || []) as PunishmentEntry[])
    setPunPage(r.page || 1)
    setPunTotalPages(r.totalPages || 1)
    setPunTotal(r.total || 0)
    setPunLoading(false)
  }, [])

  const fetchPunishmentLogs = useCallback(async (p: number) => {
    setPunLogLoading(true)
    const r = await getPunishmentLogs(p)
    setPunLogs((r.logs || []) as PunishmentLogEntry[])
    setPunLogPage(r.page || 1)
    setPunLogTotalPages(r.totalPages || 1)
    setPunLogTotal(r.total || 0)
    setPunLogLoading(false)
  }, [])

  // ─── Init ───
  useEffect(() => {
    getTodaySleepStatus().then(r => { setSleepSubmitted(r.submitted); setSleepStatus(r.status || null) })
    if (isAdmin) {
      autoApproveExpiredRequests()
      autoApplyExpiredPunishments()
      getMapsForQuestDropdown().then(m => setMapOptions(m))
      getNpcsForQuestDropdown().then(n => setNpcOptions(n))
      getPlayersForDropdown().then(p => setPlayerOptions(p))
      getAllActionAndQuestCodes().then(r => setTaskOptions([...r.actions, ...r.quests]))
    }
    fetchActionCodes(1)
    fetchQuestCodes(1)
    fetchActionSubs(1)
    fetchQuestSubs(1)
    fetchSleepLogs(1)
    fetchPrayerLogs(1)
    fetchPunishments(1)
    fetchPunishmentLogs(1)
    // Fetch player's active punishments for banner
    if (!isAdmin) {
      getPlayerActivePunishments().then(r => setActivePunishmentsForPlayer(r))
    }
  }, [isAdmin, fetchActionCodes, fetchQuestCodes, fetchActionSubs, fetchQuestSubs, fetchSleepLogs, fetchPrayerLogs, fetchPunishments, fetchPunishmentLogs])

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
      const expiration: CodeExpiration = {}
      if (type === 'action') {
        if (!genNoExpiry && genExpiresDate) expiration.expires_at = new Date(combineDateTime(genExpiresDate, genExpiresTime)).toISOString()
        if (!genUnlimitedRepeats && genMaxRepeats) expiration.max_repeats = parseInt(genMaxRepeats) || null
      } else {
        if (!genQuestNoExpiry && genQuestExpiresDate) expiration.expires_at = new Date(combineDateTime(genQuestExpiresDate, genQuestExpiresTime)).toISOString()
        if (!genQuestUnlimitedRepeats && genQuestMaxRepeats) expiration.max_repeats = parseInt(genQuestMaxRepeats) || null
      }

      const r = type === 'action'
        ? await generateActionCode(genName, genRewards, expiration)
        : await generateQuestCode(genName, genMapId || null, genNpcId || null, expiration)
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
      else {
        setPrayerSuccess({ gained: r.gained ?? 0, newSanity: r.newSanity ?? 0 })
        fetchPrayerLogs()
      }
    })
  }

  function handleCreatePunishment() {
    setPunError(null)
    if (!punName.trim()) { setPunError('กรุณากรอกชื่อบทลงโทษ'); return }
    if (punSelectedTasks.length === 0) { setPunError('กรุณาเลือกแอคชั่น/ภารกิจที่ต้องทำอย่างน้อย 1 รายการ'); return }
    if (punSelectedPlayers.length === 0) { setPunError('กรุณาเลือกผู้เล่นอย่างน้อย 1 คน'); return }
    const hasPenalty = Object.values(punPenalties).some(v => v > 0)
    if (!hasPenalty) { setPunError('กรุณากำหนดบทลงโทษอย่างน้อย 1 รายการ'); return }

    startTransition(async () => {
      const r = await createPunishment({
        name: punName,
        description: punDesc || undefined,
        ...punPenalties,
        deadline: !punNoDeadline && punDeadlineDate ? new Date(combineDateTime(punDeadlineDate, punDeadlineTime)).toISOString() : null,
        required_task_ids: punSelectedTasks,
        player_ids: punSelectedPlayers,
      })
      if (r.error) { setPunError(r.error) }
      else {
        setPunSuccess(true)
        fetchPunishments(1)
        fetchPunishmentLogs(1)
      }
    })
  }

  function handleRequestMercy(punishmentId: string) {
    startTransition(async () => {
      const r = await requestMercy(punishmentId)
      if (r.error) toast('error', r.error)
      else {
        toast('success', 'ขอเทพเมตตาสำเร็จ! คุณรอดพ้นบทลงโทษ')
        fetchPunishments(punPage)
        fetchPunishmentLogs(punLogPage)
      }
    })
  }

  function handleApplyPenalty(punishmentId: string, playerId: string) {
    startTransition(async () => {
      const r = await applyPenalty(punishmentId, playerId)
      if (r.error) toast('error', r.error)
      else {
        toast('success', 'ลงโทษสำเร็จ')
        fetchPunishments(punPage)
        fetchPunishmentLogs(punLogPage)
      }
    })
  }

  function confirmArchive() {
    if (!archiveConfirm) return
    const { type, id } = archiveConfirm
    setArchiveConfirm(null)
    startTransition(async () => {
      if (type === 'action') {
        const r = await archiveActionCode(id)
        if (r.error) toast('error', r.error)
        else { toast('success', 'เก็บเข้าคลังแล้ว'); fetchActionCodes(acPage) }
      } else if (type === 'quest') {
        const r = await archiveQuestCode(id)
        if (r.error) toast('error', r.error)
        else { toast('success', 'เก็บเข้าคลังแล้ว'); fetchQuestCodes(qcPage) }
      } else {
        const r = await archivePunishment(id)
        if (r.error) toast('error', r.error)
        else { toast('success', 'เก็บเข้าคลังแล้ว'); fetchPunishments(punPage) }
      }
    })
  }

  function openEditAction(c: CodeEntry) {
    setEditAction(c)
    setEditActionName(c.name)
    setEditActionRewards({
      reward_hp: c.reward_hp || 0,
      reward_sanity: c.reward_sanity || 0,
      reward_travel: c.reward_travel || 0,
      reward_spirituality: c.reward_spirituality || 0,
      reward_max_sanity: c.reward_max_sanity || 0,
      reward_max_travel: c.reward_max_travel || 0,
      reward_max_spirituality: c.reward_max_spirituality || 0,
    })
    const hasExpiry = !!c.expires_at
    setEditActionNoExpiry(!hasExpiry)
    if (hasExpiry) {
      const { date, time } = splitDateTime(c.expires_at!)
      setEditActionExpiresDate(date)
      setEditActionExpiresTime(time)
    } else {
      setEditActionExpiresDate('')
      setEditActionExpiresTime('')
    }
    const hasRepeatLimit = c.max_repeats !== null && c.max_repeats !== undefined
    setEditActionUnlimitedRepeats(!hasRepeatLimit)
    setEditActionMaxRepeats(hasRepeatLimit ? String(c.max_repeats) : '')
    setEditActionError(null)
  }

  function handleUpdateAction() {
    if (!editAction) return
    setEditActionError(null)
    if (!editActionName.trim()) { setEditActionError('กรุณากรอกชื่อ'); return }
    startTransition(async () => {
      const expiration: CodeExpiration = {}
      if (!editActionNoExpiry && editActionExpiresDate) expiration.expires_at = new Date(combineDateTime(editActionExpiresDate, editActionExpiresTime)).toISOString()
      else expiration.expires_at = null
      if (!editActionUnlimitedRepeats && editActionMaxRepeats) expiration.max_repeats = parseInt(editActionMaxRepeats) || null
      else expiration.max_repeats = null

      const r = await updateActionCode(editAction!.id, editActionName, editActionRewards, expiration)
      if (r.error) { setEditActionError(r.error) }
      else {
        toast('success', 'แก้ไขโค้ดแอคชั่นสำเร็จ')
        setEditAction(null)
        fetchActionCodes(acPage)
      }
    })
  }

  function openEditQuest(c: CodeEntry) {
    setEditQuest(c)
    setEditQuestName(c.name)
    setEditQuestMapId(c.map_id || '')
    setEditQuestNpcId(c.npc_token_id || '')
    const hasExpiry = !!c.expires_at
    setEditQuestNoExpiry(!hasExpiry)
    if (hasExpiry) {
      const { date, time } = splitDateTime(c.expires_at!)
      setEditQuestExpiresDate(date)
      setEditQuestExpiresTime(time)
    } else {
      setEditQuestExpiresDate('')
      setEditQuestExpiresTime('')
    }
    const hasRepeatLimit = c.max_repeats !== null && c.max_repeats !== undefined
    setEditQuestUnlimitedRepeats(!hasRepeatLimit)
    setEditQuestMaxRepeats(hasRepeatLimit ? String(c.max_repeats) : '')
    setEditQuestError(null)
  }

  function handleUpdateQuest() {
    if (!editQuest) return
    setEditQuestError(null)
    if (!editQuestName.trim()) { setEditQuestError('กรุณากรอกชื่อ'); return }
    startTransition(async () => {
      const expiration: CodeExpiration = {}
      if (!editQuestNoExpiry && editQuestExpiresDate) expiration.expires_at = new Date(combineDateTime(editQuestExpiresDate, editQuestExpiresTime)).toISOString()
      else expiration.expires_at = null
      if (!editQuestUnlimitedRepeats && editQuestMaxRepeats) expiration.max_repeats = parseInt(editQuestMaxRepeats) || null
      else expiration.max_repeats = null

      const r = await updateQuestCode(editQuest!.id, editQuestName, editQuestMapId || null, editQuestNpcId || null, expiration)
      if (r.error) { setEditQuestError(r.error) }
      else {
        toast('success', 'แก้ไขโค้ดภารกิจสำเร็จ')
        setEditQuest(null)
        fetchQuestCodes(qcPage)
      }
    })
  }

  function openEditPunishment(p: PunishmentEntry) {
    setEditPunishment(p)
    setEditPunName(p.name)
    setEditPunDesc(p.description || '')
    const hasDeadline = !!p.deadline
    setEditPunNoDeadline(!hasDeadline)
    if (hasDeadline) {
      const { date, time } = splitDateTime(p.deadline!)
      setEditPunDeadlineDate(date)
      setEditPunDeadlineTime(time)
    } else {
      setEditPunDeadlineDate('')
      setEditPunDeadlineTime('')
    }
    setEditPunPenalties({
      penalty_sanity: p.penalty_sanity,
      penalty_hp: p.penalty_hp,
      penalty_travel: p.penalty_travel,
      penalty_spirituality: p.penalty_spirituality,
      penalty_max_sanity: p.penalty_max_sanity,
      penalty_max_travel: p.penalty_max_travel,
      penalty_max_spirituality: p.penalty_max_spirituality,
    })
    setEditPunSelectedTasks(p.required_tasks.map(t =>
      t.action_code_id ? { action_code_id: t.action_code_id } : { quest_code_id: t.quest_code_id! }
    ))
    setEditPunSelectedPlayers(p.assigned_players.map(ap => ap.player_id))
    setEditPunError(null)
  }

  function handleUpdatePunishment() {
    if (!editPunishment) return
    setEditPunError(null)
    if (!editPunName.trim()) { setEditPunError('กรุณากรอกชื่อ'); return }
    if (editPunSelectedTasks.length === 0) { setEditPunError('กรุณาเลือกแอคชั่น/ภารกิจอย่างน้อย 1 รายการ'); return }
    if (editPunSelectedPlayers.length === 0) { setEditPunError('กรุณาเลือกผู้เล่นอย่างน้อย 1 คน'); return }
    const hasPenalty = Object.values(editPunPenalties).some(v => v > 0)
    if (!hasPenalty) { setEditPunError('กรุณากำหนดบทลงโทษอย่างน้อย 1 รายการ'); return }

    startTransition(async () => {
      const r = await updatePunishment(editPunishment!.id, {
        name: editPunName,
        description: editPunDesc || undefined,
        ...editPunPenalties,
        deadline: !editPunNoDeadline && editPunDeadlineDate ? new Date(combineDateTime(editPunDeadlineDate, editPunDeadlineTime)).toISOString() : null,
        required_task_ids: editPunSelectedTasks,
        player_ids: editPunSelectedPlayers,
      })
      if (r.error) { setEditPunError(r.error) }
      else {
        toast('success', 'แก้ไขบทลงโทษสำเร็จ')
        setEditPunishment(null)
        fetchPunishments(punPage)
        fetchPunishmentLogs(punLogPage)
      }
    })
  }

  /* ═══════════════════ RENDER ═══════════════════ */
  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'actions', label: 'แอคชั่น', icon: <Swords className="w-4 h-4" /> },
    { key: 'quests', label: 'ภารกิจ', icon: <Target className="w-4 h-4" /> },
    { key: 'prayer', label: 'ภาวนา', icon: <Church className="w-4 h-4" /> },
    { key: 'sleep', label: 'นอนหลับ', icon: <Moon className="w-4 h-4" /> },
    { key: 'punishments', label: 'บทลงโทษ', icon: <Skull className="w-4 h-4" /> },
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

        {/* ══════ PLAYER PUNISHMENT ALERT BANNER ══════ */}
        {!isAdmin && activePunishmentsForPlayer.length > 0 && (
          <div className="rounded-xl border-2 border-red-500/50 bg-gradient-to-r from-red-950/80 via-red-900/60 to-red-950/80 p-4 md:p-5 space-y-3 animate-pulse-slow shadow-lg shadow-red-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
                <Skull className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-red-300 font-bold text-base md:text-lg">⚠️ คุณกำลังอยู่ในบทลงโทษ!</h3>
                <p className="text-red-400/80 text-xs mt-0.5">
                  มี {activePunishmentsForPlayer.length} บทลงโทษที่ต้องดำเนินการ — ทำภารกิจให้ครบเพื่อขอเทพเมตตา
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {activePunishmentsForPlayer.map((pun: any) => (
                <div key={pun.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-red-950/60 border border-red-500/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-red-200 text-sm font-semibold truncate">{pun.name}</p>
                    {pun.deadline && (
                      <p className="text-red-400/70 text-[10px] mt-0.5">⏰ กำหนด: {fmtDate(pun.deadline)}</p>
                    )}
                  </div>
                  <button type="button" onClick={() => setShowPunishmentDetail(pun)}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 text-xs font-bold cursor-pointer transition-colors">
                    <Eye className="w-3.5 h-3.5" /> ดูรายละเอียด
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════ ADMIN TOOLS ══════ */}
        {isAdmin && (
          <Card className="p-5 md:p-8">
            <h2 className="heading-victorian text-xl md:text-2xl flex items-center gap-3 mb-5">
              <Shield className="w-5 h-5 text-gold-400" /> เครื่องมือ DM / Admin
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button type="button"
                onClick={() => { setShowGenAction(true); setGenName(''); setGenResult(null); setGenError(null); setGenRewards({}); setGenExpiresDate(''); setGenExpiresTime(''); setGenMaxRepeats(''); setGenNoExpiry(true); setGenUnlimitedRepeats(true) }}
                className="btn-gold !px-5 !py-4 !text-sm flex items-center justify-center gap-2 cursor-pointer">
                <Swords className="w-5 h-5" /> สร้างโค้ดแอคชั่น
              </button>
              <button type="button"
                onClick={() => { setShowGenQuest(true); setGenName(''); setGenMapId(''); setGenNpcId(''); setGenResult(null); setGenError(null); setGenQuestExpiresDate(''); setGenQuestExpiresTime(''); setGenQuestMaxRepeats(''); setGenQuestNoExpiry(true); setGenQuestUnlimitedRepeats(true) }}
                className="btn-gold !px-5 !py-4 !text-sm flex items-center justify-center gap-2 cursor-pointer">
                <Target className="w-5 h-5" /> สร้างโค้ดภารกิจ
              </button>
              <button type="button"
                onClick={() => {
                  setShowCreatePunishment(true); setPunName(''); setPunDesc(''); setPunDeadlineDate(''); setPunDeadlineTime(''); setPunNoDeadline(true)
                  setPunPenalties({ penalty_sanity: 0, penalty_hp: 0, penalty_travel: 0, penalty_spirituality: 0, penalty_max_sanity: 0, penalty_max_travel: 0, penalty_max_spirituality: 0 })
                  setPunSelectedTasks([]); setPunSelectedPlayers([]); setPunError(null); setPunSuccess(false)
                }}
                className="px-5 py-4 rounded-lg border-2 border-red-500/30 bg-red-500/5 text-red-300 hover:border-red-400/50 hover:bg-red-500/10 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all">
                <Skull className="w-5 h-5" /> สร้างบทลงโทษ
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
                        <th className="pb-2 pr-3">หมดอายุ</th>
                        <th className="pb-2 pr-3">ทำซ้ำ</th>
                        <th className="pb-2 pr-3">สร้างโดย</th>
                        <th className="pb-2 pr-3">วันที่</th>
                        <th className="pb-2">จัดการ</th>
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
                        const isExpired = c.expires_at && new Date(c.expires_at) < new Date()
                        return (
                        <tr key={c.id} className={`border-b border-victorian-800/50 hover:bg-victorian-800/20 ${isExpired ? 'opacity-50' : ''}`}>
                          <td className="py-2 pr-3 text-victorian-200">{c.name}{isExpired && <span className="text-red-400 text-[10px] ml-1">(หมดอายุ)</span>}</td>
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
                          <td className="py-2 pr-3">
                            {c.expires_at ? (
                              <span className={`text-xs ${isExpired ? 'text-red-400' : 'text-cyan-400'}`}>
                                {fmtDate(c.expires_at)}
                              </span>
                            ) : (
                              <span className="text-victorian-600 text-xs">ตลอดไป</span>
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            {c.max_repeats !== null && c.max_repeats !== undefined ? (
                              <span className="text-xs text-orange-400">{c.max_repeats} ครั้ง</span>
                            ) : (
                              <span className="text-victorian-600 text-xs">ไม่จำกัด</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-victorian-400">{c.created_by_name}</td>
                          <td className="py-2 pr-3 text-victorian-500 text-xs">{fmtDate(c.created_at)}</td>
                          <td className="py-2">
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => openEditAction(c)} disabled={isPending}
                                className="p-1.5 rounded bg-gold-400/10 border border-gold-400/20 text-gold-400 hover:bg-gold-400/20 cursor-pointer disabled:opacity-50 transition-colors"
                                title="แก้ไข">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => setArchiveConfirm({ type: 'action', id: c.id, name: c.name })} disabled={isPending}
                                className="p-1.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 cursor-pointer disabled:opacity-50 transition-colors"
                                title="เก็บเข้าคลัง">
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
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
                        <th className="pb-2 pr-3">หมดอายุ</th>
                        <th className="pb-2 pr-3">ทำซ้ำ</th>
                        <th className="pb-2 pr-3">สร้างโดย</th>
                        <th className="pb-2 pr-3">วันที่</th>
                        <th className="pb-2">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questCodes.map(c => {
                        const isExpired = c.expires_at && new Date(c.expires_at) < new Date()
                        return (
                        <tr key={c.id} className={`border-b border-victorian-800/50 hover:bg-victorian-800/20 ${isExpired ? 'opacity-50' : ''}`}>
                          <td className="py-2 pr-3 text-victorian-200">{c.name}{isExpired && <span className="text-red-400 text-[10px] ml-1">(หมดอายุ)</span>}</td>
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
                          <td className="py-2 pr-3">
                            {c.expires_at ? (
                              <span className={`text-xs ${isExpired ? 'text-red-400' : 'text-cyan-400'}`}>
                                {fmtDate(c.expires_at)}
                              </span>
                            ) : (
                              <span className="text-victorian-600 text-xs">ตลอดไป</span>
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            {c.max_repeats !== null && c.max_repeats !== undefined ? (
                              <span className="text-xs text-orange-400">{c.max_repeats} ครั้ง</span>
                            ) : (
                              <span className="text-victorian-600 text-xs">ไม่จำกัด</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-victorian-400">{c.created_by_name}</td>
                          <td className="py-2 pr-3 text-victorian-500 text-xs">{fmtDate(c.created_at)}</td>
                          <td className="py-2">
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => openEditQuest(c)} disabled={isPending}
                                className="p-1.5 rounded bg-gold-400/10 border border-gold-400/20 text-gold-400 hover:bg-gold-400/20 cursor-pointer disabled:opacity-50 transition-colors"
                                title="แก้ไข">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => setArchiveConfirm({ type: 'quest', id: c.id, name: c.name })} disabled={isPending}
                                className="p-1.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 cursor-pointer disabled:opacity-50 transition-colors"
                                title="เก็บเข้าคลัง">
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        )
                      })}
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
        {/*  TAB: PRAYER                            */}
        {/* ═══════════════════════════════════════ */}
        {activeTab === 'prayer' && (
          <div className="space-y-3">
            <h3 className="heading-victorian text-lg flex items-center gap-2">
              <Church className="w-4 h-4 text-purple-400" /> ประวัติการภาวนา
              <span className="text-victorian-500 text-xs font-normal ml-1">({plTotal})</span>
            </h3>

            {plLoading ? <SkeletonTable /> : prayerLogs.length === 0 ? (
              <div className="p-8 text-center border border-gold-400/10 rounded-sm" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
                <p className="text-victorian-400 heading-victorian">ยังไม่มีประวัติการภาวนา</p>
              </div>
            ) : (
              <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-victorian-500 text-left border-b border-gold-400/10">
                      {isAdmin && <th className="pb-2 pr-3">ผู้เล่น</th>}
                      <th className="pb-2 pr-3">สถานที่</th>
                      <th className="pb-2 pr-3">ผลลัพธ์</th>
                      <th className="pb-2 pr-3">หลักฐาน</th>
                      <th className="pb-2">วันที่</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prayerLogs.map(log => {
                      const church = log.map_churches
                      const religion = church?.religions
                      const mapName = church?.maps?.name
                      const player = log.profiles
                      return (
                        <tr key={log.id} className="border-b border-victorian-800/50 hover:bg-victorian-800/20">
                          {isAdmin && (
                            <td className="py-2.5 pr-3">
                              <div className="flex items-center gap-2">
                                <Avatar name={player?.display_name || '?'} url={player?.avatar_url} />
                                <span className="text-victorian-200 text-xs">{player?.display_name || 'Unknown'}</span>
                              </div>
                            </td>
                          )}
                          <td className="py-2.5 pr-3">
                            <div className="flex items-center gap-2">
                              {religion?.logo_url ? (
                                <img src={religion.logo_url} className="w-6 h-6 rounded-full border border-gold-400/20" />
                              ) : (
                                <Church className="w-4 h-4 text-gold-400/50" />
                              )}
                              <div>
                                <div className="text-victorian-200 text-xs font-semibold">{religion?.name_th || 'ไม่ทราบศาสนา'}</div>
                                <div className="text-victorian-500 text-[10px]">{mapName || 'ไม่ทราบแผนที่'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className="inline-flex items-center gap-1 text-cyan-400 text-xs font-bold bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                              🧠 +{log.sanity_gained}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3">
                            <div className="flex flex-wrap gap-1">
                              {(log.evidence_urls as string[]).map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-gold-400/70 hover:text-gold-400 transition-colors bg-gold-400/5 px-1 rounded flex items-center gap-1">
                                  <ExternalLink className="w-3 h-3" /> ลิงก์ {i + 1}
                                </a>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 text-victorian-500 text-xs">{fmtDate(log.created_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={plPage} totalPages={plTotalPages} onPage={fetchPrayerLogs} />
              </>
            )}
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

        {/* ═══════════════════════════════════════ */}
        {/*  TAB: PUNISHMENTS                       */}
        {/* ═══════════════════════════════════════ */}
        {activeTab === 'punishments' && (
          <div className="space-y-6">
            {/* Punishment list — Grid layout */}
            <div className="space-y-3">
              <h3 className="heading-victorian text-lg flex items-center gap-2">
                <Skull className="w-4 h-4 text-red-400" /> บทลงโทษ
                <span className="text-victorian-500 text-xs font-normal ml-1">({punTotal})</span>
              </h3>

              {punLoading ? <SkeletonTable /> : punishments.length === 0 ? (
                <div className="p-8 text-center border border-gold-400/10 rounded-sm" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
                  <p className="text-victorian-400 heading-victorian">ยังไม่มีบทลงโทษ</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {punishments.map(p => {
                      const penalties = [
                        p.penalty_hp > 0 ? `❤️ -${p.penalty_hp} HP` : '',
                        p.penalty_sanity > 0 ? `🧠 -${p.penalty_sanity} Sanity` : '',
                        p.penalty_travel > 0 ? `🗺️ -${p.penalty_travel} Travel` : '',
                        p.penalty_spirituality > 0 ? `✨ -${p.penalty_spirituality} Spirit` : '',
                        p.penalty_max_sanity > 0 ? `🧠 -${p.penalty_max_sanity} Max San` : '',
                        p.penalty_max_travel > 0 ? `🗺️ -${p.penalty_max_travel} Max Trv` : '',
                        p.penalty_max_spirituality > 0 ? `✨ -${p.penalty_max_spirituality} Max Spr` : '',
                      ].filter(Boolean)

                      const myEntry = p.assigned_players.find(ap => ap.player_id === _userId)
                      const isExpired = p.deadline && new Date(p.deadline) < new Date()
                      const allDone = p.assigned_players.every(ap => ap.penalty_applied || ap.mercy_requested)

                      return (
                        <Card key={p.id} className={`p-4 space-y-3 flex flex-col ${!p.is_active ? 'opacity-60' : ''} border-red-500/20`}>
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-victorian-100 font-bold text-sm flex items-center gap-1.5 leading-tight">
                              <Skull className="w-3.5 h-3.5 text-red-400 shrink-0" />
                              <span className="line-clamp-2">{p.name}</span>
                            </h4>
                            {isExpired && <span className="text-red-400 text-[9px] bg-red-500/10 px-1.5 py-0.5 rounded shrink-0">หมดเวลา</span>}
                            {allDone && !isExpired && <span className="text-green-400 text-[9px] bg-green-500/10 px-1.5 py-0.5 rounded shrink-0">เสร็จสิ้น</span>}
                          </div>

                          {p.description && <p className="text-victorian-400 text-[11px] line-clamp-2">{p.description}</p>}

                          {/* Penalties badges */}
                          <div className="flex flex-wrap gap-1">
                            {penalties.map((pen, i) => (
                              <span key={i} className="text-[10px] bg-red-900/40 text-red-300 px-1.5 py-0.5 rounded border border-red-500/20">
                                {pen}
                              </span>
                            ))}
                          </div>

                          {/* Required tasks (compact) */}
                          <div>
                            <p className="text-victorian-500 text-[10px] font-semibold mb-0.5">ต้องทำ:</p>
                            <div className="flex flex-wrap gap-1">
                              {p.required_tasks.map(t => (
                                <span key={t.id} className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                  t.action_code_id ? 'bg-amber-900/30 text-amber-300 border-amber-500/20' : 'bg-emerald-900/30 text-emerald-300 border-emerald-500/20'
                                }`}>
                                  {t.action_code_id ? `⚔️ ${t.action_name}` : `🎯 ${t.quest_name}`}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Assigned players (compact) */}
                          <div className="flex-1">
                            <p className="text-victorian-500 text-[10px] font-semibold mb-0.5 flex items-center gap-1">
                              <Users className="w-2.5 h-2.5" /> ผู้เล่น ({p.assigned_players.length}):
                            </p>
                            <div className="space-y-1">
                              {p.assigned_players.map(ap => (
                                <div key={ap.id} className="flex items-center justify-between gap-1.5 p-1.5 rounded bg-victorian-900/40 border border-victorian-800/50">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Avatar name={ap.player_name} url={ap.player_avatar} />
                                    <span className="text-victorian-200 text-[10px] truncate">{ap.player_name}</span>
                                    {ap.mercy_requested && <span className="text-green-400 text-[9px] shrink-0">✅</span>}
                                    {ap.penalty_applied && <span className="text-red-400 text-[9px] shrink-0">💀</span>}
                                    {!ap.is_completed && !ap.penalty_applied && !ap.mercy_requested && <span className="text-amber-400 text-[9px] shrink-0">⏳</span>}
                                  </div>
                                  {isAdmin && !ap.penalty_applied && !ap.mercy_requested && (
                                    <button type="button" onClick={() => handleApplyPenalty(p.id, ap.player_id)} disabled={isPending}
                                      className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-[9px] font-bold hover:bg-red-500/20 cursor-pointer disabled:opacity-50 shrink-0">
                                      ลงโทษ
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Player: Mercy */}
                          {myEntry && !myEntry.penalty_applied && !myEntry.mercy_requested && (
                            <MercyButton punishmentId={p.id} onMercy={handleRequestMercy} isPending={isPending} />
                          )}

                          {/* Footer: meta + admin actions */}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-victorian-800/50">
                            <div className="text-[9px] text-victorian-600">
                              <div>{p.created_by_name} · {fmtDate(p.created_at)}</div>
                              {p.deadline && <div className="text-cyan-400/70">กำหนด: {fmtDate(p.deadline)}</div>}
                            </div>
                            {isAdmin && (
                              <div className="flex items-center gap-1">
                                {!isExpired && (
                                  <button type="button" onClick={() => openEditPunishment(p)} disabled={isPending}
                                    className="p-1 rounded bg-gold-400/10 border border-gold-400/20 text-gold-400 hover:bg-gold-400/20 cursor-pointer disabled:opacity-50 transition-colors"
                                    title="แก้ไข">
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                )}
                                <button type="button" onClick={() => setArchiveConfirm({ type: 'punishment', id: p.id, name: p.name })} disabled={isPending}
                                  className="p-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 cursor-pointer disabled:opacity-50 transition-colors"
                                  title="เก็บเข้าคลัง">
                                  <Archive className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                  <Pagination page={punPage} totalPages={punTotalPages} onPage={fetchPunishments} />
                </>
              )}
            </div>

            {/* Punishment logs */}
            <div className="space-y-3">
              <h3 className="heading-victorian text-lg flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-red-400" /> บันทึกบทลงโทษ
                <span className="text-victorian-500 text-xs font-normal ml-1">({punLogTotal})</span>
              </h3>

              {punLogLoading ? <SkeletonTable /> : punLogs.length === 0 ? (
                <div className="p-8 text-center border border-gold-400/10 rounded-sm" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
                  <p className="text-victorian-400 heading-victorian">ยังไม่มีบันทึก</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-victorian-500 text-left border-b border-gold-400/10">
                          {isAdmin && <th className="pb-2 pr-3">ผู้เล่น</th>}
                          <th className="pb-2 pr-3">บทลงโทษ</th>
                          <th className="pb-2 pr-3">เหตุการณ์</th>
                          <th className="pb-2 pr-3">โดย</th>
                          <th className="pb-2">วันที่</th>
                        </tr>
                      </thead>
                      <tbody>
                        {punLogs.map(log => {
                          const actionLabel: Record<string, string> = {
                            assigned: '📋 มอบหมายบทลงโทษ',
                            penalty_applied: '💀 ลงโทษแล้ว',
                            mercy_requested: '🙏 ขอเทพเมตตา',
                            completed: '✅ สำเร็จ',
                            expired: '⏰ หมดเวลา',
                          }
                          return (
                            <tr key={log.id} className="border-b border-victorian-800/50 hover:bg-victorian-800/20">
                              {isAdmin && (
                                <td className="py-2.5 pr-3">
                                  <div className="flex items-center gap-2">
                                    <Avatar name={log.player_name} url={log.player_avatar} />
                                    <span className="text-victorian-200 text-xs">{log.player_name}</span>
                                  </div>
                                </td>
                              )}
                              <td className="py-2.5 pr-3 text-victorian-200 text-xs">{log.punishment_name}</td>
                              <td className="py-2.5 pr-3 text-victorian-300 text-xs">{actionLabel[log.action] || log.action}</td>
                              <td className="py-2.5 pr-3 text-victorian-500 text-xs">{log.created_by_name || '—'}</td>
                              <td className="py-2.5 text-victorian-500 text-xs">{fmtDate(log.created_at)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={punLogPage} totalPages={punLogTotalPages} onPage={fetchPunishmentLogs} />
                </>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/*  MODALS                                            */}
      {/* ═══════════════════════════════════════════════════ */}

      {/* --- Archive confirm modal --- */}
      {archiveConfirm && (
        <Modal onClose={() => setArchiveConfirm(null)}>
          <div className="flex items-center justify-between">
            <h3 className="heading-victorian text-xl flex items-center gap-3 text-red-400">
              <Archive className="w-5 h-5" /> ยืนยันเก็บเข้าคลัง
            </h3>
            <button type="button" onClick={() => setArchiveConfirm(null)} className="text-victorian-400 hover:text-gold-400 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-5 bg-red-950/60 border-2 border-red-500/30 rounded-xl space-y-3">
            <p className="text-victorian-200 text-sm">
              ต้องการเก็บ
              <strong className="text-red-300 mx-1">&quot;{archiveConfirm.name}&quot;</strong>
              เข้าคลังหรือไม่?
            </p>
            <p className="text-victorian-500 text-xs">
              {archiveConfirm.type === 'action' ? 'แอคชั่น' : archiveConfirm.type === 'quest' ? 'ภารกิจ' : 'บทลงโทษ'}นี้จะไม่แสดงในรายการอีกต่อไป แต่ข้อมูลยังคงอยู่ในระบบ
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setArchiveConfirm(null)} className="btn-victorian px-5 py-2 text-sm cursor-pointer">ยกเลิก</button>
            <button type="button" onClick={confirmArchive} disabled={isPending}
              className="px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-500 disabled:opacity-50 cursor-pointer transition-colors flex items-center gap-2">
              <Archive className="w-4 h-4" /> {isPending ? 'กำลังดำเนินการ...' : 'ยืนยันเก็บเข้าคลัง'}
            </button>
          </div>
        </Modal>
      )}

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

              {/* ── Expiration ── */}
              <div className="space-y-2">
                <label className="block text-sm text-victorian-300 font-semibold flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5 text-cyan-400" /> วันหมดอายุ
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-victorian-400 cursor-pointer">
                    <input type="checkbox" checked={genNoExpiry} onChange={e => setGenNoExpiry(e.target.checked)}
                      className="rounded border-gold-400/30" />
                    ตลอดไป (ไม่หมดอายุ)
                  </label>
                </div>
                {!genNoExpiry && (
                  <DateTimeInput dateVal={genExpiresDate} timeVal={genExpiresTime}
                    onDateChange={setGenExpiresDate} onTimeChange={setGenExpiresTime} />
                )}
              </div>

              {/* ── Repeat limit ── */}
              <div className="space-y-2">
                <label className="block text-sm text-victorian-300 font-semibold flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5 text-orange-400" /> จำกัดการทำซ้ำ
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-victorian-400 cursor-pointer">
                    <input type="checkbox" checked={genUnlimitedRepeats} onChange={e => setGenUnlimitedRepeats(e.target.checked)}
                      className="rounded border-gold-400/30" />
                    ไม่จำกัด (ทำซ้ำได้เรื่อย ๆ)
                  </label>
                </div>
                {!genUnlimitedRepeats && (
                  <input type="number" min={1} placeholder="จำนวนครั้งสูงสุด" value={genMaxRepeats} onChange={e => setGenMaxRepeats(e.target.value)}
                    className="input-victorian w-full !py-1.5 !text-xs" />
                )}
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

              {/* ── Expiration ── */}
              <div className="space-y-2">
                <label className="block text-sm text-victorian-300 font-semibold flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5 text-cyan-400" /> วันหมดอายุ
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-victorian-400 cursor-pointer">
                    <input type="checkbox" checked={genQuestNoExpiry} onChange={e => setGenQuestNoExpiry(e.target.checked)}
                      className="rounded border-gold-400/30" />
                    ตลอดไป (ไม่หมดอายุ)
                  </label>
                </div>
                {!genQuestNoExpiry && (
                  <DateTimeInput dateVal={genQuestExpiresDate} timeVal={genQuestExpiresTime}
                    onDateChange={setGenQuestExpiresDate} onTimeChange={setGenQuestExpiresTime} />
                )}
              </div>

              {/* ── Repeat limit ── */}
              <div className="space-y-2">
                <label className="block text-sm text-victorian-300 font-semibold flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5 text-orange-400" /> จำกัดการทำซ้ำ
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-victorian-400 cursor-pointer">
                    <input type="checkbox" checked={genQuestUnlimitedRepeats} onChange={e => setGenQuestUnlimitedRepeats(e.target.checked)}
                      className="rounded border-gold-400/30" />
                    ไม่จำกัด (ทำซ้ำได้เรื่อย ๆ)
                  </label>
                </div>
                {!genQuestUnlimitedRepeats && (
                  <input type="number" min={1} placeholder="จำนวนครั้งสูงสุด" value={genQuestMaxRepeats} onChange={e => setGenQuestMaxRepeats(e.target.value)}
                    className="input-victorian w-full !py-1.5 !text-xs" />
                )}
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

      {/* --- Punishment detail modal (player banner) --- */}
      {showPunishmentDetail && (
        <Modal onClose={() => setShowPunishmentDetail(null)}>
          <div className="flex items-center justify-between">
            <h3 className="heading-victorian text-xl flex items-center gap-3 text-red-400">
              <Skull className="w-5 h-5" /> รายละเอียดบทลงโทษ
            </h3>
            <button type="button" onClick={() => setShowPunishmentDetail(null)} className="text-victorian-400 hover:text-gold-400 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>

          <div className="p-5 bg-red-950/60 border-2 border-red-500/40 rounded-xl space-y-4">
            <div>
              <h4 className="text-red-200 font-bold text-lg">{showPunishmentDetail.name}</h4>
              {showPunishmentDetail.description && (
                <p className="text-red-300/80 text-sm mt-1 whitespace-pre-wrap">{showPunishmentDetail.description}</p>
              )}
            </div>

            {showPunishmentDetail.deadline && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <Clock className="w-4 h-4" />
                <span>กำหนดเสร็จ: <strong>{fmtDate(showPunishmentDetail.deadline)}</strong></span>
              </div>
            )}

            {/* Penalties */}
            <div className="border-t border-red-500/20 pt-3">
              <p className="text-red-400 text-xs font-bold mb-2">⚡ บทลงโทษหากไม่ทำสำเร็จ:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {showPunishmentDetail.penalty_sanity !== 0 && (
                  <div className="bg-red-900/40 rounded px-2 py-1.5 border border-red-500/20">
                    <span className="text-red-400">🧠 Sanity</span>
                    <span className="text-red-200 font-bold ml-1">{showPunishmentDetail.penalty_sanity}</span>
                  </div>
                )}
                {showPunishmentDetail.penalty_hp !== 0 && (
                  <div className="bg-red-900/40 rounded px-2 py-1.5 border border-red-500/20">
                    <span className="text-red-400">❤️ HP</span>
                    <span className="text-red-200 font-bold ml-1">{showPunishmentDetail.penalty_hp}</span>
                  </div>
                )}
                {showPunishmentDetail.penalty_travel !== 0 && (
                  <div className="bg-red-900/40 rounded px-2 py-1.5 border border-red-500/20">
                    <span className="text-red-400">🚶 Travel</span>
                    <span className="text-red-200 font-bold ml-1">{showPunishmentDetail.penalty_travel}</span>
                  </div>
                )}
                {showPunishmentDetail.penalty_spirituality !== 0 && (
                  <div className="bg-red-900/40 rounded px-2 py-1.5 border border-red-500/20">
                    <span className="text-red-400">✨ Spirituality</span>
                    <span className="text-red-200 font-bold ml-1">{showPunishmentDetail.penalty_spirituality}</span>
                  </div>
                )}
                {showPunishmentDetail.penalty_max_sanity !== 0 && (
                  <div className="bg-red-900/40 rounded px-2 py-1.5 border border-red-500/20">
                    <span className="text-red-400">🧠 Max Sanity</span>
                    <span className="text-red-200 font-bold ml-1">{showPunishmentDetail.penalty_max_sanity}</span>
                  </div>
                )}
                {showPunishmentDetail.penalty_max_travel !== 0 && (
                  <div className="bg-red-900/40 rounded px-2 py-1.5 border border-red-500/20">
                    <span className="text-red-400">🚶 Max Travel</span>
                    <span className="text-red-200 font-bold ml-1">{showPunishmentDetail.penalty_max_travel}</span>
                  </div>
                )}
                {showPunishmentDetail.penalty_max_spirituality !== 0 && (
                  <div className="bg-red-900/40 rounded px-2 py-1.5 border border-red-500/20">
                    <span className="text-red-400">✨ Max Spirituality</span>
                    <span className="text-red-200 font-bold ml-1">{showPunishmentDetail.penalty_max_spirituality}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Required tasks */}
            {showPunishmentDetail.required_tasks && showPunishmentDetail.required_tasks.length > 0 && (
              <div className="border-t border-red-500/20 pt-3">
                <p className="text-red-400 text-xs font-bold mb-2">📋 ภารกิจที่ต้องทำ:</p>
                <div className="space-y-1.5">
                  {showPunishmentDetail.required_tasks.map((task: any) => (
                    <div key={task.id} className="flex items-center gap-2 bg-red-900/30 rounded px-3 py-2 border border-red-500/15">
                      {task.action_name ? (
                        <>
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30 font-bold">ACTION</span>
                          <span className="text-red-200 text-xs">{task.action_name}</span>
                          <span className="text-victorian-500 text-[10px] font-mono">({task.action_code_str})</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30 font-bold">QUEST</span>
                          <span className="text-red-200 text-xs">{task.quest_name}</span>
                          <span className="text-victorian-500 text-[10px] font-mono">({task.quest_code_str})</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={() => setShowPunishmentDetail(null)} className="btn-victorian px-6 py-2 text-sm cursor-pointer">ปิด</button>
          </div>
        </Modal>
      )}

      {/* --- Create punishment modal --- */}
      {showCreatePunishment && (
        <Modal onClose={() => setShowCreatePunishment(false)}>
          <div className="flex items-center justify-between">
            <h3 className="heading-victorian text-2xl flex items-center gap-3">
              <Skull className="w-6 h-6 text-red-400" /> สร้างบทลงโทษ
            </h3>
            <button type="button" onClick={() => setShowCreatePunishment(false)} className="text-victorian-400 hover:text-gold-400 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>

          {!punSuccess ? (
            <>
              {/* Name */}
              <div>
                <label className="block text-sm text-victorian-300 mb-1.5">ชื่อบทลงโทษ <span className="text-nouveau-ruby">*</span></label>
                <input type="text" value={punName} onChange={e => setPunName(e.target.value)} placeholder="เช่น ไม่ทำภารกิจประจำวัน" className="input-victorian w-full !py-3 !text-sm" />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm text-victorian-300 mb-1.5">รายละเอียด</label>
                <textarea value={punDesc} onChange={e => setPunDesc(e.target.value)} placeholder="อธิบายเหตุผลบทลงโทษ..." rows={2} className="input-victorian w-full !py-2 !text-sm resize-none" />
              </div>

              {/* Required tasks */}
              <div className="space-y-2">
                <label className="block text-sm text-victorian-300 font-semibold flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-400" /> แอคชั่น/ภารกิจที่ต้องทำ <span className="text-nouveau-ruby">*</span>
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1 p-2 rounded-lg border border-gold-400/10 bg-victorian-900/40">
                  {taskOptions.length === 0 ? (
                    <p className="text-victorian-500 text-xs">ยังไม่มีแอคชั่น/ภารกิจ</p>
                  ) : taskOptions.map(t => {
                    const isSelected = punSelectedTasks.some(st =>
                      t.type === 'action' ? st.action_code_id === t.id : st.quest_code_id === t.id
                    )
                    return (
                      <label key={`${t.type}-${t.id}`} className="flex items-center gap-2 text-xs text-victorian-300 cursor-pointer hover:bg-victorian-800/40 p-1 rounded">
                        <input type="checkbox" checked={isSelected} onChange={() => {
                          if (isSelected) {
                            setPunSelectedTasks(prev => prev.filter(st =>
                              t.type === 'action' ? st.action_code_id !== t.id : st.quest_code_id !== t.id
                            ))
                          } else {
                            setPunSelectedTasks(prev => [
                              ...prev,
                              t.type === 'action' ? { action_code_id: t.id } : { quest_code_id: t.id }
                            ])
                          }
                        }} className="rounded border-gold-400/30" />
                        <span className={t.type === 'action' ? 'text-amber-400' : 'text-emerald-400'}>
                          {t.type === 'action' ? '⚔️' : '🎯'}
                        </span>
                        {t.name} <span className="text-victorian-600 font-mono">({t.code})</span>
                      </label>
                    )
                  })}
                </div>
                {punSelectedTasks.length > 0 && (
                  <p className="text-victorian-500 text-xs">เลือกแล้ว {punSelectedTasks.length} รายการ</p>
                )}
              </div>

              {/* Penalties */}
              <div className="space-y-2">
                <label className="block text-sm text-victorian-300 font-semibold flex items-center gap-1.5">
                  <Skull className="w-3.5 h-3.5 text-red-400" /> บทลงโทษ <span className="text-nouveau-ruby">*</span>
                  <span className="text-victorian-600 text-xs font-normal">(ลบค่าจากผู้เล่น)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['penalty_hp', 'HP', '❤️'],
                    ['penalty_sanity', 'Sanity', '🧠'],
                    ['penalty_travel', 'Travel Point', '🗺️'],
                    ['penalty_spirituality', 'Spirituality', '✨'],
                  ] as const).map(([key, lbl, ico]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <span className="text-sm">{ico}</span>
                      <span className="text-red-400 text-sm">-</span>
                      <input type="number" min={0} placeholder={lbl}
                        value={punPenalties[key] || ''}
                        onChange={e => setPunPenalties(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                        className="input-victorian w-full !py-1.5 !text-xs" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['penalty_max_sanity', 'Max Sanity', '🧠'],
                    ['penalty_max_travel', 'Max Travel', '🗺️'],
                    ['penalty_max_spirituality', 'Max Spirit', '✨'],
                  ] as const).map(([key, lbl, ico]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <span className="text-sm">{ico}</span>
                      <span className="text-red-400 text-sm">-</span>
                      <input type="number" min={0} placeholder={lbl}
                        value={punPenalties[key] || ''}
                        onChange={e => setPunPenalties(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                        className="input-victorian w-full !py-1.5 !text-xs" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Assigned players */}
              <div className="space-y-2">
                <label className="block text-sm text-victorian-300 font-semibold flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-purple-400" /> ผู้เล่นที่รับโทษ <span className="text-nouveau-ruby">*</span>
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1 p-2 rounded-lg border border-gold-400/10 bg-victorian-900/40">
                  {playerOptions.length === 0 ? (
                    <p className="text-victorian-500 text-xs">ยังไม่มีผู้เล่น</p>
                  ) : playerOptions.map(pl => {
                    const isSelected = punSelectedPlayers.includes(pl.id)
                    return (
                      <label key={pl.id} className="flex items-center gap-2 text-xs text-victorian-300 cursor-pointer hover:bg-victorian-800/40 p-1 rounded">
                        <input type="checkbox" checked={isSelected} onChange={() => {
                          if (isSelected) setPunSelectedPlayers(prev => prev.filter(id => id !== pl.id))
                          else setPunSelectedPlayers(prev => [...prev, pl.id])
                        }} className="rounded border-gold-400/30" />
                        <Avatar name={pl.display_name} url={pl.avatar_url} />
                        {pl.display_name}
                      </label>
                    )
                  })}
                </div>
                {punSelectedPlayers.length > 0 && (
                  <p className="text-victorian-500 text-xs">เลือกแล้ว {punSelectedPlayers.length} คน</p>
                )}
              </div>

              {/* Deadline */}
              <div className="space-y-2">
                <label className="block text-sm text-victorian-300 font-semibold flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5 text-cyan-400" /> กำหนดเวลา
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-victorian-400 cursor-pointer">
                    <input type="checkbox" checked={punNoDeadline} onChange={e => setPunNoDeadline(e.target.checked)}
                      className="rounded border-gold-400/30" />
                    ไม่มีกำหนด
                  </label>
                </div>
                {!punNoDeadline && (
                  <DateTimeInput dateVal={punDeadlineDate} timeVal={punDeadlineTime}
                    onDateChange={setPunDeadlineDate} onTimeChange={setPunDeadlineTime} />
                )}
              </div>

              {punError && <div className="p-3 bg-red-900/40 border border-red-500/30 rounded-lg text-red-300 text-sm text-center">{punError}</div>}

              <div className="p-3 bg-victorian-800/40 border border-gold-400/10 rounded-lg text-victorian-500 text-xs space-y-1">
                <p>• ผู้เล่นที่ถูกกำหนดจะเห็นบทลงโทษนี้ในแท็บ &quot;บทลงโทษ&quot;</p>
                <p>• ผู้เล่นต้องทำแอคชั่น/ภารกิจที่กำหนดให้ครบ ถึงจะกดปุ่ม &quot;ขอเทพเมตตา&quot; ได้</p>
                <p>• หากไม่ทำครบ ทีมงานสามารถลงโทษ (ลบค่า) ได้โดยตรง</p>
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreatePunishment(false)} className="btn-victorian px-4 py-2 text-sm cursor-pointer">ยกเลิก</button>
                <button type="button" onClick={handleCreatePunishment} disabled={isPending || !punName.trim() || punSelectedTasks.length === 0 || punSelectedPlayers.length === 0}
                  className="px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-500 disabled:opacity-50 cursor-pointer transition-colors">
                  {isPending ? 'กำลังสร้าง...' : '💀 สร้างบทลงโทษ'}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center space-y-4">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
              <p className="text-green-300 text-lg font-bold">สร้างบทลงโทษสำเร็จ!</p>
              <p className="text-victorian-400 text-sm">ผู้เล่นที่ถูกกำหนดจะเห็นบทลงโทษนี้ในแท็บ &quot;บทลงโทษ&quot;</p>
              <button type="button" onClick={() => setShowCreatePunishment(false)} className="btn-victorian px-6 py-2 text-sm cursor-pointer">ปิด</button>
            </div>
          )}
        </Modal>
      )}

      {/* --- Edit action code modal --- */}
      {editAction && (
        <Modal onClose={() => setEditAction(null)}>
          <div className="flex items-center justify-between">
            <h3 className="heading-victorian text-2xl flex items-center gap-3"><Pencil className="w-5 h-5 text-gold-400" /> แก้ไขโค้ดแอคชั่น</h3>
            <button type="button" onClick={() => setEditAction(null)} className="text-victorian-400 hover:text-gold-400 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-2 bg-victorian-900/60 border border-gold-400/10 rounded-lg text-center">
            <span className="font-mono text-gold-400 text-sm">{editAction.code}</span>
            <span className="text-victorian-500 text-[10px] ml-2">(โค้ดไม่สามารถเปลี่ยนได้)</span>
          </div>
          <div>
            <label className="block text-sm text-victorian-300 mb-1.5">ชื่อแอคชั่น <span className="text-nouveau-ruby">*</span></label>
            <input type="text" value={editActionName} onChange={e => setEditActionName(e.target.value)} className="input-victorian w-full !py-3 !text-sm" />
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-victorian-300 font-semibold flex items-center gap-1.5">
              <Gift className="w-3.5 h-3.5 text-emerald-400" /> มอบรางวัล
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([['reward_hp', 'HP', '❤️'], ['reward_sanity', 'Sanity', '🧠'], ['reward_travel', 'Travel', '🗺️'], ['reward_spirituality', 'Spirituality', '✨']] as const).map(([key, lbl, ico]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="text-sm">{ico}</span>
                  <input type="number" min={0} placeholder={lbl} value={editActionRewards[key] || ''} onChange={e => setEditActionRewards(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))} className="input-victorian w-full !py-1.5 !text-xs" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-victorian-300 font-semibold flex items-center gap-1.5">
              <Gift className="w-3.5 h-3.5 text-amber-400" /> เพิ่มค่าสูงสุด
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([['reward_max_sanity', 'Max Sanity', '🧠'], ['reward_max_travel', 'Max Travel', '🗺️'], ['reward_max_spirituality', 'Max Spirit', '✨']] as const).map(([key, lbl, ico]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="text-sm">{ico}</span>
                  <input type="number" min={0} placeholder={lbl} value={editActionRewards[key] || ''} onChange={e => setEditActionRewards(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))} className="input-victorian w-full !py-1.5 !text-xs" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-victorian-300 font-semibold flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-cyan-400" /> วันหมดอายุ
            </label>
            <label className="flex items-center gap-2 text-xs text-victorian-400 cursor-pointer">
              <input type="checkbox" checked={editActionNoExpiry} onChange={e => setEditActionNoExpiry(e.target.checked)} className="rounded border-gold-400/30" />
              ตลอดไป (ไม่หมดอายุ)
            </label>
            {!editActionNoExpiry && (
              <DateTimeInput dateVal={editActionExpiresDate} timeVal={editActionExpiresTime}
                onDateChange={setEditActionExpiresDate} onTimeChange={setEditActionExpiresTime} />
            )}
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-victorian-300 font-semibold flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5 text-orange-400" /> จำกัดการทำซ้ำ
            </label>
            <label className="flex items-center gap-2 text-xs text-victorian-400 cursor-pointer">
              <input type="checkbox" checked={editActionUnlimitedRepeats} onChange={e => setEditActionUnlimitedRepeats(e.target.checked)} className="rounded border-gold-400/30" />
              ไม่จำกัด
            </label>
            {!editActionUnlimitedRepeats && (
              <input type="number" min={1} placeholder="จำนวนครั้ง" value={editActionMaxRepeats} onChange={e => setEditActionMaxRepeats(e.target.value)} className="input-victorian w-full !py-1.5 !text-xs" />
            )}
          </div>
          {editActionError && <div className="p-3 bg-red-900/40 border border-red-500/30 rounded-lg text-red-300 text-sm text-center">{editActionError}</div>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setEditAction(null)} className="btn-victorian px-4 py-2 text-sm cursor-pointer">ยกเลิก</button>
            <button type="button" onClick={handleUpdateAction} disabled={isPending || !editActionName.trim()}
              className="btn-gold !px-6 !py-2 !text-sm disabled:opacity-50">{isPending ? 'กำลังบันทึก...' : 'บันทึก'}</button>
          </div>
        </Modal>
      )}

      {/* --- Edit quest code modal --- */}
      {editQuest && (
        <Modal onClose={() => setEditQuest(null)}>
          <div className="flex items-center justify-between">
            <h3 className="heading-victorian text-2xl flex items-center gap-3"><Pencil className="w-5 h-5 text-gold-400" /> แก้ไขโค้ดภารกิจ</h3>
            <button type="button" onClick={() => setEditQuest(null)} className="text-victorian-400 hover:text-gold-400 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-2 bg-victorian-900/60 border border-gold-400/10 rounded-lg text-center">
            <span className="font-mono text-gold-400 text-sm">{editQuest.code}</span>
            <span className="text-victorian-500 text-[10px] ml-2">(โค้ดไม่สามารถเปลี่ยนได้)</span>
          </div>
          <div>
            <label className="block text-sm text-victorian-300 mb-1.5">ชื่อภารกิจ <span className="text-nouveau-ruby">*</span></label>
            <input type="text" value={editQuestName} onChange={e => setEditQuestName(e.target.value)} className="input-victorian w-full !py-3 !text-sm" />
          </div>
          <div>
            <label className="block text-sm text-victorian-300 mb-1.5">
              <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-emerald-400" /> สถานที่ภารกิจ</span>
            </label>
            <select value={editQuestNpcId ? '' : editQuestMapId} onChange={e => setEditQuestMapId(e.target.value)} disabled={!!editQuestNpcId} className="input-victorian w-full !py-3 !text-sm disabled:opacity-50">
              <option value="">— ไม่จำกัดสถานที่ —</option>
              {mapOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-victorian-300 mb-1.5">
              <span className="inline-flex items-center gap-1"><Ghost className="w-3.5 h-3.5 text-nouveau-ruby" /> NPC ภารกิจ</span>
            </label>
            <select value={editQuestNpcId} onChange={e => { const val = e.target.value; setEditQuestNpcId(val); if (val) { const npc = npcOptions.find(n => n.id === val); if (npc) setEditQuestMapId(npc.map_id) } }} className="input-victorian w-full !py-3 !text-sm">
              <option value="">— ไม่กำหนด NPC —</option>
              {npcOptions.map(n => <option key={n.id} value={n.id}>{n.npc_name}{n.map_name ? ` (${n.map_name})` : ''}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-victorian-300 font-semibold flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-cyan-400" /> วันหมดอายุ
            </label>
            <label className="flex items-center gap-2 text-xs text-victorian-400 cursor-pointer">
              <input type="checkbox" checked={editQuestNoExpiry} onChange={e => setEditQuestNoExpiry(e.target.checked)} className="rounded border-gold-400/30" />
              ตลอดไป (ไม่หมดอายุ)
            </label>
            {!editQuestNoExpiry && (
              <DateTimeInput dateVal={editQuestExpiresDate} timeVal={editQuestExpiresTime}
                onDateChange={setEditQuestExpiresDate} onTimeChange={setEditQuestExpiresTime} />
            )}
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-victorian-300 font-semibold flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5 text-orange-400" /> จำกัดการทำซ้ำ
            </label>
            <label className="flex items-center gap-2 text-xs text-victorian-400 cursor-pointer">
              <input type="checkbox" checked={editQuestUnlimitedRepeats} onChange={e => setEditQuestUnlimitedRepeats(e.target.checked)} className="rounded border-gold-400/30" />
              ไม่จำกัด
            </label>
            {!editQuestUnlimitedRepeats && (
              <input type="number" min={1} placeholder="จำนวนครั้ง" value={editQuestMaxRepeats} onChange={e => setEditQuestMaxRepeats(e.target.value)} className="input-victorian w-full !py-1.5 !text-xs" />
            )}
          </div>
          {editQuestError && <div className="p-3 bg-red-900/40 border border-red-500/30 rounded-lg text-red-300 text-sm text-center">{editQuestError}</div>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setEditQuest(null)} className="btn-victorian px-4 py-2 text-sm cursor-pointer">ยกเลิก</button>
            <button type="button" onClick={handleUpdateQuest} disabled={isPending || !editQuestName.trim()}
              className="btn-gold !px-6 !py-2 !text-sm disabled:opacity-50">{isPending ? 'กำลังบันทึก...' : 'บันทึก'}</button>
          </div>
        </Modal>
      )}

      {/* --- Edit punishment modal --- */}
      {editPunishment && (
        <Modal onClose={() => setEditPunishment(null)}>
          <div className="flex items-center justify-between">
            <h3 className="heading-victorian text-2xl flex items-center gap-3"><Pencil className="w-5 h-5 text-red-400" /> แก้ไขบทลงโทษ</h3>
            <button type="button" onClick={() => setEditPunishment(null)} className="text-victorian-400 hover:text-gold-400 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
          <div>
            <label className="block text-sm text-victorian-300 mb-1.5">ชื่อบทลงโทษ <span className="text-nouveau-ruby">*</span></label>
            <input type="text" value={editPunName} onChange={e => setEditPunName(e.target.value)} className="input-victorian w-full !py-3 !text-sm" />
          </div>
          <div>
            <label className="block text-sm text-victorian-300 mb-1.5">รายละเอียด</label>
            <textarea value={editPunDesc} onChange={e => setEditPunDesc(e.target.value)} rows={2} className="input-victorian w-full !py-2 !text-sm resize-none" />
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-victorian-300 font-semibold flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-emerald-400" /> แอคชั่น/ภารกิจที่ต้องทำ <span className="text-nouveau-ruby">*</span>
            </label>
            <div className="max-h-40 overflow-y-auto space-y-1 p-2 rounded-lg border border-gold-400/10 bg-victorian-900/40">
              {taskOptions.map(t => {
                const isSelected = editPunSelectedTasks.some(st => t.type === 'action' ? st.action_code_id === t.id : st.quest_code_id === t.id)
                return (
                  <label key={`${t.type}-${t.id}`} className="flex items-center gap-2 text-xs text-victorian-300 cursor-pointer hover:bg-victorian-800/40 p-1 rounded">
                    <input type="checkbox" checked={isSelected} onChange={() => {
                      if (isSelected) setEditPunSelectedTasks(prev => prev.filter(st => t.type === 'action' ? st.action_code_id !== t.id : st.quest_code_id !== t.id))
                      else setEditPunSelectedTasks(prev => [...prev, t.type === 'action' ? { action_code_id: t.id } : { quest_code_id: t.id }])
                    }} className="rounded border-gold-400/30" />
                    <span className={t.type === 'action' ? 'text-amber-400' : 'text-emerald-400'}>{t.type === 'action' ? '⚔️' : '🎯'}</span>
                    {t.name} <span className="text-victorian-600 font-mono">({t.code})</span>
                  </label>
                )
              })}
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-victorian-300 font-semibold flex items-center gap-1.5">
              <Skull className="w-3.5 h-3.5 text-red-400" /> บทลงโทษ <span className="text-nouveau-ruby">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([['penalty_hp', 'HP', '❤️'], ['penalty_sanity', 'Sanity', '🧠'], ['penalty_travel', 'Travel', '🗺️'], ['penalty_spirituality', 'Spirit', '✨']] as const).map(([key, lbl, ico]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="text-sm">{ico}</span><span className="text-red-400 text-sm">-</span>
                  <input type="number" min={0} placeholder={lbl} value={editPunPenalties[key] || ''} onChange={e => setEditPunPenalties(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))} className="input-victorian w-full !py-1.5 !text-xs" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([['penalty_max_sanity', 'Max Sanity', '🧠'], ['penalty_max_travel', 'Max Travel', '🗺️'], ['penalty_max_spirituality', 'Max Spirit', '✨']] as const).map(([key, lbl, ico]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="text-sm">{ico}</span><span className="text-red-400 text-sm">-</span>
                  <input type="number" min={0} placeholder={lbl} value={editPunPenalties[key] || ''} onChange={e => setEditPunPenalties(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))} className="input-victorian w-full !py-1.5 !text-xs" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-victorian-300 font-semibold flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-400" /> ผู้เล่นที่รับโทษ <span className="text-nouveau-ruby">*</span>
            </label>
            <div className="max-h-40 overflow-y-auto space-y-1 p-2 rounded-lg border border-gold-400/10 bg-victorian-900/40">
              {playerOptions.map(pl => {
                const isSelected = editPunSelectedPlayers.includes(pl.id)
                return (
                  <label key={pl.id} className="flex items-center gap-2 text-xs text-victorian-300 cursor-pointer hover:bg-victorian-800/40 p-1 rounded">
                    <input type="checkbox" checked={isSelected} onChange={() => {
                      if (isSelected) setEditPunSelectedPlayers(prev => prev.filter(id => id !== pl.id))
                      else setEditPunSelectedPlayers(prev => [...prev, pl.id])
                    }} className="rounded border-gold-400/30" />
                    <Avatar name={pl.display_name} url={pl.avatar_url} />
                    {pl.display_name}
                  </label>
                )
              })}
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-victorian-300 font-semibold flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-cyan-400" /> กำหนดเวลา
            </label>
            <label className="flex items-center gap-2 text-xs text-victorian-400 cursor-pointer">
              <input type="checkbox" checked={editPunNoDeadline} onChange={e => setEditPunNoDeadline(e.target.checked)} className="rounded border-gold-400/30" />
              ไม่มีกำหนด
            </label>
            {!editPunNoDeadline && (
              <DateTimeInput dateVal={editPunDeadlineDate} timeVal={editPunDeadlineTime}
                onDateChange={setEditPunDeadlineDate} onTimeChange={setEditPunDeadlineTime} />
            )}
          </div>
          {editPunError && <div className="p-3 bg-red-900/40 border border-red-500/30 rounded-lg text-red-300 text-sm text-center">{editPunError}</div>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setEditPunishment(null)} className="btn-victorian px-4 py-2 text-sm cursor-pointer">ยกเลิก</button>
            <button type="button" onClick={handleUpdatePunishment} disabled={isPending || !editPunName.trim() || editPunSelectedTasks.length === 0 || editPunSelectedPlayers.length === 0}
              className="px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-500 disabled:opacity-50 cursor-pointer transition-colors">
              {isPending ? 'กำลังบันทึก...' : '💀 บันทึกบทลงโทษ'}
            </button>
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

function MercyButton({ punishmentId, onMercy, isPending }: {
  punishmentId: string; onMercy: (id: string) => void; isPending: boolean
}) {
  const [canMercy, setCanMercy] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    checkPlayerTaskCompletion(punishmentId).then(r => {
      setCanMercy(r.allCompleted)
      setChecking(false)
    })
  }, [punishmentId])

  return (
    <div className="pt-2 border-t border-red-500/10">
      {checking ? (
        <p className="text-victorian-500 text-xs">กำลังตรวจสอบ...</p>
      ) : canMercy ? (
        <button type="button" onClick={() => onMercy(punishmentId)} disabled={isPending}
          className="w-full px-4 py-3 rounded-lg bg-green-600/20 border-2 border-green-500/40 text-green-300 font-bold text-sm hover:bg-green-600/30 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
          <HandHeart className="w-5 h-5" /> ขอเทพเมตตา
        </button>
      ) : (
        <div className="p-3 bg-red-900/20 border border-red-500/20 rounded-lg text-center">
          <p className="text-red-300 text-xs font-semibold flex items-center justify-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> ยังทำภารกิจไม่ครบ ไม่สามารถขอเทพเมตตาได้
          </p>
          <p className="text-victorian-500 text-[10px] mt-1">ทำแอคชั่น/ภารกิจที่กำหนดให้ครบ แล้วรอการอนุมัติจากทีมงาน</p>
        </div>
      )}
    </div>
  )
}
