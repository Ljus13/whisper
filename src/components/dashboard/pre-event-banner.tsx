import { CalendarClock } from 'lucide-react'

interface PreEventBannerProps {
  webNote: string
  isStaff: boolean
}

export default function PreEventBanner({ webNote, isStaff }: PreEventBannerProps) {
  return (
    <div className="max-w-screen-2xl mx-auto px-4 md:px-8 pt-4">
      <div className="rounded-xl border-2 border-indigo-500/40 bg-gradient-to-r from-indigo-950/80 via-indigo-900/50 to-indigo-950/80 p-4 md:p-5 shadow-lg shadow-indigo-500/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0">
            <CalendarClock className="w-5 h-5 text-indigo-300" />
          </div>
          <div className="flex-1">
            <h3 className="text-indigo-200 font-bold text-sm md:text-base">
              🎭 โหมดเปิดกิจกรรม — เปิดให้เข้ามาเตรียมตัวก่อนกิจกรรมเริ่ม
            </h3>
            <p className="text-indigo-200/70 text-xs mt-0.5">
              {isStaff
                ? 'ผู้เล่นจะเข้าได้เฉพาะหน้าหลัก, ทำเนียบผู้เล่น และเส้นเรื่อง'
                : 'ขณะนี้ผู้เล่นเข้าได้เฉพาะหน้าหลัก, ทำเนียบผู้เล่น และเส้นเรื่อง'}
            </p>
            {webNote && (
              <p className="text-indigo-100/80 text-xs mt-1.5 italic whitespace-pre-wrap">
                📝 &ldquo;{webNote}&rdquo;
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
