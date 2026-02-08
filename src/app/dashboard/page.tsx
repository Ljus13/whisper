import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardContent from '@/components/dashboard/dashboard-content'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  // Fetch profile from profiles table
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
  }

  // Fetch pathway info
  const { data: playerPathways } = await supabase
    .from('player_pathways')
    .select(`
      *,
      skill_pathways (name),
      skill_sequences (name, seq_number)
    `)
    .eq('player_id', user.id)
    .limit(1)

  let rankDisplay = 'นักผจญภัย'
  
  if (playerPathways && playerPathways.length > 0) {
    const main = playerPathways[0]
    const pathwayName = (main.skill_pathways as { name?: string } | null)?.name
    const seqName = (main.skill_sequences as { name?: string; seq_number?: number } | null)?.name
    const seqNum = (main.skill_sequences as { name?: string; seq_number?: number } | null)?.seq_number

    if (pathwayName && seqNum) {
       rankDisplay = `${pathwayName} | ลำดับที่ ${seqNum}`
       if (seqName) {
         rankDisplay += ` — ${seqName}`
       }
    } else if (pathwayName) {
        rankDisplay = pathwayName
    }
  }

  return <DashboardContent user={user} profile={profile} rankDisplay={rankDisplay} />
}
