import { redirect } from 'next/navigation'
import CombatRoomContent from '@/components/combat/combat-room-content'
import { getAuth } from '@/lib/auth'

interface Props {
  params: Promise<{ sessionId: string }>
}

export default async function CombatSessionPage({ params }: Props) {
  const { sessionId } = await params
  const { user, isStaff } = await getAuth()
  if (!user) redirect('/')

  return (
    <CombatRoomContent
      sessionId={sessionId}
      userId={user.id}
      isStaff={isStaff}
    />
  )
}
