export default function DashboardLoading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0F0D0A' }}>
      {/* Skeleton Header */}
      <header className="sticky top-0 z-30 border-b border-[#D4AF37]/10" style={{ backgroundColor: 'rgba(15,13,10,0.95)' }}>
        <div className="max-w-screen-2xl mx-auto px-4 py-3 md:px-8 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#2A2520] animate-pulse" />
            <div className="hidden md:block h-5 w-24 rounded bg-[#2A2520] animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-48 rounded bg-[#2A2520] animate-pulse" />
            <div className="w-9 h-9 rounded-full bg-[#2A2520] animate-pulse" />
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 py-6 md:px-8 md:py-10 space-y-8">
        {/* Character Card Skeleton */}
        <div className="border border-[#D4AF37]/10 rounded-sm p-6 md:p-8" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
            <div className="w-32 h-32 md:w-48 md:h-48 rounded-full bg-[#2A2520] animate-pulse flex-shrink-0" />
            <div className="flex-1 w-full space-y-4">
              <div className="flex flex-col items-center md:items-start gap-2">
                <div className="h-8 w-48 rounded bg-[#2A2520] animate-pulse" />
                <div className="h-5 w-20 rounded-full bg-[#2A2520] animate-pulse" />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="p-3 rounded border border-[#D4AF37]/5" style={{ backgroundColor: 'rgba(26,22,18,0.5)' }}>
                    <div className="h-3 w-16 rounded bg-[#2A2520] animate-pulse mb-2" />
                    <div className="h-6 w-12 rounded bg-[#2A2520] animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Menu Grid Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border border-[#D4AF37]/10 rounded-sm p-6 md:p-8" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
              <div className="flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#2A2520] animate-pulse" />
                <div className="h-5 w-20 rounded bg-[#2A2520] animate-pulse" />
                <div className="h-3 w-28 rounded bg-[#2A2520] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
