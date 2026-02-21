import type { Metadata } from 'next'
import WorldClient from './_components/world-client'

export const metadata: Metadata = {
  title: 'World Setting — Whisper of the Shadow',
  description:
    'โลกแห่งศาสตร์เร้นลับ — เรื่องราว ประวัติ เส้นทางผู้วิเศษ',
}

export default function WorldSettingPage() {
  return <WorldClient />
}
