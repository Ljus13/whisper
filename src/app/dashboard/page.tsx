import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardContent from '@/components/dashboard/dashboard-content'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user) {
    redirect('/')
  }

  const user = session.user

  // Fetch profile and pathway info in parallel (not sequential!)
  const [{ data: profile }, { data: playerPathways }] = await Promise.all([
    supabase
      .from('profiles')
      .select(`
        *,
        religions (
          id,
          name_th,
          logo_url
        )
      `)
      .eq('id', user.id)
      .single(),
    supabase
      .from('player_pathways')
      .select(`
        *,
        skill_pathways (name),
        skill_sequences (name, seq_number)
      `)
      .eq('player_id', user.id)
      .limit(1),
  ])

  let rankDisplay = 'ผู้มาเยือน'
  
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
