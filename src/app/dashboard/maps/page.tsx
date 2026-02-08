import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MapsContent from '@/components/dashboard/maps-content'

export default async function MapsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  // Fetch user profile for role check and sanity
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, sanity')
    .eq('id', user.id)
    .single()

  // Fetch all maps
  const { data: maps } = await supabase
    .from('maps')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  // Find which map the current user's token is on
  const { data: myToken } = await supabase
    .from('map_tokens')
    .select('map_id')
    .eq('user_id', user.id)
    .eq('token_type', 'player')
    .single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'dm'

  return <MapsContent maps={maps ?? []} isAdmin={isAdmin} myMapId={myToken?.map_id ?? null} sanity={profile?.sanity ?? 10} />
}
