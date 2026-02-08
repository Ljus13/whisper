import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EmbedMapViewer from '@/components/embed/embed-map-viewer'
import type { MapTokenWithProfile, MapLockedZone } from '@/lib/types/database'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EmbedMapPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch map — anon policy requires embed_enabled = true
  const { data: map, error } = await supabase
    .from('maps')
    .select('*')
    .eq('id', id)
    .eq('embed_enabled', true)
    .single()

  if (error || !map) {
    notFound()
  }

  // Fetch tokens with profile data
  const { data: rawTokens } = await supabase
    .from('map_tokens')
    .select('*, profiles:user_id(display_name, avatar_url, role)')
    .eq('map_id', id)

  const tokens: MapTokenWithProfile[] = (rawTokens ?? []).map((t: Record<string, unknown>) => {
    const profile = t.profiles as Record<string, unknown> | null
    return {
      ...t,
      display_name: profile?.display_name as string | null ?? t.npc_name as string | null,
      avatar_url: profile?.avatar_url as string | null ?? t.npc_image_url as string | null,
      role: profile?.role as string ?? 'player',
    } as MapTokenWithProfile
  })

  // Fetch locked zones
  const { data: zones } = await supabase
    .from('map_locked_zones')
    .select('*')
    .eq('map_id', id)

  return <EmbedMapViewer map={map} tokens={tokens} zones={(zones as MapLockedZone[]) ?? []} />
}
