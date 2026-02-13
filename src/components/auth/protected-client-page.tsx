 'use client'
 
 import { useEffect, useState } from 'react'
 import { useRouter } from 'next/navigation'
 import { createClient } from '@/lib/supabase/client'
 
 type Props = {
   children: (ctx: { userId: string; isAdmin?: boolean }) => React.ReactNode
   requireAdmin?: boolean
   skeleton?: React.ReactNode
 }
 
 export default function ProtectedClientPage({ children, requireAdmin, skeleton }: Props) {
   const router = useRouter()
   const [loading, setLoading] = useState(true)
   const [userId, setUserId] = useState<string | null>(null)
   const [isAdmin, setIsAdmin] = useState<boolean | undefined>(undefined)
 
   useEffect(() => {
     const supabase = createClient()
 
     const init = async () => {
       const { data: { user } } = await supabase.auth.getUser()
       if (!user) {
         router.replace('/')
         return
       }
 
       setUserId(user.id)
 
       if (requireAdmin) {
         const { data: profile } = await supabase
           .from('profiles')
           .select('role')
           .eq('id', user.id)
           .single()
         const admin = profile?.role === 'admin' || profile?.role === 'dm'
         if (!admin) {
           router.replace('/dashboard')
           return
         }
         setIsAdmin(true)
       }
 
       setLoading(false)
     }
 
     const {
       data: { subscription },
     } = supabase.auth.onAuthStateChange((_event, session) => {
       if (!session?.user) {
         router.replace('/')
       }
     })
 
     init()
 
     return () => {
       subscription?.unsubscribe()
     }
   }, [requireAdmin, router])
 
   if (loading) {
     return (
       skeleton || (
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="border border-[#D4AF37]/10 rounded-sm p-5" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#2A2520] animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-28 rounded bg-[#2A2520] animate-pulse" />
                    <div className="h-3 w-20 rounded bg-[#2A2520] animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
       )
     )
   }
 
   return <>{children({ userId: userId as string, isAdmin })}</>
 }
