export default function SkillLogsLoading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0F0D0A' }}>
      <div className="max-w-4xl mx-auto p-4 md:p-10 space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded border border-[#D4AF37]/10 bg-[#2A2520] animate-pulse" />
          <div className="space-y-2">
            <div className="h-8 w-48 rounded bg-[#2A2520] animate-pulse" />
            <div className="h-3 w-36 rounded bg-[#2A2520] animate-pulse" />
          </div>
        </div>

        <div className="h-px bg-[#D4AF37]/10" />

        {/* Log Entry Skeletons */}
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="border border-[#D4AF37]/10 rounded-sm p-4 md:p-5" style={{ backgroundColor: 'rgba(26,22,18,0.6)' }}>
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 rounded-full bg-[#2A2520] animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-28 rounded bg-[#2A2520] animate-pulse" />
                    <div className="h-4 w-10 rounded bg-[#2A2520] animate-pulse" />
                  </div>
                  <div className="h-3 w-40 rounded bg-[#2A2520] animate-pulse" />
                </div>
                <div className="h-6 w-24 rounded bg-[#2A2520] animate-pulse flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
