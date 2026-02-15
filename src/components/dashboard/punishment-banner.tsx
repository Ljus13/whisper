'use client'

import { getPlayerActivePunishments } from '@/app/actions/action-quest'
import { Skull, Eye, X, Clock } from 'lucide-react'
import { useState, useEffect } from 'react'

function fmtDate(d: string) {
  const x = new Date(d)
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()} ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`
}

/* ═══════════════════ Modal Overlay ═══════════════════ */
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-victorian-900 border border-gold-400/20 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 space-y-5"
        onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

export default function PunishmentBanner() {
  const [punishments, setPunishments] = useState<any[]>([])
  const [detail, setDetail] = useState<any | null>(null)

  useEffect(() => {
    getPlayerActivePunishments().then(r => setPunishments(r)).catch(() => {})
  }, [])

  if (punishments.length === 0) return null

  return (
    <>
      <div className="max-w-screen-2xl mx-auto px-4 md:px-8 pt-4">
        <div className="rounded-xl border-2 border-red-500/50 bg-gradient-to-r from-red-950/80 via-red-900/60 to-red-950/80 p-4 md:p-5 space-y-3 animate-pulse-slow shadow-lg shadow-red-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
              <Skull className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-red-300 font-bold text-base md:text-lg">⚠️ คุณกำลังอยู่ในบทลงโทษ!</h3>
              <p className="text-red-400/80 text-xs mt-0.5">
                มี {punishments.length} บทลงโทษที่ต้องดำเนินการ — ทำภารกิจให้ครบเพื่อขอเทพเมตตา
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {punishments.map((pun: any) => (
              <div key={pun.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-red-950/60 border border-red-500/30">
                <div className="flex-1 min-w-0">
                  <p className="text-red-200 text-sm font-semibold truncate">{pun.name}</p>
                  {pun.deadline && (
                    <p className="text-red-400/70 text-[10px] mt-0.5">⏰ กำหนด: {fmtDate(pun.deadline)}</p>
                  )}
                </div>
                <button type="button" onClick={() => setDetail(pun)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 text-xs font-bold cursor-pointer transition-colors">
                  <Eye className="w-3.5 h-3.5" /> ดูรายละเอียด
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {detail && (
        <Modal onClose={() => setDetail(null)}>
          <div className="flex items-center justify-between">
            <h3 className="heading-victorian text-xl flex items-center gap-3 text-red-400">
              <Skull className="w-5 h-5" /> รายละเอียดบทลงโทษ
            </h3>
            <button type="button" onClick={() => setDetail(null)} className="text-victorian-400 hover:text-gold-400 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>

          <div className="p-5 bg-red-950/60 border-2 border-red-500/40 rounded-xl space-y-4">
            <div>
              <h4 className="text-red-200 font-bold text-lg">{detail.name}</h4>
              {detail.description && (
                <p className="text-red-300/80 text-sm mt-1 whitespace-pre-wrap">{detail.description}</p>
              )}
            </div>

            {detail.deadline && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <Clock className="w-4 h-4" />
                <span>กำหนดเสร็จ: <strong>{fmtDate(detail.deadline)}</strong></span>
              </div>
            )}

            {/* Penalties */}
            <div className="border-t border-red-500/20 pt-3">
              <p className="text-red-400 text-xs font-bold mb-2">⚡ บทลงโทษหากไม่ทำสำเร็จ:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {detail.penalty_sanity !== 0 && (
                  <div className="bg-red-900/40 rounded px-2 py-1.5 border border-red-500/20">
                    <span className="text-red-400">🧠 Sanity</span>
                    <span className="text-red-200 font-bold ml-1">{detail.penalty_sanity}</span>
                  </div>
                )}
                {detail.penalty_hp !== 0 && (
                  <div className="bg-red-900/40 rounded px-2 py-1.5 border border-red-500/20">
                    <span className="text-red-400">❤️ HP</span>
                    <span className="text-red-200 font-bold ml-1">{detail.penalty_hp}</span>
                  </div>
                )}
                {detail.penalty_travel !== 0 && (
                  <div className="bg-red-900/40 rounded px-2 py-1.5 border border-red-500/20">
                    <span className="text-red-400">🚶 Travel</span>
                    <span className="text-red-200 font-bold ml-1">{detail.penalty_travel}</span>
                  </div>
                )}
                {detail.penalty_spirituality !== 0 && (
                  <div className="bg-red-900/40 rounded px-2 py-1.5 border border-red-500/20">
                    <span className="text-red-400">✨ Spirituality</span>
                    <span className="text-red-200 font-bold ml-1">{detail.penalty_spirituality}</span>
                  </div>
                )}
                {detail.penalty_max_sanity !== 0 && (
                  <div className="bg-red-900/40 rounded px-2 py-1.5 border border-red-500/20">
                    <span className="text-red-400">🧠 Max Sanity</span>
                    <span className="text-red-200 font-bold ml-1">{detail.penalty_max_sanity}</span>
                  </div>
                )}
                {detail.penalty_max_travel !== 0 && (
                  <div className="bg-red-900/40 rounded px-2 py-1.5 border border-red-500/20">
                    <span className="text-red-400">🚶 Max Travel</span>
                    <span className="text-red-200 font-bold ml-1">{detail.penalty_max_travel}</span>
                  </div>
                )}
                {detail.penalty_max_spirituality !== 0 && (
                  <div className="bg-red-900/40 rounded px-2 py-1.5 border border-red-500/20">
                    <span className="text-red-400">✨ Max Spirituality</span>
                    <span className="text-red-200 font-bold ml-1">{detail.penalty_max_spirituality}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Required tasks */}
            {detail.required_tasks && detail.required_tasks.length > 0 && (
              <div className="border-t border-red-500/20 pt-3">
                <p className="text-red-400 text-xs font-bold mb-2">📋 ภารกิจที่ต้องทำ:</p>
                <div className="space-y-1.5">
                  {detail.required_tasks.map((task: any) => (
                    <div key={task.id} className="flex items-center gap-2 bg-red-900/30 rounded px-3 py-2 border border-red-500/15">
                      {task.action_name ? (
                        <>
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30 font-bold">ACTION</span>
                          <span className="text-red-200 text-xs">{task.action_name}</span>
                          <span className="text-victorian-500 text-[10px] font-mono">({task.action_code_str})</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30 font-bold">QUEST</span>
                          <span className="text-red-200 text-xs">{task.quest_name}</span>
                          <span className="text-victorian-500 text-[10px] font-mono">({task.quest_code_str})</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={() => setDetail(null)} className="btn-victorian px-6 py-2 text-sm cursor-pointer">ปิด</button>
          </div>
        </Modal>
      )}
    </>
  )
}
