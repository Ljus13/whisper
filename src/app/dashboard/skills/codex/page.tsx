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
    supabase.from('skill_types').select('id, name, description, overview').order('name'),
    supabase.from('skill_pathways').select('id, name, description, overview, type_id, logo_url, bg_url').order('name'),
    supabase.from('skill_sequences').select('id, name, seq_number, pathway_id, roleplay_keywords').order('seq_number', { ascending: true }),
    supabase.from('skills').select('id, name, description, spirit_cost, pathway_id, sequence_id').order('name'),
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
