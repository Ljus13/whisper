import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ActionQuestContent from '@/components/dashboard/action-quest-content'

export default async function ActionQuestPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user) redirect('/auth/callback')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'dm'

  return <ActionQuestContent userId={session.user.id} isAdmin={isAdmin} />
}
