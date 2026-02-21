import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Documentation — Whisper of the Shadow',
  description: 'เอกสารและคู่มือการใช้งานระบบ Whisper of the Shadow',
}

const DOC_CARDS = [
  {
    href: '/docs/bot-handbook',
    icon: '🤖',
    title: 'Discord Bot Handbook',
    description: 'คู่มือการใช้งาน Discord Bot ทุก Command สำหรับผู้เล่นและ Admin/DM — พร้อมตัวอย่างการใช้งานจริง',
    tags: ['Player', 'Admin', 'DM'],
    status: 'ready' as const,
  },
  {
    href: '/docs/system-handbook',
    icon: '📘',
    title: 'System Handbook',
    description: 'คู่มือการใช้งานระบบฉบับสมบูรณ์ — ตั้งแต่ล็อคอิน, แผนที่, สกิล, แอคชั่น, อีเวนท์ และทำเนียบผู้เล่น',
    tags: ['Player'],
    status: 'ready' as const,
  },
  {
    href: '/world-setting',
    icon: '🌑',
    title: 'World Setting',
    description: 'เรื่องราวและฉากหลังของโลก — ทิศทางเนื้อหาและบรรยากาศของกิจกรรม Whisper of the Shadow',
    tags: ['Lore', 'Setting'],
    status: 'wip' as const,
  },
]

const STATUS_CONFIG = {
  ready:    { label: 'พร้อมใช้งาน', className: 'bg-nouveau-emerald/20 text-green-400 border-green-700/30' },
  wip:      { label: 'กำลังเขียน',  className: 'bg-gold-900/30 text-gold-400 border-gold-700/30' },
  planned:  { label: 'วางแผนแล้ว', className: 'bg-victorian-800/30 text-victorian-300 border-victorian-600/30' },
}

export default function DocsIndexPage() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-48 h-48 bg-gold-400/[0.03] rounded-full blur-3xl" />
        </div>
        <p className="text-[10px] tracking-[0.3em] uppercase text-gold-500/60 font-display mb-3">
          Whisper of the Shadow
        </p>
        <h1 className="text-3xl sm:text-4xl font-display text-nouveau-cream mb-4 leading-tight">
          Documentation
        </h1>
        <p className="text-victorian-300 text-sm leading-relaxed max-w-xl">
          ศูนย์รวมคู่มือและเอกสารทั้งหมดของระบบ — เลือกหมวดที่ต้องการด้านล่าง
        </p>
        <div className="ornament-divider mt-8" />
      </div>

      {/* Cards Grid */}
      <div>
        <h2 className="text-xs tracking-[0.2em] uppercase text-victorian-400 font-display mb-5">
          เอกสารทั้งหมด
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {DOC_CARDS.map((card) => {
            const statusCfg = STATUS_CONFIG[card.status]
            return (
              <Link
                key={card.href}
                href={card.href}
                className="group block relative bg-victorian-900/60 hover:bg-victorian-900/90
                           border border-gold-subtle hover:border-gold-400/40
                           rounded-sm p-5 transition-all duration-200
                           shadow-inner-gold hover:shadow-gold"
              >
                {/* Corner ornament */}
                <span className="absolute top-3 right-3 text-gold-400/20 group-hover:text-gold-400/40 text-lg transition-colors">✦</span>

                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5 flex-shrink-0">{card.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <h3 className="text-nouveau-cream font-display text-sm group-hover:text-gold-300 transition-colors">
                        {card.title}
                      </h3>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-sm border font-display tracking-wide ${statusCfg.className}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                    <p className="text-victorian-300 text-xs leading-relaxed mb-3">
                      {card.description}
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {card.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-2 py-0.5 bg-gold-900/30 border border-gold-700/20
                                     text-gold-400/70 rounded-sm font-display tracking-wider"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-1 text-gold-400/50 group-hover:text-gold-400 text-xs transition-colors">
                  <span>อ่านเอกสาร</span>
                  <span>→</span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
