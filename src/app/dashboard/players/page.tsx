import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlayersContent from '@/components/dashboard/players-content'

export default async function PlayersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  return <PlayersContent userId={user.id} />
}
