'use client'

import { getAllPrayerLogs } from '@/app/actions/religions'
import { ArrowLeft, ExternalLink, User, Church, Calendar, TrendingUp, Link as LinkIcon } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SanityLockOverlay from '@/components/sanity-lock-overlay'
import { createClient } from '@/lib/supabase/client'

interface PrayerLog {
  id: string
  player_id: string
  church_id: string
  evidence_urls: string[]
  sanity_gained: number
  created_at: string
  profiles: {
    id: string
    display_name: string | null
    avatar_url: string | null
  } | null
  map_churches: {
    id: string
    map_id: string
    religion_id: string
    maps: {
      id: string
      name: string
    } | null
    religions: {
      id: string
      name_th: string
      name_en: string
      logo_url: string | null
    } | null
  } | null
}

interface Profile {
  sanity: number
  max_sanity: number
}

export default function PrayerLogsContent({ userId }: { userId: string }) {
  const router = useRouter()
  const [logs, setLogs] = useState<PrayerLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Fetch profile
    supabase.from('profiles').select('sanity, max_sanity').eq('id', userId).single()
      .then(res => { if (res.data) setCurrentProfile(res.data) })

    // Fetch logs
    getAllPrayerLogs().then(res => {
      if (res.error) {
        setError(res.error)
      } else {
        setLogs(res.logs as PrayerLog[])
      }
      setLoading(false)
    })

    // Realtime subscription
    const channel = supabase
      .channel('prayer_logs_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prayer_logs' }, () => {
        getAllPrayerLogs().then(res => {
          if (!res.error) setLogs(res.logs as PrayerLog[])
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const isSanityLocked = (currentProfile?.sanity ?? 10) === 0

  if (loading) return null // Show loading.tsx skeleton

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1A1612' }}>
      {/* Header */}
      <header className="border-b border-gold-400/10 bg-victorian-950/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => router.push('/dashboard/players')}
                className="text-victorian-400 hover:text-gold-400 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <span className="text-gold-400 text-2xl">📿</span>
              <div>
                <h1 className="heading-victorian text-2xl">บันทึกการภาวนา</h1>
                <p className="text-victorian-400 text-sm font-display mt-1">
                  ตรวจสอบลิงก์หลักฐานจากผู้เล่นทุกคน
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-victorian-400 text-sm font-display">บันทึกทั้งหมด</p>
              <p className="text-gold-400 text-2xl font-display">{logs.length}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-10">
        {error && (
          <div className="mb-6 p-4 bg-nouveau-ruby/10 border border-nouveau-ruby/30 rounded-sm text-nouveau-ruby">
            {error}
          </div>
        )}

        {logs.length === 0 ? (
          <div className="text-center py-20 text-victorian-400">
            <Church className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="font-display text-xl">ยังไม่มีบันทึกการภาวนา</p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map(log => {
              const player = log.profiles
              const church = log.map_churches
              const religion = church?.religions
              const mapName = church?.maps?.name
              const date = new Date(log.created_at)

              return (
                <div
                  key={log.id}
                  className="card-victorian relative overflow-hidden hover:border-gold-400/40 transition-all"
                >
                  {/* Background pattern */}
                  <div className="absolute inset-0 opacity-5 pointer-events-none">
                    <div className="absolute inset-0" style={{
                      backgroundImage: 'radial-gradient(circle, #D4AF37 1px, transparent 1px)',
                      backgroundSize: '20px 20px'
                    }} />
                  </div>

                  <div className="relative z-10 p-5 md:p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Left: Player Info */}
                      <div className="lg:col-span-3 flex items-center gap-3">
                        {player?.avatar_url ? (
                          <img
                            src={player.avatar_url}
                            alt={player.display_name || ''}
                            className="w-12 h-12 rounded-full border-2 border-gold-400/30 object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full border-2 border-gold-400/30 bg-victorian-800 flex items-center justify-center flex-shrink-0">
                            <User className="w-6 h-6 text-gold-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-nouveau-cream font-display font-semibold truncate">
                            {player?.display_name || 'ไม่ระบุชื่อ'}
                          </p>
                          <p className="text-victorian-400 text-xs font-display flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {date.toLocaleDateString('th-TH', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>

                      {/* Center: Religion & Map Info */}
                      <div className="lg:col-span-3 flex items-center gap-3">
                        {religion?.logo_url ? (
                          <img
                            src={religion.logo_url}
                            alt={religion.name_th}
                            className="w-10 h-10 rounded-full border border-amber-400/30 object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full border border-amber-400/30 bg-victorian-800 flex items-center justify-center flex-shrink-0">
                            <Church className="w-5 h-5 text-amber-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-amber-400 text-sm font-display font-semibold truncate">
                            {religion?.name_th || 'ไม่ทราบศาสนา'}
                          </p>
                          <p className="text-victorian-400 text-xs truncate">
                            {mapName || 'ไม่ทราบแผนที่'}
                          </p>
                        </div>
                      </div>

                      {/* Center-Right: Sanity Gain */}
                      <div className="lg:col-span-2 flex items-center justify-center">
                        <div className="text-center px-4 py-2 bg-cyan-500/10 border border-cyan-400/20 rounded-sm">
                          <div className="flex items-center justify-center gap-1 text-cyan-400">
                            <TrendingUp className="w-4 h-4" />
                            <span className="text-2xl font-display font-bold">+{log.sanity_gained}</span>
                          </div>
                          <p className="text-victorian-400 text-[10px] uppercase tracking-wider font-display mt-0.5">
                            สติ
                          </p>
                        </div>
                      </div>

                      {/* Right: Evidence URLs */}
                      <div className="lg:col-span-4">
                        <div className="flex items-center gap-2 mb-2">
                          <LinkIcon className="w-4 h-4 text-victorian-400" />
                          <span className="text-victorian-400 text-xs uppercase tracking-wider font-display">
                            หลักฐาน ({(log.evidence_urls as string[]).length} ลิงก์)
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {(log.evidence_urls as string[]).map((url, idx) => (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-gold-400 hover:text-gold-300 text-sm group cursor-pointer transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate group-hover:underline">
                                {url.length > 50 ? `${url.substring(0, 50)}...` : url}
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Sanity Lock Overlay */}
      {isSanityLocked && <SanityLockOverlay />}
    </div>
  )
}
