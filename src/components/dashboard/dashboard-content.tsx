'use client'

import { signOut, updateProfile } from '@/app/actions/auth'
import { applySanityDecay } from '@/app/actions/players'
import AdminEditModal from '@/components/admin/admin-edit-modal'
import SanityLockOverlay from '@/components/sanity-lock-overlay'
import type { User } from '@supabase/supabase-js'
import { LogOut, Shield, Swords, Crown, Settings, X, Camera, Map, Zap, Skull, Users, Footprints, Flame, Brain, Heart, Pencil, Lock } from 'lucide-react'
import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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

/* ── Art Nouveau Corner Ornament (same as login) ── */
function CornerOrnament({ className }: { className?: string }) {
  return (
    <svg className={className} width="60" height="60" viewBox="0 0 60 60" fill="none">
      <path
        d="M2 58V20C2 10 10 2 20 2H58"
        stroke="url(#gold-corner)"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M8 58V26C8 16 16 8 26 8H58"
        stroke="url(#gold-corner)"
        strokeWidth="0.5"
        opacity="0.4"
        fill="none"
      />
      <circle cx="20" cy="20" r="2" fill="#D4AF37" opacity="0.6"/>
      <defs>
        <linearGradient id="gold-corner" x1="2" y1="58" x2="58" y2="2">
          <stop stopColor="#D4AF37" stopOpacity="0.8"/>
          <stop offset="1" stopColor="#C5A55A" stopOpacity="0.2"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

function OrnamentedCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`card-victorian relative overflow-hidden ${className}`}>
      <CornerOrnament className="absolute top-0 left-0" />
      <CornerOrnament className="absolute top-0 right-0 -scale-x-100" />
      <CornerOrnament className="absolute bottom-0 left-0 -scale-y-100" />
      <CornerOrnament className="absolute bottom-0 right-0 scale-x-[-1] scale-y-[-1]" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  const config = {
    admin:  { icon: Crown,  label: 'ผู้ดูแลระบบ',    color: 'text-gold-300 bg-gold-400/10 border-gold-400/30' },
    dm:     { icon: Shield, label: 'Dungeon Master', color: 'text-nouveau-cream bg-nouveau-emerald/10 border-nouveau-emerald/30' },
    player: { icon: Swords, label: 'ผู้เล่น',        color: 'text-nouveau-cream bg-metal-silver/10 border-metal-silver/30' },
  }[role] ?? { icon: Swords, label: 'ผู้เล่น', color: 'text-nouveau-cream bg-metal-silver/10 border-metal-silver/30' }

  const Icon = config.icon

  return (
    <span className={`inline-flex items-center gap-3 px-6 py-3 text-xl font-display 
                      tracking-wider border rounded-md ${config.color}`}>
      <Icon className="w-8 h-8" />
      {config.label}
    </span>
  )
}

export default function DashboardContent({ 
  user, 
  profile,
  rankDisplay = 'Level 1 Adventurer'
}: { 
  user: User
  profile: Profile | null
  rankDisplay?: string 
}) {
  const [showProfile, setShowProfile] = useState(false)
  const [showEditAvatar, setShowEditAvatar] = useState(false)
  const [showAdminEdit, setShowAdminEdit] = useState(false)
  const [isSigningOut, startTransition] = useTransition()
  const router = useRouter()
  
  // Optimistic UI state
  const [optimisticAvatar, setOptimisticAvatar] = useState<string | null>(null)

  const isAdmin = profile?.role === 'admin' || profile?.role === 'dm'
  
  // ตรวจสอบว่าสติเหลือ 0 หรือไม่ (Sanity Lock)
  const isSanityLocked = profile?.sanity === 0
  
  // Apply sanity decay on page load
  useEffect(() => {
    applySanityDecay().catch(() => {})
  }, [])

  const displayName = profile?.display_name 
    || user.user_metadata?.full_name 
    || user.email?.split('@')[0] 
    || 'นักผจญภัย'

  const currentAvatarUrl = optimisticAvatar 
    || profile?.avatar_url 
    || user.user_metadata?.avatar_url

  const role = profile?.role || 'player'

  function handleSignOut() {
    startTransition(async () => {
      await signOut()
    })
  }

  return (
    <div className="min-h-screen">
      {/* Top nav bar */}
      <header className="border-b border-gold-400/10 bg-victorian-950/80 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-8 py-8 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <span className="text-gold-400 text-5xl">⚜</span>
            <h1 className="heading-victorian text-5xl">Whisper</h1>
          </div>

          {/* User info */}
          <div className="flex items-center gap-8">
            <RoleBadge role={role} />

            {/* Click avatar to open profile popup */}
            <button 
              type="button"
              onClick={() => setShowProfile(true)}
              className="flex items-center gap-6 cursor-pointer hover:opacity-70 transition-opacity"
            >
              {currentAvatarUrl ? (
                <img
                  src={currentAvatarUrl}
                  alt={displayName}
                  className="w-20 h-20 rounded-full border-2 border-gold-400/30 object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full border-2 border-gold-400/30 
                                bg-victorian-800 flex items-center justify-center">
                  <span className="text-gold-400 text-2xl font-display">
                    {displayName[0]?.toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-nouveau-cream/80 text-2xl font-body hidden sm:block">
                {displayName}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-screen-2xl mx-auto px-8 py-10 space-y-12">
        
        {/* 1. Character Info Section */}
        <OrnamentedCard className="p-10 md:p-14 animate-fade-in">
        <section className="flex flex-col xl:flex-row items-center xl:items-start gap-12 xl:gap-20">
          {/* Left: Avatar + Name */}
          <div className="flex flex-col items-center text-center w-full xl:w-auto shrink-0">
            <div className="relative group mb-6">
              <div className="absolute -inset-1 rounded-xl bg-gold-400/20 blur-md group-hover:bg-gold-400/30 transition-all duration-500" />
              {currentAvatarUrl ? (
                <img
                  src={currentAvatarUrl}
                  alt={displayName}
                  className="relative w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-xl border-4 border-gold-400/50 object-cover shadow-gold"
                />
              ) : (
                <div className="relative w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-xl border-4 border-gold-400/50 
                                bg-victorian-800 flex items-center justify-center shadow-gold">
                  <span className="text-gold-400 text-8xl font-body font-semibold">
                    {displayName[0]?.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 justify-center">
              <h2 className="heading-victorian text-3xl md:text-4xl">
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
            <p className="text-victorian-300 font-body text-lg md:text-xl tracking-wide mt-3">
              {rankDisplay}
            </p>
          </div>

          {/* Right: Stats Grid — fills remaining space */}
          <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-6 xl:gap-8">
            {/* ตัวตายตัวแทน (HP) */}
            <div className="p-6 bg-victorian-900/60 border border-red-500/20 rounded-md flex items-center justify-between min-h-[140px]">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-500/10 rounded-full">
                  <Heart className="w-10 h-10 text-red-400" />
                </div>
                <span className="text-red-300 font-display text-xl tracking-wider uppercase">ตัวตายตัวแทน</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-7xl text-red-200 tabular-nums">{profile?.hp ?? 5}</span>
                <span className="text-red-400/50 text-xl font-display">ครั้ง</span>
              </div>
            </div>

            {/* สติ (Sanity) */}
            <div className="p-6 bg-victorian-900/60 border border-cyan-500/20 rounded-md flex flex-col justify-center min-h-[140px]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-cyan-500/10 rounded-full">
                    <Brain className="w-10 h-10 text-cyan-400" />
                  </div>
                  <div>
                    <span className="block text-cyan-300 font-display text-xl tracking-wider uppercase">สติ</span>
                    <span className="text-cyan-500/50 text-sm">(-2/วัน)</span>
                  </div>
                </div>
                <span className="font-display text-4xl text-cyan-200">
                  {profile?.sanity ?? 10} <span className="text-cyan-400/60 text-xl">/ {profile?.max_sanity ?? 10}</span>
                </span>
              </div>
              <div className="w-full h-4 bg-victorian-950 rounded-full overflow-hidden border border-cyan-500/10">
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
            <div className="p-6 bg-victorian-900/60 border border-purple-500/20 rounded-md flex flex-col justify-center min-h-[140px]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-500/10 rounded-full">
                    <Flame className="w-10 h-10 text-purple-400" />
                  </div>
                  <span className="text-purple-300 font-display text-xl tracking-wider uppercase">พลังวิญญาณ</span>
                </div>
                <span className="font-display text-4xl text-purple-200">
                  {profile?.spirituality ?? 15} <span className="text-purple-400/60 text-xl">/ {profile?.max_spirituality ?? 15}</span>
                </span>
              </div>
              <div className="w-full h-4 bg-victorian-950 rounded-full overflow-hidden border border-purple-500/10">
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
            <div className="p-6 bg-victorian-900/60 border border-emerald-500/20 rounded-md flex flex-col justify-center min-h-[140px]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-full">
                    <Footprints className="w-10 h-10 text-emerald-400" />
                  </div>
                  <span className="text-emerald-300 font-display text-xl tracking-wider uppercase">หน่วยการเดินทาง</span>
                </div>
                <span className="font-display text-4xl text-emerald-200">
                  {profile?.travel_points ?? 9} <span className="text-emerald-400/60 text-xl">/ {profile?.max_travel_points ?? 9}</span>
                </span>
              </div>
              <div className="w-full h-4 bg-victorian-950 rounded-full overflow-hidden border border-emerald-500/10">
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
          </div>
        </section>
        </OrnamentedCard>

        {/* 2. Grid Menu */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          <Link 
            href={isSanityLocked ? "#" : "/dashboard/maps"} 
            className={`group relative overflow-hidden card-victorian p-12 lg:p-16 flex flex-col items-center justify-center gap-8 
                        hover:border-gold-400/50 hover:bg-victorian-900/90 transition-all duration-300 min-h-[350px]
                        ${isSanityLocked ? 'pointer-events-none opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            title={isSanityLocked ? "ถูกล็อค: สติของคุณเหลือ 0" : ""}
          >
            <CornerOrnament className="absolute top-0 left-0 w-24 h-24" />
            <CornerOrnament className="absolute top-0 right-0 -scale-x-100 w-24 h-24" />
            <CornerOrnament className="absolute bottom-0 left-0 -scale-y-100 w-24 h-24" />
            <CornerOrnament className="absolute bottom-0 right-0 scale-x-[-1] scale-y-[-1] w-24 h-24" />
            <div className="relative z-10 flex flex-col items-center gap-8">
              <div className="w-32 h-32 rounded-full bg-victorian-800/50 border-2 border-gold-400/20 
                              flex items-center justify-center group-hover:scale-110 group-hover:shadow-gold transition-all duration-300">
                {isSanityLocked ? (
                  <Lock className="w-16 h-16 text-red-500" />
                ) : (
                  <Map className="w-16 h-16 text-gold-400" />
                )}
              </div>
              <h3 className="heading-victorian text-5xl">แผนที่</h3>
              <p className="text-victorian-400 text-center text-2xl font-body">
                สำรวจโลกกว้างและสถานที่สำคัญ
              </p>
            </div>
          </Link>

          <a 
            href={isSanityLocked ? "#" : "/dashboard/skills"} 
            className={`group relative overflow-hidden card-victorian p-12 lg:p-16 flex flex-col items-center justify-center gap-8 
                        hover:border-gold-400/50 hover:bg-victorian-900/90 transition-all duration-300 min-h-[350px]
                        ${isSanityLocked ? 'pointer-events-none opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            title={isSanityLocked ? "ถูกล็อค: สติของคุณเหลือ 0" : ""}
          >
            <CornerOrnament className="absolute top-0 left-0 w-24 h-24" />
            <CornerOrnament className="absolute top-0 right-0 -scale-x-100 w-24 h-24" />
            <CornerOrnament className="absolute bottom-0 left-0 -scale-y-100 w-24 h-24" />
            <CornerOrnament className="absolute bottom-0 right-0 scale-x-[-1] scale-y-[-1] w-24 h-24" />
            <div className="relative z-10 flex flex-col items-center gap-8">
              <div className="w-32 h-32 rounded-full bg-victorian-800/50 border-2 border-gold-400/20 
                              flex items-center justify-center group-hover:scale-110 group-hover:shadow-gold transition-all duration-300">
                {isSanityLocked ? (
                  <Lock className="w-16 h-16 text-red-500" />
                ) : (
                  <Zap className="w-16 h-16 text-gold-400" />
                )}
              </div>
              <h3 className="heading-victorian text-5xl">สกิล</h3>
              <p className="text-victorian-400 text-center text-2xl font-body">
                จัดการทักษะและความสามารถพิเศษ
              </p>
            </div>
          </a>

          <a 
            href={isSanityLocked ? "#" : "#enemies"} 
            className={`group relative overflow-hidden card-victorian p-12 lg:p-16 flex flex-col items-center justify-center gap-8 
                        hover:border-gold-400/50 hover:bg-victorian-900/90 transition-all duration-300 min-h-[350px]
                        ${isSanityLocked ? 'pointer-events-none opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            title={isSanityLocked ? "ถูกล็อค: สติของคุณเหลือ 0" : ""}
          >
            <CornerOrnament className="absolute top-0 left-0 w-24 h-24" />
            <CornerOrnament className="absolute top-0 right-0 -scale-x-100 w-24 h-24" />
            <CornerOrnament className="absolute bottom-0 left-0 -scale-y-100 w-24 h-24" />
            <CornerOrnament className="absolute bottom-0 right-0 scale-x-[-1] scale-y-[-1] w-24 h-24" />
            <div className="relative z-10 flex flex-col items-center gap-8">
              <div className="w-32 h-32 rounded-full bg-victorian-800/50 border-2 border-gold-400/20 
                              flex items-center justify-center group-hover:scale-110 group-hover:shadow-gold transition-all duration-300">
                {isSanityLocked ? (
                  <Lock className="w-16 h-16 text-red-500" />
                ) : (
                  <Skull className="w-16 h-16 text-gold-400" />
                )}
              </div>
              <h3 className="heading-victorian text-5xl">ข้อมูลศัตรู</h3>
              <p className="text-victorian-400 text-center text-2xl font-body">
                บันทึกการเผชิญหน้าและจุดอ่อนศัตรู
              </p>
            </div>
          </a>

          <a 
            href={isSanityLocked ? "#" : "/dashboard/players"} 
            className={`group relative overflow-hidden card-victorian p-12 lg:p-16 flex flex-col items-center justify-center gap-8 
                        hover:border-gold-400/50 hover:bg-victorian-900/90 transition-all duration-300 min-h-[350px]
                        ${isSanityLocked ? 'pointer-events-none opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            title={isSanityLocked ? "ถูกล็อค: สติของคุณเหลือ 0" : ""}
          >
            <CornerOrnament className="absolute top-0 left-0 w-24 h-24" />
            <CornerOrnament className="absolute top-0 right-0 -scale-x-100 w-24 h-24" />
            <CornerOrnament className="absolute bottom-0 left-0 -scale-y-100 w-24 h-24" />
            <CornerOrnament className="absolute bottom-0 right-0 scale-x-[-1] scale-y-[-1] w-24 h-24" />
            <div className="relative z-10 flex flex-col items-center gap-8">
              <div className="w-32 h-32 rounded-full bg-victorian-800/50 border-2 border-gold-400/20 
                              flex items-center justify-center group-hover:scale-110 group-hover:shadow-gold transition-all duration-300">
                {isSanityLocked ? (
                  <Lock className="w-16 h-16 text-red-500" />
                ) : (
                  <Users className="w-16 h-16 text-gold-400" />
                )}
              </div>
              <h3 className="heading-victorian text-5xl">ทำเนียบผู้เล่น</h3>
              <p className="text-victorian-400 text-center text-2xl font-body">
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
                การตั้งค่า
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
      {/*  EDIT AVATAR POPUP — Only if NOT locked    */}
      {/* ═══════════════════════════════════════════ */}
      {showEditAvatar && !isSanityLocked && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowEditAvatar(false)}
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
          <div 
            className="w-full max-w-md rounded-sm border border-gold-400/20 p-8"
            style={{ backgroundColor: '#1A1612' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="heading-victorian text-2xl">แก้ไขรูปโปรไฟล์</h3>
              <button 
                type="button"
                onClick={() => setShowEditAvatar(false)}
                className="text-victorian-400 hover:text-gold-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form action={async (formData) => {
              const newUrl = formData.get('avatar_url') as string
              if (!newUrl) return

              // 1. Optimistic Update: Show new image immediately
              setOptimisticAvatar(newUrl)
              setShowEditAvatar(false)

              // 2. Server Update
              const result = await updateProfile(formData)
              
              // 3. Rollback if error
              if (result?.error) {
                setOptimisticAvatar(null)
                alert(`เกิดข้อผิดพลาด: ${result.error}`)
              }
            }}>
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

              <div className="mb-6">
                <label className="block text-sm text-victorian-300 mb-2">
                  Avatar URL <span className="text-nouveau-ruby">*</span>
                </label>
                <input 
                  name="avatar_url"
                  type="url" 
                  defaultValue={currentAvatarUrl || ''}
                  placeholder="https://example.com/image.jpg"
                  required
                  className="input-victorian w-full"
                  onChange={(e) => {
                    // Optional: Preview as you type
                    if (e.target.value && e.target.value.startsWith('http')) {
                      setOptimisticAvatar(e.target.value)
                    }
                  }}
                />
                <p className="mt-2 text-xs text-victorian-500 flex items-center gap-1.5">
                  <Camera className="w-3 h-3" />
                  รองรับเฉพาะ Direct URL ของรูปภาพเท่านั้น
                </p>
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

      {/* Admin Edit Modal */}
      {showAdminEdit && profile && (
        <AdminEditModal
          player={profile}
          onClose={() => setShowAdminEdit(false)}
          onSaved={() => router.refresh()}
        />
      )}

      {/* Sanity Lock Overlay - แสดงเมื่อสติเหลือ 0 */}
      {isSanityLocked && <SanityLockOverlay />}
    </div>
  )
}
