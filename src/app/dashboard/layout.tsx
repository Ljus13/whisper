import { createClient } from '@/lib/supabase/server'
import PunishmentBanner from '@/components/dashboard/punishment-banner'
import NotificationBell from '@/components/dashboard/notification-bell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
      {/* Notification Bell — fixed top-right, visible on all dashboard pages */}
      {user && (
        <div className="fixed top-4 right-4 z-50">
          <NotificationBell userId={user.id} isAdmin={isAdmin} />
        </div>
      )}

      {!isAdmin && user && (
        <div className="max-w-screen-2xl mx-auto px-4 md:px-8 pt-4">
          <PunishmentBanner />
        </div>
      )}
      {children}
    </>
  )
}
