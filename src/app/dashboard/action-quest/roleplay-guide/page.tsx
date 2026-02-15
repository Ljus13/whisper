import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RoleplayGuideContent from '@/components/dashboard/roleplay-guide-content'

export default async function RoleplayGuidePage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user) {
    redirect('/auth/callback')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'dm'
  if (!isAdmin) {
    redirect('/dashboard/action-quest')
  }

  const [typesRes, pathwaysRes, sequencesRes] = await Promise.all([
    supabase.from('skill_types').select('id, name, description, overview, sort_order, created_at, updated_at').order('name'),
    supabase.from('skill_pathways').select('id, type_id, name, description, overview, bg_url, logo_url, sort_order, created_at, updated_at').order('name'),
    supabase.from('skill_sequences').select('id, pathway_id, seq_number, name, roleplay_keywords, created_at, updated_at').order('seq_number', { ascending: false }),
  ])

  return (
    <RoleplayGuideContent
      types={typesRes.data || []}
      pathways={pathwaysRes.data || []}
      sequences={sequencesRes.data || []}
    />
  )
}
