// src/app/dashboard/players/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import PlayerDetailView from '@/components/dashboard/player-detail-view'
import { notFound } from 'next/navigation'

type Props = {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  // Parallel fetch for efficiency
  const [profileRes, ppRes, pathwaysRes, sequencesRes] = await Promise.all([
     supabase.from('profiles').select('*, religions(id, name_th, logo_url)').eq('id', id).single(),
     supabase.from('player_pathways').select('*').eq('player_id', id),
     supabase.from('skill_pathways').select('id, name, logo_url'),
     supabase.from('skill_sequences').select('id, name, seq_number, pathway_id')
  ])

  if (profileRes.error || !profileRes.data) {
     return notFound()
  }

  return (
    <PlayerDetailView 
       profile={profileRes.data}
       playerPathways={ppRes.data || []}
       pathways={pathwaysRes.data || []}
       sequences={sequencesRes.data || []}
    />
  )
}
