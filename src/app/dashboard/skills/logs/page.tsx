import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SkillLogsContent from '@/components/dashboard/skill-logs-content'

export default async function SkillLogsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  return <SkillLogsContent />
}
