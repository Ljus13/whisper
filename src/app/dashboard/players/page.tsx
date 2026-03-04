import { redirect } from 'next/navigation'
import PlayersContent from '@/components/dashboard/players-content'
import { getAuth } from '@/lib/auth'

export default async function PlayersPage() {
  const { user } = await getAuth()
  if (!user) redirect('/')

  return <PlayersContent userId={user.id} />
}
