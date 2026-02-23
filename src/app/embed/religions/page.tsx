import ReligionsClient from '@/app/docs/religions/ReligionsClient'

export const metadata = {
  title: 'ศาสนาจารีตทั้ง 7 — Whisper of the Shadow',
  robots: { index: false },
}

export default function EmbedReligionsPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: '#070604', fontFamily: 'var(--font-kanit), Kanit, sans-serif' }}
    >
      <div className="max-w-5xl mx-auto px-4 py-8">
        <ReligionsClient />
      </div>
    </div>
  )
}
