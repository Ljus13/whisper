import { redirect } from 'next/navigation'
import SkillsContent from '@/components/dashboard/skills-content'
import { getAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getGrantedSkillsForPlayer } from '@/app/actions/granted-skills'

export default async function SkillsPage() {
  const { user } = await getAuth()
  if (!user) redirect('/')

  // ⚡ Server-side parallel data fetch — eliminates client loading spinner
  const supabase = await createClient()
  const [pRes, tRes, pwRes, sqRes, skRes, ppRes, gsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('skill_types').select('*').order('name'),
    supabase.from('skill_pathways').select('*').order('name'),
    supabase.from('skill_sequences').select('*').order('seq_number', { ascending: false }),
    supabase.from('skills').select('*').order('name'),
    supabase.from('player_pathways').select('*').eq('player_id', user.id),
    getGrantedSkillsForPlayer(),
  ])

  return (
    <SkillsContent
      userId={user.id}
      initialData={{
        profile: pRes.data!,
        skillTypes: tRes.data ?? [],
        pathways: pwRes.data ?? [],
        sequences: sqRes.data ?? [],
        skills: skRes.data ?? [],
        playerPathways: ppRes.data ?? [],
        grantedSkills: gsRes?.skills ?? [],
      }}
    />
  )
}
