'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PATHWAYS } from '../_data/pathways'

/* ─────────────────────────────────────────────────────────────
   Hooks
───────────────────────────────────────────────────────────── */
function useReveal(delay = 0) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setTimeout(() => setVisible(true), delay); obs.disconnect() } },
      { threshold: 0.06, rootMargin: '0px 0px -20px 0px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [delay])
  return { ref, visible }
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 700px)')
    setMobile(mq.matches)
    const fn = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return mobile
}

/* ─────────────────────────────────────────────────────────────
   Base reveal wrapper
───────────────────────────────────────────────────────────── */
function Reveal({
  children,
  delay = 0,
  style = {},
}: {
  children: React.ReactNode
  delay?: number
  style?: React.CSSProperties
}) {
  const { ref, visible } = useReveal(delay)
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function Hr() {
  const { ref, visible } = useReveal()
  return (
    <div
      ref={ref}
      style={{
        height: 1,
        background: 'linear-gradient(to right, transparent, rgba(139,27,27,0.3), transparent)',
        margin: '3.5rem 0',
        transform: visible ? 'scaleX(1)' : 'scaleX(0)',
        opacity: visible ? 1 : 0,
        transition: 'transform 1s ease, opacity 1s ease',
        transformOrigin: 'center',
      }}
    />
  )
}

/* ─────────────────────────────────────────────────────────────
   TWO-COLUMN LORE SECTION
───────────────────────────────────────────────────────────── */
interface LoreSectionProps {
  src: string
  alt: string
  label?: string
  title: string
  reverse?: boolean
  children: React.ReactNode
}

function LoreSection({ src, alt, label, title, reverse = false, children }: LoreSectionProps) {
  const { ref: imgRef, visible: imgV } = useReveal(0)
  const { ref: txtRef, visible: txtV } = useReveal(130)
  const mobile = useIsMobile()

  const imgCol = (
    <div
      ref={imgRef}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 2,
        height: mobile ? 200 : 380,
        flexShrink: 0,
        width: mobile ? '100%' : '46%',
        order: mobile ? 0 : reverse ? 1 : 0,
        opacity: imgV ? 1 : 0,
        transform: imgV ? 'translateX(0)' : `translateX(${reverse ? '28px' : '-28px'})`,
        transition: 'opacity 0.9s ease, transform 0.9s ease',
      }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={mobile ? '100vw' : '50vw'}
        style={{
          objectFit: 'cover',
          objectPosition: 'center',
          opacity: imgV ? 0.72 : 0.3,
          transition: 'opacity 1s ease',
        }}
      />
      {/* side vignette fades into text */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: reverse
            ? 'linear-gradient(to left, rgba(4,2,2,0.55) 0%, rgba(4,2,2,0.02) 65%, transparent 100%)'
            : 'linear-gradient(to right, rgba(4,2,2,0.55) 0%, rgba(4,2,2,0.02) 65%, transparent 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(4,2,2,0.35) 0%, transparent 40%, rgba(4,2,2,0.55) 100%)',
        }}
      />
    </div>
  )

  const txtCol = (
    <div
      ref={txtRef}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: mobile
          ? '1.25rem 0 0'
          : reverse
          ? '0 2.5rem 0 0'
          : '0 0 0 2.5rem',
        order: mobile ? 1 : reverse ? 0 : 1,
        opacity: txtV ? 1 : 0,
        transform: txtV ? 'translateX(0)' : `translateX(${reverse ? '-22px' : '22px'})`,
        transition: 'opacity 0.8s ease, transform 0.8s ease',
      }}
    >
      {label && (
        <p
          style={{
            fontSize: 10,
            letterSpacing: '0.26em',
            textTransform: 'uppercase',
            color: '#7a2825',
            marginBottom: 7,
            fontWeight: 500,
          }}
        >
          {label}
        </p>
      )}
      <h2
        style={{
          fontSize: 'clamp(1.1rem, 2.2vw, 1.45rem)',
          fontWeight: 600,
          color: '#d4c8ba',
          marginBottom: '1.1rem',
          lineHeight: 1.25,
        }}
      >
        {title}
      </h2>
      <div style={{ fontSize: 14, lineHeight: 2, color: '#968a80', fontWeight: 300 }}>
        {children}
      </div>
    </div>
  )

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: mobile ? 'column' : 'row',
        alignItems: mobile ? 'stretch' : 'center',
        margin: '0 0 0.5rem',
      }}
    >
      {imgCol}
      {txtCol}
    </div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ marginBottom: '0.85rem', color: '#968a80' }}>{children}</p>
  )
}

function Q({ children }: { children: React.ReactNode }) {
  return (
    <blockquote
      style={{
        borderLeft: '2px solid #7a2020',
        paddingLeft: '1rem',
        paddingTop: '0.2rem',
        paddingBottom: '0.2rem',
        color: '#625a54',
        fontStyle: 'italic',
        fontSize: 13.5,
        lineHeight: 1.85,
        marginBottom: '0.85rem',
      }}
    >
      {children}
    </blockquote>
  )
}

/* ─────────────────────────────────────────────────────────────
   PATHWAY LIGHTBOX
───────────────────────────────────────────────────────────── */
type PathwayType = (typeof PATHWAYS)[0]

function Lightbox({ p, onClose }: { p: PathwayType; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true))
    document.body.style.overflow = 'hidden'
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', esc)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', esc)
    }
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: mounted ? 'rgba(2,1,1,0.88)' : 'rgba(2,1,1,0)',
        backdropFilter: mounted ? 'blur(7px)' : 'blur(0px)',
        transition: 'background 0.35s ease, backdrop-filter 0.35s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(155deg, #130606 0%, #0c0404 100%)',
          border: '1px solid rgba(120,35,35,0.38)',
          borderRadius: 4,
          width: '100%',
          maxWidth: 520,
          maxHeight: '90svh',
          overflowY: 'auto',
          padding: '22px 20px 28px',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'scale(1) translateY(0)' : 'scale(0.93) translateY(22px)',
          transition: 'opacity 0.38s ease, transform 0.38s ease',
          scrollbarWidth: 'none',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              flexShrink: 0,
              borderRadius: 3,
              background: 'rgba(28,8,8,0.9)',
              border: '1px solid rgba(100,30,30,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Image
              src={p.logo}
              alt={p.nameEn}
              width={40}
              height={40}
              style={{ objectFit: 'contain', opacity: 0.95 }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#d4c4a8', lineHeight: 1.2 }}>
              {p.name}
            </p>
            <p style={{ fontSize: 10.5, color: '#504038', marginTop: 3, letterSpacing: '0.14em' }}>
              {p.nameEn}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#4a2828',
              fontSize: 18,
              lineHeight: 1,
              padding: '4px 6px',
              flexShrink: 0,
              transition: 'color 0.2s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#c06060')}
            onMouseLeave={e => (e.currentTarget.style.color = '#4a2828')}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div style={{ height: 1, background: 'rgba(100,30,30,0.28)', marginBottom: 16 }} />

        {/* Highlight */}
        <p style={{ color: '#968878', fontSize: 13.5, lineHeight: 1.9, marginBottom: 18 }}>
          {p.highlight}
        </p>

        {/* Warning */}
        {p.warning && (
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              background: 'rgba(120,30,10,0.18)',
              border: '1px solid rgba(180,60,20,0.4)',
              borderLeft: '3px solid rgba(200,80,30,0.7)',
              borderRadius: 3,
              padding: '10px 12px',
              marginBottom: 18,
            }}
          >
            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚠</span>
            <div>
              <p style={{ fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#b05030', marginBottom: 4 }}>
                ข้อควรทราบพิเศษ
              </p>
              <p style={{ fontSize: 12.5, color: '#c08060', lineHeight: 1.75 }}>
                {p.warning}
              </p>
              <p style={{ fontSize: 11, color: '#6a4030', marginTop: 6, lineHeight: 1.6 }}>
                เงื่อนไขนี้จะเกิดขึ้นโดยถาวรและไม่สามารถย้อนกลับได้ — โปรดพิจารณาก่อนเลือกเส้นทางนี้
              </p>
            </div>
          </div>
        )}

        {/* Warning */}
        {p.warning && (
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              background: 'rgba(120,30,10,0.18)',
              border: '1px solid rgba(180,60,20,0.4)',
              borderLeft: '3px solid rgba(200,80,30,0.7)',
              borderRadius: 3,
              padding: '10px 12px',
              marginBottom: 18,
            }}
          >
            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚠</span>
            <div>
              <p style={{ fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#b05030', marginBottom: 4 }}>
                ข้อควรทราบพิเศษ
              </p>
              <p style={{ fontSize: 12.5, color: '#c08060', lineHeight: 1.75 }}>
                {p.warning}
              </p>
              <p style={{ fontSize: 11, color: '#6a4030', marginTop: 6, lineHeight: 1.6 }}>
                เงื่อนไขนี้จะเกิดขึ้นโดยถาวรและไม่สามารถย้อนกลับได้ — โปรดพิจารณาก่อนเลือกเส้นทางนี้
              </p>
            </div>
          </div>
        )}

        {/* Skills */}
        <p
          style={{
            fontSize: 9.5,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: '#682525',
            marginBottom: 8,
          }}
        >
          ความสามารถ
        </p>
        <p style={{ color: '#645c52', fontSize: 12.5, lineHeight: 1.8, marginBottom: 20 }}>
          {p.skills}
        </p>

        {/* Images */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7 }}>
          {p.images.map((src, i) => {
            const isVid = p.firstAssetType === 'video' && i === 0
            return isVid ? (
              <video
                key={i}
                src={src}
                autoPlay
                muted
                loop
                playsInline
                style={{
                  width: '100%',
                  aspectRatio: '3/4',
                  objectFit: 'cover',
                  borderRadius: 3,
                  opacity: 0.88,
                }}
              />
            ) : (
              <div
                key={i}
                style={{
                  position: 'relative',
                  aspectRatio: '3/4',
                  borderRadius: 3,
                  overflow: 'hidden',
                  background: '#0a0404',
                }}
              >
                <Image
                  src={src}
                  alt={`${p.name} ${i + 1}`}
                  fill
                  sizes="180px"
                  style={{ objectFit: 'cover', opacity: 0.88 }}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   PATHWAY CARD — 1:1 square, bg image faded, logo + name
───────────────────────────────────────────────────────────── */
// Pick a stable random image per card (seeded by index, not random each render)
function pickBgImg(p: PathwayType, index: number): string {
  return p.images[index % 3]
}

function PathwayCard({
  p,
  index,
  onOpen,
}: {
  p: PathwayType
  index: number
  onOpen: (p: PathwayType) => void
}) {
  const { ref, visible } = useReveal(Math.min(index % 4, 3) * 65)
  const [hovered, setHovered] = useState(false)
  const bgImage = pickBgImg(p, index)

  return (
    <div
      ref={ref}
      onClick={() => onOpen(p)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        aspectRatio: '1 / 1',
        borderRadius: 3,
        overflow: 'hidden',
        cursor: 'pointer',
        border: hovered
          ? '1px solid rgba(160,50,50,0.6)'
          : '1px solid rgba(70,25,25,0.22)',
        background: '#0a0404',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(14px) scale(0.97)',
        transition: `opacity 0.55s ease, transform 0.55s ease, border-color 0.25s`,
      }}
    >
      {/* faded background image */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <Image
          src={bgImage}
          alt=""
          fill
          sizes="200px"
          style={{
            objectFit: 'cover',
            objectPosition: 'top',
            opacity: hovered ? 0.26 : 0.12,
            transform: hovered ? 'scale(1.06)' : 'scale(1)',
            transition: 'opacity 0.45s ease, transform 0.55s ease',
          }}
        />
      </div>

      {/* gradient overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: hovered
            ? 'linear-gradient(to bottom, rgba(4,2,2,0.28) 0%, rgba(4,2,2,0.72) 100%)'
            : 'linear-gradient(to bottom, rgba(4,2,2,0.48) 0%, rgba(4,2,2,0.88) 100%)',
          transition: 'background 0.35s ease',
        }}
      />

      {/* content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 10,
          gap: 7,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            background: 'rgba(8,3,3,0.88)',
            border: `1px solid ${hovered ? 'rgba(150,55,55,0.55)' : 'rgba(70,25,25,0.32)'}`,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'border-color 0.25s',
          }}
        >
          <Image
            src={p.logo}
            alt={p.nameEn}
            width={30}
            height={30}
            style={{
              objectFit: 'contain',
              opacity: hovered ? 1 : 0.78,
              transition: 'opacity 0.25s',
            }}
          />
        </div>
        <div style={{ textAlign: 'center', padding: '0 4px' }}>
          <p
            style={{
              fontSize: 11.5,
              fontWeight: 500,
              color: hovered ? '#d0b89a' : '#9a8878',
              lineHeight: 1.3,
              transition: 'color 0.25s',
            }}
          >
            {p.name}
          </p>
          <p style={{ fontSize: 9.5, color: '#3e2e2e', marginTop: 3, letterSpacing: '0.06em' }}>
            {p.nameEn}
          </p>
        </div>
      </div>

      {/* warning badge */}
      {p.warning && (
        <div
          title={p.warning}
          style={{
            position: 'absolute',
            top: 7,
            right: 7,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'rgba(180,60,20,0.88)',
            border: '1px solid rgba(255,120,60,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            lineHeight: 1,
            boxShadow: '0 0 6px rgba(180,60,20,0.5)',
          }}
        >
          ⚠
        </div>
      )}

      {/* hint on hover */}
      <div
        style={{
          position: 'absolute',
          bottom: 7,
          right: 9,
          fontSize: 8.5,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: hovered ? '#7a3535' : 'transparent',
          transition: 'color 0.25s',
        }}
      >
        รายละเอียด ›
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   VIDEO HERO
───────────────────────────────────────────────────────────── */
function VideoHero() {
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    videoRef.current?.play().catch(() => {})
  }, [])

  return (
    <div style={{ position: 'relative', height: 'min(82svh, 600px)', overflow: 'hidden' }}>
      <video
        ref={videoRef}
        src="https://res.cloudinary.com/dehp6efwc/video/upload/v1771648009/train_le8mda.mp4"
        muted
        loop
        playsInline
        preload="metadata"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to bottom, rgba(4,2,2,0.5) 0%, rgba(4,2,2,0.05) 40%, rgba(4,2,2,0.97) 100%)',
        }}
      />
      {/* film grain */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px',
          opacity: 0.024,
        }}
      />

      {/* centered logo + tagline */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 24px',
          gap: 20,
        }}
      >
        <Image
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771648474/width_550_cukew9.png"
          alt="Whisper of the Shadow"
          width={420}
          height={168}
          priority
          style={{
            width: 'min(340px, 78vw)',
            height: 'auto',
            filter: 'drop-shadow(0 0 50px rgba(180,80,40,0.18))',
          }}
        />
        <p
          style={{
            color: '#50463e',
            fontSize: 13,
            fontStyle: 'italic',
            lineHeight: 1.9,
            maxWidth: 280,
          }}
        >
          ในเงามืดของเมืองที่ไม่มีใครมองเห็น
          <br />
          เสียงกระซิบกำลังคลืบคลานเข้ามา…
        </p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   PAGE ROOT
───────────────────────────────────────────────────────────── */
const BG = '#040202'
const WRAP: React.CSSProperties = {
  maxWidth: 1060,
  margin: '0 auto',
  padding: '0 24px',
}

export default function WorldClient() {
  const [lightboxPathway, setLightboxPathway] = useState<PathwayType | null>(null)
  const openLightbox = useCallback((p: PathwayType) => setLightboxPathway(p), [])
  const closeLightbox = useCallback(() => setLightboxPathway(null), [])

  return (
    <div
      style={{
        background: BG,
        minHeight: '100vh',
        fontFamily: 'var(--font-kanit), Kanit, sans-serif',
      }}
    >
      {/* NAV */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(4,2,2,0.93)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(100,30,30,0.18)',
          padding: '0 24px',
          height: 44,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Link
          href="/docs"
          style={{
            color: '#5a4038',
            fontSize: 11,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#c06040')}
          onMouseLeave={e => (e.currentTarget.style.color = '#5a4038')}
        >
          ← กลับ Docs
        </Link>
      </nav>

      {/* HERO */}
      <VideoHero />

      <div style={WRAP}>

        {/* ── 1. BACKGROUND ─────────────────────────────────── */}
        <LoreSection
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771648590/unnamed_d7pmdc.jpg"
          alt="City fog"
          label="Background"
          title="ภูมิหลัง"
          reverse={false}
        >
          <P>
            ในเงามืดของเมืองที่ไม่มีใครมองเห็น เสียงกระซิบกำลังคลืบคลานเข้ามา…
            และไม่มีใครรู้ว่ามันเริ่มต้นตั้งแต่เมื่อไร
          </P>
          <P>
            โลกนี้ขับเคลื่อนด้วยพลังไอน้ำและกลไกเวท ไม่มีน้ำมัน ไม่มีไฟฟ้าอย่างที่เรารู้จัก
            แต่เครื่องจักรยังคงทำงานได้ด้วยพลังลึกลับที่มีเพียงไม่กี่คนเข้าใจ
          </P>
          <P>
            ที่นี่คือยุคแห่งความเจริญและความบ้าคลั่ง — เมืองเต็มไปด้วยควันไอและคำโกหก
            ผู้วิเศษเดินปะปนอยู่ในฝูงชน และคดีอาชญากรรมเหนือธรรมชาติเพิ่มขึ้นทุกวัน
          </P>
          <Q>
            &ldquo;อย่าไว้ใจเสียงในหัวของคุณ เพราะมันอาจไม่ใช่ความคิดของคุณอีกต่อไป&rdquo;
          </Q>
        </LoreSection>

        <Hr />

        {/* ── 2. THE WORLD ──────────────────────────────────── */}
        <LoreSection
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771648859/width_550_1_rzdjmn.png"
          alt="Steampunk city"
          label="The World"
          title="โลกที่ควันไม่เคยจาง"
          reverse={true}
        >
          <P>
            ที่นี่คือโลกที่ขับเคลื่อนด้วย{' '}
            <strong style={{ color: '#c0b2a0', fontWeight: 500 }}>พลังไอน้ำและกลไกเวท</strong>
            {' '}— ไม่มีน้ำมัน ไม่มีไฟฟ้าอย่างที่เรารู้จัก
            แต่เครื่องจักรกลับทำงานได้ด้วยพลังบางอย่างที่เหนือความเข้าใจ
          </P>
          <P>
            ตึกสูงจากอิฐและคอนกรีตปกคลุมด้วยหมอก โรงงานปล่อยควันไม่หยุด
            รถไฟไอน้ำคำรามตลอดวัน และบนท้องฟ้า เรือเหาะลอยผ่านดวงจันทร์สีแดงชาด
          </P>
          <P>
            มันคือยุคอุตสาหกรรมแห่ง{' '}
            <strong style={{ color: '#c0b2a0', fontWeight: 500 }}>ความเจริญและความบ้าคลั่ง</strong>
            {' '}ในเวลาเดียวกัน
          </P>
        </LoreSection>

        <Hr />

        {/* ── 3. BEYONDERS ──────────────────────────────────── */}
        <LoreSection
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771648960/_1eb0f746-7c14-456d-94dd-22db543fae65_yir1vy.jpg"
          alt="Beyonder"
          label="Beyond Human Limits"
          title="ผู้วิเศษ (Beyonder)"
          reverse={false}
        >
          <P>
            ในโลกที่ &ldquo;กฎธรรมชาติ&rdquo; ไม่ได้เป็นของธรรมชาติอีกต่อไป
            มีบางคนที่ได้พลังอันไม่ควรมี — พลังที่เปลี่ยนมนุษย์ให้ก้าวข้ามขีดจำกัดของตน
          </P>
          <P>
            พวกเขาถูกเรียกว่า{' '}
            <strong style={{ color: '#c0b2a0', fontWeight: 500 }}>ผู้วิเศษ (Beyonder)</strong>
            {' '}— พลังของแต่ละคนขึ้นอยู่กับ &ldquo;เส้นทาง&rdquo; ที่เลือกเดิน
            บางเส้นนำไปสู่ปาฏิหาริย์… แต่บางเส้นนำไปสู่ความบ้าคลั่งและการกลืนกินตัวเอง
          </P>
          <Q>
            คนทั่วไปไม่รู้ว่าผู้วิเศษมีอยู่จริง — และบางที มันอาจดีกว่าแบบนั้น
          </Q>
        </LoreSection>

        <Hr />

        {/* ── 4. RELIGION & POLITICS ────────────────────────── */}
        <LoreSection
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771649795/width_550_2_uhvsp8.png"
          alt="Religion and politics"
          label="Faith & Power"
          title="ศรัทธาและการเมือง"
          reverse={true}
        >
          <P>
            ศาสนาในโลกนี้ไม่ใช่เรื่องของความเชื่อเท่านั้น
            แต่มันคือ{' '}
            <strong style={{ color: '#c0b2a0', fontWeight: 500 }}>&ldquo;อำนาจ&rdquo;</strong>
            {' '}ที่สามารถเปลี่ยนโฉมโลกได้จริง
          </P>
          <P>
            ในราชอาณาจักรโลเอ็น ผู้คนส่วนใหญ่สวดภาวนาแก่{' '}
            <strong style={{ color: '#c0b2a0', fontWeight: 500 }}>เทพีรัติกาล</strong>
            {' '}— แต่ในเงามืด ยังมีศาสนาอื่นที่ถูกลืม ถูกห้าม หรือแอบคงอยู่ในรูปแบบลัทธิใต้ดิน
          </P>
          <Q>
            บางศาสนาเชื่อว่าพระเจ้าของพวกเขายังตอบกลับอยู่…
            และบางครั้ง เสียงนั้นก็ไม่ใช่เสียงของเทพ
          </Q>
        </LoreSection>

        <Hr />

        {/* ── 5. BACKLUND ───────────────────────────────────── */}
        <LoreSection
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771649793/width_366_dd6pf2.png"
          alt="Backlund city"
          label="เมืองหลวงแห่งอาณาจักรโลเอ็น"
          title="กรุงเบคลันด์ (Backlund)"
          reverse={false}
        >
          <P>ศูนย์กลางแห่งอุตสาหกรรม ความมั่งคั่ง และความเสื่อมทราม</P>
          <P>
            ในยามกลางวัน มันคือเมืองแห่งความก้าวหน้า
            แต่ในยามค่ำคืน มันคือเขาวงกตแห่งอาชญากรรม
            ตรอกซอกซอยที่แสงไฟของตะเกียงแก๊สไม่ส่องถึง
            เต็มไปด้วยเสียงกรีดร้อง คำสาป และสิ่งที่ไม่มีชื่อเรียก
          </P>
        </LoreSection>

        <Hr />

        {/* ── 6. LEGENDARY RACES ────────────────────────────── */}
        <LoreSection
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1771649855/width_366_1_c6ajln.png"
          alt="Legendary races"
          label="Legendary Races"
          title="เผ่าพันธุ์ในตำนาน"
          reverse={true}
        >
          <P>
            ตำนานเก่ากล่าวว่า มนุษย์ไม่ได้เป็นเจ้าของโลกนี้แต่แรก
            ก่อนหน้ามนุษย์ ยังมีเผ่าพันธุ์ยักษ์ มังกร เอลฟ์ ผีดูดเลือด และอีกมากมาย
            แต่พวกเขาหายไปจนเหลือเพียงร่องรอยในตำนาน
          </P>
          <P>
            บางคนเชื่อว่าพวกเขาถูกทำลาย
            บางคนเชื่อว่าพวกเขายังคงอยู่ — เฝ้ามองมนุษย์จากที่ใดที่หนึ่ง
          </P>
          <Q>
            และบางคน… อาจสืบเชื้อสายมาจากพวกนั้นโดยไม่รู้ตัว
          </Q>
        </LoreSection>

        <Hr />

        {/* ── 7. PATH OF THE DIVINE ─────────────────────────── */}
        <LoreSection
          src="https://res.cloudinary.com/dehp6efwc/image/upload/v1770699103/darkness_euxpng.jpg"
          alt="Path of the Divine"
          label="Path of the Divine"
          title="เส้นทางแห่งเทพ"
          reverse={false}
        >
          <P>
            <strong style={{ color: '#c0b2a0', fontWeight: 500 }}>
              เส้นทางสู่การเป็นเทพ (Path of the Divine)
            </strong>
            {' '}คือชุดของสูตรโอสถทั้งหมด 9 ลำดับ ซึ่งเป็นกุญแจไขสู่พลังเหนือธรรมชาติและศาสตร์เร้นลับ
            เมื่อดื่มโอสถนั้นแล้ว พวกเขาจะก้าวเข้าสู่การเป็น ผู้วิเศษ (Beyonder) แห่งเส้นทางนั้นทันที
          </P>
          <P>
            บนโลกนี้ มี{' '}
            <strong style={{ color: '#c0b2a0', fontWeight: 500 }}>เส้นทางมาตรฐาน 22 เส้นทาง</strong>
            {' '}แต่ละเส้นทางประกอบด้วย 9 ลำดับ (Sequence)
            จากลำดับต่ำสุดคือ ลำดับที่ 9 ไปจนถึงลำดับชั้นสูงสุดคือ ลำดับที่ 1
          </P>
        </LoreSection>

        {/* dual artworks */}
        <Reveal style={{ marginTop: '1.5rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              marginBottom: '0.5rem',
            }}
          >
            {(
              [
                [
                  'https://res.cloudinary.com/dehp6efwc/image/upload/v1770699103/darkness_euxpng.jpg',
                  'Darkness',
                ],
                [
                  'https://res.cloudinary.com/dehp6efwc/image/upload/v1770703215/sun_seq_2_v2_oebsiv.jpg',
                  'Sun',
                ],
              ] as [string, string][]
            ).map(([src, alt]) => (
              <div
                key={alt}
                style={{
                  position: 'relative',
                  aspectRatio: '16/9',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <Image
                  src={src}
                  alt={alt}
                  fill
                  sizes="50vw"
                  style={{
                    objectFit: 'cover',
                    objectPosition: 'top',
                    opacity: 0.65,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(to bottom, transparent 40%, rgba(4,2,2,0.65) 100%)',
                  }}
                />
              </div>
            ))}
          </div>
        </Reveal>

        <Hr />

        {/* ── 8. PATHWAYS GRID ──────────────────────────────── */}
        <Reveal>
          <div style={{ marginBottom: '1.5rem' }}>
            <p
              style={{
                fontSize: 10,
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: '#6a2828',
                marginBottom: 8,
              }}
            >
              เลือกเส้นทางของคุณ
            </p>
            <h2
              style={{ fontSize: 20, fontWeight: 600, color: '#c8b8a0', marginBottom: 8 }}
            >
              เส้นทางแห่งผู้วิเศษ
            </h2>
            <p style={{ fontSize: 12.5, color: '#5a504a', lineHeight: 1.7 }}>
              คลิกที่การ์ดเพื่อดูรายละเอียด — แต่ละเส้นทางมีพลังและชะตากรรมที่แตกต่างกัน
            </p>
          </div>
        </Reveal>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 8,
            paddingBottom: '6rem',
          }}
        >
          {PATHWAYS.map((p, i) => (
            <PathwayCard key={p.id} p={p} index={i} onOpen={openLightbox} />
          ))}
        </div>
      </div>

      {/* LIGHTBOX */}
      {lightboxPathway && (
        <Lightbox p={lightboxPathway} onClose={closeLightbox} />
      )}
    </div>
  )
}
