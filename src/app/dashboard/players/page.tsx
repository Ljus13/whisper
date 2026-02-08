import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlayersContent from '@/components/dashboard/players-content'

export default async function PlayersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  // Current user's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // All players
  const { data: players } = await supabase
    .from('profiles')
    .select('*')
    .order('display_name')

  // All player_pathways with pathway + sequence info
  const { data: playerPathways } = await supabase
    .from('player_pathways')
    .select('*')

  // All pathways (for display names)
  const { data: pathways } = await supabase
    .from('skill_pathways')
    .select('*')

  // All sequences (for display names)
  const { data: sequences } = await supabase
    .from('skill_sequences')
    .select('*')

  return (
    <PlayersContent
      currentUser={user}
      currentProfile={profile}
      players={players || []}
      playerPathways={playerPathways || []}
      pathways={pathways || []}
      sequences={sequences || []}
    />
  )
}
