import { redirect } from 'next/navigation'
import MapsContent from '@/components/dashboard/maps-content'
import { getAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function MapsPage() {
  const { user, isStaff } = await getAuth()
  if (!user) redirect('/')

  // ⚡ Server-side data fetch — eliminates client loading spinner
  const supabase = await createClient()
  const [mapsRes, tokenRes, profileRes] = await Promise.all([
    supabase.from('maps').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
    supabase.from('map_tokens').select('map_id').eq('user_id', user.id).eq('token_type', 'player').single(),
    supabase.from('profiles').select('sanity').eq('id', user.id).single(),
  ])

  return (
    <MapsContent
      userId={user.id}
      initialData={{
        maps: mapsRes.data ?? [],
        isAdmin: isStaff,
        myMapId: tokenRes.data?.map_id ?? null,
        sanity: profileRes.data?.sanity ?? 10,
      }}
    />
  )
}
