'use client'

import AdminEditModal from '@/components/admin/admin-edit-modal'
import { ArrowLeft, Crown, Shield, Swords, Pencil, Users, Church, Plus, Trash2, X, Save, Eye } from 'lucide-react'
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


function RoleIcon({ role }: { role: string }) {
  if (role === 'admin') return <Crown className="w-4 h-4 text-gold-300" />
  if (role === 'dm') return <Shield className="w-4 h-4 text-nouveau-emerald" />
  return <Swords className="w-4 h-4 text-metal-silver" />
}

export default function PlayersContent({ userId }: { userId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(getCached<Profile>('players:me'))
  const [players, setPlayers] = useState<Profile[]>(getCached<Profile[]>('players:all') ?? [])
  const [playerPathways, setPlayerPathways] = useState<PlayerPathway[]>(getCached<PlayerPathway[]>('players:pp') ?? [])
  const [pathways, setPathways] = useState<Pathway[]>(getCached<Pathway[]>('players:pw') ?? [])
  const [sequences, setSequences] = useState<Sequence[]>(getCached<Sequence[]>('players:seq') ?? [])
  const [loaded, setLoaded] = useState(!!getCached('players:me'))
  const [editingPlayer, setEditingPlayer] = useState<Profile | null>(null)

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
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('profiles').select('*').order('display_name'),
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
    
    fetchPlayers()

    const channel = supabase
      .channel('players_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchPlayers())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_pathways' }, () => fetchPlayers())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // ── Fetch religions ──
  useEffect(() => {
    getReligions().then(r => { if (r.religions) setReligions(r.religions as Religion[]) })
  }, [])

  const isAdmin = currentProfile?.role === 'admin' || currentProfile?.role === 'dm'
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
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {players.map((player) => {
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

                {/* Background image */}
                {player.background_url && (
                  <div className="absolute inset-0 z-0">
                    <img src={player.background_url} alt="" className="w-full h-full object-cover opacity-10" loading="lazy" decoding="async" />
                    <div className="absolute inset-0 bg-gradient-to-b from-victorian-950/50 to-victorian-950/90" />
                  </div>
                )}

                <div className="relative z-10 p-6">
                  {/* Admin Edit Button */}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditingPlayer(player) }}
                      className="absolute top-3 right-3 p-2 text-victorian-400 hover:text-gold-400 
                                 opacity-0 group-hover:opacity-100 transition-all cursor-pointer
                                 bg-victorian-900/80 rounded-sm border border-gold-400/10 hover:border-gold-400/30"
                      title="แก้ไขข้อมูล"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}

                  {/* Avatar + Basic Info */}
                  <div className="flex items-center gap-4 mb-5">
                    {player.avatar_url ? (
                      <img
                        src={player.avatar_url}
                        alt={player.display_name || ''}
                        className="w-16 h-16 rounded-full border-2 border-gold-400/30 object-cover flex-shrink-0"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full border-2 border-gold-400/30 bg-victorian-800 flex items-center justify-center flex-shrink-0">
                        <span className="text-gold-400 text-xl font-display">
                          {(player.display_name || '?')[0]?.toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-display text-lg text-gold-400 truncate">
                        {player.display_name || 'ไม่ระบุชื่อ'}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <RoleIcon role={player.role} />
                        <span className="text-victorian-400 text-sm font-display">
                          {player.role === 'admin' ? 'ผู้ดูแลระบบ' : player.role === 'dm' ? 'DM' : 'ผู้เล่น'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pathways & Sequences */}
                  {pathwayInfo.length > 0 ? (
                    <div className="space-y-2">
                      {pathwayInfo.map((info, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-3 py-2 
                                     bg-victorian-950/60 border border-gold-400/10 rounded-sm"
                        >
                          <span className="text-nouveau-cream/80 text-sm truncate">
                            {info.pathwayName}
                          </span>
                          <span className="text-gold-400 text-xs font-display ml-2 flex-shrink-0">
                            {info.seqNumber !== null ? `ลำดับ ${info.seqNumber}` : '-'}
                            {info.sequenceName && (
                              <span className="text-victorian-400 ml-1">({info.sequenceName})</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-victorian-500 text-sm italic text-center py-2">
                      ยังไม่มีเส้นทาง
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {players.length === 0 && (
          <div className="text-center py-20 text-victorian-400">
            <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="font-display text-xl">ยังไม่มีผู้เล่นในระบบ</p>
          </div>
        )}
      </main>
      )}

      {/* ═══ TAB: Religions ═══ */}
      {activeTab === 'religions' && (
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-10">
        {/* Add button (DM only) */}
        {isAdmin && (
          <div className="mb-6 flex justify-end">
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
                {isAdmin && (
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
