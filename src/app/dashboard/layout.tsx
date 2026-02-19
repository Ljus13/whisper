import { createClient } from '@/lib/supabase/server'
import PunishmentBanner from '@/components/dashboard/punishment-banner'
import OfflineBanner from '@/components/dashboard/offline-banner'

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

  // Check offline status for admin/DM banner
  let isOffline = false
  let offlineReason: string | null = null
  if (isAdmin) {
    const { data: settings } = await supabase
      .from('site_settings')
      .select('is_offline, offline_reason')
      .eq('id', 'main')
      .single()
    isOffline = settings?.is_offline === true
    offlineReason = settings?.offline_reason ?? null
  }

  return (
    <>
      {isAdmin && isOffline && (
        <OfflineBanner reason={offlineReason} />
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
