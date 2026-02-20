'use client'

import { BioRenderer } from '@/components/bio-editor'
import { CornerOrnament } from '@/components/ui/ornaments'
import { ArrowLeft, Crown, Shield, Swords, Brain, Flame, Heart, Users, Church } from 'lucide-react'
import { useRouter } from 'next/navigation'

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
  logo_url: string | null
}

interface Sequence {
  id: string
  pathway_id: string
  seq_number: number
  name: string
}

function RoleBadge({ role }: { role: string }) {
  const config = {
    admin:  { icon: Crown,  label: 'ผู้ดูแลระบบ',    color: 'text-gold-300 bg-gold-400/10 border-gold-400/30' },
    dm:     { icon: Shield, label: 'Dungeon Master', color: 'text-nouveau-cream bg-nouveau-emerald/10 border-nouveau-emerald/30' },
    player: { icon: Swords, label: 'ผู้เล่น',        color: 'text-nouveau-cream bg-metal-silver/10 border-metal-silver/30' },
  }[role] ?? { icon: Swords, label: 'ผู้เล่น', color: 'text-nouveau-cream bg-metal-silver/10 border-metal-silver/30' }

  const Icon = config.icon

  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 text-sm font-display tracking-wider border rounded-md ${config.color}`}>
      <Icon className="w-4 h-4" />
      {config.label}
    </span>
  )
}

interface PlayerDetailViewProps {
  profile: Profile
  playerPathways: PlayerPathway[]
  pathways: Pathway[]
  sequences: Sequence[]
}

export default function PlayerDetailView({ profile, playerPathways, pathways, sequences }: PlayerDetailViewProps) {
  const router = useRouter()

  // Helper: Get mapped info
  const mappedPathways = playerPathways.map(pp => {
    const pw = pathways.find(p => p.id === pp.pathway_id)
    const seq = sequences.find(s => s.id === pp.sequence_id)
    return {
      pathwayId: pw?.id || '',
      pathwayName: pw?.name || '-',
      logoUrl: pw?.logo_url || null,
      sequenceName: seq?.name || '-',
      seqNumber: seq?.seq_number ?? null
    }
  })

  return (
    <div className="min-h-screen bg-[#0F0D0A]">
      {/* Header */}
      <header className="border-b border-gold-400/10 bg-victorian-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="w-[90%] mx-auto px-4 py-4 md:px-8 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-victorian-400 hover:text-gold-400 hover:bg-gold-400/5 rounded-full transition-all"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="heading-victorian text-xl md:text-2xl truncate">
            {profile.display_name || 'ข้อมูลตัวละคร'}
          </h1>
        </div>
      </header>

      <main className="w-[90%] mx-auto px-4 py-8 md:px-8">
        <div className="card-victorian relative overflow-hidden bg-[#1A1612]">
          {/* Banner Background */}
          {profile.background_url && (
            <div className="relative w-full h-48 md:h-64 overflow-hidden">
              <img
                src={profile.background_url}
                alt=""
                className="w-full h-full object-cover"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#1A1612]/60 to-[#1A1612]" />
            </div>
          )}

          <CornerOrnament className="absolute top-0 left-0 z-20" />
          <CornerOrnament className="absolute top-0 right-0 -scale-x-100 z-20" />
          <CornerOrnament className="absolute bottom-0 left-0 -scale-y-100 z-20" />
          <CornerOrnament className="absolute bottom-0 right-0 scale-x-[-1] scale-y-[-1] z-20" />

          <div className="relative z-10 px-6 pb-10" style={{ marginTop: profile.background_url ? '-4rem' : '2rem' }}>
            {/* Header / Avatar */}
            <div className="flex flex-col md:flex-row items-end md:items-end gap-6 mb-8">
              <div className="relative shrink-0">
                 {profile.avatar_url ? (
                   <img 
                     src={profile.avatar_url} 
                     alt={profile.display_name || ''}
                     className="w-32 h-32 md:w-40 md:h-40 rounded-lg border-4 border-gold-400/30 object-cover shadow-gold bg-victorian-950"
                     decoding="async" 
                   />
                 ) : (
                   <div className="w-32 h-32 md:w-40 md:h-40 rounded-lg border-4 border-gold-400/30 bg-victorian-800 flex items-center justify-center shadow-gold">
                      <span className="text-gold-400 text-5xl font-display">
                        {(profile.display_name || '?')[0]?.toUpperCase()}
                      </span>
                   </div>
                 )}
              </div>
              
              <div className="flex-1 mb-2">
                 <h2 className="heading-victorian text-3xl md:text-4xl lg:text-5xl text-gold-400 drop-shadow-md">
                   {profile.display_name}
                 </h2>
                 <div className="flex flex-wrap items-center gap-3 mt-3">
                   <RoleBadge role={profile.role} />
                   {profile.religions && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 text-sm font-display tracking-wider border rounded-md text-gold-200 bg-gold-500/10 border-gold-500/20">
                        {profile.religions.logo_url ? (
                            <img src={profile.religions.logo_url} className="w-4 h-4 rounded-full object-cover" />
                        ) : (
                            <Church className="w-4 h-4" />
                        )}
                        {profile.religions.name_th}
                    </div>
                   )}
                   <span className="text-victorian-400 text-sm font-mono">
                     ID: {profile.id.slice(0, 8)}
                   </span>
                 </div>
              </div>
            </div>

            {/* Stats & Pathways — horizontal row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
               {/* Status Card */}
               <div className="p-5 bg-victorian-950/40 border border-gold-400/10 rounded-sm space-y-4">
                  <h3 className="text-victorian-300 text-xs font-display uppercase tracking-wider mb-2">สถานะ</h3>
                  
                  {/* HP */}
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2 text-red-400">
                        <Heart className="w-4 h-4" />
                        <span className="text-sm font-body">HP</span>
                     </div>
                     <span className="font-display text-xl text-red-200">{profile.hp}</span>
                  </div>

                  {/* Sanity */}
                  <div className="space-y-1">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-cyan-400">
                           <Brain className="w-4 h-4" />
                           <span className="text-sm font-body">Sanity</span>
                        </div>
                        <span className="font-display text-sm text-cyan-200">
                          {profile.sanity} / {profile.max_sanity}
                        </span>
                     </div>
                     <div className="h-1.5 w-full bg-victorian-900 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-cyan-500 rounded-full" 
                          style={{ width: `${(profile.sanity / profile.max_sanity) * 100}%` }} 
                        />
                     </div>
                  </div>

                  {/* Spirituality */}
                  <div className="space-y-1">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-purple-400">
                           <Flame className="w-4 h-4" />
                           <span className="text-sm font-body">Spirituality</span>
                        </div>
                        <span className="font-display text-sm text-purple-200">
                          {profile.spirituality} / {profile.max_spirituality}
                        </span>
                     </div>
                     <div className="h-1.5 w-full bg-victorian-900 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-500 rounded-full" 
                          style={{ width: `${(profile.spirituality / profile.max_spirituality) * 100}%` }} 
                        />
                     </div>
                  </div>
               </div>

               {/* Pathways */}
               <div className="p-5 bg-victorian-950/40 border border-gold-400/10 rounded-sm">
                  <h3 className="text-victorian-300 text-xs font-display uppercase tracking-wider mb-3">เส้นทาง</h3>
                  {mappedPathways.length > 0 ? (
                    <div className="space-y-3">
                      {mappedPathways.map((info, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-victorian-900/50 rounded-sm border border-white/5">
                            {info.logoUrl && (
                              <img 
                                src={info.logoUrl} 
                                alt={info.pathwayName}
                                className="w-10 h-10 rounded object-contain bg-victorian-950/50 p-1 shrink-0"
                                loading="lazy"
                                decoding="async"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <span className="text-nouveau-cream text-sm font-medium block truncate">{info.pathwayName}</span>
                              <div className="flex items-center justify-between mt-1 gap-2">
                                <span className="text-gold-500 text-xs truncate">
                                  {info.sequenceName}
                                </span>
                                {info.seqNumber !== null && (
                                  <span className="text-victorian-500 text-[10px] border border-victorian-700 px-1.5 py-0.5 rounded shrink-0">
                                    Seq {info.seqNumber}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-victorian-500 text-sm italic">ไม่มีข้อมูลเส้นทาง</p>
                  )}
               </div>
            </div>

          </div>
        </div>

        {/* Bio — Full Width Section */}
        <div className="mt-8 card-victorian relative overflow-hidden bg-[#1A1612]">
          <CornerOrnament className="absolute top-0 left-0" />
          <CornerOrnament className="absolute top-0 right-0 -scale-x-100" />
          <CornerOrnament className="absolute bottom-0 left-0 -scale-y-100" />
          <CornerOrnament className="absolute bottom-0 right-0 scale-x-[-1] scale-y-[-1]" />

          <div className="relative z-10 p-6 md:p-8">
            <div className="flex items-center gap-2 mb-6 pb-3 border-b border-gold-400/10">
              <Users className="w-5 h-5 text-gold-400" />
              <h3 className="text-gold-100 font-display uppercase tracking-wider">ประวัติตัวละคร</h3>
            </div>
            {profile.bio && profile.bio !== '<p></p>' ? (
              <BioRenderer html={profile.bio} className="text-nouveau-cream" />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-victorian-500 gap-3">
                <Users className="w-10 h-10 opacity-20" />
                <p className="italic text-lg">ยังไม่ได้บันทึกประวัติ</p>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  )
}
