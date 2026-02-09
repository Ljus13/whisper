import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MapsContent from '@/components/dashboard/maps-content'

export default async function MapsPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user) {
    redirect('/')
  }

  return <MapsContent userId={session.user.id} />
}
