import { redirect } from 'next/navigation'
import MapViewerLoader from '@/components/dashboard/map-viewer-loader'
import { getAuth } from '@/lib/auth'

export default async function MapDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user } = await getAuth()
  if (!user) redirect('/')

  return <MapViewerLoader userId={user.id} mapId={id} />
}
