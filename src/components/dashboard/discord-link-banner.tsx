'use client'

import { linkDiscordIdentity } from '@/app/actions/auth'
import { X, Link2Off, ExternalLink } from 'lucide-react'
import { useState, useEffect, useTransition } from 'react'

const DISMISS_KEY = 'discord-link-banner-dismissed'

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
    </svg>
  )
}

interface DiscordLinkBannerProps {
  discordLinked: boolean
}

export default function DiscordLinkBanner({ discordLinked }: DiscordLinkBannerProps) {
  // dismissed starts true to avoid hydration flash; will be corrected after mount
  const [dismissed, setDismissed] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const stored = localStorage.getItem(DISMISS_KEY)
    setDismissed(stored === 'true')
    setMounted(true)
  }, [])

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
  }

  function handleLink() {
    startTransition(async () => {
      await linkDiscordIdentity()
    })
  }

  return (
    <>
      {/* Dismissible warning banner (only when not linked & not dismissed) */}
      {mounted && !discordLinked && !dismissed && (
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-3 rounded-lg
                        bg-amber-900/20 border border-amber-500/25 shadow-lg shadow-amber-900/10">
          {/* Icon */}
          <div className="flex items-center gap-2 shrink-0">
            <DiscordIcon className="w-5 h-5 text-[#5865F2]" />
            <Link2Off className="w-4 h-4 text-amber-400" />
          </div>

          {/* Message */}
          <div className="flex-1 min-w-0">
            <p className="text-amber-200 text-sm font-medium leading-snug">
              ท่านยังไม่ได้เชื่อมต่อ Discord
            </p>
            <p className="text-amber-200/60 text-xs mt-0.5">
              จะไม่สามารถใช้งาน Bot ได้ จนกว่าจะเชื่อมต่อบัญชี Discord
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleLink}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold
                         bg-[#5865F2] hover:bg-[#4752C4] text-white
                         transition-colors duration-200 disabled:opacity-50 disabled:cursor-wait"
            >
              {isPending ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ExternalLink className="w-3.5 h-3.5" />
              )}
              เชื่อมต่อ Discord
            </button>

            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-md text-amber-400/60 hover:text-amber-300 hover:bg-amber-900/30
                         transition-colors duration-200"
              title="ไม่ต้องแสดงอีก"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
