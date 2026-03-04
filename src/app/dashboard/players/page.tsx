import { redirect } from 'next/navigation'
import PlayersContent from '@/components/dashboard/players-content'
import { getAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function PlayersPage() {
  const { user } = await getAuth()
  if (!user) redirect('/')

  // ⚡ Server-side parallel data fetch — eliminates client loading spinner
  const supabase = await createClient()
  const [meRes, allRes, ppRes, pwRes, seqRes] = await Promise.all([
    supabase.from('profiles').select('*, religions(id, name_th, logo_url)').eq('id', user.id).single(),
    supabase.from('profiles').select('*, religions(id, name_th, logo_url)').order('display_name'),
    supabase.from('player_pathways').select('*'),
    supabase.from('skill_pathways').select('*'),
    supabase.from('skill_sequences').select('*'),
  ])

  return (
    <PlayersContent
      userId={user.id}
      initialData={{
        currentProfile: meRes.data!,
        players: allRes.data ?? [],
        playerPathways: ppRes.data ?? [],
        pathways: pwRes.data ?? [],
        sequences: seqRes.data ?? [],
      }}
    />
  )
}
