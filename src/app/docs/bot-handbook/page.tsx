import type { Metadata } from 'next'
import BotHandbookClient from './BotHandbookClient'

export const metadata: Metadata = {
  title: 'Discord Bot Handbook — Whisper of the Shadow',
  description: 'คู่มือการใช้งาน Discord Bot ของระบบ Whisper of the Shadow ทุก Command',
}

export default function BotHandbookPage() {
  return <BotHandbookClient />
}
