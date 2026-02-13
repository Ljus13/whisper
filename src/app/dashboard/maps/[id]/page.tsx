 'use client'
 import { useEffect, useState } from 'react'
 import MapViewerLoader from '@/components/dashboard/map-viewer-loader'
 import ProtectedClientPage from '@/components/auth/protected-client-page'

 export default function MapDetailPage({ params }: { params: Promise<{ id: string }> }) {
   const [mapId, setMapId] = useState<string | null>(null)
 
   useEffect(() => {
     let mounted = true
     params.then(p => { if (mounted) setMapId(p.id) })
     return () => { mounted = false }
   }, [params])
 
   return (
     <ProtectedClientPage>
       {({ userId }) => (mapId ? <MapViewerLoader userId={userId} mapId={mapId} /> : null)}
     </ProtectedClientPage>
   )
 }
