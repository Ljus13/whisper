import { redirect } from 'next/navigation'
import TravelLogsContent from '@/components/dashboard/travel-logs-content'
import { getAuth } from '@/lib/auth'

export default async function TravelLogsPage() {
  const { user } = await getAuth()
  if (!user) redirect('/')

  return <TravelLogsContent />
}
