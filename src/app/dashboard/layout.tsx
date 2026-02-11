import { createClient } from '@/lib/supabase/server'
import PunishmentBanner from '@/components/dashboard/punishment-banner'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Check if user is admin/dm — banner only shows for players
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    isAdmin = profile?.role === 'admin' || profile?.role === 'dm'
  }

  return (
    <>
      {!isAdmin && user && (
        <div className="max-w-screen-2xl mx-auto px-4 md:px-8 pt-4">
          <PunishmentBanner />
        </div>
      )}
      {children}
    </>
  )
}
