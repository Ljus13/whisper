import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ActionQuestContent from '@/components/dashboard/action-quest-content'

const allowedTabs = ['quests', 'sleep', 'prayer', 'punishments', 'roleplay'] as const
type TabKey = typeof allowedTabs[number]

export default async function ActionQuestTabPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params
  // Redirect legacy /actions URL to /quests
  if (tab === 'actions') redirect('/dashboard/action-quest/quests')
  if (!allowedTabs.includes(tab as TabKey)) {
    redirect('/dashboard/action-quest/quests')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/callback')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'dm'

  return <ActionQuestContent userId={user.id} isAdmin={isAdmin} defaultTab={tab as TabKey} usePageTabs />
}
