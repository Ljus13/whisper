'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { grantPathwayChoices } from '@/app/actions/pathway-grants'
import { ArrowLeft, Sparkles, Check, X, Search, CheckCircle2 } from 'lucide-react'

interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  role: 'player' | 'admin' | 'dm'
}

interface PlayerPathway {
  id: string
  player_id: string
  pathway_id: string | null
  sequence_id: string | null
}

interface PathwayGrant {
  id: string
  player_id: string
  pathway_id: string
}

interface Pathway {
  id: string
  name: string
  overview: string | null
  bg_url: string | null
  logo_url: string | null
}

type TabKey = 'pending' | 'decided'

function GrantModal({
  player, pathways, selectedPathwayIds, onToggle, onClose, onSubmit, isPending, error
}: {
  player: Profile
  pathways: Pathway[]
  selectedPathwayIds: string[]
  onToggle: (id: string) => void
  onClose: () => void
  onSubmit: () => void
  isPending: boolean
  error: string | null
}) {
  const [search, setSearch] = useState('')
  const [previewId, setPreviewId] = useState<string | null>(pathways[0]?.id ?? null)
  const [mobileShowDetail, setMobileShowDetail] = useState(false)

  const filtered = search.trim()
    ? pathways.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.overview?.toLowerCase().includes(search.toLowerCase()))
    : pathways

  const preview = pathways.find(p => p.id === previewId)

  function handleSelectItem(id: string) {
    setPreviewId(id)
    setMobileShowDetail(true)
  }

  // Shared detail panel content
  const DetailPanel = preview ? (
    <>
      {/* Image */}
      <div className="relative h-44 md:h-64 flex-shrink-0 overflow-hidden">
        {preview.bg_url ? (
          <img src={preview.bg_url} alt={preview.name} className="w-full h-full object-cover object-top" />
        ) : (
          <div className="w-full h-full bg-victorian-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A1612] via-[#1A1612]/40 to-transparent" />
        {preview.logo_url && (
          <img src={preview.logo_url} alt="" className="absolute bottom-3 left-4 h-10 w-10 object-contain drop-shadow-lg" />
        )}
        <h3 className={`absolute bottom-3 font-display text-xl text-gold-100 drop-shadow ${preview.logo_url ? 'left-16' : 'left-4'}`}>
          {preview.name}
        </h3>
      </div>

      {/* Overview */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {preview.overview ? (
          <p className="text-sm text-victorian-300 leading-relaxed">{preview.overview}</p>
        ) : (
          <p className="text-xs text-victorian-600 italic">ไม่มีรายละเอียด</p>
        )}
      </div>

      {/* Toggle button */}
      <div className="p-4 border-t border-gold-400/10 flex-shrink-0">
        <button
          type="button"
          onClick={() => onToggle(preview.id)}
          className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            selectedPathwayIds.includes(preview.id)
              ? 'bg-amber-500/20 border border-amber-400/40 text-amber-200 hover:bg-amber-500/30'
              : 'bg-victorian-800/60 border border-gold-400/15 text-victorian-300 hover:border-gold-400/30 hover:text-gold-200'
          }`}
        >
          {selectedPathwayIds.includes(preview.id) ? (
            <><CheckCircle2 className="w-4 h-4" /> เลือกแล้ว — คลิกเพื่อยกเลิก</>
          ) : (
            <><Check className="w-4 h-4" /> เลือกเส้นทางนี้</>
          )}
        </button>
      </div>
    </>
  ) : (
    <div className="flex-1 flex items-center justify-center text-victorian-600 text-sm p-8">
      เลือกเส้นทางจากรายการ
    </div>
  )

  // Shared list panel content
  const ListPanel = (
    <>
      {/* Search */}
      <div className="p-3 border-b border-gold-400/10 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-victorian-500" />
          <input
            type="text"
            placeholder="ค้นหาเส้นทาง..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-victorian-900/60 border border-gold-400/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-victorian-200 placeholder-victorian-600 focus:outline-none focus:border-gold-400/30"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-center text-victorian-600 text-xs py-6">ไม่พบเส้นทาง</p>
        ) : filtered.map(p => {
          const isSelected = selectedPathwayIds.includes(p.id)
          const isActive = previewId === p.id
          return (
            <div
              key={p.id}
              className={`w-full flex items-center gap-2 px-2 py-2 text-left transition-all border-l-2 ${
                isActive
                  ? 'border-gold-400 bg-gold-400/8'
                  : 'border-transparent hover:bg-victorian-800/40'
              }`}
            >
              {/* Preview area */}
              <button
                onClick={() => handleSelectItem(p.id)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                {p.bg_url ? (
                  <img src={p.bg_url} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0 opacity-80" />
                ) : (
                  <div className="w-7 h-7 rounded bg-victorian-800 flex-shrink-0" />
                )}
                <span className={`text-xs font-medium truncate ${isActive ? 'text-gold-200' : 'text-victorian-300'}`}>{p.name}</span>
              </button>
              {/* Direct toggle checkbox */}
              <button
                onClick={e => { e.stopPropagation(); onToggle(p.id) }}
                title={isSelected ? 'ยกเลิกการเลือก' : 'เลือก'}
                className={`flex-shrink-0 w-6 h-6 rounded border flex items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-amber-500/20 border-amber-400/60 text-amber-300 hover:bg-amber-500/30'
                    : 'border-victorian-600 text-transparent hover:border-gold-400/40 hover:bg-victorian-800'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
    >
      <div
        className="w-full sm:max-w-3xl sm:rounded-xl rounded-t-xl border-2 border-gold-400/20 flex flex-col h-[100dvh] sm:h-[82vh]"
        style={{ backgroundColor: '#1A1612' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gold-400/10 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile back button */}
            {mobileShowDetail && (
              <button
                onClick={() => setMobileShowDetail(false)}
                className="md:hidden text-victorian-400 hover:text-gold-400 flex-shrink-0 mr-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-gold-300 font-display text-base sm:text-lg truncate">
                {mobileShowDetail && preview
                  ? <span className="md:hidden">{preview.name}</span>
                  : null}
                <span className={mobileShowDetail && preview ? 'hidden md:inline' : ''}>
                  มอบโอสถให้ {player.display_name || player.id.slice(0, 8)}
                </span>
              </h2>
              <p className="text-victorian-500 text-xs mt-0.5 hidden sm:block">เลือกเส้นทางที่จะมอบให้ ({selectedPathwayIds.length} เส้นทางที่เลือก)</p>
            </div>
          </div>
          <button onClick={onClose} className="text-victorian-400 hover:text-gold-400 transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-hidden">

          {/* ── MOBILE: show list OR detail ── */}
          <div className="flex flex-col h-full md:hidden">
            {mobileShowDetail ? (
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {DetailPanel}
              </div>
            ) : (
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {ListPanel}
              </div>
            )}
          </div>

          {/* ── DESKTOP: side-by-side ── */}
          <div className="hidden md:flex h-full">
            {/* Left */}
            <div className="w-64 flex-shrink-0 border-r border-gold-400/10 flex flex-col">
              {ListPanel}
            </div>
            {/* Right */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {DetailPanel}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gold-400/10 flex-shrink-0 space-y-2">
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-victorian-500 truncate">
              เลือกแล้ว: {selectedPathwayIds.length > 0
                ? pathways.filter(p => selectedPathwayIds.includes(p.id)).map(p => p.name).join(', ')
                : 'ยังไม่ได้เลือก'}
            </p>
            <button
              type="button"
              onClick={onSubmit}
              disabled={isPending || selectedPathwayIds.length === 0}
              className="btn-gold px-5 py-2 text-sm disabled:opacity-50 flex-shrink-0"
            >
              {isPending ? 'กำลังมอบโอสถ...' : `มอบโอสถ (${selectedPathwayIds.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PathwaysGrantContent({ userId }: { userId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [players, setPlayers] = useState<Profile[]>([])
  const [playerPathways, setPlayerPathways] = useState<PlayerPathway[]>([])
  const [pathwayGrants, setPathwayGrants] = useState<PathwayGrant[]>([])
  const [pathways, setPathways] = useState<Pathway[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>('pending')
  const [grantingPlayer, setGrantingPlayer] = useState<Profile | null>(null)
  const [selectedPathwayIds, setSelectedPathwayIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const fetchData = async () => {
      const [meRes, playersRes, ppRes, grantRes, pathwayRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name, avatar_url, role').eq('id', userId).single(),
        supabase.from('profiles').select('id, display_name, avatar_url, role').order('display_name'),
        supabase.from('player_pathways').select('id, player_id, pathway_id, sequence_id'),
        supabase.from('pathway_grants').select('id, player_id, pathway_id'),
        supabase.from('skill_pathways').select('id, name, overview, bg_url, logo_url').order('name'),
      ])
      if (meRes.data) setCurrentProfile(meRes.data)
      if (playersRes.data) setPlayers(playersRes.data)
      if (ppRes.data) setPlayerPathways(ppRes.data)
      if (grantRes.data) setPathwayGrants(grantRes.data)
      if (pathwayRes.data) setPathways(pathwayRes.data)
    }
    fetchData()
  }, [userId])

  const isStaff = currentProfile?.role === 'admin' || currentProfile?.role === 'dm'

  const playerHasPathway = useMemo(() => {
    const map = new Set<string>()
    for (const pp of playerPathways) {
      if (pp.pathway_id) map.add(pp.player_id)
    }
    return map
  }, [playerPathways])

  const grantsByPlayer = useMemo(() => {
    const map = new Map<string, PathwayGrant[]>()
    for (const grant of pathwayGrants) {
      const list = map.get(grant.player_id) || []
      list.push(grant)
      map.set(grant.player_id, list)
    }
    return map
  }, [pathwayGrants])

  const pathwayNameById = useMemo(() => {
    return new Map(pathways.map(p => [p.id, p.name]))
  }, [pathways])

  const playersOnly = players.filter(p => p.role === 'player')
  const pendingPlayers = playersOnly.filter(p => !playerHasPathway.has(p.id))
  const decidedPlayers = playersOnly.filter(p => playerHasPathway.has(p.id))

  function openGrantModal(player: Profile) {
    const existing = (grantsByPlayer.get(player.id) || []).map(g => g.pathway_id)
    setGrantingPlayer(player)
    setSelectedPathwayIds(existing)
    setError(null)
  }

  function togglePathway(pathwayId: string) {
    setSelectedPathwayIds(prev => prev.includes(pathwayId)
      ? prev.filter(id => id !== pathwayId)
      : [...prev, pathwayId]
    )
  }

  function submitGrant() {
    if (!grantingPlayer) return
    setError(null)
    startTransition(async () => {
      const result = await grantPathwayChoices(grantingPlayer.id, selectedPathwayIds)
      if (result?.error) {
        setError(result.error)
        return
      }
      setGrantingPlayer(null)
      setSelectedPathwayIds([])
      const supabase = createClient()
      const [ppRes, grantRes] = await Promise.all([
        supabase.from('player_pathways').select('id, player_id, pathway_id, sequence_id'),
        supabase.from('pathway_grants').select('id, player_id, pathway_id'),
      ])
      if (ppRes.data) setPlayerPathways(ppRes.data)
      if (grantRes.data) setPathwayGrants(grantRes.data)
    })
  }

  if (!currentProfile) {
    return (
      <div className="min-h-screen bg-victorian-950 text-victorian-100">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="h-6 w-40 bg-victorian-800/60 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  if (!isStaff) {
    return (
      <div className="min-h-screen bg-victorian-950 text-victorian-100">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <button onClick={() => router.back()} className="btn-victorian px-4 py-2 flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> กลับ
          </button>
          <div className="mt-6 p-6 border border-gold-400/10 rounded-sm bg-victorian-900/40 text-victorian-300">
            หน้านี้สำหรับทีมงานเท่านั้น
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-victorian-950 text-victorian-100">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-lg border border-gold-400/10 text-gold-400 hover:bg-victorian-800/50 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="heading-victorian text-3xl md:text-4xl flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-gold-400" /> มอบโอสถ
            </h1>
            <p className="text-victorian-400 text-sm mt-1">จัดการการมอบเส้นทางและสถานะการตัดสินใจ</p>
          </div>
        </div>

        <div className="ornament-divider" />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-sm border text-sm font-display tracking-wider uppercase ${activeTab === 'pending'
              ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
              : 'bg-victorian-900/40 text-victorian-400 border-gold-400/10 hover:bg-victorian-800/60'}`}
          >
            ยังไม่มีเส้นทาง ({pendingPlayers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('decided')}
            className={`px-4 py-2 rounded-sm border text-sm font-display tracking-wider uppercase ${activeTab === 'decided'
              ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
              : 'bg-victorian-900/40 text-victorian-400 border-gold-400/10 hover:bg-victorian-800/60'}`}
          >
            ได้รับเส้นทางแล้ว ({decidedPlayers.length})
          </button>
        </div>

        {activeTab === 'pending' && (
          <div className="space-y-3">
            {pendingPlayers.length === 0 && (
              <div className="p-6 border border-gold-400/10 rounded-sm bg-victorian-900/40 text-victorian-400">
                ไม่มีผู้เล่นที่อยู่ในสถานะนี้
              </div>
            )}
            {pendingPlayers.map(player => {
              const grants = grantsByPlayer.get(player.id) || []
              const statusText = grants.length > 0 ? 'กำลังรอตัดสินใจ' : 'ยังไม่มีเส้นทาง'
              return (
                <div key={player.id} className="p-4 border border-gold-400/10 rounded-sm bg-victorian-900/40 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-gold-200 font-semibold truncate">{player.display_name || player.id.slice(0, 8)}</div>
                    <div className="text-victorian-400 text-xs mt-1">{statusText}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openGrantModal(player)}
                    className="px-3 py-1.5 text-xs border border-amber-400/30 text-amber-200 rounded-sm hover:bg-amber-500/10 transition-colors"
                  >
                    มอบโอสถ
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'decided' && (
          <div className="space-y-3">
            {decidedPlayers.length === 0 && (
              <div className="p-6 border border-gold-400/10 rounded-sm bg-victorian-900/40 text-victorian-400">
                ไม่มีผู้เล่นที่อยู่ในสถานะนี้
              </div>
            )}
            {decidedPlayers.map(player => {
              const paths = playerPathways
                .filter(pp => pp.player_id === player.id && pp.pathway_id)
                .map(pp => pathwayNameById.get(pp.pathway_id as string))
                .filter(Boolean)
              return (
                <div key={player.id} className="p-4 border border-gold-400/10 rounded-sm bg-victorian-900/40 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-gold-200 font-semibold truncate">{player.display_name || player.id.slice(0, 8)}</div>
                    <div className="text-victorian-400 text-xs mt-1">ตัดสินใจแล้ว</div>
                    {paths.length > 0 && (
                      <div className="text-victorian-300 text-xs mt-1 truncate">
                        {paths.join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-1.5 text-xs rounded-sm border border-emerald-400/40 text-emerald-200 bg-emerald-500/10">
                    <Check className="w-3 h-3 inline-block mr-1" /> ตัดสินใจแล้ว
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {grantingPlayer && (
        <GrantModal
          player={grantingPlayer}
          pathways={pathways}
          selectedPathwayIds={selectedPathwayIds}
          onToggle={togglePathway}
          onClose={() => { setGrantingPlayer(null); setSelectedPathwayIds([]) }}
          onSubmit={submitGrant}
          isPending={isPending}
          error={error}
        />
      )}
    </div>
  )
}
