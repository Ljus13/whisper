'use client'

import dynamic from 'next/dynamic'

const MapViewer = dynamic(() => import('@/components/dashboard/map-viewer'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen" style={{ backgroundColor: '#1A1612' }}>
      <div className="border-b border-[#D4AF37]/10" style={{ backgroundColor: 'rgba(15,13,10,0.9)' }}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center gap-4">
          <div className="w-9 h-9 rounded border border-[#D4AF37]/10 bg-[#2A2520] animate-pulse" />
          <div className="h-6 w-40 rounded bg-[#2A2520] animate-pulse" />
        </div>
      </div>
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 60px)' }}>
        <div className="w-full h-full bg-[#2A2520] animate-pulse relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-4 w-32 rounded bg-[#1A1612]/60 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  ),
})

export default function MapViewerLoader({ userId, mapId }: { userId: string; mapId: string }) {
  return <MapViewer userId={userId} mapId={mapId} />
}
