import { redirect } from 'next/navigation'
import ActionQuestContent from '@/components/dashboard/action-quest-content'
import { getAuth } from '@/lib/auth'

const allowedTabs = ['quests', 'sleep', 'prayer', 'punishments', 'roleplay'] as const
type TabKey = typeof allowedTabs[number]

export default async function ActionQuestTabPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params
  // Redirect legacy /actions URL to /quests
  if (tab === 'actions') redirect('/dashboard/action-quest/quests')
  if (!allowedTabs.includes(tab as TabKey)) {
    redirect('/dashboard/action-quest/quests')
  }

  const { user, isStaff: isAdmin } = await getAuth()
  if (!user) redirect('/auth/callback')

  return <ActionQuestContent userId={user.id} isAdmin={isAdmin} defaultTab={tab as TabKey} usePageTabs />
}
