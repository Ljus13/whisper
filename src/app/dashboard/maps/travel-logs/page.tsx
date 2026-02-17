import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TravelLogsContent from '@/components/dashboard/travel-logs-content'

export default async function TravelLogsPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user) {
    redirect('/')
  }

  return <TravelLogsContent />
}
