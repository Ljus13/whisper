import { redirect } from 'next/navigation'
import SkillLogsContent from '@/components/dashboard/skill-logs-content'
import { getAuth } from '@/lib/auth'

export default async function SkillLogsPage() {
  const { user } = await getAuth()
  if (!user) redirect('/')

  return <SkillLogsContent />
}
