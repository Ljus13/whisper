import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SkillsCodexContent from '@/components/dashboard/skills-codex-content'

export default async function SkillsCodexPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user) {
    redirect('/')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'dm'
  if (!isAdmin) {
    redirect('/dashboard/skills')
  }

  const [typesRes, pathwaysRes, sequencesRes, skillsRes] = await Promise.all([
    supabase.from('skill_types').select('id, name, description, overview, sort_order, created_at, updated_at').order('name'),
    supabase.from('skill_pathways').select('id, type_id, name, description, overview, bg_url, logo_url, sort_order, created_at, updated_at').order('name'),
    supabase.from('skill_sequences').select('id, pathway_id, seq_number, name, roleplay_keywords, created_at, updated_at').order('seq_number', { ascending: true }),
    supabase.from('skills').select('id, pathway_id, sequence_id, name, description, spirit_cost, icon_url, sort_order, created_at, updated_at').order('name'),
  ])

  const types = typesRes.data || []
  const pathways = pathwaysRes.data || []
  const sequences = sequencesRes.data || []
  const skills = skillsRes.data || []

  return (
    <SkillsCodexContent
      types={types}
      pathways={pathways}
      sequences={sequences}
      skills={skills}
    />
  )
}
