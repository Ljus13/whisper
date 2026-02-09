'use client'

import { useId } from 'react'

/* ─── Shared Art Nouveau Corner Ornament ─── */
export function CornerOrnament({ className, size = 60 }: { className?: string; size?: number }) {
  const id = useId()
  const gradientId = `corner-${id}`
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 60 60" fill="none">
      <path d="M2 58V20C2 10 10 2 20 2H58" stroke={`url(#${gradientId})`} strokeWidth="1.5" fill="none" />
      <path d="M8 58V26C8 16 16 8 26 8H58" stroke={`url(#${gradientId})`} strokeWidth="0.5" opacity="0.4" fill="none" />
      <circle cx="20" cy="20" r="2" fill="#D4AF37" opacity="0.6" />
      <defs>
        <linearGradient id={gradientId} x1="2" y1="58" x2="58" y2="2">
          <stop stopColor="#D4AF37" stopOpacity="0.8" />
          <stop offset="1" stopColor="#C5A55A" stopOpacity="0.2" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/* ─── Card with corner ornaments ─── */
export function OrnamentedCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`card-victorian relative overflow-hidden ${className}`}>
      <CornerOrnament className="absolute top-0 left-0" />
      <CornerOrnament className="absolute top-0 right-0 -scale-x-100" />
      <CornerOrnament className="absolute bottom-0 left-0 -scale-y-100" />
      <CornerOrnament className="absolute bottom-0 right-0 scale-x-[-1] scale-y-[-1]" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
