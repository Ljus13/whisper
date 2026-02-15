import PunishmentBanner from '@/components/dashboard/punishment-banner'
import DashboardPrefetch from '@/components/dashboard/dashboard-prefetch'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <DashboardPrefetch />
      <PunishmentBanner />
      {children}
    </>
  )
}
