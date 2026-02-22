'use client'

import { useState, useRef, useEffect, type FormEvent } from 'react'
import { X, Loader2, Check } from 'lucide-react'
import type { TimelineEntry, SideStory, SubStory } from './timeline-view'
import {
  setSideStoryModerators, setSideStoryParticipants, setSideStoryPunishments,
  setSubStoryModerators, setSubStoryParticipants,
} from '@/app/actions/timeline'

type Profile = { id: string; display_name: string; avatar_url: string | null }
type PunishmentOption = { id: string; name: string; description: string | null; archived: boolean }

type ModalMode =
  | { type: 'create-entry' }
  | { type: 'edit-entry'; entry: TimelineEntry }
  | { type: 'create-side'; timelineId: string }
  | { type: 'edit-side'; side: SideStory; entries: TimelineEntry[] }
  | { type: 'create-sub'; sideStoryId: string }
  | { type: 'edit-sub'; sub: SubStory; sideStories: SideStory[] }

interface Props {
  mode: ModalMode
  entries: TimelineEntry[]
  allSideStories: SideStory[]
  isPending: boolean
  onClose: () => void
  onCreateEntry: (fd: FormData) => Promise<void>
  onUpdateEntry: (id: string, fd: FormData) => Promise<void>
  onCreateSide: (fd: FormData) => Promise<void>
  onUpdateSide: (id: string, fd: FormData) => Promise<void>
  onCreateSub: (fd: FormData) => Promise<void>
  onUpdateSub: (id: string, fd: FormData) => Promise<void>
  // New optional props for moderators/participants/punishments
  adminDmProfiles?: Profile[]
  playerProfiles?: Profile[]
  punishments?: PunishmentOption[]
}

function getModalTitle(mode: ModalMode): string {
  switch (mode.type) {
    case 'create-entry': return 'สร้างไทม์ไลน์หลัก'
    case 'edit-entry': return 'แก้ไขไทม์ไลน์หลัก'
    case 'create-side': return 'สร้าง Side Story'
    case 'edit-side': return 'แก้ไข Side Story'
    case 'create-sub': return 'สร้าง Sub Story'
    case 'edit-sub': return 'แก้ไข Sub Story'
  }
}

function getAccentColor(mode: ModalMode): string {
  if (mode.type.includes('sub')) return 'emerald'
  if (mode.type.includes('side')) return 'blue'
  return 'gold'
}

export default function TimelineFormModal({
  mode, entries, allSideStories, isPending,
  onClose, onCreateEntry, onUpdateEntry, onCreateSide, onUpdateSide, onCreateSub, onUpdateSub,
  adminDmProfiles = [], playerProfiles = [], punishments = [],
}: Props) {
  const formRef = useRef<HTMLFormElement>(null)

  // Determine initial values from edit modes
  const initial = (() => {
    if (mode.type === 'edit-entry') {
      const e = mode.entry
      return { title: e.title, description: e.description || '', full_detail: e.full_detail || '', goal: e.goal || '', image_url: e.image_url || '', sort_order: e.sort_order, started_at: e.started_at || '', ended_at: e.ended_at || '', timeline_id: '', side_story_id: '' }
    }
    if (mode.type === 'edit-side') {
      const s = mode.side
      return { title: s.title, description: s.description || '', full_detail: s.full_detail || '', goal: s.goal || '', image_url: s.image_url || '', sort_order: s.sort_order, started_at: s.started_at || '', ended_at: s.ended_at || '', timeline_id: s.timeline_id, side_story_id: '' }
    }
    if (mode.type === 'edit-sub') {
      const sb = mode.sub
      return { title: sb.title, description: sb.description || '', full_detail: sb.full_detail || '', goal: sb.goal || '', image_url: sb.image_url || '', sort_order: sb.sort_order, started_at: sb.started_at || '', ended_at: sb.ended_at || '', timeline_id: '', side_story_id: sb.side_story_id }
    }
    if (mode.type === 'create-side') {
      return { title: '', description: '', full_detail: '', goal: '', image_url: '', sort_order: 0, started_at: '', ended_at: '', timeline_id: mode.timelineId, side_story_id: '' }
    }
    if (mode.type === 'create-sub') {
      return { title: '', description: '', full_detail: '', goal: '', image_url: '', sort_order: 0, started_at: '', ended_at: '', timeline_id: '', side_story_id: mode.sideStoryId }
    }
    return { title: '', description: '', full_detail: '', goal: '', image_url: '', sort_order: 0, started_at: '', ended_at: '', timeline_id: '', side_story_id: '' }
  })()

  // Pre-populate moderators/participants/punishments from edit mode
  const initialModerators = (() => {
    if (mode.type === 'edit-side' && mode.side.moderators) return mode.side.moderators.map(m => m.id)
    if (mode.type === 'edit-sub' && mode.sub.moderators) return mode.sub.moderators.map(m => m.id)
    return [] as string[]
  })()
  const initialParticipants = (() => {
    if (mode.type === 'edit-side' && mode.side.participants) return mode.side.participants.map(p => p.id)
    if (mode.type === 'edit-sub' && mode.sub.participants) return mode.sub.participants.map(p => p.id)
    return [] as string[]
  })()
  const initialPunishments = (() => {
    if (mode.type === 'edit-side' && mode.side.event_punishments) return mode.side.event_punishments.map(p => p.punishment_id)
    return [] as string[]
  })()

  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [fullDetail, setFullDetail] = useState(initial.full_detail)
  const [goal, setGoal] = useState(initial.goal)
  const [imageUrl, setImageUrl] = useState(initial.image_url)
  const [sortOrder, setSortOrder] = useState(initial.sort_order)
  const [startedAt, setStartedAt] = useState(initial.started_at)
  const [endedAt, setEndedAt] = useState(initial.ended_at)
  const [timelineId, setTimelineId] = useState(initial.timeline_id)
  const [sideStoryId, setSideStoryId] = useState(initial.side_story_id)
  const [selectedModerators, setSelectedModerators] = useState<string[]>(initialModerators)
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(initialParticipants)
  const [selectedPunishments, setSelectedPunishments] = useState<string[]>(initialPunishments)

  // Whether to show moderator/participant/punishment sections
  const isSideOrSub = mode.type.includes('side') || mode.type.includes('sub')
  const isSideOnly = mode.type.includes('side')

  const toggleInList = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id])
  }

  const accent = getAccentColor(mode)
  const borderColor = accent === 'gold' ? 'border-gold-500/40' : accent === 'blue' ? 'border-nouveau-sapphire/40' : 'border-nouveau-emerald/40'
  const accentText = accent === 'gold' ? 'text-gold-400' : accent === 'blue' ? 'text-blue-300' : 'text-emerald-300'

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    const fd = new FormData()
    fd.set('title', title.trim())
    fd.set('description', description.trim())
    fd.set('full_detail', fullDetail.trim())
    fd.set('goal', goal.trim())
    fd.set('image_url', imageUrl.trim())
    fd.set('sort_order', String(sortOrder))
    if (startedAt) fd.set('started_at', startedAt)
    if (endedAt)   fd.set('ended_at',   endedAt)

    let resultId: string | undefined

    switch (mode.type) {
      case 'create-entry':
        await onCreateEntry(fd)
        break
      case 'edit-entry':
        await onUpdateEntry(mode.entry.id, fd)
        break
      case 'create-side':
        fd.set('timeline_id', timelineId)
        await onCreateSide(fd)
        // Note: For create, the caller must handle setting moderators/participants in the callback
        break
      case 'edit-side':
        fd.set('timeline_id', timelineId)
        await onUpdateSide(mode.side.id, fd)
        resultId = mode.side.id
        // Save moderators, participants, punishments for side stories
        await Promise.all([
          setSideStoryModerators(resultId, selectedModerators),
          setSideStoryParticipants(resultId, selectedParticipants),
          setSideStoryPunishments(resultId, selectedPunishments),
        ])
        break
      case 'create-sub':
        fd.set('side_story_id', sideStoryId)
        await onCreateSub(fd)
        break
      case 'edit-sub':
        fd.set('side_story_id', sideStoryId)
        await onUpdateSub(mode.sub.id, fd)
        resultId = mode.sub.id
        // Save moderators, participants for sub stories
        await Promise.all([
          setSubStoryModerators(resultId, selectedModerators),
          setSubStoryParticipants(resultId, selectedParticipants),
        ])
        break
    }
  }

  const showTimelineSelect = mode.type === 'edit-side'
  const showSideSelect = mode.type === 'edit-sub'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className={`
        relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl
        bg-victorian-900 border ${borderColor}
        shadow-2xl animate-fade-in
      `}>
        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-center justify-between p-4 border-b ${borderColor} bg-victorian-900/95 backdrop-blur-sm`}>
          <h3 className={`font-display text-lg ${accentText}`}>
            {getModalTitle(mode)}
          </h3>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-victorian-400 hover:text-victorian-200 hover:bg-victorian-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form ref={formRef} onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-victorian-300 mb-1">ชื่อเรื่อง *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              required placeholder="ชื่อตอน / เหตุการณ์"
              className="input-victorian w-full" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-victorian-300 mb-1">คำอธิบายสั้น</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={2} placeholder="คำอธิบายแบบย่อที่แสดงบนการ์ด"
              className="input-victorian w-full resize-none" />
          </div>

          {/* Full Detail */}
          <div>
            <label className="block text-sm font-medium text-victorian-300 mb-1">รายละเอียดเพิ่มเติม</label>
            <textarea value={fullDetail} onChange={e => setFullDetail(e.target.value)}
              rows={4} placeholder="รายละเอียดที่แสดงเมื่อกดดูเพิ่มเติม (รองรับหลายบรรทัด)"
              className="input-victorian w-full resize-y min-h-[80px]" />
          </div>

          {/* Goal */}
          <div>
            <label className="block text-sm font-medium text-victorian-300 mb-1">เป้าหมาย / จุดมุ่งหมาย</label>
            <input type="text" value={goal} onChange={e => setGoal(e.target.value)}
              placeholder="เช่น ค้นหาคัมภีร์มืด, ปราบวิญญาณร้าย"
              className="input-victorian w-full" />
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-sm font-medium text-victorian-300 mb-1">URL รูปภาพ</label>
            <div className="flex gap-2">
              <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="input-victorian w-full" />
            </div>
            {imageUrl && (
              <div className="mt-2 relative aspect-[5/4] w-32 rounded-lg overflow-hidden border border-victorian-700">
                <img src={imageUrl} alt="Preview"
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = 'none')} />
              </div>
            )}
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-victorian-300 mb-1">วันเริ่มต้น</label>
              <input
                type="date"
                value={startedAt}
                onChange={e => setStartedAt(e.target.value)}
                className="input-victorian w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-victorian-300 mb-1">วันสิ้นสุด</label>
              <input
                type="date"
                value={endedAt}
                onChange={e => setEndedAt(e.target.value)}
                className="input-victorian w-full"
              />
            </div>
          </div>

          {/* Sort Order */}
          <div>
            <label className="block text-sm font-medium text-victorian-300 mb-1">ลำดับ</label>
            <input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))}
              className="input-victorian w-24" />
            <p className="text-[11px] text-victorian-500 mt-1">ตัวเลขน้อย = แสดงก่อน</p>
          </div>

          {/* Timeline Select (for editing side story's parent) */}
          {showTimelineSelect && (
            <div>
              <label className="block text-sm font-medium text-victorian-300 mb-1">เชื่อมกับไทม์ไลน์หลัก</label>
              <select value={timelineId} onChange={e => setTimelineId(e.target.value)}
                className="input-victorian w-full">
                {entries.map(en => (
                  <option key={en.id} value={en.id}>{en.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Side Story Select (for editing sub story's parent) */}
          {showSideSelect && (
            <div>
              <label className="block text-sm font-medium text-victorian-300 mb-1">เชื่อมกับ Side Story</label>
              <select value={sideStoryId} onChange={e => setSideStoryId(e.target.value)}
                className="input-victorian w-full">
                {allSideStories.map(ss => (
                  <option key={ss.id} value={ss.id}>{ss.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* ─── Moderators (admin/dm) multi-select ─── */}
          {isSideOrSub && adminDmProfiles.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-victorian-300 mb-1">
                ผู้ดำเนินเหตุการณ์ (DM / Admin)
              </label>
              <div className="border border-victorian-700 rounded-lg max-h-36 overflow-y-auto custom-scrollbar bg-victorian-950/50">
                {adminDmProfiles.map(p => {
                  const checked = selectedModerators.includes(p.id)
                  return (
                    <button key={p.id} type="button"
                      onClick={() => toggleInList(selectedModerators, setSelectedModerators, p.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition cursor-pointer
                        ${checked ? 'bg-nouveau-sapphire/20 text-blue-200' : 'text-victorian-300 hover:bg-victorian-800'}`}>
                      <span className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center
                        ${checked ? 'bg-nouveau-sapphire border-nouveau-sapphire' : 'border-victorian-600'}`}>
                        {checked && <Check className="w-3 h-3 text-white" />}
                      </span>
                      {p.avatar_url && (
                        <img src={p.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                      )}
                      <span className="truncate">{p.display_name}</span>
                    </button>
                  )
                })}
              </div>
              {selectedModerators.length > 0 && (
                <p className="text-[11px] text-victorian-500 mt-1">
                  เลือกแล้ว {selectedModerators.length} คน
                </p>
              )}
            </div>
          )}

          {/* ─── Participants (players) multi-select ─── */}
          {isSideOrSub && playerProfiles.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-victorian-300 mb-1">
                ผู้ร่วมเหตุการณ์ (Players)
              </label>
              <div className="border border-victorian-700 rounded-lg max-h-36 overflow-y-auto custom-scrollbar bg-victorian-950/50">
                {playerProfiles.map(p => {
                  const checked = selectedParticipants.includes(p.id)
                  return (
                    <button key={p.id} type="button"
                      onClick={() => toggleInList(selectedParticipants, setSelectedParticipants, p.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition cursor-pointer
                        ${checked ? 'bg-nouveau-emerald/20 text-emerald-200' : 'text-victorian-300 hover:bg-victorian-800'}`}>
                      <span className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center
                        ${checked ? 'bg-nouveau-emerald border-nouveau-emerald' : 'border-victorian-600'}`}>
                        {checked && <Check className="w-3 h-3 text-white" />}
                      </span>
                      {p.avatar_url && (
                        <img src={p.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                      )}
                      <span className="truncate">{p.display_name}</span>
                    </button>
                  )
                })}
              </div>
              {selectedParticipants.length > 0 && (
                <p className="text-[11px] text-victorian-500 mt-1">
                  เลือกแล้ว {selectedParticipants.length} คน
                </p>
              )}
            </div>
          )}

          {/* ─── Punishments (side story only) multi-select ─── */}
          {isSideOnly && punishments.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-victorian-300 mb-1">
                บทลงโทษที่เกี่ยวข้อง (Event Story)
              </label>
              <p className="text-[11px] text-victorian-500 mb-1.5">
                จะสร้างกล่อง Event Story เชื่อมต่อเส้นประอัตโนมัติ
              </p>
              <div className="border border-victorian-700 rounded-lg max-h-40 overflow-y-auto custom-scrollbar bg-victorian-950/50">
                {punishments.map(pun => {
                  const checked = selectedPunishments.includes(pun.id)
                  return (
                    <button key={pun.id} type="button"
                      onClick={() => toggleInList(selectedPunishments, setSelectedPunishments, pun.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition cursor-pointer
                        ${checked ? 'bg-amber-500/20 text-amber-200' : 'text-victorian-300 hover:bg-victorian-800'}`}>
                      <span className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center
                        ${checked ? 'bg-amber-500 border-amber-500' : 'border-victorian-600'}`}>
                        {checked && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span className="flex-1 truncate">
                        {pun.name}
                        {pun.archived && <span className="ml-1 text-[10px] text-victorian-500">(เก็บถาวร)</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
              {selectedPunishments.length > 0 && (
                <p className="text-[11px] text-victorian-500 mt-1">
                  เลือกแล้ว {selectedPunishments.length} บทลงโทษ
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-victorian-800">
            <button type="button" onClick={onClose} disabled={isPending}
              className="px-4 py-2 rounded-lg text-sm text-victorian-300 bg-victorian-800 hover:bg-victorian-700 border border-victorian-700 transition cursor-pointer">
              ยกเลิก
            </button>
            <button type="submit" disabled={isPending || !title.trim()}
              className={`
                px-5 py-2 rounded-lg text-sm font-medium transition cursor-pointer
                flex items-center gap-2
                ${accent === 'gold'
                  ? 'bg-gold-500 text-victorian-950 hover:bg-gold-400 disabled:opacity-50'
                  : accent === 'blue'
                    ? 'bg-nouveau-sapphire text-white hover:bg-nouveau-sapphire/80 disabled:opacity-50'
                    : 'bg-nouveau-emerald text-white hover:bg-nouveau-emerald/80 disabled:opacity-50'
                }
              `}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode.type.startsWith('create') ? 'สร้าง' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
