import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MapViewer from '@/components/dashboard/map-viewer'

export default async function MapDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user) {
    redirect('/')
  }

  return <MapViewer userId={session.user.id} mapId={id} />
}
