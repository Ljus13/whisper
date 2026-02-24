'use client'

import type { CombatStatusEffect } from '@/lib/types/database'
import { STATUS_EFFECT_LABELS } from '@/lib/types/database'

interface Props {
  effect: CombatStatusEffect
  allEffects: CombatStatusEffect[]
}

/**
 * Full-screen visual effect overlay based on status_effect_1 (primary).
 * Renders on the player's screen only.
 */
export default function StatusEffectOverlay({ effect, allEffects }: Props) {
  // Effects that completely darken the screen + overlay message
  const darkOverlays: Record<string, { message: string; textColor: string }> = {
    sleeping: { message: 'คุณกำลังอยู่ในสภาวะนอนหลับ', textColor: 'text-purple-400' },
    paralyzed: { message: 'ติดสถานะอัมพาต', textColor: 'text-yellow-400' },
    blinded: { message: 'ติดสถานะมองไม่เห็น', textColor: 'text-red-400' },
  }

  const darkInfo = darkOverlays[effect]
  if (darkInfo) {
    return (
      <div className="fixed inset-0 z-[9990] pointer-events-none">
        <div className="absolute inset-0 bg-black/95" />
        <div className="absolute inset-0 flex items-center justify-center">
          <p className={`text-2xl md:text-4xl font-bold ${darkInfo.textColor} animate-combat-glow text-center px-8`}>
            {darkInfo.message}
          </p>
        </div>
        {/* Status badge */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {allEffects.map(e => (
            <span key={e} className="px-3 py-1 rounded-full bg-black/80 border border-victorian-600/50 text-victorian-300 text-xs font-bold">
              {STATUS_EFFECT_LABELS[e]}
            </span>
          ))}
        </div>
      </div>
    )
  }

  // Border/gradient effects — CSS class mapping
  const effectStyles: Record<string, string> = {
    stunned: 'animate-combat-stunned',          // ขาว-เหลือง กระพริบ
    frozen: 'animate-combat-frozen',             // ฟ้า gradient
    cursed: 'animate-combat-cursed',             // ม่วง-แดง gradient
    death_aura: 'animate-combat-death-aura',     // teal gradient
    burning: 'animate-combat-burning',           // แดง-ส้ม gradient
    blinding_light: 'animate-combat-blinding',   // ขาวกระพริบ
    poisoned: 'animate-combat-poisoned',         // เขียว gradient
    berserk: 'animate-combat-berserk',           // แดง-ฟ้า กระพริบ
    bleeding: 'animate-combat-bleeding',         // แดง gradient
    charmed: 'animate-combat-charmed',           // ชมพู gradient
    drowning: 'animate-combat-drowning',         // ฟ้า-ขาว gradient
  }

  const animClass = effectStyles[effect] || ''

  return (
    <div className="fixed inset-0 z-[9990] pointer-events-none">
      {/* Border effect */}
      <div className={`absolute inset-0 ${animClass}`} />

      {/* Status badge */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2">
        {allEffects.map(e => (
          <span key={e} className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-victorian-600/50 text-victorian-200 text-xs font-bold shadow-lg">
            ⚠️ {STATUS_EFFECT_LABELS[e]}
          </span>
        ))}
      </div>
    </div>
  )
}
