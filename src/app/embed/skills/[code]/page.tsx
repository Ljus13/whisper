import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 300

type SkillEmbedLog = {
  player_id: string
  player_name: string | null
  player_avatar: string | null
  skill_id: string
  skill_name: string | null
  used_at: string
  reference_code: string | null
  note: string | null
  outcome: string | null
  roll: number | null
  success_rate: number | null
}

function parseReferenceCode(code: string) {
  const match = code.match(/^SKL-([A-Z0-9]+)-(\d{8})-T(\d{1,2})-R(\d{1,2})-([SF])$/)
  if (!match) return null
  const [, , dateStr, rateStr, rollStr, outcome] = match
  const successRate = parseInt(rateStr, 10)
  const roll = parseInt(rollStr, 10)
  const yyyy = dateStr.slice(4, 8)
  const mm = dateStr.slice(2, 4)
  const dd = dateStr.slice(0, 2)
  return {
    successRate,
    roll,
    outcome: outcome === 'S' ? 'success' : 'fail',
    dateLabel: `${dd}/${mm}/${yyyy}`
  }
}

export default async function SkillEmbedPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const referenceCode = decodeURIComponent(code)
  const supabase = await createClient()

  const { data: log } = await supabase
    .rpc('get_skill_embed_log', { p_reference_code: referenceCode })
    .single() as { data: SkillEmbedLog | null }

  if (!log) notFound()

  const skillName = log.skill_name || 'ไม่ทราบสกิล'
  const playerName = log.player_name || 'ผู้เล่น'

  const outcomeFromLog = log.outcome
    ? {
        outcome: log.outcome,
        roll: log.roll ?? null,
        successRate: log.success_rate ?? null,
        dateLabel: new Date(log.used_at).toLocaleDateString('th-TH')
      }
    : null

  const outcome = outcomeFromLog || parseReferenceCode(referenceCode)
  const successLabel = outcome
    ? outcome.outcome === 'success' ? 'สำเร็จ' : 'ไม่สำเร็จ'
    : 'ไม่ทราบผล'

  return (
    <div className="min-h-[60px] bg-[#0e0b08] flex items-center justify-center p-2">
      <div className="w-[560px] h-[60px] max-w-full rounded-lg border border-gold-400/20 bg-victorian-950/90 px-4 py-2 text-[12px] text-victorian-200 flex items-center gap-3 overflow-hidden">
        {log.player_avatar ? (
          <img
            src={log.player_avatar}
            alt={playerName}
            className="w-9 h-9 rounded-full border border-gold-400/20 object-cover"
          />
        ) : (
          <div className="w-9 h-9 rounded-full border border-gold-400/20 bg-victorian-900/60 flex items-center justify-center text-gold-300">
            <span className="text-sm">✦</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-gold-300 font-semibold truncate">{playerName}</span>
            <span className="text-victorian-500">•</span>
            <span className="text-victorian-200 truncate">{skillName}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-victorian-500 min-w-0">
            <span className="truncate">{referenceCode}</span>
            {log.note && <span className="truncate">| {log.note}</span>}
          </div>
        </div>
        <div
          className={`shrink-0 px-2 py-1 rounded border text-[11px] ${
            outcome?.outcome === 'success'
              ? 'border-green-400/40 bg-green-500/10 text-green-200'
              : outcome
                ? 'border-red-400/40 bg-red-500/10 text-red-200'
                : 'border-gold-400/30 bg-victorian-900/70 text-victorian-200'
          }`}
        >
          ผล: {successLabel}
        </div>
      </div>
    </div>
  )
}
