export default function SkillLogsLoading() {
  return (
    <div className="min-h-screen bg-[#0F0D0A] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-2 border-[#D4AF37]/20 rounded-full" />
          <div className="absolute inset-0 border-2 border-transparent border-t-[#D4AF37] rounded-full animate-spin" />
        </div>
        <p className="text-[#A89070] text-sm font-[Kanit] animate-pulse">กำลังโหลดประวัติ...</p>
      </div>
    </div>
  )
}
