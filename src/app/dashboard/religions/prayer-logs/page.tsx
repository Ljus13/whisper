import { redirect } from 'next/navigation'
import PrayerLogsContent from '@/components/dashboard/prayer-logs-content'
import { getAuth } from '@/lib/auth'

export default async function PrayerLogsPage() {
  const { user, isStaff } = await getAuth()
  if (!user) redirect('/dashboard')
  if (!isStaff) redirect('/dashboard')

  return <PrayerLogsContent userId={user.id} />
}
