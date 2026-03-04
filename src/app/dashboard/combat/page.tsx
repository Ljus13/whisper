import { redirect } from 'next/navigation'
import CombatListContent from '@/components/combat/combat-list-content'
import { getAuth } from '@/lib/auth'

export default async function CombatPage() {
  const { user, isStaff } = await getAuth()
  if (!user) redirect('/')

  return <CombatListContent userId={user.id} isStaff={isStaff} />
}
