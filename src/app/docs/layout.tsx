import Link from 'next/link'

const NAV_ITEMS = [
  {
    section: 'เริ่มต้น',
    links: [
      { href: '/docs', label: '📖 ภาพรวม Docs' },
    ],
  },
  {
    section: 'Discord Bot',
    links: [
      { href: '/docs/bot-handbook', label: '🤖 Bot Handbook' },
    ],
  },
  {
    section: 'คู่มือระบบ',
    links: [
      { href: '/docs/system-handbook', label: '📘 System Handbook' },
    ],
  },
  {
    section: 'เรื่องราว',
    links: [
      { href: '/world-setting', label: '🌑 World Setting' },
    ],
  },
]

export const metadata = {
  title: 'Docs — Whisper of the Shadow',
  description: 'เอกสารและคู่มือการใช้งานระบบ Whisper of the Shadow',
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b border-gold-subtle bg-victorian-950/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
            <span className="text-gold-400 text-xs tracking-widest uppercase font-display">← Whisper</span>
          </Link>
          <span className="text-victorian-600 text-xs">|</span>
          <span className="text-gold-400/80 text-xs tracking-widest uppercase font-display">Documentation</span>
        </div>
      </header>

      <div className="flex flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 gap-8">
        {/* Sidebar */}
        <aside className="hidden md:block w-56 flex-shrink-0">
          <nav className="sticky top-22 space-y-6">
            {NAV_ITEMS.map((group) => (
              <div key={group.section}>
                <p className="text-[10px] font-display tracking-[0.2em] uppercase text-victorian-400 mb-2 px-2">
                  {group.section}
                </p>
                <ul className="space-y-0.5">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="block px-3 py-1.5 rounded text-sm text-victorian-300 
                                   hover:text-gold-400 hover:bg-gold-400/5 
                                   transition-colors duration-150"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
