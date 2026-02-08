import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import MapViewer from '@/components/dashboard/map-viewer'

export default async function MapDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  // Fetch map
  const { data: map, error } = await supabase
    .from('maps')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !map) {
    notFound()
  }

  // Fetch current user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/')
  }

  // Fetch tokens on this map
  const { data: rawTokens } = await supabase
    .from('map_tokens')
    .select('*')
    .eq('map_id', id)

  // Get profile data for player tokens
  const playerIds = (rawTokens ?? [])
    .filter(t => t.token_type === 'player' && t.user_id)
    .map(t => t.user_id!)

  let profileMap: Record<string, { display_name: string | null; avatar_url: string | null; role: string }> = {}
  if (playerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, role')
      .in('id', playerIds)
    if (profiles) {
      profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))
    }
  }

  const tokens = (rawTokens ?? []).map(t => ({
    ...t,
    display_name: t.user_id ? (profileMap[t.user_id]?.display_name ?? null) : t.npc_name,
    avatar_url: t.user_id ? (profileMap[t.user_id]?.avatar_url ?? null) : t.npc_image_url,
    role: t.user_id ? (profileMap[t.user_id]?.role ?? null) : null,
  }))

  // Fetch locked zones
  const { data: zones } = await supabase
    .from('map_locked_zones')
    .select('*')
    .eq('map_id', id)

  // Fetch all profiles (for admin player management)
  const isAdmin = profile.role === 'admin' || profile.role === 'dm'
  let allPlayers: { id: string; display_name: string | null; avatar_url: string | null; role: string }[] = []
  if (isAdmin) {
    const { data: players } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, role')
      .order('display_name')
    allPlayers = players ?? []
  }

  return (
    <MapViewer
      map={map}
      tokens={tokens}
      zones={zones ?? []}
      currentUser={profile}
      currentUserId={user.id}
      isAdmin={isAdmin}
      allPlayers={allPlayers}
    />
  )
}
