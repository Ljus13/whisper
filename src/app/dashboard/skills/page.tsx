import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SkillsContent from '@/components/dashboard/skills-content'

export default async function SkillsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  return <SkillsContent userId={user.id} />
}
