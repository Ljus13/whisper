import { createClient } from '@/lib/supabase/server'
import { getTimelineEntries } from '@/app/actions/timeline'
import TimelineView, { type TimelineEntry } from '@/components/timeline/timeline-view'
import Link from 'next/link'
import { AuthButton } from '@/components/timeline/auth-button'

export const metadata = {
  title: 'Timeline — Whisper of the Shadow',
  description: 'เส้นเรื่องและไทม์ไลน์ของเหตุการณ์',
}

export default async function TimelinePage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  let isAdmin = false
  let userId: string | null = null
  if (session?.user) {
    userId = session.user.id
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
    isAdmin = profile?.role === 'admin' || profile?.role === 'dm'
  }

  // Admin sees all (including unpublished), others see published only
  const entries = await getTimelineEntries(isAdmin) as unknown as TimelineEntry[]

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Background atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-victorian-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(212,175,55,0.04)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_80%,rgba(139,116,37,0.03)_0%,transparent_60%)]" />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-victorian-950/80 border-b border-gold-400/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href={session ? '/dashboard' : '/'}
            className="text-gold-400 hover:text-gold-300 transition-colors text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {session ? 'กลับแดชบอร์ด' : 'กลับหน้าหลัก'}
          </Link>
          <h1 className="font-display title-whisper-gold text-lg tracking-wider">
            ✦ เส้นเรื่อง ✦
          </h1>
          <div className="w-20 flex justify-end">
            <AuthButton isLoggedIn={!!session} />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 pb-20">
        <TimelineView entries={entries} isAdmin={isAdmin} />
      </main>
    </div>
  )
}
