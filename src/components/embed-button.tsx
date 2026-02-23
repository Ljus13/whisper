'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Code, Copy, Check, X } from 'lucide-react'

interface EmbedButtonProps {
  embedPath: string   // e.g. "/embed/world-setting"
  label?: string
}

export function EmbedButton({ embedPath, label = 'Embed' }: EmbedButtonProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
    setPortalRoot(document.body)
  }, [])

  const embedUrl = `${origin}${embedPath}`
  const iframeCode = `<iframe\n  src="${embedUrl}"\n  width="100%"\n  height="700"\n  frameborder="0"\n  allowfullscreen\n  style="border:none;"\n></iframe>`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(iframeCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = iframeCode
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // close on Escape
  useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border
                   border-victorian-700/40 bg-victorian-900/50 text-victorian-400
                   hover:border-gold-600/50 hover:text-gold-300 hover:bg-victorian-800/60
                   text-xs font-display tracking-wide transition-all duration-200 cursor-pointer"
        title="รับโค้ด iFrame สำหรับฝังเว็บอื่น"
      >
        <Code className="w-3.5 h-3.5" />
        {label}
      </button>

      {open && portalRoot && createPortal(
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* modal */}
          <div className="relative z-10 w-full max-w-lg rounded border border-gold-700/30
                          bg-victorian-950 shadow-[0_0_60px_rgba(0,0,0,0.8)] overflow-hidden">
            {/* header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-victorian-800/60">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-gold-400/70" />
                <span className="font-display text-sm text-nouveau-cream tracking-wide">
                  Embed iFrame
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-victorian-500 hover:text-victorian-300 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* body */}
            <div className="p-5 space-y-4">
              <p className="text-victorian-400 text-xs leading-relaxed">
                คัดลอกโค้ดด้านล่างไปวางในหน้าเว็บของคุณ — จะแสดงเฉพาะเนื้อหา ไม่มีแถบเมนู
              </p>

              {/* code block */}
              <div className="relative rounded-sm border border-victorian-700/40 bg-victorian-900/60 overflow-hidden">
                <pre className="p-4 text-xs text-victorian-300 font-mono leading-relaxed overflow-x-auto whitespace-pre">
                  {iframeCode}
                </pre>
                <button
                  onClick={handleCopy}
                  className={[
                    'absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm',
                    'border text-xs font-display tracking-wide transition-all duration-200 cursor-pointer',
                    copied
                      ? 'bg-emerald-900/60 border-emerald-600/50 text-emerald-300'
                      : 'bg-victorian-800/80 border-victorian-600/40 text-victorian-300 hover:border-gold-600/50 hover:text-gold-300',
                  ].join(' ')}
                >
                  {copied ? (
                    <><Check className="w-3 h-3" /> คัดลอกแล้ว</>
                  ) : (
                    <><Copy className="w-3 h-3" /> คัดลอก</>
                  )}
                </button>
              </div>

              {/* preview link */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-victorian-500 text-xs">URL ตัวอย่าง:</span>
                <a
                  href={embedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gold-400/70 hover:text-gold-400 transition-colors underline underline-offset-2 font-mono truncate"
                >
                  {embedUrl}
                </a>
              </div>

              {/* size hint */}
              <p className="text-victorian-600 text-[11px] leading-relaxed border-t border-victorian-800/50 pt-3">
                แนะนำ: ตั้งค่า <code className="text-victorian-400">height</code> ขั้นต่ำ 600–800px เพื่อให้แสดงผลครบถ้วน
              </p>
            </div>
          </div>
        </div>
      , portalRoot)}
    </>
  )
}
