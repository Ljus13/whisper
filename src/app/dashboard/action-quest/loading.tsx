export default function ActionQuestLoading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0F0D0A' }}>
      <div className="max-w-5xl mx-auto p-4 md:p-10 space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded border border-[#D4AF37]/10 bg-[#2A2520] animate-pulse" />
          <div className="space-y-2">
            <div className="h-8 w-52 rounded bg-[#2A2520] animate-pulse" />
            <div className="h-3 w-40 rounded bg-[#2A2520] animate-pulse" />
          </div>
        </div>

        <div className="h-px bg-[#D4AF37]/10" />

        {/* Tabs Skeleton */}
        <div className="flex gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 w-24 rounded bg-[#2A2520] animate-pulse" />
          ))}
        </div>

        {/* Action Buttons Card Skeleton */}
        <div className="border border-[#D4AF37]/10 rounded-sm p-5 md:p-8" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
          <div className="h-6 w-32 rounded bg-[#2A2520] animate-pulse mb-5" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 rounded border-2 border-[#D4AF37]/10 bg-[#2A2520] animate-pulse" />
            ))}
          </div>
        </div>

        {/* Submissions Skeleton */}
        <div className="border border-[#D4AF37]/10 rounded-sm p-5 md:p-8" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
          <div className="h-6 w-40 rounded bg-[#2A2520] animate-pulse mb-5" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4 rounded border border-[#D4AF37]/5" style={{ backgroundColor: 'rgba(26,22,18,0.5)' }}>
                <div className="w-9 h-9 rounded-full bg-[#2A2520] animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 rounded bg-[#2A2520] animate-pulse" />
                  <div className="h-3 w-24 rounded bg-[#2A2520] animate-pulse" />
                </div>
                <div className="h-5 w-16 rounded-full bg-[#2A2520] animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
