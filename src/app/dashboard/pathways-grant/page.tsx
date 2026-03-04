import { redirect } from 'next/navigation'
import PathwaysGrantContent from '@/components/dashboard/pathways-grant-content'
import { getAuth } from '@/lib/auth'

export default async function PathwaysGrantPage() {
  const { user, isStaff } = await getAuth()
  if (!user) redirect('/')
  if (!isStaff) redirect('/dashboard')

  return <PathwaysGrantContent userId={user.id} />
}
