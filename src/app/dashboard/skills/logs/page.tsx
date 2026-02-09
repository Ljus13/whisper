import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SkillLogsContent from '@/components/dashboard/skill-logs-content'

export default async function SkillLogsPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user) {
    redirect('/')
  }

  return <SkillLogsContent />
}
