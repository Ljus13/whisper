import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PathwaysGrantContent from '@/components/dashboard/pathways-grant-content'

export default async function PathwaysGrantPage() {
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

  if (!profile || (profile.role !== 'admin' && profile.role !== 'dm')) {
    redirect('/dashboard')
  }

  return <PathwaysGrantContent userId={session.user.id} />
}
