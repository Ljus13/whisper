export default function SkillsLoading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0F0D0A' }}>
      {/* Header Skeleton */}
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-9 h-9 rounded border border-[#D4AF37]/10 bg-[#2A2520] animate-pulse" />
          <div className="space-y-2">
            <div className="h-10 w-24 rounded bg-[#2A2520] animate-pulse" />
            <div className="h-3 w-48 rounded bg-[#2A2520] animate-pulse" />
          </div>
        </div>

        <div className="h-px bg-[#D4AF37]/10 mb-8" />

        {/* Spirit Points Bar */}
        <div className="border border-[#D4AF37]/10 rounded-sm p-5 mb-6" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
          <div className="flex items-center justify-between">
            <div className="h-5 w-32 rounded bg-[#2A2520] animate-pulse" />
            <div className="h-8 w-16 rounded bg-[#2A2520] animate-pulse" />
          </div>
        </div>

        {/* Pathway Card Skeleton */}
        <div className="space-y-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="border border-[#D4AF37]/10 rounded-sm overflow-hidden" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
              {/* Pathway banner */}
              <div className="h-48 bg-[#2A2520] animate-pulse relative">
                <div className="absolute bottom-4 left-6 space-y-2">
                  <div className="h-4 w-16 rounded-full bg-[#1A1612]/60 animate-pulse" />
                  <div className="h-8 w-48 rounded bg-[#1A1612]/60 animate-pulse" />
                </div>
              </div>
              {/* Skills list */}
              <div className="p-5 space-y-3">
                <div className="h-5 w-32 rounded bg-[#2A2520] animate-pulse" />
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="p-4 rounded border border-[#D4AF37]/5" style={{ backgroundColor: 'rgba(26,22,18,0.5)' }}>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="h-5 w-36 rounded bg-[#2A2520] animate-pulse" />
                        <div className="h-6 w-12 rounded-full bg-[#2A2520] animate-pulse" />
                      </div>
                      <div className="h-3 w-full rounded bg-[#2A2520] animate-pulse" />
                      <div className="h-9 w-full rounded bg-[#2A2520] animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
