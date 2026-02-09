import type { Metadata, Viewport } from 'next'
import { Kanit } from 'next/font/google'
import './globals.css'

/* ── next/font: eliminates render-blocking @import ── */
const kanit = Kanit({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600'],
  display: 'swap',
  variable: '--font-kanit',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0F0D0A',
}

export const metadata: Metadata = {
  title: 'Whisper — DND 5e Campaign Table',
  description: 'A Victorian-styled online tabletop companion for DND 5e campaigns',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`dark ${kanit.variable}`}>
      <head>
        {/* Preconnect to Google Fonts for Uncial Antiqua (display font, non-critical) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Uncial Antiqua: loaded async (display font, not body text) */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Uncial+Antiqua&display=swap"
          media="print"
          // @ts-expect-error onLoad sets media to all after async load
          onLoad="this.media='all'"
        />
      </head>
      <body className={`min-h-screen ${kanit.className}`}>
        {children}
      </body>
    </html>
  )
}
