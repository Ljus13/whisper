'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { grantPathwayChoices } from '@/app/actions/pathway-grants'
import { ArrowLeft, Sparkles, Check, X } from 'lucide-react'

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
}

type TabKey = 'pending' | 'decided'

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
        supabase.from('skill_pathways').select('id, name, overview').order('name'),
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
        <Modal onClose={() => { setGrantingPlayer(null); setSelectedPathwayIds([]) }}>
          <div className="flex items-center justify-between">
            <div className="text-gold-300 font-display text-lg">มอบโอสถให้ {grantingPlayer.display_name || grantingPlayer.id.slice(0, 8)}</div>
            <button onClick={() => { setGrantingPlayer(null); setSelectedPathwayIds([]) }} className="text-victorian-400 hover:text-gold-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="border border-gold-400/10 rounded-sm p-3 bg-victorian-900/50 max-h-64 overflow-y-auto space-y-2">
            {pathways.map(pathway => (
              <label key={pathway.id} className="flex items-start gap-3 p-2 rounded-sm border border-transparent hover:border-gold-400/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedPathwayIds.includes(pathway.id)}
                  onChange={() => togglePathway(pathway.id)}
                  className="mt-1 accent-amber-400"
                />
                <div className="min-w-0">
                  <div className="text-victorian-100 text-sm font-semibold">{pathway.name}</div>
                  {pathway.overview && (
                    <div className="text-victorian-400 text-xs mt-1">{pathway.overview}</div>
                  )}
                </div>
              </label>
            ))}
          </div>

          {error && (
            <div className="text-red-400 text-sm">{error}</div>
          )}

          <button
            type="button"
            onClick={submitGrant}
            disabled={isPending}
            className="btn-gold w-full !py-2 !text-sm disabled:opacity-50"
          >
            {isPending ? 'กำลังมอบโอสถ...' : 'มอบโอสถ'}
          </button>
        </Modal>
      )}
    </div>
  )
}
