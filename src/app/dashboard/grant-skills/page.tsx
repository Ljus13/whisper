import { redirect } from 'next/navigation'
import GrantSkillsContent from '@/components/dashboard/grant-skills-content'
import { getAuth } from '@/lib/auth'

export default async function GrantSkillsPage() {
  const { user, isStaff } = await getAuth()
  if (!user) redirect('/')
  if (!isStaff) redirect('/dashboard')

  return <GrantSkillsContent userId={user.id} />
}
