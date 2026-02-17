'use client'

import { signOut, updateProfile } from '@/app/actions/auth'
import { promotePotionDigest } from '@/app/actions/action-quest'
import { applySanityDecay } from '@/app/actions/players'
import AdminEditModal from '@/components/admin/admin-edit-modal'
import DisplayNameSetup from '@/components/dashboard/display-name-setup'
import SanityLockOverlay from '@/components/sanity-lock-overlay'
import { CornerOrnament, OrnamentedCard } from '@/components/ui/ornaments'
import dynamic from 'next/dynamic'
import type { User } from '@supabase/supabase-js'
import { LogOut, Shield, Swords, Crown, Settings, X, Camera, Map, Zap, Users, Footprints, Flame, Brain, Heart, Pencil, Lock, Image as ImageIcon, BookOpen, FileText, Church } from 'lucide-react'
import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const BioEditor = dynamic(() => import('@/components/bio-editor'), { ssr: false })

interface Profile {
  id: string
  display_name: string | null
  display_name_set: boolean
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
  religion_id?: string | null
  religions?: {
    id: string
    name_th: string
    logo_url: string | null
  } | null
  created_at: string
  updated_at: string
}

interface RankInfo {
  pathwayName: string
  pathwayLogoUrl: string | null
  pathwayBgUrl: string | null
  seqNumber: number | null
  sequenceName: string | null
}


function RoleBadge({ role }: { role: string }) {
  const config = {
    admin:  { icon: Crown,  label: 'ผู้ดูแลระบบ',    color: 'text-gold-300 bg-gold-400/10 border-gold-400/30' },
    dm:     { icon: Shield, label: 'Dungeon Master', color: 'text-nouveau-cream bg-nouveau-emerald/10 border-nouveau-emerald/30' },
    player: { icon: Swords, label: 'ผู้เล่น',        color: 'text-nouveau-cream bg-metal-silver/10 border-metal-silver/30' },
  }[role] ?? { icon: Swords, label: 'ผู้เล่น', color: 'text-nouveau-cream bg-metal-silver/10 border-metal-silver/30' }

  const Icon = config.icon

  return (
    <span className={`inline-flex items-center gap-2 md:gap-3 px-3 py-1.5 md:px-6 md:py-3 text-sm md:text-xl font-display 
                      tracking-wider border rounded-md ${config.color}`}>
      <Icon className="w-5 h-5 md:w-8 md:h-8" />
      {config.label}
    </span>
  )
}

export default function DashboardContent({ 
  user, 
  profile,
  rankDisplay = 'Level 1 Adventurer',
  rankInfo = null
}: { 
  user: User
  profile: Profile | null
  rankDisplay?: string 
  rankInfo?: RankInfo | null
}) {
  const [showProfile, setShowProfile] = useState(false)
  const [showEditAvatar, setShowEditAvatar] = useState(false)
  const [showEditBio, setShowEditBio] = useState(false)
  const [showAdminEdit, setShowAdminEdit] = useState(false)
  const [isSigningOut, startTransition] = useTransition()
  const [isSavingBio, setIsSavingBio] = useState(false)
  const router = useRouter()
  
  // Optimistic UI state
  const [optimisticAvatar, setOptimisticAvatar] = useState<string | null>(null)
  const [optimisticBg, setOptimisticBg] = useState<string | null | undefined>(undefined)
  const [optimisticBio, setOptimisticBio] = useState<string | null | undefined>(undefined)
  const [digestProgress, setDigestProgress] = useState(profile?.potion_digest_progress ?? 0)
  const [isPromotingDigest, setIsPromotingDigest] = useState(false)
  const [promoteResult, setPromoteResult] = useState<{ seqNumber: number; seqName: string | null } | null>(null)

  const isAdmin = profile?.role === 'admin' || profile?.role === 'dm'
  
  // ตรวจสอบว่าผู้เล่นยืนยันชื่อแล้วหรือยัง
  const needsDisplayNameSetup = profile && !profile.display_name_set

  // ตรวจสอบว่าสติเหลือ 0 หรือไม่ (Sanity Lock)
  const isSanityLocked = profile?.sanity === 0
  
  // Apply sanity decay on page load
  useEffect(() => {
    applySanityDecay().catch(() => {})
  }, [])

  useEffect(() => {
    setDigestProgress(profile?.potion_digest_progress ?? 0)
  }, [profile?.potion_digest_progress])

  const displayName = profile?.display_name 
    || user.user_metadata?.full_name 
    || user.email?.split('@')[0] 
    || 'นักผจญภัย'

  const currentAvatarUrl = optimisticAvatar 
    || profile?.avatar_url 
    || user.user_metadata?.avatar_url

  const currentBgUrl = optimisticBg !== undefined ? optimisticBg : profile?.background_url
  const currentBio = optimisticBio !== undefined ? optimisticBio : profile?.bio

  const role = profile?.role || 'player'

  function handleSignOut() {
    startTransition(async () => {
      await signOut()
    })
  }

  function handlePromoteDigest() {
    setIsPromotingDigest(true)
    startTransition(async () => {
      const r = await promotePotionDigest()
      if (r?.error) {
        alert(r.error)
      } else {
        setDigestProgress(0)
        setPromoteResult({ seqNumber: r.newSeqNumber || 0, seqName: r.newSeqName || null })
        router.refresh()
      }
      setIsPromotingDigest(false)
    })
  }

  return (
    <div className="min-h-screen">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes flowEnergy {
          0% { background-position: 200% 0; }
          100% { background-position: 0% 0; }
        }
      `}} />
      {/* Top nav bar */}
      <header className="border-b border-gold-400/10 bg-victorian-950/80 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-4 py-4 md:px-8 md:py-8 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 md:gap-6">
            <span className="text-gold-400 text-3xl md:text-5xl">⚜</span>
            <h1 className="heading-victorian text-2xl md:text-5xl">Whisper</h1>
          </div>

          {/* User info */}
          <div className="flex items-center gap-3 md:gap-8">
            <RoleBadge role={role} />

            {/* Click avatar to open profile popup */}
            <button 
              type="button"
              onClick={() => setShowProfile(true)}
              className="flex items-center gap-3 md:gap-6 cursor-pointer hover:opacity-70 transition-opacity"
            >
              {currentAvatarUrl ? (
                <img
                  src={currentAvatarUrl}
                  alt={displayName}
                  className="w-10 h-10 md:w-20 md:h-20 rounded-full border-2 border-gold-400/30 object-cover"
                  decoding="async"
                />
              ) : (
                <div className="w-10 h-10 md:w-20 md:h-20 rounded-full border-2 border-gold-400/30 
                                bg-victorian-800 flex items-center justify-center">
                  <span className="text-gold-400 text-base md:text-2xl font-display">
                    {displayName[0]?.toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-nouveau-cream/80 text-base md:text-2xl font-body hidden sm:block">
                {displayName}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-screen-2xl mx-auto px-4 py-6 md:px-8 md:py-10 space-y-8 md:space-y-12">
        
        {/* 1. Character Info Section */}
        <OrnamentedCard className="p-4 md:p-10 lg:p-14 animate-fade-in relative">
        <section className="flex flex-col xl:flex-row items-center xl:items-start gap-6 md:gap-12 xl:gap-20">
          {/* Left: Avatar + Name */}
          <div className="flex flex-col items-center text-center w-full xl:w-auto shrink-0">
            <div className="relative group mb-4 md:mb-6">
              <div className="absolute -inset-1 rounded-xl bg-gold-400/20 blur-md group-hover:bg-gold-400/30 transition-all duration-500" />
              {currentAvatarUrl ? (
                <img
                  src={currentAvatarUrl}
                  alt={displayName}
                  className="relative w-32 h-32 md:w-64 md:h-64 lg:w-80 lg:h-80 xl:w-96 xl:h-96 rounded-xl border-4 border-gold-400/50 object-cover shadow-gold"
                  fetchPriority="high"
                  decoding="async"
                />
              ) : (
                <div className="relative w-32 h-32 md:w-64 md:h-64 lg:w-80 lg:h-80 xl:w-96 xl:h-96 rounded-xl border-4 border-gold-400/50 
                                bg-victorian-800 flex items-center justify-center shadow-gold">
                  <span className="text-gold-400 text-5xl md:text-8xl font-body font-semibold">
                    {displayName[0]?.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 justify-center">
              <h2 className="heading-victorian text-2xl md:text-3xl lg:text-4xl">
                {displayName}
              </h2>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowAdminEdit(true)}
                  className="p-2 text-victorian-400 hover:text-gold-400 cursor-pointer 
                             bg-victorian-900/60 rounded-md border border-gold-400/10 hover:border-gold-400/30 transition-all"
                  title="แก้ไขข้อมูล (Admin)"
                >
                  <Pencil className="w-5 h-5" />
                </button>
              )}
            </div>
            {rankInfo?.pathwayName ? (
              <div className="mt-3 w-full max-w-[320px]">
                <div className="relative overflow-hidden rounded-lg border border-gold-400/20 bg-victorian-900/70">
                  {rankInfo.pathwayBgUrl && (
                    <img
                      src={rankInfo.pathwayBgUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover opacity-35"
                      decoding="async"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-victorian-950/80 via-victorian-900/70 to-victorian-950/80" />
                  <div className="relative p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full border border-gold-400/30 bg-victorian-900/80 flex items-center justify-center overflow-hidden">
                      {rankInfo.pathwayLogoUrl ? (
                        <img src={rankInfo.pathwayLogoUrl} alt="" className="w-full h-full object-cover" decoding="async" />
                      ) : (
                        <Flame className="w-5 h-5 text-amber-300" />
                      )}
                    </div>
                    <div className="text-left">
                      <div className="text-gold-200 font-display text-sm md:text-base drop-shadow-[0_0_6px_rgba(251,191,36,0.7)]">
                        {rankInfo.pathwayName}
                      </div>
                      <div className="text-amber-200/90 text-xs md:text-sm drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]">
                        ลำดับ {rankInfo.seqNumber ?? '-'}{rankInfo.sequenceName ? ` — ${rankInfo.sequenceName}` : ''}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-victorian-300 font-body text-sm md:text-lg lg:text-xl tracking-wide mt-2 md:mt-3">
                {rankDisplay}
              </p>
            )}
          </div>

          {/* Right: Stats Grid — fills remaining space */}
          <div className="flex-1 w-full flex flex-col gap-3 md:gap-6 xl:gap-8">
            <div className="w-full grid grid-cols-2 gap-3 md:gap-6 xl:gap-8">
            {/* ตัวตายตัวแทน (HP) */}
            <div className="p-3 md:p-6 bg-victorian-900/60 border border-red-500/20 rounded-md flex flex-col md:flex-row items-center md:justify-between gap-2 md:gap-4">
              <div className="flex items-center gap-2 md:gap-4">
                <div className="p-2 md:p-3 bg-red-500/10 rounded-full">
                  <Heart className="w-6 h-6 md:w-10 md:h-10 text-red-400" />
                </div>
                <span className="text-red-300 font-display text-xs md:text-xl tracking-wider uppercase">HP</span>
              </div>
              <div className="flex items-baseline gap-1 md:gap-2">
                <span className="font-display text-3xl md:text-7xl text-red-200 tabular-nums">{profile?.hp ?? 5}</span>
                <span className="text-red-400/50 text-sm md:text-xl font-display">ครั้ง</span>
              </div>
            </div>

            {/* สติ (Sanity) */}
            <div className="p-3 md:p-6 bg-victorian-900/60 border border-cyan-500/20 rounded-md flex flex-col justify-center">
              <div className="flex items-center justify-between mb-2 md:mb-4">
                <div className="flex items-center gap-2 md:gap-4">
                  <div className="p-2 md:p-3 bg-cyan-500/10 rounded-full">
                    <Brain className="w-6 h-6 md:w-10 md:h-10 text-cyan-400" />
                  </div>
                  <div>
                    <span className="block text-cyan-300 font-display text-xs md:text-xl tracking-wider uppercase">สติ</span>
                    <span className="text-cyan-500/50 text-[10px] md:text-sm hidden md:inline">(-2/วัน)</span>
                  </div>
                </div>
                <span className="font-display text-lg md:text-4xl text-cyan-200">
                  {profile?.sanity ?? 10} <span className="text-cyan-400/60 text-xs md:text-xl">/ {profile?.max_sanity ?? 10}</span>
                </span>
              </div>
              <div className="w-full h-2 md:h-4 bg-victorian-950 rounded-full overflow-hidden border border-cyan-500/10">
                <div 
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ 
                    width: `${((profile?.sanity ?? 10) / (profile?.max_sanity ?? 10)) * 100}%`,
                    background: 'linear-gradient(90deg, #0891B2, #06B6D4, #22D3EE)',
                    boxShadow: '0 0 12px rgba(6, 182, 212, 0.5)'
                  }}
                />
              </div>
            </div>

            {/* พลังวิญญาณ (Spirituality) */}
            <div className="p-3 md:p-6 bg-victorian-900/60 border border-purple-500/20 rounded-md flex flex-col justify-center">
              <div className="flex items-center justify-between mb-2 md:mb-4">
                <div className="flex items-center gap-2 md:gap-4">
                  <div className="p-2 md:p-3 bg-purple-500/10 rounded-full">
                    <Flame className="w-6 h-6 md:w-10 md:h-10 text-purple-400" />
                  </div>
                  <span className="text-purple-300 font-display text-xs md:text-xl tracking-wider uppercase">วิญญาณ</span>
                </div>
                <span className="font-display text-lg md:text-4xl text-purple-200">
                  {profile?.spirituality ?? 15} <span className="text-purple-400/60 text-xs md:text-xl">/ {profile?.max_spirituality ?? 15}</span>
                </span>
              </div>
              <div className="w-full h-2 md:h-4 bg-victorian-950 rounded-full overflow-hidden border border-purple-500/10">
                <div 
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ 
                    width: `${((profile?.spirituality ?? 15) / (profile?.max_spirituality ?? 15)) * 100}%`,
                    background: 'linear-gradient(90deg, #7C3AED, #A855F7, #C084FC)',
                    boxShadow: '0 0 12px rgba(168, 85, 247, 0.5)'
                  }}
                />
              </div>
            </div>

            {/* หน่วยการเดินทาง (Travel Points) */}
            <div className="p-3 md:p-6 bg-victorian-900/60 border border-emerald-500/20 rounded-md flex flex-col justify-center">
              <div className="flex items-center justify-between mb-2 md:mb-4">
                <div className="flex items-center gap-2 md:gap-4">
                  <div className="p-2 md:p-3 bg-emerald-500/10 rounded-full">
                    <Footprints className="w-6 h-6 md:w-10 md:h-10 text-emerald-400" />
                  </div>
                  <span className="text-emerald-300 font-display text-xs md:text-xl tracking-wider uppercase">เดินทาง</span>
                </div>
                <span className="font-display text-lg md:text-4xl text-emerald-200">
                  {profile?.travel_points ?? 9} <span className="text-emerald-400/60 text-xs md:text-xl">/ {profile?.max_travel_points ?? 9}</span>
                </span>
              </div>
              <div className="w-full h-2 md:h-4 bg-victorian-950 rounded-full overflow-hidden border border-emerald-500/10">
                <div 
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ 
                    width: `${((profile?.travel_points ?? 9) / (profile?.max_travel_points ?? 9)) * 100}%`,
                    background: 'linear-gradient(90deg, #059669, #10B981, #34D399)',
                    boxShadow: '0 0 12px rgba(16, 185, 129, 0.5)'
                  }}
                />
              </div>
            </div>

            <div className="p-3 md:p-6 bg-victorian-900/60 border border-amber-500/20 rounded-md flex flex-col justify-center">
              <div className="flex items-center justify-between mb-2 md:mb-4">
                <div className="flex items-center gap-2 md:gap-4">
                  <div className="p-2 md:p-3 bg-amber-500/10 rounded-full">
                    <Flame className="w-6 h-6 md:w-10 md:h-10 text-amber-400" />
                  </div>
                  <span className="text-amber-300 font-display text-xs md:text-xl tracking-wider uppercase">ย่อยโอสถ</span>
                </div>
                <span className="font-display text-lg md:text-4xl text-amber-200 tabular-nums">
                  {Math.min(100, Math.max(0, digestProgress))}%
                </span>
              </div>
              <div className="w-full h-2 md:h-4 bg-victorian-950 rounded-full overflow-hidden border border-amber-500/10">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.min(100, Math.max(0, digestProgress))}%`,
                    background: 'linear-gradient(90deg, #F59E0B, #FBBF24, #FFFBEB, #FBBF24, #F59E0B)',
                    backgroundSize: '200% 100%',
                    animation: 'flowEnergy 2s linear infinite',
                    boxShadow: '0 0 12px rgba(251, 191, 36, 0.6)'
                  }}
                />
              </div>
              {digestProgress >= 100 && (
                <button
                  type="button"
                  onClick={handlePromoteDigest}
                  disabled={isPromotingDigest}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-md text-xs md:text-sm font-bold bg-gradient-to-r from-amber-500 to-yellow-300 text-amber-950 shadow-lg shadow-amber-500/20 disabled:opacity-60"
                >
                  {isPromotingDigest && <div className="w-3.5 h-3.5 border-2 border-amber-900/40 border-t-amber-900 rounded-full animate-spin" />}
                  เลื่อนลำดับขั้น
                </button>
              )}
            </div>
            </div>
            <div className="p-3 md:p-5 bg-victorian-900/60 border border-gold-400/20 rounded-md flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 bg-gold-500/10 rounded-full">
                {profile?.religions?.logo_url ? (
                  <img
                    src={profile.religions.logo_url}
                    alt=""
                    className="w-6 h-6 md:w-9 md:h-9 rounded-full object-cover"
                    decoding="async"
                  />
                ) : (
                  <Church className="w-6 h-6 md:w-9 md:h-9 text-gold-400" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-gold-400/80 font-display text-[10px] md:text-xs uppercase tracking-wider">ศาสนาที่สังกัด</span>
                <span className="text-nouveau-cream text-sm md:text-lg font-display">
                  {profile?.religions?.name_th || 'ยังไม่เลือกศาสนา'}
                </span>
              </div>
            </div>
          </div>
        </section>

        </OrnamentedCard>

        {/* 2. Grid Menu */}
        <section className="grid grid-cols-2 md:grid-cols-2 gap-4 md:gap-8 lg:gap-12">
          <Link 
            href={isSanityLocked ? "#" : "/dashboard/maps"} 
            className={`group relative overflow-hidden card-victorian p-6 md:p-12 lg:p-16 flex flex-col items-center justify-center gap-4 md:gap-8 
                        hover:border-gold-400/50 hover:bg-victorian-900/90 transition-all duration-300 min-h-[180px] md:min-h-[350px]
                        ${isSanityLocked ? 'pointer-events-none opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            title={isSanityLocked ? "ถูกล็อค: สติของคุณเหลือ 0" : ""}
          >
            <CornerOrnament className="absolute top-0 left-0 w-12 h-12 md:w-24 md:h-24" />
            <CornerOrnament className="absolute top-0 right-0 -scale-x-100 w-12 h-12 md:w-24 md:h-24" />
            <CornerOrnament className="absolute bottom-0 left-0 -scale-y-100 w-12 h-12 md:w-24 md:h-24" />
            <CornerOrnament className="absolute bottom-0 right-0 scale-x-[-1] scale-y-[-1] w-12 h-12 md:w-24 md:h-24" />
            <div className="relative z-10 flex flex-col items-center gap-3 md:gap-8">
              <div className="w-16 h-16 md:w-32 md:h-32 rounded-full bg-victorian-800/50 border-2 border-gold-400/20 
                              flex items-center justify-center group-hover:scale-110 group-hover:shadow-gold transition-all duration-300">
                {isSanityLocked ? (
                  <Lock className="w-8 h-8 md:w-16 md:h-16 text-red-500" />
                ) : (
                  <Map className="w-8 h-8 md:w-16 md:h-16 text-gold-400" />
                )}
              </div>
              <h3 className="heading-victorian text-2xl md:text-5xl">แผนที่</h3>
              <p className="text-victorian-400 text-center text-sm md:text-2xl font-body hidden md:block">
                สำรวจโลกกว้างและสถานที่สำคัญ
              </p>
            </div>
          </Link>

          <a 
            href={isSanityLocked ? "#" : "/dashboard/skills"} 
            className={`group relative overflow-hidden card-victorian p-6 md:p-12 lg:p-16 flex flex-col items-center justify-center gap-4 md:gap-8 
                        hover:border-gold-400/50 hover:bg-victorian-900/90 transition-all duration-300 min-h-[180px] md:min-h-[350px]
                        ${isSanityLocked ? 'pointer-events-none opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            title={isSanityLocked ? "ถูกล็อค: สติของคุณเหลือ 0" : ""}
          >
            <CornerOrnament className="absolute top-0 left-0 w-12 h-12 md:w-24 md:h-24" />
            <CornerOrnament className="absolute top-0 right-0 -scale-x-100 w-12 h-12 md:w-24 md:h-24" />
            <CornerOrnament className="absolute bottom-0 left-0 -scale-y-100 w-12 h-12 md:w-24 md:h-24" />
            <CornerOrnament className="absolute bottom-0 right-0 scale-x-[-1] scale-y-[-1] w-12 h-12 md:w-24 md:h-24" />
            <div className="relative z-10 flex flex-col items-center gap-3 md:gap-8">
              <div className="w-16 h-16 md:w-32 md:h-32 rounded-full bg-victorian-800/50 border-2 border-gold-400/20 
                              flex items-center justify-center group-hover:scale-110 group-hover:shadow-gold transition-all duration-300">
                {isSanityLocked ? (
                  <Lock className="w-8 h-8 md:w-16 md:h-16 text-red-500" />
                ) : (
                  <Zap className="w-8 h-8 md:w-16 md:h-16 text-gold-400" />
                )}
              </div>
              <h3 className="heading-victorian text-2xl md:text-5xl">สกิล</h3>
              <p className="text-victorian-400 text-center text-sm md:text-2xl font-body hidden md:block">
                จัดการทักษะและความสามารถพิเศษ
              </p>
            </div>
          </a>

          <a 
            href={isSanityLocked ? "#" : "/dashboard/action-quest"} 
            className={`group relative overflow-hidden card-victorian p-6 md:p-12 lg:p-16 flex flex-col items-center justify-center gap-4 md:gap-8 
                        hover:border-gold-400/50 hover:bg-victorian-900/90 transition-all duration-300 min-h-[180px] md:min-h-[350px]
                        ${isSanityLocked ? 'pointer-events-none opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            title={isSanityLocked ? "ถูกล็อค: สติของคุณเหลือ 0" : ""}
          >
            <CornerOrnament className="absolute top-0 left-0 w-12 h-12 md:w-24 md:h-24" />
            <CornerOrnament className="absolute top-0 right-0 -scale-x-100 w-12 h-12 md:w-24 md:h-24" />
            <CornerOrnament className="absolute bottom-0 left-0 -scale-y-100 w-12 h-12 md:w-24 md:h-24" />
            <CornerOrnament className="absolute bottom-0 right-0 scale-x-[-1] scale-y-[-1] w-12 h-12 md:w-24 md:h-24" />
            <div className="relative z-10 flex flex-col items-center gap-3 md:gap-8">
              <div className="w-16 h-16 md:w-32 md:h-32 rounded-full bg-victorian-800/50 border-2 border-gold-400/20 
                              flex items-center justify-center group-hover:scale-110 group-hover:shadow-gold transition-all duration-300">
                {isSanityLocked ? (
                  <Lock className="w-8 h-8 md:w-16 md:h-16 text-red-500" />
                ) : (
                  <Swords className="w-8 h-8 md:w-16 md:h-16 text-gold-400" />
                )}
              </div>
              <h3 className="heading-victorian text-2xl md:text-5xl">แอคชั่น</h3>
              <p className="text-victorian-400 text-center text-sm md:text-2xl font-body hidden md:block">
                ส่งการกระทำ / ภารกิจ
              </p>
            </div>
          </a>

          <a 
            href={isSanityLocked ? "#" : "/dashboard/players"} 
            className={`group relative overflow-hidden card-victorian p-6 md:p-12 lg:p-16 flex flex-col items-center justify-center gap-4 md:gap-8 
                        hover:border-gold-400/50 hover:bg-victorian-900/90 transition-all duration-300 min-h-[180px] md:min-h-[350px]
                        ${isSanityLocked ? 'pointer-events-none opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            title={isSanityLocked ? "ถูกล็อค: สติของคุณเหลือ 0" : ""}
          >
            <CornerOrnament className="absolute top-0 left-0 w-12 h-12 md:w-24 md:h-24" />
            <CornerOrnament className="absolute top-0 right-0 -scale-x-100 w-12 h-12 md:w-24 md:h-24" />
            <CornerOrnament className="absolute bottom-0 left-0 -scale-y-100 w-12 h-12 md:w-24 md:h-24" />
            <CornerOrnament className="absolute bottom-0 right-0 scale-x-[-1] scale-y-[-1] w-12 h-12 md:w-24 md:h-24" />
            <div className="relative z-10 flex flex-col items-center gap-3 md:gap-8">
              <div className="w-16 h-16 md:w-32 md:h-32 rounded-full bg-victorian-800/50 border-2 border-gold-400/20 
                              flex items-center justify-center group-hover:scale-110 group-hover:shadow-gold transition-all duration-300">
                {isSanityLocked ? (
                  <Lock className="w-8 h-8 md:w-16 md:h-16 text-red-500" />
                ) : (
                  <Users className="w-8 h-8 md:w-16 md:h-16 text-gold-400" />
                )}
              </div>
              <h3 className="heading-victorian text-2xl md:text-5xl">ทำเนียบผู้เล่น</h3>
              <p className="text-victorian-400 text-center text-sm md:text-2xl font-body hidden md:block">
                รายชื่อนักผจญภัยและสหายร่วมรบ
              </p>
            </div>
          </a>
        </section>

      </main>

      {/* ═══════════════════════════════════════════ */}
      {/*  PROFILE POPUP — Center of screen, simple  */}
      {/* ═══════════════════════════════════════════ */}
      {showProfile && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowProfile(false)}
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
          <div 
            className="w-full max-w-lg rounded-sm border border-gold-400/20 p-8"
            style={{ backgroundColor: '#1A1612' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <div className="flex justify-end mb-4">
              <button 
                type="button"
                onClick={() => setShowProfile(false)}
                className="text-victorian-400 hover:text-gold-400 cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Avatar + Name */}
            <div className="flex flex-col items-center gap-4 mb-8">
              {currentAvatarUrl ? (
                <img
                  src={currentAvatarUrl}
                  alt={displayName}
                  className="w-24 h-24 rounded-full border-2 border-gold-400/30 object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-full border-2 border-gold-400/30 
                                bg-victorian-800 flex items-center justify-center">
                  <span className="text-gold-400 text-3xl font-display">
                    {displayName[0]?.toUpperCase()}
                  </span>
                </div>
              )}
              <div className="text-center">
                <p className="font-display text-gold-400 text-2xl">{displayName}</p>
                <p className="text-victorian-400 text-sm mt-1">{user.email}</p>
              </div>
              <RoleBadge role={role} />
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  if (isSanityLocked) return
                  setShowProfile(false)
                  setShowEditBio(true)
                }}
                disabled={isSanityLocked}
                className={`w-full flex items-center justify-center gap-3 px-4 py-3
                           border border-gold-400/20 rounded-sm
                           text-nouveau-cream hover:text-gold-400 hover:border-gold-400/40
                           transition-colors text-base
                           ${isSanityLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                style={{ backgroundColor: '#231C14' }}
                title={isSanityLocked ? "ถูกล็อค: สติของคุณเหลือ 0" : ""}
              >
                {isSanityLocked ? (
                  <Lock className="w-5 h-5 text-red-500" />
                ) : (
                  <BookOpen className="w-5 h-5" />
                )}
                แก้ไขประวัติ
              </button>

              <a
                href={isSanityLocked ? "#" : "/dashboard/bio-templates"}
                className={`w-full flex items-center justify-center gap-3 px-4 py-3
                           border border-gold-400/20 rounded-sm
                           text-nouveau-cream hover:text-gold-400 hover:border-gold-400/40
                           transition-colors text-base
                           ${isSanityLocked ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
                style={{ backgroundColor: '#231C14' }}
                title={isSanityLocked ? "ถูกล็อค: สติของคุณเหลือ 0" : ""}
              >
                {isSanityLocked ? (
                  <Lock className="w-5 h-5 text-red-500" />
                ) : (
                  <FileText className="w-5 h-5" />
                )}
                เทมเพลตประวัติ
              </a>

              <button
                type="button"
                onClick={() => {
                  if (isSanityLocked) return
                  setShowProfile(false)
                  setShowEditAvatar(true)
                }}
                disabled={isSanityLocked}
                className={`w-full flex items-center justify-center gap-3 px-4 py-3
                           border border-gold-400/20 rounded-sm
                           text-nouveau-cream hover:text-gold-400 hover:border-gold-400/40
                           transition-colors text-base
                           ${isSanityLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                style={{ backgroundColor: '#231C14' }}
                title={isSanityLocked ? "ถูกล็อค: สติของคุณเหลือ 0" : ""}
              >
                {isSanityLocked ? (
                  <Lock className="w-5 h-5 text-red-500" />
                ) : (
                  <Settings className="w-5 h-5" />
                )}
                ตั้งค่าโปรไฟล์
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="w-full flex items-center justify-center gap-3 px-4 py-3
                           border border-nouveau-ruby/30 rounded-sm
                           text-nouveau-ruby hover:border-nouveau-ruby/60
                           transition-colors cursor-pointer text-base
                           disabled:opacity-50"
                style={{ backgroundColor: '#231C14' }}
              >
                <LogOut className="w-5 h-5" />
                {isSigningOut ? 'กำลังออกจากระบบ...' : 'ออกจากระบบ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/*  SETTINGS POPUP — Avatar + Background URL */}
      {/* ═══════════════════════════════════════════ */}
      {showEditAvatar && !isSanityLocked && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowEditAvatar(false)}
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
          <div 
            className="w-full max-w-md rounded-sm border border-gold-400/20 p-8 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: '#1A1612' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="heading-victorian text-2xl">การตั้งค่าโปรไฟล์</h3>
              <button 
                type="button"
                onClick={() => setShowEditAvatar(false)}
                className="text-victorian-400 hover:text-gold-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form action={async (formData) => {
              const newAvatarUrl = formData.get('avatar_url') as string
              const newBgUrl = formData.get('background_url') as string

              // Optimistic Updates
              if (newAvatarUrl) setOptimisticAvatar(newAvatarUrl)
              if (newBgUrl) setOptimisticBg(newBgUrl)
              else setOptimisticBg(null)
              setShowEditAvatar(false)

              const result = await updateProfile(formData)
              
              if (result?.error) {
                setOptimisticAvatar(null)
                setOptimisticBg(undefined)
                alert(`เกิดข้อผิดพลาด: ${result.error}`)
              }
            }}>
              {/* Avatar Preview */}
              <div className="flex justify-center mb-6">
                {currentAvatarUrl ? (
                  <img
                    src={currentAvatarUrl}
                    alt="Current Avatar"
                    className="w-24 h-24 rounded-full border-2 border-gold-400/30 object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full border-2 border-gold-400/30 
                                  bg-victorian-800 flex items-center justify-center">
                    <span className="text-gold-400 text-3xl font-display">
                      {displayName[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Avatar URL */}
              <div className="mb-5">
                <label className="block text-sm text-victorian-300 mb-2">
                  <Camera className="w-3.5 h-3.5 inline mr-1.5" />
                  Avatar URL
                </label>
                <input 
                  name="avatar_url"
                  type="url" 
                  defaultValue={currentAvatarUrl || ''}
                  placeholder="https://example.com/avatar.jpg"
                  className="input-victorian w-full"
                  onChange={(e) => {
                    if (e.target.value && e.target.value.startsWith('http')) {
                      setOptimisticAvatar(e.target.value)
                    }
                  }}
                />
              </div>

              {/* Background URL */}
              <div className="mb-6">
                <label className="block text-sm text-victorian-300 mb-2">
                  <ImageIcon className="w-3.5 h-3.5 inline mr-1.5" />
                  ภาพแบ็คกราวด์โปรไฟล์
                </label>
                <input 
                  name="background_url"
                  type="url" 
                  defaultValue={currentBgUrl || ''}
                  placeholder="https://example.com/background.jpg"
                  className="input-victorian w-full"
                />
                <p className="mt-2 text-xs text-victorian-500">
                  ภาพจะแสดงเป็นพื้นหลังในการ์ดตัวละครของคุณ
                </p>
                {/* Background preview */}
                {currentBgUrl && (
                  <div className="mt-3 rounded-sm overflow-hidden border border-gold-400/10 h-20">
                    <img src={currentBgUrl} alt="BG Preview" className="w-full h-full object-cover opacity-60" loading="lazy" decoding="async" />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowEditAvatar(false)}
                  className="px-4 py-2 text-sm text-victorian-400 hover:text-nouveau-cream cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit"
                  className="btn-gold !py-2 !px-4 !text-sm"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/*  BIO EDITOR POPUP                          */}
      {/* ═══════════════════════════════════════════ */}
      {showEditBio && !isSanityLocked && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowEditBio(false)}
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
          <div 
            className="w-full max-w-2xl rounded-sm border border-gold-400/20 p-6 md:p-8 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: '#1A1612' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="heading-victorian text-2xl">แก้ไขประวัติตัวละคร</h3>
              <button 
                type="button"
                onClick={() => setShowEditBio(false)}
                className="text-victorian-400 hover:text-gold-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <BioEditor
              initialContent={currentBio || ''}
              saving={isSavingBio}
              onSave={async (html) => {
                setIsSavingBio(true)
                setOptimisticBio(html)
                
                const formData = new FormData()
                formData.set('bio', html)
                const result = await updateProfile(formData)
                
                setIsSavingBio(false)
                if (result?.error) {
                  setOptimisticBio(undefined)
                  alert(`เกิดข้อผิดพลาด: ${result.error}`)
                } else {
                  setShowEditBio(false)
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Admin Edit Modal */}
      {showAdminEdit && profile && (
        <AdminEditModal
          player={profile}
          currentUserRole={profile.role}
          onClose={() => setShowAdminEdit(false)}
          onSaved={() => router.refresh()}
        />
      )}

      {promoteResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(5,4,3,0.75)' }}>
          <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-amber-400/40 bg-victorian-950/90">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.35),_transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(245,158,11,0.25),_transparent_60%)]" />
            <div className="relative p-6 md:p-10 text-center space-y-5">
              <div className="mx-auto w-16 h-16 rounded-full border border-amber-400/50 bg-amber-500/10 flex items-center justify-center shadow-[0_0_25px_rgba(251,191,36,0.5)]">
                <Flame className="w-8 h-8 text-amber-300" />
              </div>
              <div className="heading-victorian text-2xl md:text-3xl text-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,0.7)]">
                ย่อยโอสถเสร็จสมบูรณ์
              </div>
              <div className="text-amber-100 text-sm md:text-lg drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]">
                คุณเลื่อนสู่ลำดับที่ {promoteResult.seqNumber} {promoteResult.seqName ? `(${promoteResult.seqName})` : ''}
              </div>
              <button type="button" onClick={() => setPromoteResult(null)} className="btn-gold !px-6 !py-2 !text-sm">
                รับทราบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sanity Lock Overlay - แสดงเมื่อสติเหลือ 0 */}
      {isSanityLocked && <SanityLockOverlay />}

      {/* Display Name Setup - บังคับตั้งชื่อเมื่อล็อกอินครั้งแรก */}
      {needsDisplayNameSetup && (
        <DisplayNameSetup currentName={displayName} />
      )}
    </div>
  )
}
