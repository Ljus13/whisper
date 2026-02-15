import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MapViewerLoader from '@/components/dashboard/map-viewer-loader'

export default async function MapDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  return <MapViewerLoader userId={user.id} mapId={id} />
}
