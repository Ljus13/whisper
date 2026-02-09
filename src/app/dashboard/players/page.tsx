import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlayersContent from '@/components/dashboard/players-content'

export default async function PlayersPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user) {
    redirect('/')
  }

  return <PlayersContent userId={session.user.id} />
}
