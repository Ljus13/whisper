export default function Loading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1A1612' }}>
      <div className="border-b border-[#D4AF37]/10" style={{ backgroundColor: 'rgba(15,13,10,0.8)' }}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6 flex items-center gap-4">
          <div className="w-9 h-9 rounded border border-[#D4AF37]/10 bg-[#2A2520] animate-pulse" />
          <div className="space-y-2">
            <div className="h-8 w-40 rounded bg-[#2A2520] animate-pulse" />
            <div className="h-3 w-56 rounded bg-[#2A2520] animate-pulse" />
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="space-y-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="border border-[#D4AF37]/10 rounded-sm p-5" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#2A2520] animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-40 rounded bg-[#2A2520] animate-pulse" />
                  <div className="h-3 w-64 rounded bg-[#2A2520] animate-pulse" />
                  <div className="h-3 w-32 rounded bg-[#2A2520] animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
