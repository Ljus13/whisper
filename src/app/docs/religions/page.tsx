import type { Metadata } from 'next'
import ReligionsClient from './ReligionsClient'

export const metadata: Metadata = {
  title: 'ศาสนาจารีตทั้ง 7 — Whisper of the Shadow',
  description: 'ข้อมูลศาสนาทั้ง 7 ที่เป็นที่ยอมรับในทวีป — หลักคำสอน จารีต และเทพเจ้าของแต่ละศาสนา',
}

export default function ReligionsPage() {
  return <ReligionsClient />
}
