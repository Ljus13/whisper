import WorldClient from '@/app/world-setting/_components/world-client'

export const metadata = {
  title: 'World Setting — Whisper of the Shadow',
  robots: { index: false },
}

export default function EmbedWorldSettingPage() {
  return <WorldClient hideNav />
}
