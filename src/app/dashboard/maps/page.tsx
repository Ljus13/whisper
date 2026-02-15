import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MapsContent from '@/components/dashboard/maps-content'

export default async function MapsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  return <MapsContent userId={user.id} />
}
