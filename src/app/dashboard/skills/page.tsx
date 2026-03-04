import { redirect } from 'next/navigation'
import SkillsContent from '@/components/dashboard/skills-content'
import { getAuth } from '@/lib/auth'

export default async function SkillsPage() {
  const { user } = await getAuth()
  if (!user) redirect('/')

  return <SkillsContent userId={user.id} />
}
