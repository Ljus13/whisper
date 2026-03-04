import { redirect } from 'next/navigation'
import MapsContent from '@/components/dashboard/maps-content'
import { getAuth } from '@/lib/auth'

export default async function MapsPage() {
  const { user } = await getAuth()
  if (!user) redirect('/')

  return <MapsContent userId={user.id} />
}
