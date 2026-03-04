import { redirect } from 'next/navigation'
import CombatListContent from '@/components/combat/combat-list-content'
import { getAuth } from '@/lib/auth'
import { getCombatSessions } from '@/app/actions/combat'

export default async function CombatPage() {
  const { user, isStaff } = await getAuth()
  if (!user) redirect('/')

  // ⚡ Server-side data fetch — eliminates client loading spinner
  const { sessions } = await getCombatSessions()

  return (
    <CombatListContent
      userId={user.id}
      isStaff={isStaff}
      initialSessions={sessions ?? []}
    />
  )
}
