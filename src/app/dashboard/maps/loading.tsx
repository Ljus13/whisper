export default function MapsLoading() {
  return (
    <div className="min-h-screen bg-[#0F0D0A] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-2 border-[#D4AF37]/20 rounded-full" />
          <div className="absolute inset-0 border-2 border-transparent border-t-[#D4AF37] rounded-full animate-spin" />
          <div className="absolute inset-2 border border-[#D4AF37]/10 rounded-full" />
          <div className="absolute inset-2 border border-transparent border-b-[#D4AF37]/60 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
        </div>
        <p className="text-[#A89070] text-sm font-[Kanit] tracking-wider animate-pulse">
          กำลังโหลดแผนที่...
        </p>
      </div>
    </div>
  )
}
