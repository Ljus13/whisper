export default function ActionQuestLoading() {
  return (
    <div className="min-h-screen bg-victorian-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-2 border-[#D4AF37]/20 rounded-full" />
          <div className="absolute inset-0 border-2 border-transparent border-t-[#D4AF37] rounded-full animate-spin" />
        </div>
        <p className="text-victorian-400 text-sm animate-pulse font-display">กำลังโหลด...</p>
      </div>
    </div>
  )
}
