import { Wrench } from 'lucide-react'

interface MaintenanceBannerProps {
  webNote: string
}

export default function MaintenanceBanner({ webNote }: MaintenanceBannerProps) {
  return (
    <div className="max-w-screen-2xl mx-auto px-4 md:px-8 pt-4">
      <div className="rounded-xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-950/80 via-amber-900/50 to-amber-950/80 p-4 md:p-5 shadow-lg shadow-amber-500/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-amber-200 font-bold text-sm md:text-base">
              🔧 โหมดปิดปรับปรุง — เว็บกำลังอยู่ในโหมดปิดปรับปรุง อาจพบเจอบั๊กและข้อผิดพลาดได้
            </h3>
            <p className="text-amber-300/60 text-xs mt-0.5">
              ผู้เล่นจะไม่สามารถเข้าใช้งานได้ | DM และ Admin ยังเข้าใช้งานได้ตามปกติ
            </p>
            {webNote && (
              <p className="text-amber-200/50 text-xs mt-1.5 italic">
                📝 &ldquo;{webNote}&rdquo;
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
