 'use client'
 import { useEffect, useState } from 'react'
 import { createClient } from '@/lib/supabase/client'
import DashboardContent from '@/components/dashboard/dashboard-content'
 import ProtectedClientPage from '@/components/auth/protected-client-page'
 import type { User } from '@supabase/supabase-js'

 export default function DashboardPage() {
   const [user, setUser] = useState<User | null>(null)
   const [profile, setProfile] = useState<any | null>(null)
   const [rankDisplay, setRankDisplay] = useState<string>('ผู้มาเยือน')
 
   useEffect(() => {
     const supabase = createClient()
     const load = async () => {
       const { data: { user: u } } = await supabase.auth.getUser()
       if (!u) return
       setUser(u)
 
       const [{ data: prof }, { data: playerPathways }] = await Promise.all([
         supabase
           .from('profiles')
           .select('*, religions(id, name_th, logo_url)')
           .eq('id', u.id)
           .single(),
         supabase
           .from('player_pathways')
           .select('*, skill_pathways(name), skill_sequences(name, seq_number)')
           .eq('player_id', u.id)
           .limit(1),
       ])
 
       setProfile(prof || null)
 
       if (playerPathways && playerPathways.length > 0) {
         const main: any = playerPathways[0]
         const pathwayName = main?.skill_pathways?.name as string | undefined
         const seqName = main?.skill_sequences?.name as string | undefined
         const seqNum = main?.skill_sequences?.seq_number as number | undefined
 
         if (pathwayName && seqNum) {
           setRankDisplay(`${pathwayName} | ลำดับที่ ${seqNum}${seqName ? ` — ${seqName}` : ''}`)
         } else if (pathwayName) {
           setRankDisplay(pathwayName)
         }
       }
     }
     load()
   }, [])
 
   return (
     <ProtectedClientPage
       skeleton={
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
         </div>
       }
     >
       {() =>
         user ? (
           <DashboardContent user={user} profile={profile} rankDisplay={rankDisplay} />
         ) : null
       }
     </ProtectedClientPage>
   )
 }
