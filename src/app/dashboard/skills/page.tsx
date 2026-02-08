import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SkillsContent from '@/components/dashboard/skills-content'

export default async function SkillsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch all skill types
  const { data: skillTypes } = await supabase
    .from('skill_types')
    .select('*')
    .order('name')

  // Fetch all pathways with their type info
  const { data: pathways } = await supabase
    .from('skill_pathways')
    .select('*')
    .order('name')

  // Fetch all sequences ordered by seq_number (9=weakest first, 0=strongest last)
  const { data: sequences } = await supabase
    .from('skill_sequences')
    .select('*')
    .order('seq_number', { ascending: false })

  // Fetch all skills with their sequence info
  const { data: skills } = await supabase
    .from('skills')
    .select('*')
    .order('name')

  // Fetch player's pathway progressions
  const { data: playerPathways } = await supabase
    .from('player_pathways')
    .select('*')
    .eq('player_id', user.id)

  return (
    <SkillsContent
      user={user}
      profile={profile}
      skillTypes={skillTypes ?? []}
      pathways={pathways ?? []}
      sequences={sequences ?? []}
      skills={skills ?? []}
      playerPathways={playerPathways ?? []}
    />
  )
}
