import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CombatListContent from '@/components/combat/combat-list-content'

export default async function CombatPage() {
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

  return <CombatListContent userId={session.user.id} isStaff={isStaff} />
}
