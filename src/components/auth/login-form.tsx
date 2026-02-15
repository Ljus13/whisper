'use client'

import { signInWithGoogle, signInWithDiscord } from '@/app/actions/auth'
import { useEffect, useState } from 'react'

/* ── SVG Icons ── */
function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function DiscordIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z"/>
    </svg>
  )
}

/* ── Art Nouveau Corner Ornament ── */
function CornerOrnament({ className }: { className?: string }) {
  return (
    <svg className={className} width="60" height="60" viewBox="0 0 60 60" fill="none">
      <path
        d="M2 58V20C2 10 10 2 20 2H58"
        stroke="url(#gold-grad)"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M8 58V26C8 16 16 8 26 8H58"
        stroke="url(#gold-grad)"
        strokeWidth="0.5"
        opacity="0.4"
        fill="none"
      />
      <circle cx="20" cy="20" r="2" fill="#D4AF37" opacity="0.6"/>
      <defs>
        <linearGradient id="gold-grad" x1="2" y1="58" x2="58" y2="2">
          <stop stopColor="#D4AF37" stopOpacity="0.8"/>
          <stop offset="1" stopColor="#C5A55A" stopOpacity="0.2"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function LoginForm() {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [policyOpen, setPolicyOpen] = useState(true)
  const [policyAccepted, setPolicyAccepted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('privacyConsentAccepted')
    if (stored === 'true') {
      setPolicyAccepted(true)
      setPolicyOpen(false)
    }
  }, [])

  async function handleGoogleLogin() {
    setLoading('google')
    setError(null)
    try {
      const result = await signInWithGoogle()
      if (result?.error) setError(result.error)
    } catch {
      setError('Failed to sign in with Google')
    } finally {
      setLoading(null)
    }
  }

  async function handleDiscordLogin() {
    setLoading('discord')
    setError(null)
    try {
      const result = await signInWithDiscord()
      if (result?.error) setError(result.error)
    } catch {
      setError('Failed to sign in with Discord')
    } finally {
      setLoading(null)
    }
  }

  function handleAcceptPolicy() {
    localStorage.setItem('privacyConsentAccepted', 'true')
    setPolicyAccepted(true)
    setPolicyOpen(false)
  }

  const canLogin = policyAccepted && !policyOpen

  return (
    <>
    {policyOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
        <div className="w-full max-w-3xl rounded-xl border-2 border-gold-400/20 bg-victorian-950 p-5 md:p-8 space-y-4 max-h-[90vh] overflow-y-auto">
          <div className="text-center space-y-1">
            <h2 className="heading-victorian text-xl md:text-2xl text-gold-300">ประกาศนโยบายความเป็นส่วนตัวและข้อตกลงการใช้งาน</h2>
            <p className="text-victorian-400 text-xs md:text-sm">Privacy Notice & Terms of Service</p>
          </div>
          <div className="space-y-3 text-victorian-200 text-sm leading-relaxed">
            <p>โปรดอ่านและยอมรับเงื่อนไขก่อนเข้าสู่ระบบกิจกรรม:</p>
            <div className="space-y-2">
              <p><span className="text-gold-300 font-semibold">1. มาตรฐานการยืนยันตัวตนและความปลอดภัย (Authentication Security)</span><br />
                เว็บไซต์นี้ใช้โปรโตคอล OAuth 2.0 มาตรฐานสากลผ่าน Google และ Discord เท่านั้น กระบวนการยืนยันตัวตนจะเกิดขึ้นบนแพลตฟอร์มต้นทางโดยตรง ทางระบบจะไม่มีการรับรู้ เห็น หรือจัดเก็บรหัสผ่านของผู้ใช้งานในทุกกรณี (Zero-Password Access) ข้อมูลที่ได้รับจะมีเพียง Access Token ที่ถูกเข้ารหัสเพื่อใช้ยืนยันสถานะความเป็นเจ้าของบัญชีชั่วคราวเท่านั้น
              </p>
              <p><span className="text-gold-300 font-semibold">2. การคุ้มครองข้อมูลส่วนบุคคล (PDPA Compliance)</span><br />
                ระบบยึดหลักการจัดเก็บข้อมูลน้อยที่สุด (Data Minimization) โดยไม่มีการจัดเก็บข้อมูลส่วนบุคคลใดๆ ลงในฐานข้อมูลถาวร ข้อมูลพื้นฐานที่จำเป็นจะถูกเรียกใช้แบบ Real-time เพื่อสร้าง Session ในการเล่นกิจกรรมและจะถูกทำลายทันทีเมื่อสิ้นสุดการใช้งาน
              </p>
              <p><span className="text-gold-300 font-semibold">3. การประมวลผลและการใช้คุกกี้ (Technical Processing)</span><br />
                เว็บไซต์นี้ไม่มีการใช้คุกกี้ (No Cookies) เพื่อการติดตามหรือเก็บข้อมูลระบุตัวตน การทำงานทั้งหมดของระบบประมวลผลผ่าน JavaScript บนอุปกรณ์ของผู้ใช้งานโดยตรง (Client-Side Processing) เพื่อความปลอดภัยสูงสุดของข้อมูล
              </p>
              <p><span className="text-gold-300 font-semibold">4. สิทธิ์ในการควบคุมและตัดการเชื่อมต่อ (User Control & Revocation)</span><br />
                ผู้ใช้งานมีสิทธิ์ในการควบคุมข้อมูลของตนเองอย่างสมบูรณ์ ท่านสามารถดำเนินการยกเลิกสิทธิ์การเข้าถึง (Revoke Access) และตัดการเชื่อมต่อกับแอปพลิเคชันนี้ได้ด้วยตนเองตลอดเวลา ผ่านหน้าการตั้งค่าความปลอดภัย (Security Settings) ของบัญชี Google หรือ Discord ของท่าน ซึ่งจะส่งผลให้ Token ทั้งหมดที่ใช้ในเซสชันนี้เป็นโมฆะทันที
              </p>
              <p><span className="text-gold-300 font-semibold">5. การให้ความยินยอม (Explicit Consent)</span><br />
                การกด “ยอมรับ” และเข้าสู่ระบบ ถือว่าท่านได้รับทราบ เข้าใจ และยินยอมให้ระบบใช้ Token ในการยืนยันตัวตนตามขอบเขตที่ระบุไว้ข้างต้นอย่างชัดเจน
              </p>
              <p><span className="text-gold-300 font-semibold">6. การติดต่อสอบถาม (Contact)</span><br />
                หากต้องการสอบถามหรือร้องเรียนเกี่ยวกับข้อมูลส่วนบุคคล สามารถติดต่อผู้ดูแลระบบผ่านช่องทางที่ทีมงานกำหนดในกิจกรรมนี้
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2">
            <button type="button" onClick={handleAcceptPolicy} className="btn-gold !px-6 !py-2 !text-sm">ยอมรับและดำเนินการต่อ</button>
          </div>
        </div>
      </div>
    )}
    <div className="card-victorian max-w-md w-full mx-4 relative overflow-hidden">
      {/* Corner ornaments */}
      <CornerOrnament className="absolute top-0 left-0" />
      <CornerOrnament className="absolute top-0 right-0 -scale-x-100" />
      <CornerOrnament className="absolute bottom-0 left-0 -scale-y-100" />
      <CornerOrnament className="absolute bottom-0 right-0 scale-x-[-1] scale-y-[-1]" />

      <div className="relative z-10 px-4 py-8 sm:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          {/* Logo / D20 symbol */}
          <div className="inline-flex items-center justify-center w-24 h-24 mb-6
                          border border-gold-400/30 rounded-full
                          bg-victorian-800/50 shadow-gold">
            <span className="text-4xl text-gold-400 font-display">⚜</span>
          </div>

          <h1 className="heading-victorian text-4xl mb-4 md:text-6xl">
            Whisper
          </h1>
          <p className="text-victorian-300 font-body text-lg tracking-wide md:text-xl">
            เข้าสู่ดินแดนแห่งการผจญภัย
          </p>
        </div>

        <div className="ornament-divider !my-6" />

        {/* Error message */}
        {error && (
          <div className="mb-4 p-4 rounded-sm bg-nouveau-ruby/10 border border-nouveau-ruby/30 
                          text-nouveau-cream/80 text-base text-center font-body">
            {error}
          </div>
        )}

        {/* OAuth Buttons */}
        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading !== null || !canLogin}
            className="btn-victorian w-full"
          >
            {loading === 'google' ? (
              <span className="w-5 h-5 border-2 border-gold-400/30 border-t-gold-400 
                               rounded-full animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            <span>เข้าสู่ระบบด้วย Google</span>
          </button>

          <button
            onClick={handleDiscordLogin}
            disabled={loading !== null || !canLogin}
            className="btn-victorian w-full"
          >
            {loading === 'discord' ? (
              <span className="w-5 h-5 border-2 border-gold-400/30 border-t-gold-400 
                               rounded-full animate-spin" />
            ) : (
              <DiscordIcon />
            )}
            <span>เข้าสู่ระบบด้วย Discord</span>
          </button>
        </div>

        <div className="ornament-divider !my-6" />
        {!canLogin && (
          <p className="text-center text-victorian-500 text-xs">กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนเข้าสู่ระบบ</p>
        )}

        {/* Footer text */}
        <p className="text-center text-victorian-500 text-sm font-body tracking-wide">
          การเดินทางเริ่มต้นที่นี่
          <br />
          <span className="text-gold-400/40">ขอให้ลูกเต๋าเข้าข้างคุณ</span>
        </p>
      </div>
    </div>
    </>
  )
}
