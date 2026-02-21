import type { Metadata } from 'next'
import HandbookClient from './HandbookClient'

export const metadata: Metadata = {
  title: 'System Handbook — Whisper of the Shadow',
  description: 'คู่มือการใช้งานระบบ Whisper of the Shadow ฉบับสมบูรณ์ — ครอบคลุมทุกฟังก์ชั่นสำหรับผู้เล่น',
}

export default function SystemHandbookPage() {
  return <HandbookClient />
}
