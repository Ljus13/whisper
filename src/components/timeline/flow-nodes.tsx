'use client'

import { memo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Calendar, Pencil, Eye, EyeOff, Plus, Trash2, ChevronDown, X, AlertCircle, Users, Shield, Lock } from 'lucide-react'
import type { TimelineEntry, SideStory, SubStory, EventPunishment, StoryStatus } from './timeline-view'

// Hidden handle style — topology only, not user-drawn
const HH: React.CSSProperties = {
  opacity: 0, width: 4, height: 4,
  border: 'none', background: 'transparent', minWidth: 0, minHeight: 0,
}

function fmtDate(d: string | null) {
  if (!d) return null
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function DateRange({ s, e, xs }: { s: string | null; e: string | null; xs?: boolean }) {
  if (!s && !e) return null
  return (
    <div className={`flex items-center gap-1 text-victorian-400 mb-1.5 ${xs ? 'text-[9px]' : 'text-[11px]'}`}>
      <Calendar className={xs ? 'w-2 h-2 shrink-0' : 'w-3 h-3 shrink-0'} />
      <span>{fmtDate(s) ?? '?'}{e ? ` – ${fmtDate(e)}` : ''}</span>
    </div>
  )
}

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  running: { label: 'กำลังดำเนิน', glow: '0 0 18px rgba(234,179,8,0.5)',  textClass: 'text-yellow-300', bgClass: 'bg-yellow-900/50 border border-yellow-500/40' },
  end:     { label: 'จบแล้ว',      glow: '0 0 18px rgba(34,197,94,0.5)',   textClass: 'text-green-300',  bgClass: 'bg-green-900/50 border border-green-500/40'  },
  failed:  { label: 'ล้มเหลว',     glow: '0 0 18px rgba(239,68,68,0.5)',   textClass: 'text-red-300',    bgClass: 'bg-red-900/50 border border-red-500/40'    },
} as const

function StatusBadge({ status, xs }: { status: StoryStatus; xs?: boolean }) {
  if (!status) return null
  const cfg = STATUS_CFG[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
      xs ? 'text-[9px]' : 'text-[10px]'
    } ${cfg.textClass} ${cfg.bgClass} mb-1.5`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />{cfg.label}
    </span>
  )
}

function getStatusGlow(status: StoryStatus): string {
  if (!status) return ''
  return STATUS_CFG[status].glow
}

// ── Detail Popup (borderless, rounded) ─────────────────────────────────────────
function DetailPopup({ title, description, fullDetail, goal, imageUrl, startedAt, endedAt, moderators, participants, accentClass, onClose }: {
  title: string
  description?: string | null
  fullDetail?: string | null
  goal?: string | null
  imageUrl?: string | null
  startedAt?: string | null
  endedAt?: string | null
  moderators?: { id: string; display_name: string | null; avatar_url: string | null }[]
  participants?: { id: string; display_name: string | null; avatar_url: string | null }[]
  accentClass: string
  onClose: () => void
}) {
  const content = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl bg-victorian-900/95 shadow-2xl animate-fade-in custom-scrollbar"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-victorian-800/80 text-victorian-400 hover:text-victorian-200 hover:bg-victorian-700 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Image */}
        {imageUrl && (
          <div className="aspect-video overflow-hidden rounded-t-2xl">
            <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-5">
          {goal && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs ${accentClass} mb-3`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />{goal}
            </span>
          )}
          <DateRange s={startedAt ?? null} e={endedAt ?? null} />
          <h3 className="font-display text-xl text-gold-200 mb-3">{title}</h3>

          {description && (
            <p className="text-victorian-300 text-sm leading-relaxed mb-3">{description}</p>
          )}

          {fullDetail && (
            <div className="pt-3 border-t border-gold-700/20 text-victorian-300 text-sm whitespace-pre-wrap leading-relaxed">
              {fullDetail}
            </div>
          )}

          {/* Moderators */}
          {moderators && moderators.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gold-700/20">
              <div className="flex items-center gap-1.5 text-xs text-victorian-400 mb-2">
                <Shield className="w-3 h-3" /> ผู้ดำเนินเหตุการณ์
              </div>
              <div className="flex flex-wrap gap-1.5">
                {moderators.map(m => (
                  <span key={m.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-nouveau-sapphire/20 text-blue-300">
                    {m.avatar_url && <img src={m.avatar_url} className="w-3.5 h-3.5 rounded-full" alt="" />}
                    {m.display_name || 'ไม่ระบุชื่อ'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Participants */}
          {participants && participants.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gold-700/20">
              <div className="flex items-center gap-1.5 text-xs text-victorian-400 mb-2">
                <Users className="w-3 h-3" /> ผู้ร่วมเหตุการณ์
              </div>
              <div className="flex flex-wrap gap-1.5">
                {participants.map(p => (
                  <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-nouveau-emerald/20 text-emerald-300">
                    {p.avatar_url && <img src={p.avatar_url} className="w-3.5 h-3.5 rounded-full" alt="" />}
                    {p.display_name || 'ไม่ระบุชื่อ'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}

// ── Locked Box (shown to non-admins for unpublished items) ────────────────────
function LockedBox({ width, height, accent }: { width: number; height: number; accent: 'gold' | 'sapphire' | 'emerald' }) {
  const styles = {
    gold:     { outer: 'border border-gold-700/50 bg-victorian-950',  ring: 'border border-gold-700/50',     icon: 'text-gold-500/60',    text: 'text-gold-600/50' },
    sapphire: { outer: 'bg-blue-950/85',                               ring: 'border border-blue-800/40',     icon: 'text-blue-500/60',    text: 'text-blue-400/50' },
    emerald:  { outer: 'bg-emerald-950/85',                            ring: 'border border-emerald-800/40',  icon: 'text-emerald-500/60', text: 'text-emerald-400/50' },
  }[accent]
  const iconSz = Math.round(width * 0.14)
  return (
    <div
      className={`nodrag nopan rounded-xl ${styles.outer} flex flex-col items-center justify-center gap-3`}
      style={{ width, height, cursor: 'default' }}
    >
      {/* lock icon ring */}
      <div className={`rounded-full ${styles.ring} p-3 bg-victorian-900/60`}>
        <Lock className={styles.icon} style={{ width: iconSz, height: iconSz }} />
      </div>
      <p className={`${styles.text} text-[11px] text-center px-4 leading-relaxed`}>
        เนื้อหายังไม่เปิดเผย
      </p>
    </div>
  )
}

// ── Main Entry Node ────────────────────────────────────────────────────────────
export type MainNodeData = {
  entry: TimelineEntry
  isAdmin: boolean
  onEdit: () => void
  onDelete: () => void
  onTogglePublish: (v: boolean) => void
  onAddSideStory: () => void
}

function MainEntryNode({ data }: NodeProps) {
  const { entry, isAdmin, onEdit, onDelete, onTogglePublish, onAddSideStory } =
    data as unknown as MainNodeData
  const [showPopup, setShowPopup] = useState(false)

  const hasImage = !!entry.image_url

  // Non-admin view for unpublished entries
  if (!isAdmin && !entry.is_published) {
    return (
      <>
        <Handle type="target" id="top"    position={Position.Top}    style={HH} />
        <Handle type="source" id="right"  position={Position.Right}  style={HH} />
        <Handle type="source" id="left"   position={Position.Left}   style={HH} />
        <Handle type="source" id="bottom" position={Position.Bottom} style={HH} />
        <LockedBox width={360} height={hasImage ? 460 : 280} accent="gold" />
      </>
    )
  }

  return (
    <>
      <Handle type="target" id="top"    position={Position.Top}    style={HH} />
      <Handle type="source" id="right"  position={Position.Right}  style={HH} />
      <Handle type="source" id="left"   position={Position.Left}   style={HH} />
      <Handle type="source" id="bottom" position={Position.Bottom} style={HH} />

      <div className="nodrag nopan w-[360px] rounded-xl border border-gold-700/50 bg-victorian-900/90 backdrop-blur-sm overflow-hidden transition-shadow cursor-default"
        style={{ height: hasImage ? 460 : 280, boxShadow: getStatusGlow(entry.status) || '0 0 20px rgba(184,134,11,0.12)' }}
      >
        {isAdmin && !entry.is_published && (
          <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded text-[10px] bg-red-900/60 text-red-300 border border-red-500/30">ซ่อน</div>
        )}
        {entry.image_url && (
          <div className="relative h-[200px] overflow-hidden">
            <img src={entry.image_url} alt={entry.title} className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-victorian-900/80 to-transparent" />
          </div>
        )}
        <div className={`p-4 overflow-y-auto custom-scrollbar ${hasImage ? 'max-h-[240px]' : 'max-h-[260px]'}`}>
          {entry.goal && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-gold-900/40 text-gold-300 border border-gold-700/30 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />{entry.goal}
            </span>
          )}
          <StatusBadge status={entry.status} />
          <DateRange s={entry.started_at} e={entry.ended_at} />
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gold-900/60 border border-gold-700/40 text-gold-400 text-xs font-bold shrink-0">{entry.sort_order}</span>
            <h3 className="font-display text-xl text-gold-200 leading-tight">{entry.title}</h3>
          </div>
          {entry.description && (
            <p className="text-victorian-300 text-sm leading-relaxed mb-2 line-clamp-3">{entry.description}</p>
          )}
          {(entry.full_detail || entry.description) && (
            <button
              onClick={() => setShowPopup(true)}
              onPointerDown={e => e.stopPropagation()}
              className="nodrag nopan flex items-center gap-1 text-xs text-gold-400/60 hover:text-gold-300 transition cursor-pointer"
            >
              ดูเพิ่มเติม <ChevronDown className="w-3 h-3" />
            </button>
          )}
          {isAdmin && (
            <div className="mt-3 pt-3 border-t border-gold-700/20 flex items-center gap-2 flex-wrap">
              <button onClick={onEdit} onPointerDown={e => e.stopPropagation()} className="nodrag nopan p-1.5 rounded text-gold-300 bg-victorian-800 border border-gold-700/20 hover:bg-victorian-700 transition cursor-pointer" title="แก้ไข">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onTogglePublish(!entry.is_published)} onPointerDown={e => e.stopPropagation()} className="nodrag nopan p-1.5 rounded text-gold-300 bg-victorian-800 border border-gold-700/20 hover:bg-victorian-700 transition cursor-pointer">
                {entry.is_published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button onClick={onAddSideStory} onPointerDown={e => e.stopPropagation()} className="nodrag nopan p-1.5 rounded text-blue-300 bg-victorian-800 border border-nouveau-sapphire/20 hover:bg-victorian-700 transition cursor-pointer" title="เพิ่ม Side Story">
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button onClick={onDelete} onPointerDown={e => e.stopPropagation()} className="nodrag nopan p-1.5 rounded text-red-400 bg-red-900/30 border border-red-500/20 hover:bg-red-900/50 transition ml-auto cursor-pointer" title="ลบ">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {showPopup && (
        <DetailPopup
          title={entry.title}
          description={entry.description}
          fullDetail={entry.full_detail}
          goal={entry.goal}
          imageUrl={entry.image_url}
          startedAt={entry.started_at}
          endedAt={entry.ended_at}
          accentClass="bg-gold-900/40 text-gold-300 border border-gold-700/30"
          onClose={() => setShowPopup(false)}
        />
      )}
    </>
  )
}

// ── Side Story Node ────────────────────────────────────────────────────────────
export type SideNodeData = {
  side: SideStory
  isAdmin: boolean
  onEdit: () => void
  onDelete: () => void
  onTogglePublish: (v: boolean) => void
  onAddSubStory: () => void
}

function SideFlowNode({ data }: NodeProps) {
  const { side, isAdmin, onEdit, onDelete, onTogglePublish, onAddSubStory } =
    data as unknown as SideNodeData
  const [showPopup, setShowPopup] = useState(false)

  const hasImage = !!side.image_url

  // Non-admin view for unpublished side stories
  if (!isAdmin && !side.is_published) {
    return (
      <>
        <Handle type="target" id="left"   position={Position.Left}   style={HH} />
        <Handle type="target" id="right"  position={Position.Right}  style={HH} />
        <Handle type="target" id="top"    position={Position.Top}    style={HH} />
        <Handle type="source" id="bottom" position={Position.Bottom} style={HH} />
        <LockedBox width={224} height={hasImage ? 340 : 200} accent="sapphire" />
      </>
    )
  }

  return (
    <>
      <Handle type="target" id="left"   position={Position.Left}   style={HH} />
      <Handle type="target" id="right"  position={Position.Right}  style={HH} />
      <Handle type="target" id="top"    position={Position.Top}    style={HH} />
      <Handle type="source" id="bottom" position={Position.Bottom} style={HH} />

      <div className="w-[224px] rounded-xl bg-blue-950/80 backdrop-blur-sm overflow-hidden transition-shadow"
        style={{ height: hasImage ? 340 : 200, boxShadow: getStatusGlow(side.status) || undefined }}
      >
        {isAdmin && !side.is_published && (
          <div className="absolute top-1 right-1 z-10 px-1.5 py-0.5 rounded text-[10px] bg-red-900/60 text-red-300 border border-red-500/30">ซ่อน</div>
        )}
        {side.image_url && (
          <div className="h-[140px] overflow-hidden">
            <img src={side.image_url} alt={side.title} className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-victorian-900/95 to-transparent" />
          </div>
        )}
        <div className={`p-3 overflow-y-auto custom-scrollbar ${hasImage ? 'max-h-[180px]' : 'max-h-[180px]'}`}>
          {side.goal && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-nouveau-sapphire/30 text-blue-300 mb-2">
              <span className="w-1 h-1 rounded-full bg-current animate-pulse" />{side.goal}
            </div>
          )}
          <StatusBadge status={side.status} xs />
          <DateRange s={side.started_at} e={side.ended_at} xs />
          <div className="flex items-center gap-1.5 mb-1">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-900/60 text-blue-300 text-[9px] font-bold shrink-0">{side.sort_order}</span>
            <h4 className="font-display text-sm text-blue-200 leading-tight">{side.title}</h4>
          </div>
          {side.description && (
            <p className="text-victorian-300 text-xs leading-relaxed line-clamp-2">{side.description}</p>
          )}

          {/* Moderators & Participants badges */}
          {((side as any).moderators?.length > 0 || (side as any).participants?.length > 0) && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[9px] text-victorian-500">
              {(side as any).moderators?.length > 0 && (
                <span className="flex items-center gap-0.5"><Shield className="w-2.5 h-2.5" />{(side as any).moderators.length}</span>
              )}
              {(side as any).participants?.length > 0 && (
                <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{(side as any).participants.length}</span>
              )}
            </div>
          )}

          {(side.full_detail || side.description) && (
            <button
              onClick={() => setShowPopup(true)}
              onPointerDown={e => e.stopPropagation()}
              className="nodrag nopan mt-2 flex items-center gap-1 text-[10px] text-blue-300/60 hover:text-blue-300 transition cursor-pointer"
            >
              ดูเพิ่มเติม <ChevronDown className="w-2.5 h-2.5" />
            </button>
          )}
          {isAdmin && (
            <div className="mt-3 pt-2 border-t border-nouveau-sapphire/20 flex items-center gap-1.5 flex-wrap">
              <button onClick={onEdit} onPointerDown={e => e.stopPropagation()} className="nodrag nopan p-1.5 rounded text-blue-300 bg-victorian-800/80 border border-nouveau-sapphire/20 hover:bg-victorian-700/80 transition cursor-pointer"><Pencil className="w-3 h-3" /></button>
              <button onClick={() => onTogglePublish(!side.is_published)} onPointerDown={e => e.stopPropagation()} className="nodrag nopan p-1.5 rounded text-blue-300 bg-victorian-800/80 border border-nouveau-sapphire/20 hover:bg-victorian-700/80 transition cursor-pointer">
                {side.is_published ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
              <button onClick={onAddSubStory} onPointerDown={e => e.stopPropagation()} className="nodrag nopan p-1.5 rounded text-emerald-300 bg-victorian-800/80 border border-nouveau-emerald/20 hover:bg-victorian-700/80 transition cursor-pointer"><Plus className="w-3 h-3" /></button>
              <button onClick={onDelete} onPointerDown={e => e.stopPropagation()} className="nodrag nopan p-1.5 rounded text-red-400 bg-red-900/30 border border-red-500/20 hover:bg-red-900/50 transition ml-auto cursor-pointer"><Trash2 className="w-3 h-3" /></button>
            </div>
          )}
        </div>
      </div>

      {showPopup && (
        <DetailPopup
          title={side.title}
          description={side.description}
          fullDetail={side.full_detail}
          goal={side.goal}
          imageUrl={side.image_url}
          startedAt={side.started_at}
          endedAt={side.ended_at}
          moderators={(side as any).moderators}
          participants={(side as any).participants}
          accentClass="bg-nouveau-sapphire/30 text-blue-300"
          onClose={() => setShowPopup(false)}
        />
      )}
    </>
  )
}

// ── Sub Story Node ─────────────────────────────────────────────────────────────
export type SubNodeData = {
  sub: SubStory
  isAdmin: boolean
  onEdit: () => void
  onDelete: () => void
  onTogglePublish: (v: boolean) => void
}

function SubFlowNode({ data }: NodeProps) {
  const { sub, isAdmin, onEdit, onDelete, onTogglePublish } =
    data as unknown as SubNodeData
  const [showPopup, setShowPopup] = useState(false)

  const hasImage = !!sub.image_url

  // Non-admin view for unpublished sub stories
  if (!isAdmin && !sub.is_published) {
    return (
      <>
        <Handle type="target" id="top"    position={Position.Top}    style={HH} />
        <Handle type="target" id="left"   position={Position.Left}   style={HH} />
        <Handle type="target" id="right"  position={Position.Right}  style={HH} />
        <Handle type="source" id="bottom" position={Position.Bottom} style={HH} />
        <LockedBox width={192} height={hasImage ? 300 : 170} accent="emerald" />
      </>
    )
  }

  return (
    <>
      <Handle type="target" id="top"    position={Position.Top}    style={HH} />
      <Handle type="target" id="left"   position={Position.Left}   style={HH} />
      <Handle type="target" id="right"  position={Position.Right}  style={HH} />
      <Handle type="source" id="bottom" position={Position.Bottom} style={HH} />

      <div className="w-[192px] rounded-xl bg-emerald-950/80 backdrop-blur-sm overflow-hidden transition-shadow"
        style={{ height: hasImage ? 300 : 170, boxShadow: getStatusGlow(sub.status) || undefined }}
      >
        {isAdmin && !sub.is_published && (
          <div className="absolute top-1 right-1 z-10 px-1.5 py-0.5 rounded text-[10px] bg-red-900/60 text-red-300 border border-red-500/30">ซ่อน</div>
        )}
        {sub.image_url && (
          <div className="h-[130px] overflow-hidden">
            <img src={sub.image_url} alt={sub.title} className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-victorian-900/95 to-transparent" />
          </div>
        )}
        <div className={`p-2.5 overflow-y-auto custom-scrollbar ${hasImage ? 'max-h-[150px]' : 'max-h-[150px]'}`}>
          {sub.goal && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] bg-nouveau-emerald/30 text-emerald-300 mb-1.5">
              <span className="w-1 h-1 rounded-full bg-current animate-pulse" />{sub.goal}
            </div>
          )}
          <StatusBadge status={sub.status} xs />
          <DateRange s={sub.started_at} e={sub.ended_at} xs />
          <div className="flex items-center gap-1 mb-1">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-900/60 text-emerald-300 text-[8px] font-bold shrink-0">{sub.sort_order}</span>
            <h5 className="font-display text-xs text-emerald-200 leading-tight">{sub.title}</h5>
          </div>
          {sub.description && (
            <p className="text-victorian-300 text-[11px] leading-relaxed line-clamp-2">{sub.description}</p>
          )}

          {/* Moderators & Participants badges */}
          {((sub as any).moderators?.length > 0 || (sub as any).participants?.length > 0) && (
            <div className="mt-1 flex items-center gap-1.5 text-[9px] text-victorian-500">
              {(sub as any).moderators?.length > 0 && (
                <span className="flex items-center gap-0.5"><Shield className="w-2.5 h-2.5" />{(sub as any).moderators.length}</span>
              )}
              {(sub as any).participants?.length > 0 && (
                <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{(sub as any).participants.length}</span>
              )}
            </div>
          )}

          {(sub.full_detail || sub.description) && (
            <button
              onClick={() => setShowPopup(true)}
              onPointerDown={e => e.stopPropagation()}
              className="nodrag nopan mt-1.5 flex items-center gap-1 text-[9px] text-emerald-300/60 hover:text-emerald-300 transition cursor-pointer"
            >
              ดูเพิ่มเติม <ChevronDown className="w-2 h-2" />
            </button>
          )}
          {isAdmin && (
            <div className="mt-2 pt-2 border-t border-nouveau-emerald/20 flex items-center gap-1.5">
              <button onClick={onEdit} onPointerDown={e => e.stopPropagation()} className="nodrag nopan p-1 rounded text-emerald-300 bg-victorian-800/80 border border-nouveau-emerald/20 hover:bg-victorian-700/80 transition cursor-pointer"><Pencil className="w-2.5 h-2.5" /></button>
              <button onClick={() => onTogglePublish(!sub.is_published)} onPointerDown={e => e.stopPropagation()} className="nodrag nopan p-1 rounded text-emerald-300 bg-victorian-800/80 border border-nouveau-emerald/20 hover:bg-victorian-700/80 transition cursor-pointer">
                {sub.is_published ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
              </button>
              <button onClick={onDelete} onPointerDown={e => e.stopPropagation()} className="nodrag nopan p-1 rounded text-red-400 bg-red-900/30 border border-red-500/20 hover:bg-red-900/50 transition ml-auto cursor-pointer"><Trash2 className="w-2.5 h-2.5" /></button>
            </div>
          )}
        </div>
      </div>

      {showPopup && (
        <DetailPopup
          title={sub.title}
          description={sub.description}
          fullDetail={sub.full_detail}
          goal={sub.goal}
          imageUrl={sub.image_url}
          startedAt={sub.started_at}
          endedAt={sub.ended_at}
          moderators={(sub as any).moderators}
          participants={(sub as any).participants}
          accentClass="bg-nouveau-emerald/30 text-emerald-300"
          onClose={() => setShowPopup(false)}
        />
      )}
    </>
  )
}

// ── Event Story Node (auto-generated from punishment) ──────────────────────────
export type EventNodeData = {
  event: EventPunishment
  isAdmin: boolean
}

function EventStoryNode({ data }: NodeProps) {
  const d = data as unknown as Record<string, unknown>
  const event = (d.event ?? d.punishment) as EventPunishment
  const [showPopup, setShowPopup] = useState(false)

  return (
    <>
      <Handle type="target" id="left"   position={Position.Left}   style={HH} />
      <Handle type="target" id="right"  position={Position.Right}  style={HH} />
      <Handle type="target" id="top"    position={Position.Top}    style={HH} />

      <div className="w-[180px] rounded-lg border border-dashed border-amber-500/40 bg-victorian-900/70 backdrop-blur-sm overflow-hidden hover:border-amber-500/60 hover:shadow-[0_0_12px_rgba(245,158,11,0.3)] transition-shadow cursor-default"
        style={{ height: 120 }}
      >
        <div className="p-2.5 overflow-y-auto custom-scrollbar max-h-[120px]">
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] bg-amber-900/40 text-amber-300 border border-amber-500/30 mb-1.5">
            <AlertCircle className="w-2.5 h-2.5" /> Event
          </div>
          <h5 className="font-display text-xs text-amber-200 mb-1 line-clamp-2">{event.punishment_name}</h5>
          {event.punishment_description && (
            <p className="text-victorian-400 text-[10px] leading-relaxed line-clamp-2">{event.punishment_description}</p>
          )}
          <button
            onClick={() => setShowPopup(true)}
            onPointerDown={e => e.stopPropagation()}
            className="nodrag nopan mt-1 flex items-center gap-1 text-[9px] text-amber-300/60 hover:text-amber-300 transition cursor-pointer"
          >
            ดูเพิ่มเติม <ChevronDown className="w-2 h-2" />
          </button>
        </div>
      </div>

      {showPopup && (
        <DetailPopup
          title={`🔥 ${event.punishment_name}`}
          description={event.punishment_description}
          fullDetail={event.required_tasks?.map(t => `• ${t}`).join('\n') || null}
          goal="Event / บทลงโทษ"
          accentClass="bg-amber-900/40 text-amber-300 border border-amber-500/30"
          onClose={() => setShowPopup(false)}
        />
      )}
    </>
  )
}

export const nodeTypes = {
  mainEntry:  memo(MainEntryNode),
  sideStory:  memo(SideFlowNode),
  subStory:   memo(SubFlowNode),
  eventStory: memo(EventStoryNode),
}
