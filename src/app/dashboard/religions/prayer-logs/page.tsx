import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PrayerLogsContent from '@/components/dashboard/prayer-logs-content'

export default async function PrayerLogsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/dashboard')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/dashboard')
  }

  const isAdmin = profile.role === 'admin' || profile.role === 'dm'
  if (!isAdmin) {
    redirect('/dashboard')
  }

  return <PrayerLogsContent userId={user.id} />
}
