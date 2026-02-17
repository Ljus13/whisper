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
  const [{ data: profile }, { data: playerPathways }, { data: pathwayGrants }] = await Promise.all([
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
        skill_pathways (name, logo_url, bg_url),
        skill_sequences (name, seq_number)
      `)
      .eq('player_id', user.id)
      .not('pathway_id', 'is', null)
      .order('id', { ascending: true })
      .limit(1),
    supabase
      .from('pathway_grants')
      .select('pathway_id')
      .eq('player_id', user.id),
  ])

  let rankDisplay = 'ผู้มาเยือน'
  let rankInfo: {
    pathwayName: string
    pathwayLogoUrl: string | null
    pathwayBgUrl: string | null
    seqNumber: number | null
    sequenceName: string | null
  } | null = null
  
  if (playerPathways && playerPathways.length > 0) {
    const main = playerPathways[0]
    const pathway = Array.isArray(main.skill_pathways) ? main.skill_pathways[0] : main.skill_pathways
    const sequence = Array.isArray(main.skill_sequences) ? main.skill_sequences[0] : main.skill_sequences
    const pathwayName = (pathway as { name?: string } | null)?.name
    const pathwayLogoUrl = (pathway as { logo_url?: string | null } | null)?.logo_url ?? null
    const pathwayBgUrl = (pathway as { bg_url?: string | null } | null)?.bg_url ?? null
    const seqName = (sequence as { name?: string; seq_number?: number } | null)?.name
    const seqNum = (sequence as { name?: string; seq_number?: number } | null)?.seq_number
    const hasSeqNum = seqNum !== null && seqNum !== undefined

    if (pathwayName) {
      rankInfo = {
        pathwayName,
        pathwayLogoUrl,
        pathwayBgUrl,
        seqNumber: hasSeqNum ? seqNum as number : null,
        sequenceName: seqName || null,
      }
      if (hasSeqNum) {
        rankDisplay = `${pathwayName} | ลำดับที่ ${seqNum}`
        if (seqName) {
          rankDisplay += ` — ${seqName}`
        }
      } else {
        rankDisplay = pathwayName
      }
    }
  }

  const grantIds = (pathwayGrants || []).map(g => g.pathway_id).filter(Boolean)
  const { data: grantPathways } = grantIds.length > 0
    ? await supabase
      .from('skill_pathways')
      .select('id, name, overview, description, bg_url, logo_url, video_url')
      .in('id', grantIds)
    : { data: [] }

  return (
    <DashboardContent
      user={user}
      profile={profile}
      rankDisplay={rankDisplay}
      rankInfo={rankInfo}
      grantPathways={grantPathways || []}
      hasPathway={!!(playerPathways && playerPathways.length > 0)}
    />
  )
}
