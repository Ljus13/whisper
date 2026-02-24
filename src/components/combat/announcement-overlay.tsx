'use client'

interface Props {
  message: string
  onAck: () => void
}

/**
 * Full-screen overlay when DM sends an announcement with ack_required.
 * Player MUST click "รับทราบ" to dismiss.
 */
export default function AnnouncementOverlay({ message, onAck }: Props) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      {/* Dark red backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-red-950/90 to-black" />

      {/* Content */}
      <div className="relative max-w-lg w-full space-y-6 text-center">
        {/* Icon */}
        <div className="text-6xl animate-bounce">📢</div>

        {/* Title */}
        <h2 className="text-red-400 text-2xl md:text-3xl font-bold animate-pulse">
          ประกาศจากผู้ดูแลเกม
        </h2>

        {/* Message */}
        <div className="p-6 rounded-xl bg-black/50 border-2 border-red-500/40 backdrop-blur-sm">
          <p className="text-nouveau-cream text-lg md:text-xl leading-relaxed whitespace-pre-wrap">
            {message}
          </p>
        </div>

        {/* Ack button */}
        <button
          type="button"
          onClick={onAck}
          className="px-8 py-4 rounded-xl bg-red-600/30 border-2 border-red-500/50 text-red-200 text-lg font-bold hover:bg-red-600/50 cursor-pointer transition-all active:scale-95 shadow-lg shadow-red-500/20"
        >
          รับทราบ
        </button>
      </div>
    </div>
  )
}
