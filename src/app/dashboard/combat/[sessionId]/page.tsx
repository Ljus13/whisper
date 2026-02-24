import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CombatRoomContent from '@/components/combat/combat-room-content'

interface Props {
  params: Promise<{ sessionId: string }>
}

export default async function CombatSessionPage({ params }: Props) {
  const { sessionId } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user) {
    redirect('/')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  const isStaff = profile?.role === 'admin' || profile?.role === 'dm'

  return (
    <CombatRoomContent
      sessionId={sessionId}
      userId={session.user.id}
      isStaff={isStaff}
    />
  )
}
