'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Lock, ChevronDown, ChevronRight,
  Calendar, Pencil, Eye, EyeOff, Plus, Trash2,
  X, Shield, Users,
} from 'lucide-react'
import type { TimelineEntry, SideStory, SubStory, ModalMode } from './timeline-view'
import { cldAvatar, cldThumb } from '@/lib/image'

// ── Utilities ──────────────────────────────────────────────────────────────────
function fmtDate(d: string | null) {
  if (!d) return null
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function DateBadge({ s, e }: { s: string | null; e: string | null }) {
  if (!s && !e) return null
  return (
    <div className="flex items-center gap-1 text-victorian-400 text-[11px] mb-1.5">
      <Calendar className="w-3 h-3 shrink-0" />
      <span>{fmtDate(s) ?? '?'}{e ? ` – ${fmtDate(e)}` : ''}</span>
    </div>
  )
}

// ── Detail Popup (bottom-sheet on mobile, centered on desktop) ─────────────────
interface PopupProps {
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
}

function Popup({
  title, description, fullDetail, goal, imageUrl,
  startedAt, endedAt, moderators, participants,
  accentClass, onClose,
}: PopupProps) {
  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-md max-h-[90vh] sm:max-h-[80vh] overflow-y-auto
                   rounded-t-3xl sm:rounded-2xl bg-victorian-900/97 shadow-2xl custom-scrollbar"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle (mobile only) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-victorian-600" />
        </div>

        {/* Close button (sm+) */}
        <button
          onClick={onClose}
          className="hidden sm:flex absolute top-3 right-3 z-10 p-1.5 rounded-full
                     bg-victorian-800/80 text-victorian-400 hover:text-victorian-200
                     hover:bg-victorian-700 transition cursor-pointer items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>

        {imageUrl && (
          <div className="aspect-video overflow-hidden sm:rounded-t-2xl">
            <img src={cldThumb(imageUrl)} alt={title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-5">
          {goal && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs ${accentClass} mb-3`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />{goal}
            </span>
          )}
          <DateBadge s={startedAt ?? null} e={endedAt ?? null} />
          <h3 className="font-display text-xl text-gold-200 mb-3">{title}</h3>
          {description && (
            <p className="text-victorian-300 text-sm leading-relaxed mb-3">{description}</p>
          )}
          {fullDetail && (
            <div className="pt-3 border-t border-gold-700/20 text-victorian-300 text-sm leading-relaxed whitespace-pre-wrap">
              {fullDetail}
            </div>
          )}

          {moderators && moderators.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gold-700/20">
              <div className="flex items-center gap-1.5 text-xs text-victorian-400 mb-2">
                <Shield className="w-3 h-3" /> ผู้ดำเนินเหตุการณ์
              </div>
              <div className="flex flex-wrap gap-1.5">
                {moderators.map(m => (
                  <span key={m.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-nouveau-sapphire/20 text-blue-300">
                    {m.avatar_url && <img src={cldAvatar(m.avatar_url)} className="w-3.5 h-3.5 rounded-full object-cover" alt="" />}
                    {m.display_name || 'ไม่ระบุชื่อ'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {participants && participants.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gold-700/20">
              <div className="flex items-center gap-1.5 text-xs text-victorian-400 mb-2">
                <Users className="w-3 h-3" /> ผู้ร่วมเหตุการณ์
              </div>
              <div className="flex flex-wrap gap-1.5">
                {participants.map(p => (
                  <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-nouveau-emerald/20 text-emerald-300">
                    {p.avatar_url && <img src={cldAvatar(p.avatar_url)} className="w-3.5 h-3.5 rounded-full object-cover" alt="" />}
                    {p.display_name || 'ไม่ระบุชื่อ'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Close button (mobile) */}
          <button
            onClick={onClose}
            className="sm:hidden mt-5 w-full py-3 rounded-xl text-sm text-victorian-300
                       bg-victorian-800 border border-victorian-700 hover:bg-victorian-700 transition cursor-pointer"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}

// ── Locked Card ────────────────────────────────────────────────────────────────
function LockedCard({ accent }: { accent: 'gold' | 'sapphire' | 'emerald' }) {
  const styles = {
    gold:     { outer: 'rounded-xl border border-gold-700/50 bg-victorian-950',  ringBorder: 'border border-gold-700/50',    icon: 'text-gold-500/60',    text: 'text-gold-600/50' },
    sapphire: { outer: 'rounded-xl bg-blue-950/75',                               ringBorder: 'border border-blue-800/40',    icon: 'text-blue-500/60',    text: 'text-blue-400/50' },
    emerald:  { outer: 'rounded-xl bg-emerald-950/75',                            ringBorder: 'border border-emerald-800/40', icon: 'text-emerald-500/60', text: 'text-emerald-400/50' },
  }[accent]
  return (
    <div className={`${styles.outer} flex items-center gap-3 px-4 py-3.5`}>
      <div className={`p-2 rounded-full ${styles.ringBorder} bg-victorian-900/60 shrink-0`}>
        <Lock className={`${styles.icon} w-4 h-4`} />
      </div>
      <p className={`${styles.text} text-xs`}>เนื้อหายังไม่เปิดเผย</p>
    </div>
  )
}

// ── Admin Action Bar ───────────────────────────────────────────────────────────
function AdminBar({
  isPublished, onEdit, onTogglePublish, onDelete, onAdd, addLabel, compact = false,
}: {
  isPublished: boolean
  onEdit: () => void
  onTogglePublish: () => void
  onDelete: () => void
  onAdd?: () => void
  addLabel?: string
  compact?: boolean
}) {
  const btn = compact
    ? 'p-1.5 rounded text-victorian-300 bg-victorian-800 border border-victorian-700/50 hover:bg-victorian-700 transition cursor-pointer'
    : 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-victorian-300 bg-victorian-800 border border-victorian-700/50 hover:bg-victorian-700 transition cursor-pointer'

  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gold-700/15">
      <button onClick={onEdit} className={btn} title="แก้ไข">
        <Pencil className="w-3.5 h-3.5" />
        {!compact && <span>แก้ไข</span>}
      </button>
      <button onClick={onTogglePublish} className={btn} title={isPublished ? 'ซ่อน' : 'เผยแพร่'}>
        {isPublished ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        {!compact && <span>{isPublished ? 'ซ่อน' : 'เผยแพร่'}</span>}
      </button>
      {onAdd && (
        <button
          onClick={onAdd}
          className={compact
            ? 'p-1.5 rounded text-blue-300 bg-victorian-800 border border-nouveau-sapphire/20 hover:bg-victorian-700 transition cursor-pointer'
            : 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-blue-300 bg-victorian-800 border border-nouveau-sapphire/20 hover:bg-victorian-700 transition cursor-pointer'
          }
          title={addLabel}
        >
          <Plus className="w-3.5 h-3.5" />
          {!compact && addLabel && <span>{addLabel}</span>}
        </button>
      )}
      <button
        onClick={onDelete}
        className={compact
          ? 'p-1.5 rounded text-red-400 bg-red-900/30 border border-red-500/20 hover:bg-red-900/50 transition ml-auto cursor-pointer'
          : 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 bg-red-900/30 border border-red-500/20 hover:bg-red-900/50 transition ml-auto cursor-pointer'
        }
        title="ลบ"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ── Sub Story ──────────────────────────────────────────────────────────────────
function SubItem({
  sub, isAdmin, onEdit, onDelete, onTogglePublish,
}: {
  sub: SubStory
  isAdmin: boolean
  onEdit: () => void
  onDelete: () => void
  onTogglePublish: (v: boolean) => void
}) {
  const [showPopup, setShowPopup] = useState(false)

  if (!isAdmin && !sub.is_published) return <LockedCard accent="emerald" />

  return (
    <div className="rounded-xl bg-emerald-950/75 overflow-hidden">
      {!sub.is_published && isAdmin && (
        <div className="px-3 pt-2 flex">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/60 text-red-300 border border-red-500/30">ซ่อน</span>
        </div>
      )}
      {sub.image_url && (
        <div className="h-24 overflow-hidden">
          <img src={cldThumb(sub.image_url)} alt={sub.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-3">
        {sub.goal && (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] bg-nouveau-emerald/20 text-emerald-300 mb-1.5">
            <span className="w-1 h-1 rounded-full bg-current animate-pulse" />{sub.goal}
          </div>
        )}
        <DateBadge s={sub.started_at} e={sub.ended_at} />
        <div className="flex items-center gap-1.5 mb-1">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-900/60 text-emerald-300 text-[10px] font-bold shrink-0">{sub.sort_order}</span>
          <p className="font-display text-sm text-emerald-200/90">{sub.title}</p>
        </div>
        {sub.description && (
          <p className="text-victorian-400 text-xs leading-relaxed line-clamp-3">{sub.description}</p>
        )}
        {(sub.full_detail || sub.description) && (
          <button
            onClick={() => setShowPopup(true)}
            className="mt-2 flex items-center gap-1 text-[10px] text-emerald-300/60 hover:text-emerald-300 transition cursor-pointer"
          >
            ดูเพิ่มเติม <ChevronDown className="w-2.5 h-2.5" />
          </button>
        )}
        {isAdmin && (
          <AdminBar
            isPublished={sub.is_published}
            onEdit={onEdit}
            onTogglePublish={() => onTogglePublish(!sub.is_published)}
            onDelete={onDelete}
            compact
          />
        )}
      </div>

      {showPopup && (
        <Popup
          title={sub.title}
          description={sub.description}
          fullDetail={sub.full_detail}
          goal={sub.goal}
          imageUrl={sub.image_url}
          startedAt={sub.started_at}
          endedAt={sub.ended_at}
          accentClass="bg-nouveau-emerald/20 text-emerald-300"
          onClose={() => setShowPopup(false)}
        />
      )}
    </div>
  )
}

// ── Side Story ─────────────────────────────────────────────────────────────────
function SideItem({
  side, isAdmin, allEntries,
  onEdit, onDelete, onTogglePublish,
  onAddSub, onEditSub, onDeleteSub, onToggleSubPublish,
}: {
  side: SideStory
  isAdmin: boolean
  allEntries: TimelineEntry[]
  onEdit: () => void
  onDelete: () => void
  onTogglePublish: (v: boolean) => void
  onAddSub: () => void
  onEditSub: (sub: SubStory) => void
  onDeleteSub: (id: string) => void
  onToggleSubPublish: (id: string, v: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showPopup, setShowPopup] = useState(false)
  const subCount = side.timeline_sub_stories?.length ?? 0

  if (!isAdmin && !side.is_published) return <LockedCard accent="sapphire" />

  return (
    <div className="rounded-xl bg-blue-950/70 overflow-hidden">
      {!side.is_published && isAdmin && (
        <div className="px-3 pt-2 flex">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/60 text-red-300 border border-red-500/30">ซ่อน</span>
        </div>
      )}
      {side.image_url && (
        <div className="h-32 overflow-hidden">
          <img src={cldThumb(side.image_url)} alt={side.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-3">
        {side.goal && (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-nouveau-sapphire/30 text-blue-300 mb-2">
            <span className="w-1 h-1 rounded-full bg-current animate-pulse" />{side.goal}
          </div>
        )}
        <DateBadge s={side.started_at} e={side.ended_at} />
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-900/60 text-blue-300 text-[10px] font-bold shrink-0">{side.sort_order}</span>
          <p className="font-display text-base text-blue-200">{side.title}</p>
        </div>
        {side.description && (
          <p className="text-victorian-300 text-xs leading-relaxed line-clamp-3">{side.description}</p>
        )}
        {/* Moderators / Participants counts */}
        {((side as any).moderators?.length > 0 || (side as any).participants?.length > 0) && (
          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-victorian-500">
            {(side as any).moderators?.length > 0 && (
              <span className="flex items-center gap-0.5">
                <Shield className="w-2.5 h-2.5" />{(side as any).moderators.length}
              </span>
            )}
            {(side as any).participants?.length > 0 && (
              <span className="flex items-center gap-0.5">
                <Users className="w-2.5 h-2.5" />{(side as any).participants.length}
              </span>
            )}
          </div>
        )}
        {(side.full_detail || side.description) && (
          <button
            onClick={() => setShowPopup(true)}
            className="mt-2 flex items-center gap-1 text-[10px] text-blue-300/60 hover:text-blue-300 transition cursor-pointer"
          >
            ดูเพิ่มเติม <ChevronDown className="w-2.5 h-2.5" />
          </button>
        )}
        {isAdmin && (
          <AdminBar
            isPublished={side.is_published}
            onEdit={onEdit}
            onTogglePublish={() => onTogglePublish(!side.is_published)}
            onDelete={onDelete}
            onAdd={onAddSub}
            addLabel="Sub Story"
          />
        )}

        {/* Sub stories accordion toggle */}
        {subCount > 0 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-2 w-full flex items-center justify-between text-[11px] text-emerald-400/70
                       hover:text-emerald-300 transition cursor-pointer py-1.5 border-t border-nouveau-emerald/10"
          >
            <span>Sub Story ({subCount})</span>
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* Expanded sub stories */}
      {expanded && subCount > 0 && (
        <div className="px-3 pb-3 flex flex-col gap-2">
          {side.timeline_sub_stories.map(sub => (
            <SubItem
              key={sub.id}
              sub={sub}
              isAdmin={isAdmin}
              onEdit={() => onEditSub(sub)}
              onDelete={() => onDeleteSub(sub.id)}
              onTogglePublish={v => onToggleSubPublish(sub.id, v)}
            />
          ))}
        </div>
      )}

      {showPopup && (
        <Popup
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
    </div>
  )
}

// ── Main Entry ─────────────────────────────────────────────────────────────────
function EntryItem({
  entry, isAdmin,
  onEdit, onDelete, onTogglePublish,
  onAddSide, onEditSide, onDeleteSide, onToggleSidePublish,
  onAddSub, onEditSub, onDeleteSub, onToggleSubPublish,
  allEntries,
}: {
  entry: TimelineEntry
  isAdmin: boolean
  allEntries: TimelineEntry[]
  onEdit: () => void
  onDelete: () => void
  onTogglePublish: (v: boolean) => void
  onAddSide: () => void
  onEditSide: (side: SideStory) => void
  onDeleteSide: (id: string) => void
  onToggleSidePublish: (id: string, v: boolean) => void
  onAddSub: (sideStoryId: string) => void
  onEditSub: (sub: SubStory) => void
  onDeleteSub: (id: string) => void
  onToggleSubPublish: (id: string, v: boolean) => void
}) {
  const [sidesOpen, setSidesOpen] = useState(true)
  const [showPopup, setShowPopup] = useState(false)
  const sideCount = entry.timeline_side_stories?.length ?? 0

  if (!isAdmin && !entry.is_published) return <LockedCard accent="gold" />

  return (
    <div className="rounded-2xl border border-gold-700/45 bg-victorian-900/90 overflow-hidden shadow-[0_0_20px_rgba(184,134,11,0.08)]">
      {/* Hidden badge for admin */}
      {!entry.is_published && isAdmin && (
        <div className="px-4 pt-3 flex">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/60 text-red-300 border border-red-500/30">ซ่อน</span>
        </div>
      )}

      {/* Cover image */}
      {entry.image_url && (
        <div className="relative h-44 overflow-hidden">
          <img src={cldThumb(entry.image_url)} alt={entry.title} className="w-full h-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-victorian-900/80 to-transparent" />
        </div>
      )}

      <div className="p-4">
        {entry.goal && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-gold-900/40 text-gold-300 border border-gold-700/30 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />{entry.goal}
          </span>
        )}
        <DateBadge s={entry.started_at} e={entry.ended_at} />
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gold-900/60 border border-gold-700/40 text-gold-400 text-xs font-bold shrink-0">{entry.sort_order}</span>
          <h3 className="font-display text-xl text-gold-200">{entry.title}</h3>
        </div>
        {entry.description && (
          <p className="text-victorian-300 text-sm leading-relaxed">{entry.description}</p>
        )}
        {(entry.full_detail || entry.description) && (
          <button
            onClick={() => setShowPopup(true)}
            className="mt-2 flex items-center gap-1 text-xs text-gold-400/60 hover:text-gold-300 transition cursor-pointer"
          >
            ดูเพิ่มเติม <ChevronDown className="w-3 h-3" />
          </button>
        )}

        {isAdmin && (
          <AdminBar
            isPublished={entry.is_published}
            onEdit={onEdit}
            onTogglePublish={() => onTogglePublish(!entry.is_published)}
            onDelete={onDelete}
            onAdd={onAddSide}
            addLabel="Side Story"
          />
        )}

        {/* Side story accordion toggle */}
        {sideCount > 0 && (
          <button
            onClick={() => setSidesOpen(v => !v)}
            className="mt-3 w-full flex items-center justify-between text-xs text-blue-400/70
                       hover:text-blue-300 transition cursor-pointer py-1.5 px-3 rounded-lg
                       bg-victorian-800/50 border border-nouveau-sapphire/15"
          >
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60" />
              Side Story ({sideCount})
            </span>
            {sidesOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Expanded side stories */}
      {sidesOpen && sideCount > 0 && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {entry.timeline_side_stories.map(side => (
            <SideItem
              key={side.id}
              side={side}
              isAdmin={isAdmin}
              allEntries={allEntries}
              onEdit={() => onEditSide(side)}
              onDelete={() => onDeleteSide(side.id)}
              onTogglePublish={v => onToggleSidePublish(side.id, v)}
              onAddSub={() => onAddSub(side.id)}
              onEditSub={onEditSub}
              onDeleteSub={onDeleteSub}
              onToggleSubPublish={onToggleSubPublish}
            />
          ))}
        </div>
      )}

      {showPopup && (
        <Popup
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
    </div>
  )
}

// ── Export ─────────────────────────────────────────────────────────────────────
interface ListViewProps {
  entries: TimelineEntry[]
  isAdmin: boolean
  setModal: (m: ModalMode) => void
  handleDeleteEntry: (id: string) => void
  handleToggleEntry: (id: string, v: boolean) => void
  handleDeleteSide: (id: string) => void
  handleToggleSide: (id: string, v: boolean) => void
  handleDeleteSub: (id: string) => void
  handleToggleSub: (id: string, v: boolean) => void
}

export default function TimelineListView({
  entries, isAdmin, setModal,
  handleDeleteEntry, handleToggleEntry,
  handleDeleteSide, handleToggleSide,
  handleDeleteSub, handleToggleSub,
}: ListViewProps) {
  const allSideStories = entries.flatMap(e => e.timeline_side_stories ?? [])

  return (
    <div className="flex flex-col gap-8 px-4 py-4 pb-20">
      {entries.map(entry => (
        <EntryItem
          key={entry.id}
          entry={entry}
          isAdmin={isAdmin}
          allEntries={entries}
          onEdit={() => setModal({ type: 'edit-entry', entry })}
          onDelete={() => handleDeleteEntry(entry.id)}
          onTogglePublish={v => handleToggleEntry(entry.id, v)}
          onAddSide={() => setModal({ type: 'create-side', timelineId: entry.id })}
          onEditSide={side => setModal({ type: 'edit-side', side, entries })}
          onDeleteSide={handleDeleteSide}
          onToggleSidePublish={handleToggleSide}
          onAddSub={sideStoryId => setModal({ type: 'create-sub', sideStoryId })}
          onEditSub={sub => setModal({ type: 'edit-sub', sub, sideStories: allSideStories })}
          onDeleteSub={handleDeleteSub}
          onToggleSubPublish={handleToggleSub}
        />
      ))}

      {entries.length === 0 && (
        <p className="text-center text-victorian-400 mt-12 text-sm">
          ยังไม่มีเส้นเรื่อง{isAdmin && ' — กดปุ่มด้านบนเพื่อเริ่มสร้าง'}
        </p>
      )}
    </div>
  )
}
