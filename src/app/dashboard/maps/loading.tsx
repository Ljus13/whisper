export default function MapsLoading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1A1612' }}>
      {/* Header Skeleton */}
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-9 h-9 rounded border border-[#D4AF37]/10 bg-[#2A2520] animate-pulse" />
          <div className="space-y-2">
            <div className="h-10 w-32 rounded bg-[#2A2520] animate-pulse" />
            <div className="h-3 w-56 rounded bg-[#2A2520] animate-pulse" />
          </div>
        </div>

        {/* Map Cards Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="border border-[#D4AF37]/10 rounded-sm overflow-hidden" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
              <div className="aspect-square bg-[#2A2520] animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-5 w-32 rounded bg-[#2A2520] animate-pulse" />
                <div className="h-3 w-full rounded bg-[#2A2520] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
