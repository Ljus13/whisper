'use client'

import AdminEditModal from '@/components/admin/admin-edit-modal'
import { ArrowLeft, Crown, Shield, Swords, Pencil, Users } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
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

/* ── Corner Ornament ── */
function CornerOrnament({ className }: { className?: string }) {
  return (
    <svg className={className} width="40" height="40" viewBox="0 0 60 60" fill="none">
      <path d="M2 58V20C2 10 10 2 20 2H58" stroke="url(#gc)" strokeWidth="1.5" fill="none" />
      <path d="M8 58V26C8 16 16 8 26 8H58" stroke="url(#gc)" strokeWidth="0.5" opacity="0.4" fill="none" />
      <circle cx="20" cy="20" r="2" fill="#D4AF37" opacity="0.6" />
      <defs>
        <linearGradient id="gc" x1="2" y1="58" x2="58" y2="2">
          <stop stopColor="#D4AF37" stopOpacity="0.8" />
          <stop offset="1" stopColor="#C5A55A" stopOpacity="0.2" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function RoleIcon({ role }: { role: string }) {
  if (role === 'admin') return <Crown className="w-4 h-4 text-gold-300" />
  if (role === 'dm') return <Shield className="w-4 h-4 text-nouveau-emerald" />
  return <Swords className="w-4 h-4 text-metal-silver" />
}

export default function PlayersContent({
  currentUser,
  currentProfile,
  players,
  playerPathways,
  pathways,
  sequences,
}: {
  currentUser: User
  currentProfile: Profile | null
  players: Profile[]
  playerPathways: PlayerPathway[]
  pathways: Pathway[]
  sequences: Sequence[]
}) {
  const router = useRouter()
  const [editingPlayer, setEditingPlayer] = useState<Profile | null>(null)

  const isAdmin = currentProfile?.role === 'admin' || currentProfile?.role === 'dm'

  // Helper: get pathways for a player
  function getPlayerPathwayInfo(playerId: string) {
    const pp = playerPathways.filter((p) => p.player_id === playerId)
    return pp.map((p) => {
      const pathway = pathways.find((pw) => pw.id === p.pathway_id)
      const sequence = sequences.find((s) => s.id === p.sequence_id)
      return {
        pathwayName: pathway?.name || '-',
        sequenceName: sequence?.name || '-',
        seqNumber: sequence?.seq_number ?? null,
      }
    })
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gold-400/10 bg-victorian-950/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="text-victorian-400 hover:text-gold-400 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <span className="text-gold-400 text-2xl">⚜</span>
            <h1 className="heading-victorian text-2xl">ทำเนียบผู้เล่น</h1>
          </div>
          <div className="flex items-center gap-2 text-victorian-400">
            <Users className="w-5 h-5" />
            <span className="font-display text-lg">{players.length} คน</span>
          </div>
        </div>
      </header>

      {/* Player Grid */}
      <main className="max-w-7xl mx-auto px-8 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {players.map((player) => {
            const pathwayInfo = getPlayerPathwayInfo(player.id)

            return (
              <div
                key={player.id}
                className="card-victorian relative overflow-hidden group"
              >
                <CornerOrnament className="absolute top-0 left-0" />
                <CornerOrnament className="absolute top-0 right-0 -scale-x-100" />
                <CornerOrnament className="absolute bottom-0 left-0 -scale-y-100" />
                <CornerOrnament className="absolute bottom-0 right-0 scale-x-[-1] scale-y-[-1]" />

                <div className="relative z-10 p-6">
                  {/* Admin Edit Button */}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setEditingPlayer(player)}
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
                            {info.sequenceName !== '-' && (
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
    </div>
  )
}
