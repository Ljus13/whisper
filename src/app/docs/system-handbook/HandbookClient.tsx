'use client'

import Image from 'next/image'
import { useState, useEffect, useCallback } from 'react'

/* ─────────────────────────────────────────────────────────────
   Lightbox
───────────────────────────────────────────────────────────── */
type LightboxState = { src: string; alt: string } | null

function Lightbox({ state, onClose }: { state: LightboxState; onClose: () => void }) {
  useEffect(() => {
    if (!state) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [state, onClose])

  if (!state) return null
  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-8 right-0 text-victorian-400 hover:text-nouveau-cream text-xs font-display tracking-widest transition-colors"
        >
          ESC / ปิด ✕
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={state.src}
          alt={state.alt}
          className="max-w-[90vw] max-h-[85vh] object-contain rounded-sm border border-gold-subtle shadow-2xl"
        />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Component helpers
───────────────────────────────────────────────────────────── */

function SectionHeading({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="flex-shrink-0 w-8 h-8 rounded-sm bg-gold-900/40 border border-gold-700/30
                       flex items-center justify-center text-gold-400 text-xs font-display tracking-widest">
        {num}
      </span>
      <h2 className="text-lg sm:text-xl font-display text-nouveau-cream leading-tight">{title}</h2>
    </div>
  )
}

function SubHeading({ label }: { label: string }) {
  return (
    <h3 className="text-xs font-display tracking-[0.2em] uppercase text-gold-400/70 mb-2 mt-5">
      {label}
    </h3>
  )
}

function BodyText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-victorian-300 text-sm leading-relaxed mb-3">{children}</p>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 bg-gold-900/20 border border-gold-700/25 rounded-sm px-4 py-3 mb-3">
      <span className="text-gold-400/60 flex-shrink-0 mt-0.5 text-xs">✦</span>
      <p className="text-victorian-300 text-xs leading-relaxed">{children}</p>
    </div>
  )
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 bg-red-900/15 border border-red-700/25 rounded-sm px-4 py-3 mb-3">
      <span className="text-red-400/70 flex-shrink-0 mt-0.5 text-xs">⚠</span>
      <p className="text-red-300/80 text-xs leading-relaxed">{children}</p>
    </div>
  )
}

/** Thumbnail that opens a Lightbox on click */
function Screenshot({
  src, alt, caption, onOpen,
}: {
  src: string; alt: string; caption?: string
  onOpen: (s: LightboxState) => void
}) {
  return (
    <figure className="my-4 overflow-hidden rounded-sm border border-gold-subtle bg-victorian-950/60">
      <button
        type="button"
        onClick={() => onOpen({ src, alt })}
        className="group relative block w-full overflow-hidden cursor-zoom-in"
        title="คลิกเพื่อดูรูปเต็ม"
      >
        <Image
          src={src}
          alt={alt}
          width={960}
          height={540}
          sizes="(max-width: 768px) 100vw, 760px"
          style={{ width: '100%', height: 'auto', maxHeight: '280px', objectFit: 'cover', display: 'block' }}
          className="transition-transform duration-300 group-hover:scale-[1.01]"
        />
        <span className="absolute bottom-2 right-2 bg-black/60 text-[10px] font-display tracking-wider text-victorian-300
                         px-2 py-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">
          คลิกดูรูปเต็ม ↗
        </span>
      </button>
      {caption && (
        <figcaption className="px-3 py-2 text-[11px] text-victorian-400 font-display tracking-wide border-t border-gold-subtle">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

function ScreenshotGrid({
  items, onOpen,
}: {
  items: { src: string; alt: string; caption?: string }[]
  onOpen: (s: LightboxState) => void
}) {
  return (
    <div className="grid gap-3 my-4" style={{ gridTemplateColumns: items.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      {items.map((item) => (
        <figure key={item.src} className="overflow-hidden rounded-sm border border-gold-subtle bg-victorian-950/60">
          <button
            type="button"
            onClick={() => onOpen({ src: item.src, alt: item.alt })}
            className="group relative block w-full overflow-hidden cursor-zoom-in"
            title="คลิกเพื่อดูรูปเต็ม"
          >
            <Image
              src={item.src}
              alt={item.alt}
              width={960}
              height={640}
              sizes="(max-width: 640px) 100vw, 50vw"
              style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }}
              className="transition-transform duration-300 group-hover:scale-[1.01]"
            />
            <span className="absolute bottom-2 right-2 bg-black/60 text-[10px] font-display tracking-wider text-victorian-300
                             px-2 py-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">
              คลิกดูรูปเต็ม ↗
            </span>
          </button>
          {item.caption && (
            <figcaption className="px-3 py-2 text-[11px] text-victorian-400 font-display tracking-wide border-t border-gold-subtle">
              {item.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  )
}

function Divider() {
  return <div className="ornament-divider my-8" />
}

function BulletList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-1.5 mb-4 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm text-victorian-300 leading-relaxed">
          <span className="text-gold-400/40 flex-shrink-0 mt-1 text-[10px]">◆</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function QuestTypeBadge({ type, label, desc }: { type: string; label: string; desc: string }) {
  const colors: Record<string, string> = {
    personal: 'bg-blue-900/25 border-blue-700/30 text-blue-300',
    group:    'bg-amber-900/25 border-amber-700/30 text-amber-300',
    target:   'bg-emerald-900/25 border-emerald-700/30 text-emerald-300',
  }
  return (
    <div className={`rounded-sm border px-4 py-3 mb-3 ${colors[type] || 'bg-victorian-900/40 border-gold-subtle text-victorian-300'}`}>
      <p className="font-display text-xs tracking-wide mb-1">{type === 'personal' ? '🗡️' : type === 'group' ? '👥' : '🎯'} {label}</p>
      <p className="text-xs leading-relaxed opacity-80">{desc}</p>
    </div>
  )
}

function TechBadge({ icon, name, desc }: { icon: string; name: string; desc: string }) {
  return (
    <div className="bg-victorian-900/40 border border-gold-subtle rounded-sm p-3 flex gap-2.5">
      <span className="flex-shrink-0 text-base mt-0.5">{icon}</span>
      <div>
        <p className="text-nouveau-cream text-xs font-display mb-1">{name}</p>
        <p className="text-victorian-300 text-xs leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Table of Contents data
───────────────────────────────────────────────────────────── */
const TOC = [
  { id: 'login',      num: '01', title: 'การเข้าสู่ระบบ' },
  { id: 'home',       num: '02', title: 'หน้าหลักและเมนู Header' },
  { id: 'stats',      num: '03', title: 'ข้อมูลพื้นฐานตัวละคร' },
  { id: 'nav',        num: '04', title: 'เมนูระบบต่าง ๆ' },
  { id: 'map',        num: '05', title: 'ระบบแผนที่' },
  { id: 'skills',     num: '06', title: 'ระบบสกิล' },
  { id: 'actions',    num: '07', title: 'ระบบแอคชั่น' },
  { id: 'events',     num: '08', title: 'ระบบอีเวนท์' },
  { id: 'directory',  num: '09', title: 'ทำเนียบผู้เล่นและศาสนา' },
  { id: 'stack',      num: '10', title: 'Tech Stack และสถาปัตยกรรม' },
]

/* ─────────────────────────────────────────────────────────────
   Main Client Component
───────────────────────────────────────────────────────────── */
export default function HandbookClient() {
  const [lightbox, setLightbox] = useState<LightboxState>(null)
  const openLightbox = useCallback((s: LightboxState) => setLightbox(s), [])
  const closeLightbox = useCallback(() => setLightbox(null), [])

  return (
    <div className="space-y-2">
      <Lightbox state={lightbox} onClose={closeLightbox} />

      {/* ── Hero ───────────────────────────────────────────────── */}
      <div className="relative mb-2">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-48 h-48 bg-gold-400/[0.03] rounded-full blur-3xl" />
        </div>
        <p className="text-[10px] tracking-[0.3em] uppercase text-gold-500/60 font-display mb-3">
          คู่มือการใช้งาน
        </p>
        <h1 className="text-3xl sm:text-4xl font-display text-nouveau-cream mb-4 leading-tight">
          System Handbook
        </h1>
        <p className="text-victorian-300 text-sm leading-relaxed max-w-xl">
          คู่มือการใช้งานระบบ Whisper of the Shadow ฉบับสมบูรณ์ — ครอบคลุมทุกฟังก์ชั่นตั้งแต่การล็อคอิน
          จนถึงการส่งอีเวนท์ สำหรับผู้เล่นทุกคน
        </p>
        <div className="ornament-divider mt-8" />
      </div>

      {/* ── Table of Contents ──────────────────────────────────── */}
      <div className="bg-victorian-900/40 border border-gold-subtle rounded-sm p-5 mb-2">
        <p className="text-[10px] font-display tracking-[0.25em] uppercase text-gold-400/60 mb-3">สารบัญ</p>
        <div className="grid gap-1 sm:grid-cols-2">
          {TOC.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="flex items-center gap-2.5 text-xs text-victorian-300 hover:text-gold-400 transition-colors py-1 group"
            >
              <span className="text-[10px] text-gold-400/30 group-hover:text-gold-400/60 font-display transition-colors w-5 flex-shrink-0">
                {item.num}
              </span>
              <span>{item.title}</span>
            </a>
          ))}
        </div>
      </div>

      <Divider />

      {/* ══════════════════════════════════════════════════════════
          01 — การเข้าสู่ระบบ
      ══════════════════════════════════════════════════════════ */}
      <section id="login" className="scroll-mt-20">
        <SectionHeading num="01" title="การเข้าสู่ระบบ" />

        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771658494/776e8b59-0ea6-4444-8bc6-591c06167cd5.png"
          alt="หน้า Login"
          caption="หน้าเข้าสู่ระบบ Whisper of the Shadow"
          onOpen={openLightbox}
        />

        <BodyText>
          ผู้เล่นสามารถเข้าสู่ระบบได้ 2 ช่องทาง ได้แก่ <strong className="text-nouveau-cream">Discord</strong> และ{' '}
          <strong className="text-nouveau-cream">Google Account</strong> โดยทั้งสองช่องทางมีความแตกต่างกันดังนี้
        </BodyText>

        <div className="grid gap-3 sm:grid-cols-2 mb-4">
          <div className="bg-victorian-900/50 border border-gold-subtle rounded-sm p-4">
            <p className="text-gold-400 text-xs font-display tracking-wide mb-2">🔵 ล็อคอินด้วย Discord</p>
            <p className="text-victorian-300 text-xs leading-relaxed">
              เข้าถึงฟังก์ชั่นครบทุกส่วน รวมถึง{' '}
              <span className="text-nouveau-cream">Discord Bot</span> ที่ใช้รับคำสั่งโดยตรงในเซิร์ฟเวอร์
              ระบบจะดึง Discord ID และ Avatar จาก OAuth เพื่อผูกบัญชีโดยอัตโนมัติ
            </p>
          </div>
          <div className="bg-victorian-900/50 border border-gold-subtle rounded-sm p-4">
            <p className="text-gold-400 text-xs font-display tracking-wide mb-2">🔴 ล็อคอินด้วย Google</p>
            <p className="text-victorian-300 text-xs leading-relaxed">
              ใช้ระบบบนเว็บได้ครบ สามารถเชื่อมต่อ Discord ภายหลังได้ (ไม่บังคับ)
              หากไม่เชื่อมก็สามารถใช้งานผ่านเว็บไซต์ได้ปกติ แต่จะไม่รับการแจ้งเตือนผ่าน Bot
            </p>
          </div>
        </div>

        <SubHeading label="ระบบความปลอดภัยการล็อคอิน" />
        <BodyText>
          เมื่อล็อคอินสำเร็จ ระบบจะสร้างเซสชันผู้ใช้และเชื่อมกับข้อมูล Discord หรือ Google ของคุณโดยอัตโนมัติ —
          หน้า Dashboard จะเข้าไม่ได้หากยังไม่ได้ล็อคอิน ระบบจะส่งกลับมาที่หน้า Login ทันที
        </BodyText>

        <Note>
          หลังจากล็อคอินครั้งแรก ระบบจะบังคับให้ตั้งชื่อ <strong>Display Name</strong> —
          กรุณาตั้งให้ตรงกับชื่อที่ลงทะเบียนไว้ในกิจกรรม เพื่อให้ทีมงานตรวจสอบได้
          ชื่อนี้จะเห็นได้ทั่วทั้งระบบและไม่สามารถเปลี่ยนได้บ่อยครั้ง
        </Note>

        <div className="bg-gold-900/15 border border-gold-700/20 rounded-sm p-4 mb-4">
          <p className="text-[10px] font-display tracking-[0.2em] uppercase text-gold-400/60 mb-2">
            นโยบายข้อมูลส่วนบุคคล (PDPA)
          </p>
          <BulletList items={[
            'ระบบเก็บเฉพาะข้อมูลที่จำเป็นต่อการดำเนินกิจกรรม ได้แก่ ชื่อผู้ใช้ อีเมล และ Discord ID',
            'ข้อมูลทั้งหมดจัดเก็บในฐานข้อมูลที่เข้ารหัสและมีระบบรักษาความปลอดภัยหลายชั้น',
            'ผู้เล่นเข้าถึงได้เฉพาะข้อมูลของตัวเอง — ข้อมูลผู้เล่นคนอื่นจะเห็นได้เฉพาะส่วนที่เปิดเป็นสาธารณะ',
            'ข้อมูลจะไม่ถูกเผยแพร่ให้บุคคลที่สามโดยไม่ได้รับความยินยอม',
            'ผู้เล่นสามารถร้องขอให้ลบข้อมูลได้เมื่อกิจกรรมสิ้นสุดลงแล้ว',
            'การล็อคอินเข้าสู่ระบบถือว่าตกลงยอมรับนโยบายการใช้งานนี้แล้ว',
          ]} />
        </div>
      </section>

      <Divider />

      {/* ══════════════════════════════════════════════════════════
          02 — หน้าหลักและเมนู Header
      ══════════════════════════════════════════════════════════ */}
      <section id="home" className="scroll-mt-20">
        <SectionHeading num="02" title="หน้าหลักและเมนู Header" />

        <SubHeading label="A — เมนูด้านบน (Header)" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771658886/278df4ae-8f7d-46f8-990b-d93e3a1ec187.png"
          alt="Header bar"
          caption="A — แถบเมนูด้านบน"
          onOpen={openLightbox}
        />
        <BodyText>
          แถบ Header ประกอบด้วย ชื่อระบบ <strong className="text-nouveau-cream">Whisper</strong>, ป้ายบทบาทผู้ใช้ (Role Player / Admin / DM),
          ปุ่มแจ้งเตือน <strong className="text-nouveau-cream">Bell Notification</strong> และรูปโปรไฟล์
        </BodyText>
        <BodyText>
          ปุ่ม Bell แสดงจำนวนการแจ้งเตือนที่ยังไม่ได้อ่าน —
          เมื่อมีเหตุการณ์ใหม่ (อีเวนท์เปิด, ภารกิจได้รับอนุมัติ, การแจ้งเตือนจากทีมงาน)
          ตัวเลขจะอัปเดต<strong className="text-nouveau-cream">ทันทีโดยไม่ต้องรีเฟรชหน้า</strong>
        </BodyText>
        <BodyText>
          ป้ายบทบาทในมุมขวาแสดงสิทธิ์ของคุณในระบบ:
          ผู้เล่นทั่วไปจะเห็นเป็น <span className="text-victorian-200">Role Player</span>,
          ทีมงานจะเห็นเป็น <span className="text-gold-300">DM</span> หรือ <span className="text-red-300">Admin</span>{' '}
          ซึ่งมีเมนูจัดการพิเศษเพิ่มเติม
        </BodyText>

        <SubHeading label="B — เมนูโปรไฟล์" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771659009/94ce4623-2f23-4c60-92dd-98b3044c8c18.png"
          alt="Profile menu"
          caption="B — เมนูเมื่อคลิกรูปโปรไฟล์"
          onOpen={openLightbox}
        />
        <BodyText>
          เมื่อคลิกรูปโปรไฟล์จะมีเมนูย่อยปรากฏขึ้น ประกอบด้วย
        </BodyText>
        <BulletList items={[
          <>
            <strong className="text-nouveau-cream">ตั้งค่าบัญชี</strong> — เปลี่ยน Display Name และจัดการข้อมูลส่วนตัว
          </>,
          <>
            <strong className="text-nouveau-cream">แก้ไขประวัติตัวละคร</strong> — เปิด Rich Text Editor (TipTap) เพื่อแก้ไขประวัติ Bio ของตัวละคร
            รองรับ Bold, Italic, ลิงก์, รูปภาพแทรก และการจัดตำแหน่งข้อความ
          </>,
          <>
            <strong className="text-nouveau-cream">เทมเพลตประวัติ (Template)</strong> — โครงร่างตั้งต้นสำหรับเขียนประวัติตัวละคร
            ช่วยให้ข้อมูลมีมาตรฐานเดียวกัน
          </>,
          <>
            <strong className="text-nouveau-cream">ตั้งค่าโปรไฟล์</strong> — เปลี่ยนรูปโปรไฟล์และภาพพื้นหลังโปรไฟล์ของตัวละคร
          </>,
        ]} />
      </section>

      <Divider />

      {/* ══════════════════════════════════════════════════════════
          03 — ข้อมูลพื้นฐานตัวละคร
      ══════════════════════════════════════════════════════════ */}
      <section id="stats" className="scroll-mt-20">
        <SectionHeading num="03" title="ข้อมูลพื้นฐานตัวละคร" />

        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771659206/422690fd-2910-48dc-9830-5a6385ed1af0.png"
          alt="ข้อมูลพื้นฐาน"
          caption="แผงข้อมูลพื้นฐานตัวละคร"
          onOpen={openLightbox}
        />

        <BodyText>
          แผงข้อมูลแสดงค่าสถิติต่าง ๆ ของตัวละคร —
          เมื่อมีการเปลี่ยนแปลง (เช่น ทีมงานอนุมัติการนอนหลับ) ค่าจะเปลี่ยนทันทีในทุกหน้าจอโดยไม่ต้องรีเฟรช
        </BodyText>

        <div className="grid gap-3 sm:grid-cols-2 mb-4">
          {[
            {
              icon: '❤️', name: 'HP (ชีวิต)',
              desc: 'แต้มชีวิตของตัวละคร หาก HP หมดเท่ากับตาย/หลุดออกจากกิจกรรม ค่าเริ่มต้นกำหนดโดยทีมงาน และสามารถรับเพิ่มได้จากรางวัลภารกิจ หรือสกิลของบางเส้นทาง',
            },
            {
              icon: '🧠', name: 'ค่าสติ (Sanity)',
              desc: 'ลดลง -2 อัตโนมัติทุกวัน — ต้องคอยรักษาให้อยู่ในระดับดีเสมอ เพราะหากสติหมดอาจมีผลลบต่อตัวละครในกิจกรรม',
            },
            {
              icon: '💠', name: 'พลังวิญญาณ (Spirit)',
              desc: 'ใช้ในการใช้สกิลต่าง ๆ และสำหรับบางเส้นทาง (เช่น ลูกศิษย์) จะใช้ Spirit แทน Travel ในการเดินทางด้วย ฟื้นคืนเต็มหลอดเมื่อนอนหลับและทีมงานอนุมัติ',
            },
            {
              icon: '🧭', name: 'แต้มเดินทาง (Travel)',
              desc: 'ใช้ในระบบแผนที่เพื่อเคลื่อนย้ายตัวละคร (1 แต้มต่อการย้ายภายในแผนที่เดียว, 3 แต้มข้ามแผนที่) รับเพิ่มได้จากรางวัลภารกิจ',
            },
            {
              icon: '⚗️', name: 'ย่อยโอสถ (Distillation)',
              desc: 'แถบความคืบหน้าในการเลื่อนระดับขั้น (Sequence) เพิ่มขึ้นจากการสวมบทบาทที่ผ่านการอนุมัติ เมื่อเต็ม 100% ทีมงานจะดำเนินการเลื่อน Sequence ให้',
            },
            {
              icon: '📋', name: 'ข้อมูลเส้นทาง',
              desc: 'แสดงเส้นทาง (Pathway) ลำดับ (Sequence) ปัจจุบัน และศาสนาที่ตัวละครนับถือ — ข้อมูลเหล่านี้เป็นตัวกำหนดสกิล กฎการเดินทาง และพฤติกรรมต่าง ๆ ในระบบ',
            },
          ].map((stat) => (
            <div key={stat.name} className="bg-victorian-900/40 border border-gold-subtle rounded-sm p-3 flex gap-2.5">
              <span className="flex-shrink-0 text-base mt-0.5">{stat.icon}</span>
              <div>
                <p className="text-nouveau-cream text-xs font-display mb-1">{stat.name}</p>
                <p className="text-victorian-300 text-xs leading-relaxed">{stat.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <Note>
          ข้อมูลสถิติของคุณเป็นส่วนตัว — ผู้เล่นคนอื่นไม่สามารถแก้ไขหรือดูข้อมูลลึกของคุณได้
          การเปลี่ยนแปลงทุกอย่างผ่านการตรวจสอบสิทธิ์ก่อนเสมอ
        </Note>
      </section>

      <Divider />

      {/* ══════════════════════════════════════════════════════════
          04 — เมนูระบบต่าง ๆ
      ══════════════════════════════════════════════════════════ */}
      <section id="nav" className="scroll-mt-20">
        <SectionHeading num="04" title="เมนูระบบต่าง ๆ" />

        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771659561/1ccc2c6c-55b2-4a37-974f-851ed8848ae9.png"
          alt="Main menu"
          caption="เมนูหลักระบบต่าง ๆ"
          onOpen={openLightbox}
        />

        <BodyText>เมนูหลักของระบบประกอบด้วย 4 ส่วนสำคัญ</BodyText>
        <BulletList items={[
          <><strong className="text-nouveau-cream">🗺️ แผนที่</strong> — ระบบแผนที่แบบโต้ตอบ เคลื่อนย้ายตัวละครและสำรวจพื้นที่ โต้ตอบกับ NPC และสถานที่ต่าง ๆ</>,
          <><strong className="text-nouveau-cream">⚡ สกิล</strong> — ดูและใช้สกิลของตัวละคร ระบบจะสุ่มลูกเต๋าและแจ้งผลทันที พร้อมหลักฐานสำหรับนำไปแปะในโรลเพลย์</>,  
          <><strong className="text-nouveau-cream">🎯 แอคชั่น</strong> — แกนหลักของกิจกรรม ส่งภารกิจ สวมบทบาท ย่อยโอสถ นอนหลับ ภาวนา — ทุกแอคชั่นบันทึกประวัติและตรวจสอบย้อนหลังได้</>,
          <><strong className="text-nouveau-cream">👥 ทำเนียบผู้เล่น</strong> — ดูรายชื่อและโปรไฟล์ผู้เล่นทุกคน พร้อมทำเนียบศาสนาและหลักคำสอน</>,
        ]} />

        <BodyText>
          ระบบโหลดข้อมูลล่าสุดของตัวละครให้อัตโนมัติทุกครั้งที่เปิดหน้า —
          ส่วนที่ต้องการแสดงผลแบบทันทีจะอัปเดตให้เองโดยไม่ต้องรีเฟรช
        </BodyText>
      </section>

      <Divider />

      {/* ══════════════════════════════════════════════════════════
          05 — ระบบแผนที่
      ══════════════════════════════════════════════════════════ */}
      <section id="map" className="scroll-mt-20">
        <SectionHeading num="05" title="ระบบแผนที่" />

        <SubHeading label="A — หน้าแผนที่หลัก" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771659859/77dab26b-197c-43da-a151-dcd4340e851e.png"
          alt="Map overview"
          caption="A — เลือกโซนที่ต้องการเดินทาง"
          onOpen={openLightbox}
        />
        <BodyText>
          หน้าแผนที่หลักแสดงโซนต่าง ๆ ในโลก เลือกโซนที่ต้องการเดินทางเพื่อเข้าสู่แผนที่โซนนั้น ๆ
          แต่ละโซนมีภาพพื้นหลังแผนที่แยก สามารถมี Token ผู้เล่น, NPC, และจุดสนใจกระจายอยู่ทั่ว
        </BodyText>

        <SubHeading label="B — การซูมแผนที่" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771659980/16d2fdfa-3371-403c-9163-acef4fd36cdb.png"
          alt="Map zoom"
          caption="B — ใช้นิ้วซูมหรือปุ่มซูม"
          onOpen={openLightbox}
        />
        <BodyText>
          ใช้<strong className="text-nouveau-cream"> Pinch Zoom </strong>บนมือถือ หรือปุ่ม + / − ในการซูมแผนที่
          เพื่อดูรายละเอียดพื้นที่ได้ชัดเจนขึ้น
          ตำแหน่งของผู้เล่นทุกคนในแผนที่อัปเดตแบบสด — หากผู้เล่นคนอื่นย้ายตำแหน่ง ไอคอนบนหน้าจอจะขยับทันที
        </BodyText>

        <SubHeading label="C — การย้ายตำแหน่ง (2 วิธี)" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771659961/66750fdd-527f-4ffb-a010-e7ee15499fde.png"
          alt="Map movement tools"
          caption="C — เครื่องมือการย้ายตำแหน่ง"
          onOpen={openLightbox}
        />

        <div className="grid gap-3 sm:grid-cols-2 mb-4">
          <div className="bg-victorian-900/50 border border-gold-subtle rounded-sm p-4">
            <p className="text-gold-400 text-xs font-display tracking-wide mb-2">😴 สายขี้เกียจ (ใช้แต้มเดินทาง)</p>
            <BulletList items={[
              'ย้ายในแผนที่เดียวกัน: เสีย 1 แต้มเดินทางต่อครั้ง',
              'ย้ายข้ามแผนที่: เสีย 3 แต้มเดินทางต่อครั้ง',
              <>
                ผู้เล่นบางเส้นทาง (เช่น{' '}
                <span className="text-nouveau-cream">ลูกศิษย์ Seq 0–5</span>) ใช้{' '}
                <strong className="text-nouveau-cream">Spirit</strong> แทน Travel และต้นทุนข้ามแผนที่เพียง 1
              </>,
            ]} />
          </div>
          <div className="bg-victorian-900/50 border border-gold-subtle rounded-sm p-4">
            <p className="text-gold-400 text-xs font-display tracking-wide mb-2">📝 สายขยัน (ใช้โรลเพลย์)</p>
            <BulletList items={[
              'โรลเพลย์ 1 โพสต์เดินทาง แทน 1 การเคลื่อนย้าย',
              'ระบบตรวจสอบอัตโนมัติ แต่ทีมงานตรวจย้อนหลังได้',
              'ทีมงานสามารถตรวจสอบโรลเพลย์เดินทางย้อนหลังได้ทุกชิ้น',
            ]} />
          </div>
        </div>
        <Warning>
          อย่าพยายามหลอกระบบ — ทีมงานสามารถตรวจสอบประวัติการเคลื่อนไหวและโรลเพลย์เดินทางย้อนหลังได้ทุกรายการ
        </Warning>

        <SubHeading label="D — NPC และสถานที่ในแผนที่" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771660035/e14baf57-cd05-4c6e-8c61-d0ae7f633bf4.png"
          alt="Map NPC and locations"
          caption="D — NPC สถานที่ และวงรัศมีโต้ตอบ"
          onOpen={openLightbox}
        />
        <BodyText>
          ภายในแผนที่จะมี NPC และสถานที่ต่าง ๆ ปรากฏอยู่ พร้อม{' '}
          <strong className="text-nouveau-cream">วงรัศมีโต้ตอบ</strong> (Interaction Radius) —
          ตัวละครต้องเดินเข้าไปอยู่ภายในวงรัศมีนั้นก่อน จึงจะสามารถทักทาย NPC, รับภารกิจ, หรือกระตุ้นเหตุการณ์พิเศษได้
        </BodyText>
        <Note>
          บางพื้นที่ในแผนที่อาจถูก <strong>ล็อค</strong> (Locked Zone) — ผู้เล่นทั่วไปจะเข้าไม่ได้
          แต่บางเส้นทางหรือบางลำดับสามารถผ่านโซนล็อคได้โดยตรง (Bypass Locked Zones)
          ตามกำหนดของกฎการเดินทางพิเศษ
        </Note>
      </section>

      <Divider />

      {/* ══════════════════════════════════════════════════════════
          06 — ระบบสกิล
      ══════════════════════════════════════════════════════════ */}
      <section id="skills" className="scroll-mt-20">
        <SectionHeading num="06" title="ระบบสกิล" />

        <SubHeading label="A — รายการสกิล" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771660388/8e7bde70-eacf-47ec-99a3-425310a2b1ce.png"
          alt="Skills list"
          caption="A — รายการสกิลที่ปลดล็อคแล้ว"
          onOpen={openLightbox}
        />
        <BodyText>
          หน้าสกิลแสดงรายการสกิลทั้งหมดที่ตัวละครได้รับตาม <strong className="text-nouveau-cream">เส้นทาง (Pathway)</strong> และ{' '}
          <strong className="text-nouveau-cream">ลำดับ (Sequence)</strong> ปัจจุบัน —
          ทีมงานเป็นผู้มอบสกิลให้แต่ละตัวละครตามเส้นทางที่เลือก
          ยิ่ง Sequence สูงขึ้นยิ่งมีสกิลที่ทรงพลังกว่าให้ใช้งาน
        </BodyText>
        <Warning>
          ก่อนการใช้สกิลใด ๆ ต้องแจ้งทีมงานก่อนเสมอ เพื่อให้ทีมงานกำหนดอัตราความสำเร็จ
          ซึ่งขึ้นอยู่กับบริบทของอีเวนท์ ภารกิจ หรือเหตุการณ์ย่อยนั้น ๆ
        </Warning>

        <SubHeading label="B — การกดใช้สกิล" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771660485/87491fbd-0aaf-4fa7-b75e-899c2b8c0473.png"
          alt="Use skill form"
          caption="B — หน้าต่างการใช้งานสกิล"
          onOpen={openLightbox}
        />
        <Note>
          ช่อง <strong>อัตราความสำเร็จ</strong>: หากทีมงานไม่ได้ระบุเงื่อนไข ให้ใส่เลข{' '}
          <strong className="text-nouveau-cream">1</strong> (สำเร็จทันที, roll &ge; 1 ถือว่าผ่าน) —
          หากทีมงานระบุว่าต้องการ roll เกินหรือเท่ากับค่าหนึ่ง ให้ใส่ตัวเลขนั้น
          ไม่ว่าผลจะสำเร็จหรือไม่ก็จะ<strong className="text-nouveau-cream">เสียพลังวิญญาณทันที</strong>
        </Note>

        <SubHeading label="C — ผลลัพธ์และ Embed Code" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771660602/318a23b3-e857-4745-8771-a3c3c2ee52eb.png"
          alt="Skill result"
          caption="C — ผลการสุ่ม 1d20 และ Embed Code"
          onOpen={openLightbox}
        />
        <BodyText>
          หลังกดใช้งาน ระบบจะสุ่มลูกเต๋า <strong className="text-nouveau-cream">1d20</strong> และแจ้งผลทันที —
          พร้อมสร้าง <strong className="text-nouveau-cream">โค้ดหลักฐาน (Embed)</strong> ที่แสดงผลการใช้สกิลครั้งนั้น
          สามารถนำโค้ดนี้ไปวางท้ายโพสต์โรลเพลย์เป็นหลักฐานยืนยันได้
          และปรับขนาดกว้าง/สูงได้ตามต้องการ
        </BodyText>

        <SubHeading label="D — ตัวอย่างสกิลที่ใช้แล้ว" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771660711/ba7ce718-09bd-4d83-b04f-f97aa1a9208d.png"
          alt="Used skill example"
          caption="D — ตัวอย่างผลสกิลสำเร็จ"
          onOpen={openLightbox}
        />

        <SubHeading label="E — ประวัติการใช้สกิล" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771660844/18265001-0be3-4762-b518-71f8a91a6899.png"
          alt="Skill history"
          caption="E — ประวัติการใช้งานสกิลย้อนหลัง"
          onOpen={openLightbox}
        />
        <BodyText>
          ส่วน E แสดงประวัติการใช้งานสกิลทั้งหมด พร้อมชื่อสกิล, ผลลัพธ์, Spirit ที่เสียไป
          และหมายเหตุ (ถ้ามี) — ทีมงานสามารถตรวจสอบย้อนหลังได้เช่นกัน
        </BodyText>
      </section>

      <Divider />

      {/* ══════════════════════════════════════════════════════════
          07 — ระบบแอคชั่น
      ══════════════════════════════════════════════════════════ */}
      <section id="actions" className="scroll-mt-20">
        <SectionHeading num="07" title="ระบบแอคชั่น" />

        <BodyText>
          แอคชั่นคือ<strong className="text-nouveau-cream">แกนหลักของกิจกรรม</strong> ที่คอยขับเคลื่อนเรื่องราวและอีเวนท์ต่าง ๆ —
          ทุกแอคชั่นมีประวัติบันทึกไว้ ทีมงานสามารถตรวจสอบหรือยกเลิกได้ในกรณีที่มีข้อสงสัย
        </BodyText>

        <SubHeading label="A — หน้าหลักแอคชั่น" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771660971/041f6418-9d67-4a16-be03-d0aedf7ebd1b.png"
          alt="Actions main"
          caption="A — หน้าหลักระบบแอคชั่น"
          onOpen={openLightbox}
        />
        <BodyText>ประกอบด้วย</BodyText>
        <BulletList items={[
          <>
            <strong className="text-nouveau-cream">แถบย่อยโอสถ</strong> — แสดง % ความคืบหน้าสู่ Sequence ถัดไป
            ค่านี้เพิ่มขึ้นทุกครั้งที่ทีมงานอนุมัติโรลเพลย์
          </>,
          <>
            <strong className="text-nouveau-cream">นอนหลับ</strong> — ฟื้นฟู Spirit ทั้งหมด,{' '}
            ส่งได้ 1 ครั้ง/วัน, ต้องรอทีมงานหรือระบบอนุมัติ
          </>,
          <>
            <strong className="text-nouveau-cream">ภาวนา</strong> — ส่งการอธิษฐานหรือสวดมนต์ตามศาสนาของตัวละคร
            เพื่อรับผลพิเศษตามที่ทีมงานกำหนด
          </>,
          <>
            <strong className="text-nouveau-cream">ส่งภารกิจ</strong> — ใส่รหัส Quest Code พร้อมหลักฐาน
          </>,
          <>
            <strong className="text-nouveau-cream">สวมบทบาท</strong> — ส่งโรลเพลย์เพิ่มค่าย่อยโอสถ
            จำกัด 5 ชิ้น/วัน (นับตามวันปฏิทิน)
          </>,
        ]} />

        <SubHeading label="B — ประวัติแอคชั่น" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771661095/723963e4-c7ae-4e10-b25f-1218d558f1a2.png"
          alt="Action history"
          caption="B — ประวัติการส่งแอคชั่นทั้งหมด"
          onOpen={openLightbox}
        />
        <BodyText>
          แสดงประวัติย้อนหลังของทุกแอคชั่น — ครอบคลุมการนอนหลับ ภาวนา ส่งภารกิจ เหตุการณ์ และสวมบทบาท
          สถานะแต่ละรายการแสดงว่ากำลังรอ (Pending), ผ่าน (Approved) หรือไม่ผ่าน (Rejected)
          พร้อมหมายเหตุจากทีมงาน
        </BodyText>

        <SubHeading label="E — แบบฟอร์มนอนหลับ" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771661160/ac3fdcbd-d902-4d4b-872c-f2a12cd65a48.png"
          alt="Sleep form"
          caption="E — แบบฟอร์มส่งการนอนหลับ"
          onOpen={openLightbox}
        />
        <Note>
          การนอนหลับจะ<strong> ฟื้นฟูพลังวิญญาณทั้งหมด</strong>ให้กลับเต็มหลอด
          ทำได้วันละ <strong>1 ครั้ง</strong> เท่านั้น —
          ต้องรอทีมงานหรือระบบอนุมัติก่อนจึงจะมีผล คำนึงถึงเวลาการส่งให้ดี
        </Note>

        <SubHeading label="C — แบบฟอร์มภาวนา" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771661171/e04f397c-e708-45b1-b625-03feda3cafae.png"
          alt="Prayer form"
          caption="C — แบบฟอร์มส่งการภาวนา"
          onOpen={openLightbox}
        />
        <BodyText>
          การภาวนาช่วยให้ตัวละครโต้ตอบกับ Lore ของศาสนาที่นับถือ
          ทีมงานเป็นผู้กำหนดผลลัพธ์เองในแต่ละครั้ง — อาจได้รับ Buff, ข้อมูล Lore, หรือเหตุการณ์พิเศษ
          ขึ้นอยู่กับบริบทของเรื่องราวในช่วงนั้น
        </BodyText>

        <SubHeading label="D — แบบฟอร์มส่งภารกิจ" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771661175/80f43936-006d-4698-875b-a6493425aa54.png"
          alt="Quest submission form"
          caption="D — แบบฟอร์มส่งภารกิจ"
          onOpen={openLightbox}
        />
        <Note>
          ภารกิจทั่วไปจะมีโค้ดแจ้งไว้ในบอร์ดภารกิจหรือมีการแจ้งผ่าน Discord
          ส่วนภารกิจพิเศษจะไม่มีการแจ้งล่วงหน้า — ต้องสังเกตเหตุการณ์และเบาะแสในกิจกรรม
          เมื่อส่งภารกิจสำเร็จ รางวัล (HP, Sanity, Travel, Spirit) จะถูกบันทึกรอทีมงานอนุมัติ
          และเพิ่มค่าสถิติให้อัตโนมัติเมื่อผ่าน
        </Note>

        <SubHeading label="F — แบบฟอร์มสวมบทบาท" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771661184/64b41bcb-f39d-45ab-ac12-2859bb2d740c.png"
          alt="Roleplay form"
          caption="F — แบบฟอร์มส่งการสวมบทบาท"
          onOpen={openLightbox}
        />
        <BodyText>
          การสวมบทบาทคือการโรลเพลย์การกระทำใด ๆ ที่เข้ากับ Keyword หรือคอนเซปต์ของลำดับ (Sequence) นั้น ๆ
          — เมื่อทีมงานอนุมัติ ระบบจะเพิ่มค่าย่อยโอสถ (Distillation) ให้กับตัวละครโดยอัตโนมัติ
          สามารถสอบถามทีมงานเพื่อขอคำใบ้เกี่ยวกับ Keyword ที่ใช้ในแต่ละลำดับได้
        </BodyText>
        <BulletList items={[
          'ส่งโรลเพลย์ได้สูงสุด 5 ชิ้นต่อวัน (นับตามวันปฏิทิน ตัดที่เที่ยงคืน)',
          'แต่ละชิ้นต้องเป็นเนื้อหาใหม่ที่เขียนขึ้นสำหรับครั้งนั้น ๆ ห้ามซ้ำซาก',
          'แต่ละโรลเพลย์ที่ผ่านการอนุมัติจะเพิ่มค่าย่อยโอสถตามเปอร์เซ็นต์ที่ทีมงานกำหนด',
          'ระบบตรวจนับจำนวนอัตโนมัติ ไม่สามารถส่งเกินกำหนดได้',
        ]} />
      </section>

      <Divider />

      {/* ══════════════════════════════════════════════════════════
          08 — ระบบอีเวนท์
      ══════════════════════════════════════════════════════════ */}
      <section id="events" className="scroll-mt-20">
        <SectionHeading num="08" title="ระบบอีเวนท์" />

        <BodyText>
          อีเวนท์คือ<strong className="text-nouveau-cream">เหตุการณ์ร่วมแบบมีกำหนดเส้นตาย</strong> ซึ่งมีบทลงโทษหากทำไม่สำเร็จหรือไม่ผ่าน —
          จะมีการแจ้งเตือนทั้งในระบบเว็บและผ่าน Discord
        </BodyText>

        <SubHeading label="A — หน้าต่างแจ้งอีเวนท์" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771661970/b3184922-2171-4b61-9e24-8c14eba24a08.png"
          alt="Event popup"
          caption="A — หน้าต่างอีเวนท์ปรากฏในทุกส่วนของระบบ"
          onOpen={openLightbox}
        />
        <BodyText>
          เมื่อมีอีเวนท์ เปิดอยู่ Overlay จะปรากฏขึ้นในทุกหน้าของระบบ — ไม่สามารถปิดได้จนกว่าจะส่ง
          หรืออีเวนท์จะหมดเวลา แสดงรายชื่อผู้เล่นที่ต้องเข้าร่วม, แถบความคืบหน้ารวม,
          และนับถอยหลังเวลาที่เหลือแบบ Real-time
        </BodyText>

        <SubHeading label="B — รายการภารกิจในอีเวนท์" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771662063/36fb1ae8-e6c2-4b9d-b1e8-a4daaf1f13d5.png"
          alt="Event tasks"
          caption="B — รายการภารกิจที่ต้องทำในอีเวนท์"
          onOpen={openLightbox}
        />
        <BodyText>
          คลิกเข้ามาดูรายการภารกิจพร้อมรหัส Quest Code —
          รายละเอียดแต่ละภารกิจต้องติดต่อผู้สร้างอีเวนท์ซึ่งปกติจะแจกแจงไว้ก่อนสร้าง
          แต่ละภารกิจมีสถานะว่าส่งแล้วหรือยัง แสดงเป็น ✓ เมื่อทีมงานอนุมัติ
        </BodyText>

        <SubHeading label="C — ล็อคก่อนส่งภารกิจครบ" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771662068/7855bf7c-0a9c-4bc2-89da-3bd2fcf81950.png"
          alt="Event locked"
          caption="C — ปุ่มส่งอีเวนท์จะล็อคจนกว่าภารกิจจะครบ"
          onOpen={openLightbox}
        />

        <SubHeading label="D — แถบความคืบหน้า" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771662270/fe346b68-9a98-40be-9b9c-a554f487f4fd.png"
          alt="Event progress"
          caption="D — แถบความคืบหน้าอีเวนท์"
          onOpen={openLightbox}
        />
        <BodyText>
          แถบความคืบหน้าอัปเดตแบบสด —
          เมื่อผู้เล่นคนใดส่งภารกิจและได้รับอนุมัติ แถบจะขยับให้เห็นพร้อมกันทุกหน้าจอในทันที
          ให้ทุกคนในกลุ่มติดตามสถานะได้พร้อมกัน
        </BodyText>

        <SubHeading label="E — การส่งอีเวนท์" />
        <ScreenshotGrid items={[
          { src: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771662328/809b5d82-26c6-4785-992c-3afab0e0605b.png', alt: 'Event submit 1', caption: 'E.1 — ปุ่มส่งอีเวนท์ปรากฏเมื่อภารกิจครบ' },
          { src: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771662393/785cd135-57dc-4b24-9559-a790805a2330.png', alt: 'Event submit 2', caption: 'E.2 — ยืนยันการส่งอีเวนท์' },
        ]} onOpen={openLightbox} />
        <BodyText>
          เมื่อทีมงานอนุมัติภารกิจครบทุกรายการแล้ว ปุ่ม &ldquo;ส่งอีเวนท์&rdquo; จะปรากฏขึ้น
          กดส่งเพื่อยืนยันว่าคุณผ่านอีเวนท์นี้แล้ว — ระบบจะบันทึกว่าคุณหลุดพ้นจากบทลงโทษ
        </BodyText>

        <SubHeading label="F — ประเภทของอีเวนท์" />
        <QuestTypeBadge
          type="personal"
          label="ภารกิจส่วนบุคคล"
          desc="ทุกคนต้องทำเหมือนกัน — ใครทำสำเร็จก็รอดพ้นเฉพาะตัว ใครทำไม่สำเร็จจะถูกลงโทษเฉพาะตัว ไม่กระทบคนอื่น"
        />
        <QuestTypeBadge
          type="group"
          label="ภารกิจกลุ่ม"
          desc="ทุกคนต้องทำภารกิจในรายการให้ครบเหมือนกัน — หากคนใดคนหนึ่งทำไม่สำเร็จจนหมดเวลา ถือว่าอีเวนท์ล้มเหลวและทุกคนได้รับบทลงโทษ ต้องช่วยกันดูแลทุกคนในกลุ่ม"
        />
        <QuestTypeBadge
          type="target"
          label="ภารกิจเป้าหมายร่วม"
          desc="ต้องทำภารกิจในรายการให้ครบทั้งหมดรวมกัน แต่ไม่จำเป็นต้องทำเหมือนกัน — แบ่งกันทำได้ หากรายการครบแม้บางคนจะไม่ส่งเลยก็รอดทั้งกลุ่ม เน้นการแบ่งหน้าที่"
        />
        <Warning>
          โปรดตรวจสอบประเภทอีเวนท์ทุกครั้งก่อนเริ่มดำเนินการ เพราะแต่ละประเภทมีเงื่อนไขและผลกระทบต่างกันมาก
          บทลงโทษจะมีผลอัตโนมัติเมื่อหมดเวลา — ทีมงานไม่สามารถยกเว้นได้หลังจากนั้น
        </Warning>
      </section>

      <Divider />

      {/* ══════════════════════════════════════════════════════════
          09 — ทำเนียบผู้เล่นและศาสนา
      ══════════════════════════════════════════════════════════ */}
      <section id="directory" className="scroll-mt-20">
        <SectionHeading num="09" title="ทำเนียบผู้เล่นและศาสนา" />

        <SubHeading label="A — ทำเนียบผู้เล่น" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771662834/5a02ffcc-05dd-48b0-93c1-f06b40600c80.png"
          alt="Player directory"
          caption="A — รายชื่อผู้เล่นทั้งหมดในกิจกรรม"
          onOpen={openLightbox}
        />
        <BodyText>
          หน้ารวมรายชื่อผู้เล่นและทีมงานทั้งหมดในกิจกรรม
          สามารถค้นหาตามชื่อ, กรองตาม Pathway หรือ Sequence, และดูข้อมูลพื้นฐานของผู้เล่นแต่ละคนได้
        </BodyText>

        <SubHeading label="B — ประวัติตัวละครเต็ม" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771662951/01ff49da-ef83-41d5-9407-f40850613d16.png"
          alt="Player profile"
          caption="B — หน้าประวัติตัวละครเต็มรูปแบบ"
          onOpen={openLightbox}
        />
        <BodyText>
          เมื่อกดเข้าไปดูโปรไฟล์ผู้เล่น จะเห็นประวัติตัวละครเต็มรูปแบบที่เจ้าของตัวละครเขียนเอง —
          รองรับข้อความจัดรูปแบบและภาพประกอบ
          รวมถึงเส้นทาง (Pathway), ลำดับ (Sequence), ศาสนา, สกิลที่ได้รับ และรูปโปรไฟล์+พื้นหลัง
        </BodyText>

        <SubHeading label="C — ทำเนียบศาสนา" />
        <Screenshot
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771663037/13d5ab3a-274c-46a1-b763-10222be2ceba.png"
          alt="Religion directory"
          caption="C — ทำเนียบศาสนาและหลักคำสอน"
          onOpen={openLightbox}
        />
        <BodyText>
          แสดงรายการศาสนาทั้งหมดในกิจกรรม พร้อมหลักคำสอน ลักษณะเฉพาะ และรายชื่อผู้เล่นที่นับถือ —
          ใช้เป็นข้อมูลประกอบการโรลเพลย์ เพื่อให้ตัวละครมีความลึกและสอดคล้องกับ Lore ของโลก
        </BodyText>
      </section>

      <Divider />

      {/* ══════════════════════════════════════════════════════════
          10 — Tech Stack และสถาปัตยกรรม
      ══════════════════════════════════════════════════════════ */}
      <section id="stack" className="scroll-mt-20">
        <SectionHeading num="10" title="Tech Stack และสถาปัตยกรรม" />

        <BodyText>
          ระบบ Whisper of the Shadow พัฒนาขึ้นเพื่อใช้ในการจัดการ ควบคุม และอำนวยความสะดวกดูแลการโรลเพลย์
          สร้างขึ้นบน Tech Stack ที่เน้น <strong className="text-nouveau-cream">ความเร็ว Real-time, ความปลอดภัยของข้อมูล และความยืดหยุ่นในการขยายระบบ</strong>
        </BodyText>

        <SubHeading label="Core Frameworks" />
        <div className="grid gap-3 sm:grid-cols-2 mb-4">
          <TechBadge
            icon="▲"
            name="Next.js ^15.1.0"
            desc="Framework หลักของเว็บ ใช้ App Router + React Server Components — ดึงข้อมูลได้โดยตรงในฝั่ง Server, รองรับ Server Actions, Middleware และ Edge Runtime"
          />
          <TechBadge
            icon="⚛"
            name="React ^19.0.0"
            desc="Core UI Library — ใช้ Server Actions แทน REST API ทำให้ทุก mutation (ส่งภารกิจ, ใช้สกิล, ย้ายแผนที่) เรียกผ่านฟังก์ชัน async ที่รันบน Server โดยตรง"
          />
        </div>

        <SubHeading label="UI & Styling" />
        <div className="grid gap-3 sm:grid-cols-2 mb-4">
          <TechBadge
            icon="🎨"
            name="Tailwind CSS ^3.4.0"
            desc="Utility-first CSS พร้อม custom design token ในธีม Victorian / Art Nouveau — สีชุด gold, nouveau-cream, victorian ถูก extend ใน tailwind.config"
          />
          <TechBadge
            icon="✦"
            name="Lucide React ^0.468.0"
            desc="ไลบรารีไอคอน SVG สำหรับ UI ทั่วทั้งระบบ — น้ำหนักเบา, tree-shakeable, สอดคล้องกับธีม Victorian"
          />
          <TechBadge
            icon="📐"
            name="@tailwindcss/typography ^0.5.0"
            desc="Plugin สำหรับจัดรูปแบบ Rich Text ในประวัติตัวละครและเอกสารต่าง ๆ — ควบคุม typography scale อัตโนมัติ"
          />
          <TechBadge
            icon="📝"
            name="TipTap (Rich Text Editor)"
            desc="Editor ประวัติตัวละคร รองรับ Bold, Italic, Underline, Link, Image embed, Text align, Color, Highlight — บันทึกเป็น HTML"
          />
        </div>

        <SubHeading label="State Management & Data Fetching" />
        <div className="grid gap-3 sm:grid-cols-2 mb-4">
          <TechBadge
            icon="🟩"
            name="@supabase/ssr ^0.5.2"
            desc="SSR-aware Supabase client — จัดการ Session ผ่าน Cookie สำหรับ Next.js Server Components และ Middleware ได้อย่างถูกต้อง"
          />
          <TechBadge
            icon="⚡"
            name="Supabase Realtime"
            desc="Real-time updates ผ่าน WebSocket — ใช้ Broadcast Channel เป็นหลัก และ Postgres Changes เป็น fallback เพื่อรับประกันข้อมูลครบถ้วน"
          />
          <TechBadge
            icon="🗄️"
            name="Supabase (PostgreSQL)"
            desc="ฐานข้อมูลหลัก — Row-Level Security (RLS), pg_cron สำหรับ scheduled jobs (ลด Sanity, trigger บทลงโทษ), PostgreSQL Functions"
          />
          <TechBadge
            icon="🖐"
            name="@dnd-kit"
            desc="Drag & Drop สำหรับ Token ตัวละครบนแผนที่ รองรับทั้ง Mouse และ Touch — ตำแหน่ง normalize เป็น % เพื่อให้ responsive ทุกขนาดหน้าจอ"
          />
        </div>

        <SubHeading label="Discord Integration" />
        <div className="grid gap-3 sm:grid-cols-2 mb-4">
          <TechBadge
            icon="🤖"
            name="Discord.js v14"
            desc="Bot หลักที่รับ Slash Commands จากผู้เล่นในเซิร์ฟเวอร์ Discord — ใช้ REST API ลงทะเบียน Command และ Gateway WebSocket รับ event"
          />
          <TechBadge
            icon="🔔"
            name="Discord Webhook"
            desc="ระบบแจ้งเตือนแบบ fire-and-forget — ส่ง notification ไปยัง Discord channel เมื่อมีเหตุการณ์ (Quest ใหม่, อีเวนท์เปิด, การอนุมัติ)"
          />
        </div>

        <SubHeading label="Infrastructure & Hosting" />
        <div className="grid gap-3 sm:grid-cols-2 mb-4">
          <TechBadge
            icon="▲"
            name="Vercel"
            desc="Hosting สำหรับ Next.js Web App — Edge Middleware, Serverless Functions, Image Optimization อัตโนมัติ"
          />
          <TechBadge
            icon="🚂"
            name="Railway"
            desc="Hosting สำหรับ Discord Bot — รัน Node.js process ต่อเนื่อง 24/7 แยกจาก Web App"
          />
          <TechBadge
            icon="🌥"
            name="Cloudinary"
            desc="CDN สำหรับรูปภาพทั้งหมด — รูปโปรไฟล์, พื้นหลัง, และภาพประกอบ อัปโหลดผ่าน Cloudinary Widget"
          />
          <TechBadge
            icon="🔷"
            name="TypeScript 5.7"
            desc="Type-safe ตลอดทั้ง Codebase — ทั้ง Web App และ Discord Bot พัฒนาด้วย TypeScript"
          />
        </div>

        <div className="bg-victorian-900/40 border border-gold-subtle rounded-sm p-4 mb-4">
          <p className="text-[10px] font-display tracking-[0.2em] uppercase text-gold-400/60 mb-3">
            ภาพรวมสถาปัตยกรรม
          </p>
          <div className="bg-victorian-950/80 rounded-sm p-3 font-mono text-[10px] text-victorian-300 leading-relaxed overflow-x-auto">
            <pre>{`Browser / Discord Client
       │
       ├─ Next.js (Vercel)
       │   ├─ App Router (Server Components + Server Actions)
       │   ├─ Middleware (Session check via Supabase SSR)
       │   └─ Client Components (Realtime, Lightbox, DnD)
       │
       ├─ Discord Bot (Railway)
       │   └─ Slash Commands → Supabase DB
       │
       └─ Supabase
           ├─ PostgreSQL + RLS Policies
           ├─ Auth (OAuth — Discord / Google)
           ├─ Realtime (Broadcast + Postgres Changes)
           └─ pg_cron (Sanity decay, Punishment trigger)`}</pre>
          </div>
        </div>

        <Divider />

        <SubHeading label="เครดิต" />
        <div className="grid gap-3 sm:grid-cols-2 mb-4">
          <div className="bg-victorian-900/40 border border-gold-subtle rounded-sm p-4 sm:col-span-2">
            <p className="text-gold-400 text-xs font-display tracking-wide mb-3">👑 ผู้พัฒนา</p>
            <div className="flex items-start gap-3">
              <div>
                <p className="text-nouveau-cream text-sm font-display mb-1">Kendrick Mervin</p>
                <p className="text-victorian-300 text-xs leading-relaxed">
                  Project Lead & Logic Control — ออกแบบและพัฒนาระบบทั้งหมด ตั้งแต่ฐานข้อมูล, Logic การทำงาน,
                  UI/UX ไปจนถึง Discord Bot
                </p>
              </div>
            </div>
          </div>
          <div className="bg-victorian-900/40 border border-gold-subtle rounded-sm p-4 sm:col-span-2">
            <p className="text-gold-400 text-xs font-display tracking-wide mb-3">🤝 AI Collaboration</p>
            <p className="text-victorian-300 text-xs leading-relaxed mb-3">
              พัฒนาระบบโดยใช้แนวทาง <strong className="text-nouveau-cream">Human-in-the-Loop</strong> —
              ผู้พัฒนาเป็นผู้กำหนดทิศทาง Logic และตัดสินใจทุกขั้นตอน
              โดยมี AI ช่วยในการเขียนโค้ดและขยายรายละเอียด
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="bg-victorian-950/60 rounded-sm px-3 py-2">
                <p className="text-nouveau-cream text-xs font-display">Claude Opus 4.6</p>
                <p className="text-victorian-400 text-[11px] mt-0.5">Architecture & Complex Logic</p>
              </div>
              <div className="bg-victorian-950/60 rounded-sm px-3 py-2">
                <p className="text-nouveau-cream text-xs font-display">Claude Sonnet 4.5</p>
                <p className="text-victorian-400 text-[11px] mt-0.5">Implementation & Iteration</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Divider />

      {/* Footer note */}
      <div className="text-center space-y-2 pb-6">
        <p className="text-[10px] tracking-[0.25em] uppercase text-victorian-500 font-display">
          Whisper of the Shadow — System Handbook
        </p>
        <p className="text-xs text-victorian-500">
          หากพบปัญหาหรือมีคำถามเพิ่มเติม ติดต่อทีมงานผ่าน Discord ได้เลยครับ
        </p>
      </div>

    </div>
  )
}
