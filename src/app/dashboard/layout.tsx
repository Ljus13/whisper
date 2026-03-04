import PunishmentBanner from '@/components/dashboard/punishment-banner'
import NotificationBell from '@/components/dashboard/notification-bell'
import MaintenanceBanner from '@/components/dashboard/maintenance-banner'
import MaintenanceToggle from '@/components/dashboard/maintenance-toggle'
import MaintenanceWall from '@/components/dashboard/maintenance-wall'
import DiscordLinkBanner from '@/components/dashboard/discord-link-banner'
import CombatAlertBanner from '@/components/combat/combat-alert-banner'
import { getAuth, getMaintenanceStatusCached } from '@/lib/auth'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // ⚡ Parallel fetch: auth + maintenance run simultaneously (was sequential waterfall)
  const [auth, maintenance] = await Promise.all([
    getAuth(),
    getMaintenanceStatusCached(),
  ])

  const { user, isStaff: isAdmin, role, discordLinked } = auth
  const isDM = role === 'dm'

  // Player + maintenance active → show blocking wall (no dashboard access)
  if (!isAdmin && user && maintenance.enabled) {
    return <MaintenanceWall webNote={maintenance.web_note} />
  }

  return (
    <>
      {/* Notification Bell — fixed top-right, visible on all dashboard pages */}
      {user && (
        <div className="fixed top-4 right-4 z-50">
          <NotificationBell userId={user.id} isAdmin={isAdmin} />
        </div>
      )}

      {/* DM: Floating maintenance toggle button */}
      {isDM && (
        <MaintenanceToggle
          initialEnabled={maintenance.enabled}
          initialWebNote={maintenance.web_note}
        />
      )}

      {/* Admin/DM: Maintenance banner when active */}
      {isAdmin && maintenance.enabled && (
        <MaintenanceBanner webNote={maintenance.web_note} />
      )}

      {!isAdmin && user && (
        <div className="max-w-screen-2xl mx-auto px-4 md:px-8 pt-4 space-y-3">
          <CombatAlertBanner />
          <PunishmentBanner />
          <DiscordLinkBanner discordLinked={discordLinked} />
        </div>
      )}
      {children}
    </>
  )
}
