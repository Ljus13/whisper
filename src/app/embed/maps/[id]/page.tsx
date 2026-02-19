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

  // Fetch tokens
  const { data: rawTokens } = await supabase
    .from('map_tokens')
    .select('*')
    .eq('map_id', id)

  // Fetch profiles for player tokens separately (map_tokens.user_id FK points to auth.users, not profiles)
  const playerUserIds = (rawTokens ?? [])
    .filter((t) => t.token_type === 'player' && t.user_id)
    .map((t) => t.user_id as string)

  let profileMap: Record<string, { display_name: string | null; avatar_url: string | null; role: string }> = {}
  if (playerUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, role')
      .in('id', playerUserIds)
    if (profiles) {
      profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]))
    }
  }

  const tokens: MapTokenWithProfile[] = (rawTokens ?? []).map((t) => ({
    ...t,
    display_name: t.user_id ? (profileMap[t.user_id]?.display_name ?? null) : t.npc_name,
    avatar_url: t.user_id ? (profileMap[t.user_id]?.avatar_url ?? null) : t.npc_image_url,
    role: t.user_id ? (profileMap[t.user_id]?.role ?? 'player') : 'player',
  } as MapTokenWithProfile))

  // Fetch locked zones
  const { data: zones } = await supabase
    .from('map_locked_zones')
    .select('*')
    .eq('map_id', id)

  return <EmbedMapViewer map={map} tokens={tokens} zones={(zones as MapLockedZone[]) ?? []} />
}
