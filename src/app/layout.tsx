import type { Metadata, Viewport } from 'next'
import { Kanit, Uncial_Antiqua } from 'next/font/google'
import './globals.css'

/* ── next/font: eliminates render-blocking @import ── */
const kanit = Kanit({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600'],
  display: 'swap',
  variable: '--font-kanit',
})
const uncialAntiqua = Uncial_Antiqua({
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
  variable: '--font-uncial-antiqua',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0F0D0A',
}

export const metadata: Metadata = {
  title: 'Whisper of the Shadow',
  description: 'ระบบควบคุมการโรลเพลย์ โลกแห่งศาสตร์เร้นรับ',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`dark ${kanit.variable} ${uncialAntiqua.variable}`}>
      <body className={`min-h-screen ${kanit.className}`}>
        {children}
      </body>
    </html>
  )
}
