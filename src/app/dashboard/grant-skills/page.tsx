import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GrantSkillsContent from '@/components/dashboard/grant-skills-content'

export default async function GrantSkillsPage() {
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

  return <GrantSkillsContent userId={session.user.id} />
}
