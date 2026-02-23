'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'

/* -----------------------------------------------------------------------
   Font-size control  (shared localStorage key with system handbook)
----------------------------------------------------------------------- */
const FONT_SIZES = [12, 13, 14, 15, 16, 17, 18, 20, 22, 24] as const
type FontSize = typeof FONT_SIZES[number]
const DEFAULT_FONT_SIZE: FontSize = 14
const LS_KEY = 'handbook-font-size'

function HbFontStyle({ px }: { px: number }) {
  const f = (r: number) => `${(r * px).toFixed(2)}px`
  return (
    <style>{`
      .hb-doc .text-xs   { font-size: ${f(0.75)}  !important }
      .hb-doc .text-sm   { font-size: ${f(0.875)} !important }
      .hb-doc .text-base { font-size: ${f(1)}     !important }
      .hb-doc .text-lg   { font-size: ${f(1.125)} !important }
      .hb-doc .text-xl   { font-size: ${f(1.25)}  !important }
      .hb-doc .text-2xl  { font-size: ${f(1.5)}   !important }
      .hb-doc .text-3xl  { font-size: ${f(1.875)} !important }
      .hb-doc .text-4xl  { font-size: ${f(2.25)}  !important }
    `}</style>
  )
}

function FontSizeBar({ size, onChange }: { size: FontSize; onChange: (s: FontSize) => void }) {
  const idx = FONT_SIZES.indexOf(size)
  const canDec = idx > 0
  const canInc = idx < FONT_SIZES.length - 1
  return (
    <div className="sticky top-0 z-40 flex items-center justify-end gap-1.5 py-1.5 px-2
                    bg-victorian-950/80 backdrop-blur-sm border-b border-gold-subtle/30 -mx-1 mb-4">
      <span className="text-[10px] text-victorian-500 font-display tracking-widest uppercase mr-1">ขนาดตัวอักษร</span>
      <button
        type="button"
        disabled={!canDec}
        onClick={() => canDec && onChange(FONT_SIZES[idx - 1])}
        className="w-6 h-6 rounded-sm border border-gold-subtle/40 flex items-center justify-center
                   text-gold-400 hover:bg-gold-900/40 hover:border-gold-400/40 transition-colors
                   disabled:opacity-30 disabled:cursor-not-allowed text-sm leading-none"
        title="ลดขนาดตัวอักษร"
      >
        −
      </button>
      <span className="text-[10px] text-gold-400/70 font-display w-6 text-center tabular-nums">
        {size}
      </span>
      <button
        type="button"
        disabled={!canInc}
        onClick={() => canInc && onChange(FONT_SIZES[idx + 1])}
        className="w-6 h-6 rounded-sm border border-gold-subtle/40 flex items-center justify-center
                   text-gold-400 hover:bg-gold-900/40 hover:border-gold-400/40 transition-colors
                   disabled:opacity-30 disabled:cursor-not-allowed text-sm leading-none"
        title="เพิ่มขนาดตัวอักษร"
      >
        +
      </button>
    </div>
  )
}

/* -----------------------------------------------------------------------
   Data
----------------------------------------------------------------------- */

const PLAYER_COMMANDS = [
  {
    name: '/status',
    description: 'ดูสถานะตัวละครของคุณ (HP, Sanity, Travel, Spirit) พร้อม Progress bar',
    usage: '/status',
    note: 'แสดงเฉพาะตัวเองเท่านั้น (Ephemeral — คนอื่นไม่เห็น)',
    badge: 'Ephemeral',
  },
  {
    name: '/submit-quest',
    description: 'ส่ง Quest Code พร้อมหลักฐานเพื่อ Complete Quest',
    usage: '/submit-quest',
    inputs: [
      { label: 'รหัส Quest Code', placeholder: 'เช่น QC-DD-MM-YY-abcd', required: true },
      { label: 'ลิงก์หลักฐาน', placeholder: 'URL บรรทัดละ 1 ลิงก์', required: true },
    ],
    note: 'หลังส่ง Bot จะ post embed ไปยัง channel ของ Admin พร้อมปุ่ม Approve/Reject',
    badge: 'Modal',
  },
  {
    name: '/sleep',
    description: 'ส่งคำขอพักผ่อนประจำวัน — ต้องแนบลิงก์โรลเพลย์ทานอาหารและนอนหลับ',
    usage: '/sleep',
    inputs: [
      { label: 'ลิงก์ทานอาหาร', placeholder: 'URL ทานอาหาร', required: true },
      { label: 'ลิงก์นอน', placeholder: 'URL นอน', required: true },
    ],
    note: 'มี Cooldown — ส่งได้แค่ 1 ครั้งต่อวัน รอ Admin อนุมัติ',
    badge: 'Modal',
  },
  {
    name: '/prayer',
    description: 'ส่ง Prayer Log — ส่งโรลเพลย์การภาวนาที่โบสถ์',
    usage: '/prayer',
    inputs: [
      { label: 'โรลเพลย์ภาวนา', placeholder: 'เขียนบทสวดหรือคำอธิษฐาน...', required: true },
    ],
    badge: 'Modal',
  },
  {
    name: '/my-skills',
    description: 'ดู Skills ทั้งหมดที่ Unlock แล้ว พร้อมรายละเอียดแต่ละ Skill',
    usage: '/my-skills',
    note: 'แสดงเฉพาะตัวเองเท่านั้น (Ephemeral)',
    badge: 'Ephemeral',
  },
  {
    name: '/use-skill',
    description: 'ใช้งาน Skill ที่ Unlock แล้ว',
    usage: '/use-skill [skill]',
    note: 'เลือก Skill จาก autocomplete แล้วยืนยันการใช้งาน',
    badge: 'Select',
  },
  {
    name: '/notifications',
    description: 'ดู Notifications 5 รายการล่าสุดของคุณ',
    usage: '/notifications',
    note: 'แสดงเฉพาะตัวเองเท่านั้น (Ephemeral)',
    badge: 'Ephemeral',
  },
  {
    name: '/my-punishment',
    description: 'ดูบทลงโทษปัจจุบันของตัวเอง หากมี',
    usage: '/my-punishment',
    note: 'แสดงเฉพาะตัวเองเท่านั้น (Ephemeral)',
    badge: 'Ephemeral',
  },
]

const ADMIN_COMMANDS = [
  {
    name: '/pending',
    description: 'ดูรายการ Submissions ที่รอการอนุมัติทั้งหมด',
    usage: '/pending [type] [page]',
    options: [
      { name: 'type', desc: 'กรอง: actions / quests / sleep / all (default: all)' },
      { name: 'page', desc: 'หมายเลขหน้า (default: 1)' },
    ],
    roles: ['Admin', 'DM'],
    badge: 'Paginated',
  },
  {
    name: '/approve',
    description: 'อนุมัติ Submission โดยระบุ Submission ID พร้อม Note (ถ้าต้องการ)',
    usage: '/approve [submission_id] [note?]',
    options: [
      { name: 'submission_id', desc: 'ID หรือ Reference Code ของ Submission' },
      { name: 'note', desc: 'หมายเหตุสำหรับผู้เล่น (optional)' },
    ],
    roles: ['Admin', 'DM'],
    badge: 'Action',
    note: 'ผู้เล่นจะได้รับ DM แจ้งผลพร้อมรางวัลที่ได้รับ',
  },
  {
    name: '/reject',
    description: 'ปฏิเสธ Submission พร้อมระบุเหตุผล',
    usage: '/reject [submission_id] [reason]',
    options: [
      { name: 'submission_id', desc: 'ID หรือ Reference Code ของ Submission' },
      { name: 'reason', desc: 'เหตุผลที่ปฏิเสธ (required)' },
    ],
    roles: ['Admin', 'DM'],
    badge: 'Action',
    note: 'ผู้เล่นจะได้รับ DM แจ้งผลพร้อมเหตุผล',
  },
  {
    name: '/approve-sleep',
    description: 'อนุมัติคำขอ Sleep ของผู้เล่นที่ระบุ',
    usage: '/approve-sleep [@player]',
    options: [
      { name: '@player', desc: 'Mention Discord User ที่ต้องการอนุมัติ Sleep' },
    ],
    roles: ['Admin', 'DM'],
    badge: 'Action',
  },
]

/* -----------------------------------------------------------------------
   Sub-components
----------------------------------------------------------------------- */

const BADGE_STYLES: Record<string, string> = {
  Ephemeral: 'bg-victorian-800/50 text-victorian-300 border-victorian-600/30',
  Modal:     'bg-nouveau-sapphire/20 text-blue-300 border-blue-700/30',
  Select:    'bg-gold-900/30 text-gold-400 border-gold-700/30',
  Action:    'bg-nouveau-emerald/20 text-green-400 border-green-700/30',
  Paginated: 'bg-victorian-800/50 text-victorian-300 border-victorian-600/30',
}

const ROLE_STYLES: Record<string, string> = {
  Player: 'bg-nouveau-sapphire/20 text-blue-300 border-blue-700/30',
  Admin:  'bg-nouveau-ruby/20 text-red-300 border-red-700/30',
  DM:     'bg-gold-900/40 text-gold-400 border-gold-700/40',
}

function BadgePill({ label, className }: { label: string; className: string }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-sm border font-display tracking-wide flex-shrink-0 ${className}`}>
      {label}
    </span>
  )
}

function CommandCard({
  name, description, usage, inputs, options, note, badge, roles,
}: {
  name: string
  description: string
  usage?: string
  inputs?: { label: string; placeholder?: string; required?: boolean }[]
  options?: { name: string; desc: string }[]
  note?: string
  badge?: string
  roles?: string[]
}) {
  return (
    <div className="relative bg-victorian-900/50 border border-gold-subtle rounded-sm p-4 hover:border-gold-400/30 transition-colors">
      <div className="flex flex-wrap items-start gap-2 mb-2">
        <code className="text-gold-300 font-display text-sm font-medium tracking-wide">
          {name}
        </code>
        {badge && (
          <BadgePill label={badge} className={BADGE_STYLES[badge] ?? BADGE_STYLES.Ephemeral} />
        )}
        {roles?.map((r) => (
          <BadgePill key={r} label={r} className={ROLE_STYLES[r] ?? ROLE_STYLES.Player} />
        ))}
      </div>

      <p className="text-victorian-200 text-xs leading-relaxed mb-3">{description}</p>

      {usage && (
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-widest text-victorian-500 mb-1">การใช้งาน</p>
          <code className="text-xs bg-victorian-950/80 border border-victorian-800 px-2 py-1 rounded-sm text-gold-400/80 block">
            {usage}
          </code>
        </div>
      )}

      {inputs && inputs.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-widest text-victorian-500 mb-1.5">ข้อมูลที่ต้องกรอก (Modal)</p>
          <div className="space-y-1">
            {inputs.map((inp) => (
              <div key={inp.label} className="flex items-start gap-2 text-xs">
                <span className={`mt-0.5 flex-shrink-0 ${inp.required ? 'text-red-400' : 'text-victorian-500'}`}>
                  {inp.required ? '●' : '○'}
                </span>
                <div>
                  <span className="text-nouveau-cream">{inp.label}</span>
                  {inp.placeholder && (
                    <span className="text-victorian-400 ml-1.5">— {inp.placeholder}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-victorian-600 mt-1">● บังคับ &nbsp; ○ ไม่บังคับ</p>
        </div>
      )}

      {options && options.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-widest text-victorian-500 mb-1.5">ตัวเลือก</p>
          <div className="space-y-1">
            {options.map((opt) => (
              <div key={opt.name} className="flex gap-2 text-xs">
                <code className="text-gold-400/70 flex-shrink-0">{opt.name}</code>
                <span className="text-victorian-400">— {opt.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {note && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-victorian-800/60">
          <span className="text-gold-500/60 flex-shrink-0 text-xs mt-0.5">ℹ</span>
          <p className="text-victorian-400 text-xs leading-relaxed">{note}</p>
        </div>
      )}
    </div>
  )
}

/* -----------------------------------------------------------------------
   Main Client Component
----------------------------------------------------------------------- */

export default function BotHandbookClient() {
  const [fontSize, setFontSize] = useState<FontSize>(DEFAULT_FONT_SIZE)

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY)
    const parsed = stored ? Number(stored) : NaN
    if (FONT_SIZES.includes(parsed as FontSize)) {
      setFontSize(parsed as FontSize)
    }
  }, [])

  const handleFontSize = useCallback((s: FontSize) => {
    setFontSize(s)
    localStorage.setItem(LS_KEY, String(s))
  }, [])

  return (
    <>
      <HbFontStyle px={fontSize} />
      <div className="hb-doc space-y-12 pb-16">
        <FontSizeBar size={fontSize} onChange={handleFontSize} />

        {/* Header */}
        <div>
          <nav className="text-[10px] tracking-widest uppercase text-victorian-500 mb-4 flex items-center gap-2">
            <Link href="/docs" className="hover:text-gold-400 transition-colors">Docs</Link>
            <span>›</span>
            <span className="text-victorian-400">Discord Bot</span>
          </nav>
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-sm bg-victorian-800/80 border border-gold-subtle flex items-center justify-center text-2xl flex-shrink-0">
              🤖
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-display text-nouveau-cream mb-1 leading-tight">
                Discord Bot Handbook
              </h1>
              <p className="text-victorian-400 text-xs">
                Whisper of the Shadow — คู่มือ Commands ทั้งหมดสำหรับผู้เล่น, Admin และ DM
              </p>
            </div>
          </div>

          {/* Quick info boxes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Player Commands', count: PLAYER_COMMANDS.length, color: 'text-blue-300' },
              { label: 'Admin Commands',  count: ADMIN_COMMANDS.length,  color: 'text-red-300'  },
              { label: 'Commands ทั้งหมด', count: PLAYER_COMMANDS.length + ADMIN_COMMANDS.length, color: 'text-green-400' },
              { label: 'สถานะ',           count: 'สมบูรณ์', color: 'text-gold-400' },
            ].map((box) => (
              <div key={box.label} className="bg-victorian-900/50 border border-gold-subtle rounded-sm p-3 text-center">
                <p className={`text-xl font-display font-semibold ${box.color}`}>{box.count}</p>
                <p className="text-victorian-400 text-[10px] mt-0.5">{box.label}</p>
              </div>
            ))}
          </div>

          <div className="ornament-divider mt-8" />
        </div>

        {/* Getting Started */}
        <section className="space-y-4">
          <h2 className="text-sm font-display tracking-widest uppercase text-gold-400/80">
            ✦ ก่อนเริ่มใช้งาน
          </h2>
          <div className="bg-victorian-900/50 border border-gold-subtle rounded-sm p-5 space-y-3">
            <p className="text-victorian-200 text-sm leading-relaxed">
              Bot เชื่อมต่อกับบัญชีของคุณผ่าน <strong className="text-gold-300">Discord Account</strong> ที่คุณใช้ Login เว็บไซต์ — ไม่ต้อง Link บัญชีเพิ่ม ระบบจะจดจำตัวตนให้อัตโนมัติ
            </p>
            <div className="flex gap-2 pt-1">
              <span className="text-gold-400 text-xs mt-0.5">⚠</span>
              <p className="text-victorian-400 text-xs leading-relaxed">
                หากยังไม่เคย Login เว็บไซต์ด้วย Discord OAuth กรุณา Login เว็บครั้งแรกก่อน แล้วค่อยใช้ Bot
              </p>
            </div>
            <div className="flex gap-2">
              <span className="text-victorian-500 text-xs mt-0.5">🔒</span>
              <p className="text-victorian-400 text-xs leading-relaxed">
                Commands ที่ขึ้นต้นด้วย <code className="text-gold-400/70 bg-victorian-950/50 px-1 py-0.5 rounded-sm text-[10px]">Ephemeral</code> — คนอื่นในห้องไม่เห็นผลลัพธ์ เห็นเฉพาะตัวคุณเอง
              </p>
            </div>
          </div>
        </section>

        {/* Player Commands */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-display tracking-widest uppercase text-gold-400/80">
              ✦ Player Commands
            </h2>
            <BadgePill label="ผู้เล่นทุกคน" className={ROLE_STYLES.Player} />
          </div>
          <p className="text-victorian-400 text-xs">
            Commands เหล่านี้ใช้ได้สำหรับผู้เล่นทุกคนในเซิร์ฟเวอร์
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {PLAYER_COMMANDS.map((cmd) => (
              <CommandCard key={cmd.name} {...cmd} />
            ))}
          </div>
        </section>

        <div className="ornament-divider" />

        {/* Admin Commands */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-display tracking-widest uppercase text-gold-400/80">
              ✦ Admin / DM Commands
            </h2>
            <BadgePill label="Admin" className={ROLE_STYLES.Admin} />
            <BadgePill label="DM" className={ROLE_STYLES.DM} />
          </div>
          <p className="text-victorian-400 text-xs">
            Commands สำหรับ Admin และ DM เท่านั้น — หากผู้เล่นธรรมดาพยายามใช้ Bot จะแจ้งว่าไม่มีสิทธิ์
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {ADMIN_COMMANDS.map((cmd) => (
              <CommandCard key={cmd.name} {...cmd} />
            ))}
          </div>
        </section>

        <div className="ornament-divider" />

        {/* Approval Flow */}
        <section className="space-y-4">
          <h2 className="text-sm font-display tracking-widest uppercase text-gold-400/80">
            ✦ Approval Flow — ขั้นตอนอนุมัติ
          </h2>
          <div className="bg-victorian-900/50 border border-gold-subtle rounded-sm overflow-hidden">
            <div className="p-5">
              <p className="text-victorian-200 text-xs leading-relaxed mb-5">
                เมื่อผู้เล่น Submit Action หรือ Quest Bot จะส่ง Embed พร้อมปุ่มไปยัง channel ของ Admin โดยอัตโนมัติ
              </p>
              <div className="space-y-3">
                {[
                  { step: '1', actor: 'ผู้เล่น', text: 'รัน /submit-action หรือ /submit-quest → กรอก Modal', color: 'text-blue-300' },
                  { step: '2', actor: 'Bot', text: 'ส่ง Embed ไป #approvals-channel พร้อมปุ่ม Approve / Reject', color: 'text-gold-400' },
                  { step: '3', actor: 'Admin/DM', text: 'กด Approve → Modal ให้ใส่ Note (optional) → ยืนยัน', color: 'text-red-300' },
                  { step: '4', actor: 'Bot', text: 'DM ผู้เล่นแจ้งผล + รางวัลที่ได้รับ / เหตุผลที่ปฏิเสธ', color: 'text-green-400' },
                ].map((s) => (
                  <div key={s.step} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-sm bg-gold-900/50 border border-gold-700/30 flex items-center justify-center text-[10px] text-gold-400 font-display flex-shrink-0 mt-0.5">
                      {s.step}
                    </div>
                    <div className="text-xs">
                      <span className={`font-display mr-1.5 ${s.color}`}>[{s.actor}]</span>
                      <span className="text-victorian-300">{s.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

      </div>
    </>
  )
}
