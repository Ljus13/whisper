'use client'

import dynamic from 'next/dynamic'

const MapViewer = dynamic(() => import('@/components/dashboard/map-viewer'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F0D0A' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-2 border-[#D4AF37]/20 rounded-full" />
          <div className="absolute inset-0 border-2 border-transparent border-t-[#D4AF37] rounded-full animate-spin" />
        </div>
        <p className="text-[#A89070] text-sm animate-pulse">กำลังโหลดแผนที่...</p>
      </div>
    </div>
  ),
})

export default function MapViewerLoader({ userId, mapId }: { userId: string; mapId: string }) {
  return <MapViewer userId={userId} mapId={mapId} />
}
