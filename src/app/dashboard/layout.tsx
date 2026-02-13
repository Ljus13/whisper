 'use client'
 
 import { useEffect, useState } from 'react'
 import { useRouter } from 'next/navigation'
 import Image from 'next/image'
 import Link from 'next/link'
 import { ArrowLeft, Home, LogOut, Settings, BookOpen, FileText } from 'lucide-react'
 import { createClient } from '@/lib/supabase/client'
 import PunishmentBanner from '@/components/dashboard/punishment-banner'
 import { signOut } from '@/app/actions/auth'
 import { useRef } from 'react'
 
 export default function DashboardLayout({
   children,
 }: {
   children: React.ReactNode
 }) {
  const router = useRouter()
   const [isAdmin, setIsAdmin] = useState<boolean>(false)
   const [hasUser, setHasUser] = useState<boolean>(false)
   const [displayName, setDisplayName] = useState<string>('ผู้มาเยือน')
   const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState<boolean>(false)
  const [showCompact, setShowCompact] = useState<boolean>(false)
  const headerRef = useRef<HTMLElement | null>(null)
 
   useEffect(() => {
     const supabase = createClient()
     const run = async () => {
       const { data: { user } } = await supabase.auth.getUser()
       setHasUser(!!user)
       if (!user) return
       const { data: profile } = await supabase
         .from('profiles')
         .select('display_name, avatar_url, role')
         .eq('id', user.id)
         .single()
       setIsAdmin(profile?.role === 'admin' || profile?.role === 'dm')
       setDisplayName(
         profile?.display_name ||
         user.user_metadata?.full_name ||
         user.email?.split('@')[0] ||
         'ผู้มาเยือน'
       )
       setAvatarUrl(profile?.avatar_url || user.user_metadata?.avatar_url || null)
     }
     run()
 
     router.prefetch('/dashboard')
     router.prefetch('/dashboard/maps')
     router.prefetch('/dashboard/players')
     router.prefetch('/dashboard/skills')
  }, [router])
 
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        setShowCompact(!entries[0].isIntersecting)
      },
      { threshold: 0 }
    )
    obs.observe(el)
    return () => { obs.disconnect() }
  }, [])
 
   return (
     <>
      <header ref={headerRef} className="border-b border-gold-400/10 bg-victorian-950/80 backdrop-blur-sm">
         <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 md:py-4 flex items-center justify-between">
           <div className="flex items-center gap-3">
             <span className="font-display text-gold-300 text-lg md:text-2xl">Whisper</span>
           </div>
           <div className="flex items-center gap-4">
             {hasUser && (
               <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border ${
                 isAdmin
                   ? 'text-nouveau-cream bg-nouveau-emerald/10 border-nouveau-emerald/30'
                   : 'text-nouveau-cream bg-metal-silver/10 border-metal-silver/30'
               }`}>
                 {isAdmin ? 'Dungeon Master' : 'Player'}
               </span>
             )}
            <div className="relative flex items-center gap-3">
               {avatarUrl ? (
                 <Image
                   src={avatarUrl}
                   alt="avatar"
                   width={28}
                   height={28}
                   className="rounded-full border border-gold-400/20 object-cover"
                 />
               ) : (
                 <div className="w-7 h-7 rounded-full bg-[#2A2520] border border-gold-400/20" />
               )}
               <span className="text-victorian-200 text-sm md:text-base">{displayName}</span>
              <button
                type="button"
                onClick={() => { signOut().catch(() => {}) }}
                className="px-3 py-1.5 rounded-md bg-victorian-900/70 border border-gold-400/20 text-gold-300 hover:bg-victorian-800/70 text-xs md:text-sm cursor-pointer inline-flex items-center gap-1.5"
                aria-label="ออกจากระบบ"
              >
                <LogOut className="w-3.5 h-3.5" /> ออกจากระบบ
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen(v => !v)}
                className="px-3 py-1.5 rounded-md bg-victorian-900/70 border border-gold-400/20 text-gold-300 hover:bg-victorian-800/70 text-xs md:text-sm cursor-pointer inline-flex items-center gap-1.5"
                aria-label="เมนูตั้งค่า"
              >
                <Settings className="w-3.5 h-3.5" /> ตั้งค่า
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-victorian-900 border border-gold-400/20 rounded-md shadow-xl z-50">
                  <Link href="/dashboard/bio-templates" className="flex items-center gap-2 px-3 py-2 text-victorian-200 hover:bg-victorian-800/70">
                    <BookOpen className="w-4 h-4" /> แม่แบบประวัติ
                  </Link>
                  <Link href="/dashboard" className="flex items-center gap-2 px-3 py-2 text-victorian-200 hover:bg-victorian-800/70">
                    <FileText className="w-4 h-4" /> แก้ไขประวัติ
                  </Link>
                  <Link href="/dashboard/players" className="flex items-center gap-2 px-3 py-2 text-victorian-200 hover:bg-victorian-800/70">
                    <Settings className="w-4 h-4" /> ตั้งค่าโปรไฟล์
                  </Link>
                </div>
              )}
             </div>
           </div>
         </div>
       </header>
 
      {hasUser && (
        <div className={`fixed top-3 right-3 z-40 transition-all duration-300 ${showCompact ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
          <div className="flex items-center gap-2">
             <button
               type="button"
               onClick={() => router.back()}
               className="w-9 h-9 rounded-full bg-victorian-900/70 border border-gold-400/20 text-gold-300 hover:bg-victorian-800/70 flex items-center justify-center cursor-pointer"
               aria-label="ย้อนกลับ"
             >
               <ArrowLeft className="w-4 h-4" />
             </button>
             <Link
               href="/dashboard"
               className="w-9 h-9 rounded-full bg-victorian-900/70 border border-gold-400/20 text-gold-300 hover:bg-victorian-800/70 flex items-center justify-center cursor-pointer"
               aria-label="กลับหน้า Dashboard"
             >
               <Home className="w-4 h-4" />
             </Link>
            <button
              type="button"
              onClick={() => { signOut().catch(() => {}) }}
              className="w-9 h-9 rounded-full bg-victorian-900/70 border border-gold-400/20 text-gold-300 hover:bg-victorian-800/70 flex items-center justify-center cursor-pointer"
              aria-label="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4" />
            </button>
           </div>
         </div>
       )}
       {!isAdmin && hasUser && (
         <div className="max-w-screen-2xl mx-auto px-4 md:px-8 pt-4">
           <PunishmentBanner />
         </div>
       )}
       {children}
     </>
   )
 }
