'use client'

import AdminEditModal from '@/components/admin/admin-edit-modal'
import { ArrowLeft, Crown, Shield, Swords, Pencil, Users, Church, Plus, Trash2, X, Save, Eye, ScrollText, LayoutGrid, List, Search } from 'lucide-react'
import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import SanityLockOverlay from '@/components/sanity-lock-overlay'
import { CornerOrnament } from '@/components/ui/ornaments'
import { createClient } from '@/lib/supabase/client'
import { getCached, setCache, REF_TTL } from '@/lib/client-cache'
import {
  getReligions, createReligion, updateReligion, deleteReligion,
} from '@/app/actions/religions'

interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  background_url: string | null
  bio: string | null
  role: 'player' | 'admin' | 'dm'
  hp: number
  sanity: number
  max_sanity: number
  spirituality: number
  max_spirituality: number
  travel_points: number
  max_travel_points: number
  potion_digest_progress: number
  religion_id: string | null
  religions?: {
    id: string
    name_th: string
    logo_url: string | null
  } | null
  created_at: string
  updated_at: string
}

interface PlayerPathway {
  id: string
  player_id: string
  pathway_id: string | null
  sequence_id: string | null
}

interface Pathway {
  id: string
  name: string
}

interface Sequence {
  id: string
  pathway_id: string
  seq_number: number
  name: string
}

interface Religion {
  id: string
  name_th: string
  name_en: string
  deity_th: string | null
  deity_en: string | null
  overview: string | null
  teachings: string | null
  bg_url: string | null
  logo_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

type TabKey = 'players' | 'religions'

/** Server-fetched initial data — skips the client-side loading spinner */
interface PlayersInitialData {
  currentProfile: Profile
  players: Profile[]
  playerPathways: PlayerPathway[]
  pathways: Pathway[]
  sequences: Sequence[]
}


function RoleIcon({ role }: { role: string }) {
  if (role === 'admin') return <Crown className="w-4 h-4 text-gold-300" />
  if (role === 'dm') return <Shield className="w-4 h-4 text-nouveau-emerald" />
  return <Swords className="w-4 h-4 text-metal-silver" />
}

export default function PlayersContent({ userId, initialData }: { userId: string; initialData?: PlayersInitialData }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(initialData?.currentProfile ?? getCached<Profile>('players:me'))
  const [players, setPlayers] = useState<Profile[]>(initialData?.players ?? getCached<Profile[]>('players:all') ?? [])
  const [playerPathways, setPlayerPathways] = useState<PlayerPathway[]>(initialData?.playerPathways ?? getCached<PlayerPathway[]>('players:pp') ?? [])
  const [pathways, setPathways] = useState<Pathway[]>(initialData?.pathways ?? getCached<Pathway[]>('players:pw') ?? [])
  const [sequences, setSequences] = useState<Sequence[]>(initialData?.sequences ?? getCached<Sequence[]>('players:seq') ?? [])
  const [loaded, setLoaded] = useState(!!initialData || !!getCached('players:me'))
  const [editingPlayer, setEditingPlayer] = useState<Profile | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')

  // ── Religion state ──
  const [activeTab, setActiveTab] = useState<TabKey>('players')
  const [religions, setReligions] = useState<Religion[]>([])
  const [showReligionForm, setShowReligionForm] = useState(false)
  const [editingReligion, setEditingReligion] = useState<Religion | null>(null)
  const [viewingReligion, setViewingReligion] = useState<Religion | null>(null)
  const [relForm, setRelForm] = useState({ name_th: '', name_en: '', deity_th: '', deity_en: '', overview: '', teachings: '', bg_url: '', logo_url: '' })
  const [relError, setRelError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const fetchPlayers = () => {
      Promise.all([
        supabase.from('profiles').select('*, religions(id, name_th, logo_url)').eq('id', userId).single(),
        supabase.from('profiles').select('*, religions(id, name_th, logo_url)').order('display_name'),
        supabase.from('player_pathways').select('*'),
        supabase.from('skill_pathways').select('*'),
        supabase.from('skill_sequences').select('*'),
      ]).then(([meRes, allRes, ppRes, pwRes, seqRes]) => {
        if (meRes.data) { setCurrentProfile(meRes.data); setCache('players:me', meRes.data) }
        if (allRes.data) { setPlayers(allRes.data); setCache('players:all', allRes.data) }
        if (ppRes.data) { setPlayerPathways(ppRes.data); setCache('players:pp', ppRes.data) }
        if (pwRes.data) { setPathways(pwRes.data); setCache('players:pw', pwRes.data, REF_TTL) }
        if (seqRes.data) { setSequences(seqRes.data); setCache('players:seq', seqRes.data, REF_TTL) }
        setLoaded(true)
      })
    }
    
    // If server provided initial data, only subscribe to realtime (skip initial fetch)
    if (!initialData) fetchPlayers()

    const channel = supabase
      .channel('players_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchPlayers())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_pathways' }, () => fetchPlayers())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, initialData])

  // ── Fetch religions ──
  useEffect(() => {
    getReligions().then(r => { if (r.religions) setReligions(r.religions as Religion[]) })
  }, [])

  const isAdmin = currentProfile?.role === 'admin'
  const isDM = currentProfile?.role === 'dm'
  const isStaff = isAdmin || isDM
  const isSanityLocked = (currentProfile?.sanity ?? 10) === 0

  function openReligionForm(rel?: Religion) {
    if (rel) {
      setEditingReligion(rel)
      setRelForm({
        name_th: rel.name_th, name_en: rel.name_en,
        deity_th: rel.deity_th || '', deity_en: rel.deity_en || '',
        overview: rel.overview || '', teachings: rel.teachings || '', bg_url: rel.bg_url || '', logo_url: rel.logo_url || '',
      })
    } else {
      setEditingReligion(null)
      setRelForm({ name_th: '', name_en: '', deity_th: '', deity_en: '', overview: '', teachings: '', bg_url: '', logo_url: '' })
    }
    setRelError(null)
    setShowReligionForm(true)
  }

  function handleSaveReligion() {
    setRelError(null)
    startTransition(async () => {
      const r = editingReligion
        ? await updateReligion(editingReligion.id, relForm)
        : await createReligion(relForm)
      if (r.error) { setRelError(r.error) }
      else {
        setShowReligionForm(false)
        const fresh = await getReligions()
        if (fresh.religions) setReligions(fresh.religions as Religion[])
      }
    })
  }

  function handleDeleteReligion(id: string) {
    if (!confirm('ลบศาสนานี้?')) return
    startTransition(async () => {
      await deleteReligion(id)
      const fresh = await getReligions()
      if (fresh.religions) setReligions(fresh.religions as Religion[])
    })
  }

  if (!loaded) return (
    <div className="min-h-screen" style={{ backgroundColor: '#1A1612' }}>
      <div className="border-b border-[#D4AF37]/10" style={{ backgroundColor: 'rgba(15,13,10,0.8)' }}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6 flex items-center gap-4">
          <div className="w-9 h-9 rounded border border-[#D4AF37]/10 bg-[#2A2520] animate-pulse" />
          <div className="space-y-2">
            <div className="h-8 w-40 rounded bg-[#2A2520] animate-pulse" />
            <div className="h-3 w-56 rounded bg-[#2A2520] animate-pulse" />
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="border border-[#D4AF37]/10 rounded-sm p-5" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#2A2520] animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-28 rounded bg-[#2A2520] animate-pulse" />
                  <div className="h-3 w-20 rounded bg-[#2A2520] animate-pulse" />
                  <div className="h-3 w-36 rounded bg-[#2A2520] animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // Helper: get pathways for a player
  function getPlayerPathwayInfo(playerId: string) {
    const pp = playerPathways.filter((p) => p.player_id === playerId)
    return pp.map((p) => {
      const pathway = pathways.find((pw) => pw.id === p.pathway_id)
      const sequence = sequences.find((s) => s.id === p.sequence_id)
      return {
        pathwayName: pathway?.name || null,
        sequenceName: sequence?.name || null,
        seqNumber: sequence?.seq_number ?? null,
      }
    }).filter(info => info.pathwayName !== null)
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gold-400/10 bg-victorian-950/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="text-victorian-400 hover:text-gold-400 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <span className="text-gold-400 text-2xl">⚜</span>
            <h1 className="heading-victorian text-2xl">ทำเนียบ</h1>
          </div>
          <div className="flex items-center gap-2 text-victorian-400">
            <Users className="w-5 h-5" />
            <span className="font-display text-lg">{players.length} คน</span>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex gap-0">
          {([
            { key: 'players' as TabKey, label: 'ผู้เล่น', icon: <Users className="w-4 h-4" /> },
            { key: 'religions' as TabKey, label: 'ศาสนา', icon: <Church className="w-4 h-4" /> },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-display tracking-wider border-b-2 transition-all cursor-pointer
                ${activeTab === tab.key
                  ? 'border-gold-400 text-gold-400'
                  : 'border-transparent text-victorian-400 hover:text-victorian-200'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* ═══ TAB: Players ═══ */}
      {activeTab === 'players' && (
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        {/* Search + Toggle */}
        <div className="flex items-center gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-victorian-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาผู้เล่น..."
              className="w-full pl-9 pr-4 py-2.5 bg-victorian-950/60 border border-gold-400/20 rounded-sm text-nouveau-cream placeholder-victorian-500 text-sm font-display focus:outline-none focus:border-gold-400/50 transition-colors"
            />
          </div>
          <div className="flex border border-gold-400/20 rounded-sm overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 transition-colors ${
                viewMode === 'grid' ? 'bg-gold-400/15 text-gold-400' : 'bg-victorian-950/60 text-victorian-400 hover:text-victorian-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 transition-colors border-l border-gold-400/20 ${
                viewMode === 'list' ? 'bg-gold-400/15 text-gold-400' : 'bg-victorian-950/60 text-victorian-400 hover:text-victorian-200'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {(() => {
          const filtered = players.filter(p => !search || p.display_name?.toLowerCase().includes(search.toLowerCase()))
          const dmList = filtered.filter(p => p.role === 'dm')
          const adminList = filtered.filter(p => p.role === 'admin')
          const playerList = filtered.filter(p => p.role === 'player')
          const staffList = [...dmList, ...adminList]

          return (
            <>
              {/* ── Staff Section ── */}
              {staffList.length > 0 && (
                <div className="mb-8">
                  {/* Section header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg,transparent,#c9a84c55)' }} />
                    <span className="text-xs font-display tracking-[0.25em] uppercase"
                      style={{ background: 'linear-gradient(135deg,#c9a84c,#f0d080,#b8881e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                      ผู้ดูแล
                    </span>
                    <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg,#c9a84c55,transparent)' }} />
                  </div>

                  {/* Grid View — DM featured full-width, then Admins compact */}
                  {viewMode === 'grid' && (
                    <div className="space-y-3">
                      {/* DM — full-width grand banner */}
                      {dmList.map(player => {
                        const pathwayInfo = getPlayerPathwayInfo(player.id)
                        return (
                          <div
                            key={player.id}
                            onClick={() => router.push(`/dashboard/players/${player.id}`)}
                            className="relative overflow-hidden group cursor-pointer rounded-sm border transition-all duration-300"
                            style={{
                              borderColor: 'rgba(52,211,153,0.5)',
                              background: 'linear-gradient(135deg,rgba(8,24,18,0.98) 0%,rgba(12,32,24,0.98) 40%,rgba(8,22,16,0.98) 100%)',
                              boxShadow: '0 0 40px rgba(52,211,153,0.18), 0 0 80px rgba(52,211,153,0.07), inset 0 0 80px rgba(52,211,153,0.04)',
                            }}
                          >
                            <CornerOrnament className="absolute top-0 left-0 z-10" size={52} />
                            <CornerOrnament className="absolute top-0 right-0 -scale-x-100 z-10" size={52} />
                            <CornerOrnament className="absolute bottom-0 left-0 -scale-y-100 z-10" size={52} />
                            <CornerOrnament className="absolute bottom-0 right-0 scale-x-[-1] scale-y-[-1] z-10" size={52} />
                            {/* Top shimmer */}
                            <div className="absolute top-0 left-0 right-0 h-[2px] z-20"
                              style={{ background: 'linear-gradient(90deg,transparent 0%,#34d399 20%,#6ee7b7 50%,#34d399 80%,transparent 100%)' }} />
                            <div className="absolute bottom-0 left-0 right-0 h-[1px] z-20"
                              style={{ background: 'linear-gradient(90deg,transparent,#34d39940,transparent)' }} />
                            {/* Background */}
                            {player.background_url && (
                              <div className="absolute inset-0 z-0">
                                <img src={player.background_url} alt="" className="w-full h-full object-cover opacity-15 group-hover:opacity-22 transition-opacity duration-500" loading="lazy" decoding="async" />
                                <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg,rgba(8,24,18,0.7) 0%,rgba(8,22,16,0.92) 100%)' }} />
                              </div>
                            )}
                            {/* DM badge */}
                            <div className="absolute top-3.5 right-3.5 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-sm border"
                              style={{ borderColor: 'rgba(52,211,153,0.35)', background: 'rgba(52,211,153,0.08)' }}>
                              <Shield className="w-3.5 h-3.5 text-nouveau-emerald" />
                              <span className="text-[10px] font-display tracking-widest uppercase" style={{ color: '#6ee7b7' }}>DM</span>
                            </div>
                            <div className="relative z-10 flex items-center gap-5 px-5 py-4">
                              {/* Avatar */}
                              {player.avatar_url ? (
                                <div className="relative flex-shrink-0">
                                  <div className="absolute inset-0 rounded-full blur-lg opacity-55 scale-125"
                                    style={{ background: 'radial-gradient(circle,#34d399,transparent)' }} />
                                  <img src={player.avatar_url} alt={player.display_name || ''}
                                    className="relative w-16 h-16 rounded-full object-cover"
                                    style={{ border: '2px solid rgba(110,231,183,0.55)' }}
                                    loading="lazy" decoding="async" />
                                </div>
                              ) : (
                                <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{ border: '2px solid rgba(110,231,183,0.55)', background: 'rgba(8,24,18,0.8)' }}>
                                  <span className="text-xl font-display" style={{ color: '#6ee7b7' }}>{(player.display_name || '?')[0]?.toUpperCase()}</span>
                                </div>
                              )}
                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-display text-xl truncate"
                                  style={{ background: 'linear-gradient(135deg,#34d399 0%,#6ee7b7 40%,#a7f3d0 60%,#34d399 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                  {player.display_name || 'ไม่ระบุชื่อ'}
                                </h3>
                                <p className="text-xs font-display mt-0.5" style={{ color: 'rgba(52,211,153,0.55)' }}>Dungeon Master</p>
                                {player.religions && (
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    {player.religions.logo_url
                                      ? <img src={player.religions.logo_url} className="w-3 h-3 rounded-full object-cover border border-gold-400/20" />
                                      : <Church className="w-3 h-3 text-gold-400" />}
                                    <span className="text-gold-400/60 text-xs font-display">{player.religions.name_th}</span>
                                  </div>
                                )}
                              </div>
                              {/* Pathways inline */}
                              {pathwayInfo.length > 0 && (
                                <div className="hidden sm:flex flex-col gap-1 flex-shrink-0 text-right">
                                  {pathwayInfo.slice(0, 2).map((info, i) => (
                                    <span key={i} className="text-xs font-display" style={{ color: 'rgba(52,211,153,0.65)' }}>
                                      {info.pathwayName}{info.seqNumber !== null ? ` · ลำดับ ${info.seqNumber}` : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {/* Potion */}
                              {isStaff && (
                                <div className="hidden sm:flex flex-col gap-1 w-28 flex-shrink-0">
                                  <div className="flex justify-between text-[10px] font-display" style={{ color: '#6ee7b7' }}>
                                    <span>ย่อยโอสถ</span>
                                    <span>{Math.min(100, Math.max(0, player.potion_digest_progress ?? 0))}%</span>
                                  </div>
                                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(52,211,153,0.12)' }}>
                                    <div className="h-full rounded-full" style={{
                                      width: `${Math.min(100, Math.max(0, player.potion_digest_progress ?? 0))}%`,
                                      background: 'linear-gradient(90deg,#059669,#34d399,#6ee7b7)',
                                      boxShadow: '0 0 6px rgba(52,211,153,0.4)',
                                    }} />
                                  </div>
                                </div>
                              )}
                              {isStaff && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); setEditingPlayer(player) }}
                                  className="p-1.5 text-victorian-400 hover:text-gold-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer flex-shrink-0">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}

                      {/* Admins — compact 3-col */}
                      {adminList.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {adminList.map(player => {
                            const pathwayInfo = getPlayerPathwayInfo(player.id)
                            return (
                              <div
                                key={player.id}
                                onClick={() => router.push(`/dashboard/players/${player.id}`)}
                                className="relative overflow-hidden group cursor-pointer rounded-sm border transition-all duration-300"
                                style={{
                                  borderColor: 'rgba(212,175,55,0.4)',
                                  background: 'linear-gradient(145deg,rgba(28,22,10,0.97),rgba(36,28,8,0.97))',
                                  boxShadow: '0 0 20px rgba(212,175,55,0.1)',
                                }}
                              >
                                <CornerOrnament className="absolute top-0 left-0 z-10" size={32} />
                                <CornerOrnament className="absolute top-0 right-0 -scale-x-100 z-10" size={32} />
                                <div className="absolute top-0 left-0 right-0 h-[1.5px] z-20"
                                  style={{ background: 'linear-gradient(90deg,transparent,#c9a84c,#f0d080,#c9a84c,transparent)' }} />
                                {player.background_url && (
                                  <div className="absolute inset-0 z-0">
                                    <img src={player.background_url} alt="" className="w-full h-full object-cover opacity-10" loading="lazy" decoding="async" />
                                    <div className="absolute inset-0" style={{ background: 'rgba(20,15,5,0.82)' }} />
                                  </div>
                                )}
                                {/* Admin badge */}
                                <div className="absolute top-2 right-2 z-20">
                                  <Crown className="w-3 h-3" style={{ color: '#c9a84c' }} />
                                </div>
                                <div className="relative z-10 flex items-center gap-3 px-3 py-3">
                                  {player.avatar_url ? (
                                    <div className="relative flex-shrink-0">
                                      <div className="absolute inset-0 rounded-full blur-md opacity-50 scale-110"
                                        style={{ background: 'radial-gradient(circle,#c9a84c,transparent)' }} />
                                      <img src={player.avatar_url} alt={player.display_name || ''}
                                        className="relative w-10 h-10 rounded-full object-cover"
                                        style={{ border: '1.5px solid rgba(212,175,55,0.5)' }}
                                        loading="lazy" decoding="async" />
                                    </div>
                                  ) : (
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                                      style={{ border: '1.5px solid rgba(212,175,55,0.5)', background: 'rgba(28,22,10,0.8)' }}>
                                      <span className="text-sm font-display" style={{ color: '#f0d080' }}>{(player.display_name || '?')[0]?.toUpperCase()}</span>
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="font-display text-sm truncate"
                                      style={{ background: 'linear-gradient(135deg,#c9a84c,#f0d080,#b8881e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                      {player.display_name || 'ไม่ระบุชื่อ'}
                                    </p>
                                    {pathwayInfo.length > 0 && (
                                      <p className="text-[11px] truncate mt-0.5" style={{ color: 'rgba(212,175,55,0.45)' }}>
                                        {pathwayInfo[0].pathwayName}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* List View — Staff */}
                  {viewMode === 'list' && (
                    <div className="space-y-1.5">
                      {/* DM rows — slightly taller with glow */}
                      {dmList.map(player => {
                        const pathwayInfo = getPlayerPathwayInfo(player.id)
                        return (
                          <div
                            key={player.id}
                            onClick={() => router.push(`/dashboard/players/${player.id}`)}
                            className="relative flex items-center gap-3 px-4 py-3 rounded-sm border cursor-pointer overflow-hidden group transition-all duration-300"
                            style={{
                              borderColor: 'rgba(52,211,153,0.42)',
                              background: 'linear-gradient(135deg,rgba(8,24,18,0.98),rgba(12,32,24,0.98))',
                              boxShadow: '0 0 18px rgba(52,211,153,0.12)',
                            }}
                          >
                            <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-sm"
                              style={{ background: 'linear-gradient(180deg,#34d399,#6ee7b7,#34d399)' }} />
                            {player.avatar_url ? (
                              <div className="relative flex-shrink-0">
                                <div className="absolute inset-0 rounded-full blur-sm opacity-45" style={{ background: 'radial-gradient(circle,#34d399,transparent)' }} />
                                <img src={player.avatar_url} alt={player.display_name || ''} className="relative w-11 h-11 rounded-full object-cover" style={{ border: '1.5px solid rgba(110,231,183,0.5)' }} loading="lazy" decoding="async" />
                              </div>
                            ) : (
                              <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ border: '1.5px solid rgba(110,231,183,0.5)' }}>
                                <span className="font-display" style={{ color: '#6ee7b7' }}>{(player.display_name || '?')[0]?.toUpperCase()}</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-display text-base truncate" style={{ background: 'linear-gradient(135deg,#34d399,#6ee7b7,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                  {player.display_name || 'ไม่ระบุชื่อ'}
                                </span>
                                <Shield className="w-3.5 h-3.5 text-nouveau-emerald flex-shrink-0" />
                              </div>
                              {pathwayInfo.length > 0 && (
                                <p className="text-xs truncate mt-0.5" style={{ color: 'rgba(52,211,153,0.45)' }}>{pathwayInfo.map(i => i.pathwayName).join(', ')}</p>
                              )}
                            </div>
                            <span className="text-[10px] font-display tracking-widest px-2 py-0.5 rounded-sm border flex-shrink-0" style={{ borderColor: 'rgba(52,211,153,0.28)', color: '#34d399', background: 'rgba(52,211,153,0.07)' }}>DM</span>
                            {isStaff && (
                              <button type="button" onClick={(e) => { e.stopPropagation(); setEditingPlayer(player) }} className="p-1.5 text-victorian-400 hover:text-gold-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"><Pencil className="w-3.5 h-3.5" /></button>
                            )}
                          </div>
                        )
                      })}
                      {/* Admin rows — compact gold */}
                      {adminList.map(player => {
                        const pathwayInfo = getPlayerPathwayInfo(player.id)
                        return (
                          <div
                            key={player.id}
                            onClick={() => router.push(`/dashboard/players/${player.id}`)}
                            className="relative flex items-center gap-3 px-4 py-2.5 rounded-sm border cursor-pointer overflow-hidden group transition-all duration-300"
                            style={{
                              borderColor: 'rgba(212,175,55,0.35)',
                              background: 'linear-gradient(135deg,rgba(28,22,10,0.97),rgba(36,28,8,0.97))',
                              boxShadow: '0 0 12px rgba(212,175,55,0.08)',
                            }}
                          >
                            <div className="absolute left-0 top-0 bottom-0 w-[2.5px] rounded-l-sm"
                              style={{ background: 'linear-gradient(180deg,#c9a84c,#f0d080,#c9a84c)' }} />
                            {player.avatar_url ? (
                              <img src={player.avatar_url} alt={player.display_name || ''} className="w-9 h-9 rounded-full object-cover flex-shrink-0" style={{ border: '1.5px solid rgba(212,175,55,0.45)' }} loading="lazy" decoding="async" />
                            ) : (
                              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ border: '1.5px solid rgba(212,175,55,0.45)' }}>
                                <span className="text-sm font-display" style={{ color: '#f0d080' }}>{(player.display_name || '?')[0]?.toUpperCase()}</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-display text-sm truncate" style={{ background: 'linear-gradient(135deg,#c9a84c,#f0d080,#b8881e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                  {player.display_name || 'ไม่ระบุชื่อ'}
                                </span>
                                <Crown className="w-3 h-3 flex-shrink-0" style={{ color: '#c9a84c' }} />
                              </div>
                              {pathwayInfo.length > 0 && (
                                <p className="text-[11px] truncate" style={{ color: 'rgba(212,175,55,0.4)' }}>{pathwayInfo[0].pathwayName}</p>
                              )}
                            </div>
                            <span className="text-[10px] font-display tracking-widest px-1.5 py-0.5 rounded-sm border flex-shrink-0" style={{ borderColor: 'rgba(212,175,55,0.25)', color: '#c9a84c', background: 'rgba(212,175,55,0.06)' }}>ADMIN</span>
                            {isStaff && (
                              <button type="button" onClick={(e) => { e.stopPropagation(); setEditingPlayer(player) }} className="p-1.5 text-victorian-400 hover:text-gold-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"><Pencil className="w-3 h-3" /></button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Players Section ── */}
              {playerList.length > 0 && (
                <div>
                  {/* Section header — only show if staff section also visible */}
                  {staffList.length > 0 && (
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-px flex-1 bg-gold-400/10" />
                      <span className="text-xs font-display tracking-[0.25em] uppercase text-victorian-400">ผู้เล่น</span>
                      <div className="h-px flex-1 bg-gold-400/10" />
                    </div>
                  )}

                  {/* Grid View — Players */}
                  {viewMode === 'grid' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {playerList.map((player) => {
                        const pathwayInfo = getPlayerPathwayInfo(player.id)
                        return (
                          <div
                            key={player.id}
                            onClick={() => router.push(`/dashboard/players/${player.id}`)}
                            className="card-victorian relative overflow-hidden group cursor-pointer hover:border-gold-400/40 transition-all"
                          >
                            <CornerOrnament className="absolute top-0 left-0" size={40} />
                            <CornerOrnament className="absolute top-0 right-0 -scale-x-100" size={40} />
                            <CornerOrnament className="absolute bottom-0 left-0 -scale-y-100" size={40} />
                            <CornerOrnament className="absolute bottom-0 right-0 scale-x-[-1] scale-y-[-1]" size={40} />

                            {player.background_url && (
                              <div className="absolute inset-0 z-0">
                                <img src={player.background_url} alt="" className="w-full h-full object-cover opacity-10" loading="lazy" decoding="async" />
                                <div className="absolute inset-0 bg-gradient-to-b from-victorian-950/50 to-victorian-950/90" />
                              </div>
                            )}

                            <div className="relative z-10 p-6">
                              {isStaff && (isDM || player.role !== 'dm') && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setEditingPlayer(player) }}
                                  className="absolute top-3 right-3 p-2 text-victorian-400 hover:text-gold-400
                                             opacity-0 group-hover:opacity-100 transition-all cursor-pointer
                                             bg-victorian-900/80 rounded-sm border border-gold-400/10 hover:border-gold-400/30"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )}

                              <div className="flex items-center gap-4 mb-5">
                                {player.avatar_url ? (
                                  <img src={player.avatar_url} alt={player.display_name || ''} className="w-16 h-16 rounded-full border-2 border-gold-400/30 object-cover flex-shrink-0" loading="lazy" decoding="async" />
                                ) : (
                                  <div className="w-16 h-16 rounded-full border-2 border-gold-400/30 bg-victorian-800 flex items-center justify-center flex-shrink-0">
                                    <span className="text-gold-400 text-xl font-display">{(player.display_name || '?')[0]?.toUpperCase()}</span>
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <h3 className="font-display text-lg text-gold-400 truncate">{player.display_name || 'ไม่ระบุชื่อ'}</h3>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <Swords className="w-4 h-4 text-metal-silver" />
                                    <span className="text-victorian-400 text-sm font-display">ผู้เล่น</span>
                                  </div>
                                  {player.religions && (
                                    <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                                      {player.religions.logo_url
                                        ? <img src={player.religions.logo_url} className="w-3.5 h-3.5 rounded-full object-cover border border-gold-400/20" />
                                        : <Church className="w-3.5 h-3.5 text-gold-400" />}
                                      <span className="text-gold-400/80">{player.religions.name_th}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {pathwayInfo.length > 0 ? (
                                <div className="space-y-2">
                                  {pathwayInfo.map((info, i) => (
                                    <div key={i} className="flex items-center justify-between px-3 py-2 bg-victorian-950/60 border border-gold-400/10 rounded-sm">
                                      <span className="text-nouveau-cream/80 text-sm truncate">{info.pathwayName}</span>
                                      <span className="text-gold-400 text-xs font-display ml-2 flex-shrink-0">
                                        {info.seqNumber !== null ? `ลำดับ ${info.seqNumber}` : '-'}
                                        {info.sequenceName && <span className="text-victorian-400 ml-1">({info.sequenceName})</span>}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-victorian-500 text-sm italic text-center py-2">ยังไม่มีเส้นทาง</p>
                              )}

                              {isStaff && (
                                <div className="mt-4">
                                  <div className="flex items-center justify-between text-xs text-amber-200 mb-1">
                                    <span className="font-display tracking-wider">ย่อยโอสถ</span>
                                    <span className="tabular-nums">{Math.min(100, Math.max(0, player.potion_digest_progress ?? 0))}%</span>
                                  </div>
                                  <div className="w-full h-2 bg-victorian-950 rounded-full overflow-hidden border border-amber-500/10">
                                    <div className="h-full rounded-full transition-all duration-700"
                                      style={{
                                        width: `${Math.min(100, Math.max(0, player.potion_digest_progress ?? 0))}%`,
                                        background: 'linear-gradient(90deg,#F59E0B,#FBBF24,#FDE68A)',
                                        boxShadow: '0 0 10px rgba(251,191,36,0.5)',
                                      }} />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* List View — Players */}
                  {viewMode === 'list' && (
                    <div className="space-y-1.5">
                      {playerList.map((player) => {
                        const pathwayInfo = getPlayerPathwayInfo(player.id)
                        return (
                          <div
                            key={player.id}
                            onClick={() => router.push(`/dashboard/players/${player.id}`)}
                            className="flex items-center gap-3 px-4 py-3 card-victorian cursor-pointer hover:border-gold-400/40 transition-all"
                          >
                            {player.avatar_url ? (
                              <img src={player.avatar_url} alt={player.display_name || ''} className="w-10 h-10 rounded-full border border-gold-400/30 object-cover flex-shrink-0" loading="lazy" decoding="async" />
                            ) : (
                              <div className="w-10 h-10 rounded-full border border-gold-400/30 bg-victorian-800 flex items-center justify-center flex-shrink-0">
                                <span className="text-gold-400 text-sm font-display">{(player.display_name || '?')[0]?.toUpperCase()}</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-display text-gold-400 truncate">{player.display_name || 'ไม่ระบุชื่อ'}</span>
                                <Swords className="w-3.5 h-3.5 text-metal-silver flex-shrink-0" />
                              </div>
                              {pathwayInfo.length > 0 && (
                                <p className="text-victorian-400 text-xs truncate mt-0.5">{pathwayInfo.map(i => i.pathwayName).join(', ')}</p>
                              )}
                            </div>
                            {player.religions && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {player.religions.logo_url
                                  ? <img src={player.religions.logo_url} className="w-4 h-4 rounded-full object-cover border border-gold-400/20" />
                                  : <Church className="w-3.5 h-3.5 text-gold-400" />}
                                <span className="text-gold-400/80 text-xs font-display">{player.religions.name_th}</span>
                              </div>
                            )}
                            {isStaff && (
                              <button type="button" onClick={(e) => { e.stopPropagation(); setEditingPlayer(player) }}
                                className="p-1.5 text-victorian-400 hover:text-gold-400 transition-colors cursor-pointer">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {filtered.length === 0 && (
                <div className="text-center py-20 text-victorian-400">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="font-display text-xl">{search ? 'ไม่พบผู้เล่น' : 'ยังไม่มีผู้เล่นในระบบ'}</p>
                </div>
              )}
            </>
          )
        })()}
      </main>
      )}

      {/* ═══ TAB: Religions ═══ */}
      {activeTab === 'religions' && (
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-10">
        {/* Add button (DM only) */}
        {isStaff && (
          <div className="mb-6 flex justify-between items-center">
            <button
              onClick={() => router.push('/dashboard/religions/prayer-logs')}
              className="btn-victorian !py-2 !px-5 !text-sm flex items-center gap-2"
            >
              <ScrollText className="w-4 h-4" /> ดูบันทึกการภาวนา
            </button>
            <button onClick={() => openReligionForm()}
              className="btn-gold !py-2 !px-5 !text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> เพิ่มศาสนา
            </button>
          </div>
        )}

        {/* Religion cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {religions.map(rel => (
            <div key={rel.id} className="card-victorian relative overflow-hidden group">
              <CornerOrnament className="absolute top-0 left-0 z-20" size={40} />
              <CornerOrnament className="absolute top-0 right-0 -scale-x-100 z-20" size={40} />
              <CornerOrnament className="absolute bottom-0 left-0 -scale-y-100 z-20" size={40} />
              <CornerOrnament className="absolute bottom-0 right-0 scale-x-[-1] scale-y-[-1] z-20" size={40} />

              {/* Banner header with bg image */}
              <div className="relative h-32 overflow-hidden">
                {rel.bg_url ? (
                  <>
                    <img src={rel.bg_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-victorian-950/90" />
                  </>
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-victorian-800/60 via-victorian-900/80 to-victorian-950" />
                )}
                {/* Admin actions */}
                {isStaff && (
                  <div className="absolute top-2 right-2 z-30 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => openReligionForm(rel)}
                      className="p-1.5 text-victorian-300 hover:text-gold-400 bg-black/60 backdrop-blur-sm rounded-sm border border-gold-400/10 hover:border-gold-400/30 cursor-pointer"
                      title="แก้ไข"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDeleteReligion(rel.id)}
                      className="p-1.5 text-nouveau-ruby/70 hover:text-nouveau-ruby bg-black/60 backdrop-blur-sm rounded-sm border border-nouveau-ruby/10 hover:border-nouveau-ruby/30 cursor-pointer"
                      title="ลบ"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>

              {/* Logo overlapping the banner */}
              <div className="relative z-10 -mt-10 px-6">
                <div className="flex items-end gap-4">
                  {rel.logo_url ? (
                    <img src={rel.logo_url} alt={rel.name_th} className="w-20 h-20 rounded-full border-3 border-gold-400/40 object-cover flex-shrink-0 shadow-lg shadow-black/50 bg-victorian-950" loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-20 h-20 rounded-full border-3 border-gold-400/40 bg-victorian-900 flex items-center justify-center flex-shrink-0 shadow-lg shadow-black/50">
                      <Church className="w-10 h-10 text-gold-400" />
                    </div>
                  )}
                  <div className="min-w-0 pb-1">
                    <h3 className="font-display font-semibold text-lg text-gold-400 truncate leading-tight">{rel.name_th}</h3>
                    <p className="text-victorian-400 text-sm">{rel.name_en}</p>
                  </div>
                </div>
              </div>

              <div className="relative z-10 px-6 pb-6 pt-3">
                {/* Deity */}
                {(rel.deity_th || rel.deity_en) && (
                  <div className="px-3 py-2 bg-victorian-950/60 border border-gold-400/10 rounded-sm mb-3">
                    <p className="text-[10px] text-gold-400 uppercase tracking-wider font-display mb-0.5">เทพเจ้า</p>
                    <p className="text-nouveau-cream text-sm font-semibold">{rel.deity_th || rel.deity_en}</p>
                    {rel.deity_th && rel.deity_en && <p className="text-victorian-400 text-xs">{rel.deity_en}</p>}
                  </div>
                )}

                {/* Overview (truncated) */}
                {rel.overview && (
                  <p className="text-victorian-400 text-sm line-clamp-2 mb-2">{rel.overview}</p>
                )}
                {rel.teachings && (
                  <p className="text-victorian-500 text-xs line-clamp-1 mb-3 italic">📜 มีหลักคำสอน</p>
                )}

                <button onClick={() => setViewingReligion(rel)}
                  className="flex items-center gap-1 text-gold-400 text-xs hover:text-gold-300 cursor-pointer">
                  <Eye className="w-3.5 h-3.5" /> ดูรายละเอียด
                </button>
              </div>
            </div>
          ))}
        </div>

        {religions.length === 0 && (
          <div className="text-center py-20 text-victorian-400">
            <Church className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="font-display text-xl">ยังไม่มีศาสนาในระบบ</p>
          </div>
        )}
      </main>
      )}

      {/* ═══ Religion Detail Modal ═══ */}
      {viewingReligion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setViewingReligion(null)} style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-lg rounded-sm border border-gold-400/20 overflow-hidden max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#1A1612' }} onClick={e => e.stopPropagation()}>
            {/* Banner header */}
            <div className="relative h-40 overflow-hidden">
              {viewingReligion.bg_url ? (
                <>
                  <img src={viewingReligion.bg_url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-[#1A1612]" />
                </>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-victorian-800/60 via-victorian-900/80 to-[#1A1612]" />
              )}
              <button onClick={() => setViewingReligion(null)} className="absolute top-3 right-3 text-victorian-300 hover:text-gold-400 cursor-pointer bg-black/40 backdrop-blur-sm rounded-full p-1.5 z-10">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Logo overlapping banner */}
            <div className="relative z-10 -mt-14 flex justify-center">
              {viewingReligion.logo_url ? (
                <img src={viewingReligion.logo_url} alt={viewingReligion.name_th} className="w-28 h-28 rounded-full border-4 border-gold-400/40 object-cover shadow-xl shadow-black/60 bg-victorian-950" />
              ) : (
                <div className="w-28 h-28 rounded-full border-4 border-gold-400/40 bg-victorian-900 flex items-center justify-center shadow-xl shadow-black/60">
                  <Church className="w-14 h-14 text-gold-400" />
                </div>
              )}
            </div>

            <div className="px-6 md:px-8 pb-6 md:pb-8 pt-4">
              <h3 className="heading-victorian text-2xl text-center mb-6">{viewingReligion.name_th}</h3>
              <div className="space-y-4 text-sm">
                <div className="border-b border-gold-400/10 pb-3"><span className="text-gold-400 font-semibold">ชื่อไทย:</span> <span className="text-nouveau-cream font-semibold">{viewingReligion.name_th}</span></div>
                <div className="border-b border-gold-400/10 pb-3"><span className="text-gold-400 font-semibold">ชื่ออังกฤษ:</span> <span className="text-nouveau-cream">{viewingReligion.name_en}</span></div>
                {viewingReligion.deity_th && <div className="border-b border-gold-400/10 pb-3"><span className="text-gold-400 font-semibold">เทพเจ้า (ไทย):</span> <span className="text-nouveau-cream font-semibold">{viewingReligion.deity_th}</span></div>}
                {viewingReligion.deity_en && <div className="border-b border-gold-400/10 pb-3"><span className="text-gold-400 font-semibold">เทพเจ้า (อังกฤษ):</span> <span className="text-nouveau-cream">{viewingReligion.deity_en}</span></div>}
                {viewingReligion.overview && (
                  <div className="border-b border-gold-400/10 pb-4">
                    <span className="text-gold-400 font-semibold block mb-2">เกริ่นนำ:</span>
                    <p className="text-victorian-300 whitespace-pre-wrap leading-relaxed">{viewingReligion.overview}</p>
                  </div>
                )}
                {viewingReligion.teachings && (
                  <div>
                    <span className="text-gold-400 font-semibold block mb-2">หลักคำสอน:</span>
                    <p className="text-victorian-300 whitespace-pre-wrap leading-relaxed">{viewingReligion.teachings}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Religion Form Modal (Create/Edit) ═══ */}
      {showReligionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowReligionForm(false)} style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-lg rounded-sm border border-gold-400/20 p-6 md:p-8 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#1A1612' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="heading-victorian text-2xl">{editingReligion ? 'แก้ไขศาสนา' : 'เพิ่มศาสนาใหม่'}</h3>
              <button onClick={() => setShowReligionForm(false)} className="text-victorian-400 hover:text-gold-400 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            {relError && <p className="text-nouveau-ruby text-sm mb-4">{relError}</p>}
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gold-400 mb-1 font-display">ชื่อไทย *</label>
                <input value={relForm.name_th} onChange={e => setRelForm(f => ({ ...f, name_th: e.target.value }))} className="input-victorian !py-2 !px-3 w-full" placeholder="เช่น ลัทธิแห่งแสง" />
              </div>
              <div>
                <label className="block text-xs text-gold-400 mb-1 font-display">ชื่ออังกฤษ *</label>
                <input value={relForm.name_en} onChange={e => setRelForm(f => ({ ...f, name_en: e.target.value }))} className="input-victorian !py-2 !px-3 w-full" placeholder="e.g. Order of Light" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gold-400 mb-1 font-display">เทพเจ้า (ไทย)</label>
                  <input value={relForm.deity_th} onChange={e => setRelForm(f => ({ ...f, deity_th: e.target.value }))} className="input-victorian !py-2 !px-3 w-full" />
                </div>
                <div>
                  <label className="block text-xs text-gold-400 mb-1 font-display">เทพเจ้า (อังกฤษ)</label>
                  <input value={relForm.deity_en} onChange={e => setRelForm(f => ({ ...f, deity_en: e.target.value }))} className="input-victorian !py-2 !px-3 w-full" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gold-400 mb-1 font-display">เกริ่นนำ</label>
                <textarea value={relForm.overview} onChange={e => setRelForm(f => ({ ...f, overview: e.target.value }))} rows={3} className="input-victorian !py-2 !px-3 w-full" placeholder="ประวัติความเป็นมา, คำอธิบายทั่วไป..." />
              </div>
              <div>
                <label className="block text-xs text-gold-400 mb-1 font-display">หลักคำสอน</label>
                <textarea value={relForm.teachings} onChange={e => setRelForm(f => ({ ...f, teachings: e.target.value }))} rows={4} className="input-victorian !py-2 !px-3 w-full" placeholder="แนวทางปฏิบัติ, ข้อบัญญัติ, คำสอนหลัก..." />
              </div>
              <div>
                <label className="block text-xs text-gold-400 mb-1 font-display">URL แบ็คกราวด์</label>
                <input value={relForm.bg_url} onChange={e => setRelForm(f => ({ ...f, bg_url: e.target.value }))} className="input-victorian !py-2 !px-3 w-full" placeholder="https://..." />
              </div>
              <div>
                <label className="block text-xs text-gold-400 mb-1 font-display">URL โลโก้ศาสนา</label>
                <input value={relForm.logo_url} onChange={e => setRelForm(f => ({ ...f, logo_url: e.target.value }))} className="input-victorian !py-2 !px-3 w-full" placeholder="https://..." />
                {relForm.logo_url && (
                  <div className="mt-2 flex justify-center">
                    <img src={relForm.logo_url} alt="Preview" className="w-16 h-16 rounded-full border border-gold-400/20 object-cover" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowReligionForm(false)} className="px-4 py-2 text-sm text-victorian-400 hover:text-nouveau-cream cursor-pointer">ยกเลิก</button>
              <button onClick={handleSaveReligion} disabled={isPending} className="btn-gold !py-2 !px-5 !text-sm flex items-center gap-2 disabled:opacity-50">
                <Save className="w-4 h-4" /> {isPending ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Admin Edit Modal */}
      {editingPlayer && (
        <AdminEditModal
          player={editingPlayer}
          currentUserRole={currentProfile?.role ?? 'player'}
          onClose={() => setEditingPlayer(null)}
          onSaved={() => router.refresh()}
          pathways={pathways}
          sequences={sequences}
          playerPathways={playerPathways}
        />
      )}
      
      {/* Sanity Lock Overlay */}
      {isSanityLocked && <SanityLockOverlay />}
    </div>
  )
}
