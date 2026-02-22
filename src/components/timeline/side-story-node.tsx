'use client'

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { Eye, EyeOff, Pencil, Trash2, Plus, ChevronDown, ChevronUp, GripVertical, Calendar } from 'lucide-react'

function fmtDate(d: string | null): string | null {
  if (!d) return null
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}
import type { SideStory, SubStory, StoryStatus } from './timeline-view'

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

// ── Layout constants ──────────────────────────────────────────────────────────
const SIDE_CARD_W    = 224   // w-56 = 224 px
const SIDE_CARD_H_EST = 200  // estimated side card height for sub connector anchor
const SUB_CARD_W     = 192   // w-48 = 192 px
const SUB_CARD_H_HALF = 60   // ≈ half height of sub card

// Where the connector originates on the main timeline (y from entry container top).
// The node dot sits at -top-3 (-12px), so 0 is the container's top edge — close enough.
const CONN_ORIGIN_Y = 0

// Default horizontal offset when a card has never been moved (pos.x=0, pos.y=0)
function defaultSideX(sideIndex: number) {
  return sideIndex % 2 === 0 ? 260 : -260
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  side: SideStory
  sideIndex: number
  isAdmin: boolean
  onEdit: () => void
  onDelete: () => void
  onTogglePublish: (val: boolean) => void
  onPositionChange: (x: number, y: number) => void
  onAddSubStory: () => void
  onEditSub: (sub: SubStory) => void
  onDeleteSub: (id: string) => void
  onToggleSubPublish: (id: string, val: boolean) => void
  onSubPositionChange: (id: string, x: number, y: number) => void
}

// ── SideStoryNode ─────────────────────────────────────────────────────────────
export default function SideStoryNode({
  side, sideIndex, isAdmin,
  onEdit, onDelete, onTogglePublish, onPositionChange,
  onAddSubStory, onEditSub, onDeleteSub, onToggleSubPublish, onSubPositionChange,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [pos, setPos] = useState({ x: side.position_x, y: side.position_y })
  const [sideCardH, setSideCardH] = useState(SIDE_CARD_H_EST)
  const sideCardRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef({ mx: 0, my: 0, startX: 0, startY: 0 })

  // Measure actual side card height so sub cards anchor correctly
  useLayoutEffect(() => {
    const el = sideCardRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSideCardH(el.offsetHeight))
    ro.observe(el)
    setSideCardH(el.offsetHeight)
    return () => ro.disconnect()
  }, [])

  // If card was never moved keep it away from center so it doesn't overlap the main card
  const displayX = (pos.x === 0 && pos.y === 0) ? defaultSideX(sideIndex) : pos.x
  const displayY = (pos.x === 0 && pos.y === 0) ? 0 : pos.y

  // ── Drag ───────────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isAdmin) return
    e.preventDefault()
    setIsDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, startX: displayX, startY: displayY }
  }, [isAdmin, displayX, displayY])

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => {
      setPos({
        x: dragStart.current.startX + (e.clientX - dragStart.current.mx),
        y: dragStart.current.startY + (e.clientY - dragStart.current.my),
      })
    }
    const onUp = () => setIsDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDragging])

  // Persist when drag ends
  const prevDragging = useRef(isDragging)
  useEffect(() => {
    if (prevDragging.current && !isDragging) onPositionChange(pos.x, pos.y)
    prevDragging.current = isDragging
  }, [isDragging, pos, onPositionChange])

  // Compute SVG dimensions so the path sits fully inside the viewport
  // — no need for overflow:visible hacks
  const absX  = Math.abs(displayX)
  const pathH = Math.max(4, displayY + SIDE_CARD_H_EST / 2)
  // For right-side card (displayX>0): SVG anchored at 50%, path goes right then down
  // For left-side  card (displayX<0): SVG anchored at calc(50%+displayX), path goes right then down
  const svgLeft    = displayX >= 0 ? '50%'                      : `calc(50% + ${displayX}px)`
  const pathOriginX = displayX >= 0 ? 0                          : absX
  const pathEndX    = displayX >= 0 ? absX                       : 0

  return (
    <>
      {/* Supabase-style 90° elbow connector — sits behind cards (z:1) */}
      <svg
        aria-hidden
        width={absX}
        height={pathH}
        style={{
          position:      'absolute',
          left:          svgLeft,
          top:           CONN_ORIGIN_Y,
          pointerEvents: 'none',
          zIndex:        1,
          display:       'block',
        }}
      >
        <path
          d={`M ${pathOriginX} 0 H ${pathEndX} V ${pathH}`}
          fill="none"
          stroke="rgba(99,179,237,0.6)"
          strokeWidth={1.5}
          strokeDasharray="6 3"
          strokeLinecap="square"
        />
        <circle cx={pathOriginX} cy={0}     r={3} fill="rgba(99,179,237,0.75)" />
        <circle cx={pathEndX}    cy={pathH} r={3} fill="rgba(99,179,237,0.75)" />
      </svg>

      {/* Side Story card wrapper — always centred on displayX */}
      <div
        className="absolute"
        style={{
          left:      `calc(50% + ${displayX}px)`,
          top:       CONN_ORIGIN_Y + displayY,
          width:     SIDE_CARD_W,
          transform: 'translateX(-50%)',
          zIndex:    20,
        }}
      >
        {/* Card */}
        <div
          className={`
            relative w-full rounded-lg border backdrop-blur-sm overflow-hidden
            transition-shadow duration-300 animate-fade-in
            border-nouveau-sapphire/40 hover:border-nouveau-sapphire/70
            bg-victorian-900/85
            ${isDragging ? 'scale-105 cursor-grabbing' : ''}
          `}
          style={{ boxShadow: getStatusGlow(side.status) || (isDragging ? '0 0 25px rgba(27,58,92,0.55)' : undefined) }}
        >
          {/* Drag handle */}
          {isAdmin && (
            <div
              onMouseDown={handleMouseDown}
              className="absolute top-1 left-1 z-30 p-1 cursor-grab text-victorian-400 hover:text-blue-300 transition-colors"
            >
              <GripVertical className="w-4 h-4" />
            </div>
          )}

          {isAdmin && !side.is_published && (
            <div className="absolute top-1 right-1 z-20">
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-900/60 text-red-300 border border-red-500/30">ซ่อน</span>
            </div>
          )}

          {side.image_url && (
            <div className="relative aspect-[5/4] overflow-hidden">
              <img src={side.image_url} alt={side.title}
                className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-victorian-900/95 to-transparent" />
            </div>
          )}

          <div className="p-3" ref={sideCardRef}>
            {side.goal && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-nouveau-sapphire/30 text-blue-300 mb-2">
                <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
                {side.goal}
              </div>
            )}
            <StatusBadge status={side.status} xs />
            {(side.started_at || side.ended_at) && (
              <div className="flex items-center gap-1 text-[10px] text-victorian-400 mb-1">
                <Calendar className="w-2.5 h-2.5 shrink-0" />
                <span>{fmtDate(side.started_at) ?? '?'}{side.ended_at ? ` – ${fmtDate(side.ended_at)}` : ''}</span>
              </div>
            )}
            <h4 className="font-display text-sm text-blue-300 mb-1">{side.title}</h4>
            {side.description && (
              <p className="text-victorian-300 text-xs leading-relaxed line-clamp-2">{side.description}</p>
            )}
            {side.full_detail && (
              <>
                <button onClick={() => setExpanded(!expanded)}
                  className="mt-2 flex items-center gap-1 text-[10px] text-blue-300/60 hover:text-blue-300 transition cursor-pointer">
                  {expanded ? <>ย่อ <ChevronUp className="w-2.5 h-2.5" /></> : <>เพิ่มเติม <ChevronDown className="w-2.5 h-2.5" /></>}
                </button>
                {expanded && (
                  <div className="mt-2 pt-2 border-t border-nouveau-sapphire/20 text-victorian-300 text-xs whitespace-pre-wrap animate-fade-in">
                    {side.full_detail}
                  </div>
                )}
              </>
            )}
            {isAdmin && (
              <div className="mt-3 pt-2 border-t border-nouveau-sapphire/20 flex items-center gap-1.5 flex-wrap">
                <button onClick={onEdit}
                  className="p-1.5 rounded text-blue-300 bg-victorian-800/80 border border-nouveau-sapphire/20 hover:bg-victorian-700/80 transition cursor-pointer" title="แก้ไข">
                  <Pencil className="w-3 h-3" />
                </button>
                <button onClick={() => onTogglePublish(!side.is_published)}
                  className="p-1.5 rounded text-blue-300 bg-victorian-800/80 border border-nouveau-sapphire/20 hover:bg-victorian-700/80 transition cursor-pointer"
                  title={side.is_published ? 'ซ่อน' : 'เผยแพร่'}>
                  {side.is_published ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
                <button onClick={onAddSubStory}
                  className="p-1.5 rounded text-emerald-300 bg-victorian-800/80 border border-nouveau-emerald/20 hover:bg-victorian-700/80 transition cursor-pointer" title="เพิ่ม Sub Story">
                  <Plus className="w-3 h-3" />
                </button>
                <button onClick={onDelete}
                  className="p-1.5 rounded text-red-400 bg-red-900/30 border border-red-500/20 hover:bg-red-900/50 transition ml-auto cursor-pointer" title="ลบ">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sub Stories rendered inside the side card wrapper */}
        {(side.timeline_sub_stories || []).map((sub, subIdx) => (
          <SubStoryNode
            key={sub.id}
            sub={sub}
            subIndex={subIdx}
            sideCardHEst={sideCardH}
            sideCardW={SIDE_CARD_W}
            subCardW={SUB_CARD_W}
            subCardHHalf={SUB_CARD_H_HALF}
            isAdmin={isAdmin}
            onEdit={() => onEditSub(sub)}
            onDelete={() => onDeleteSub(sub.id)}
            onTogglePublish={(val) => onToggleSubPublish(sub.id, val)}
            onPositionChange={(x, y) => onSubPositionChange(sub.id, x, y)}
          />
        ))}
      </div>
    </>
  )
}

// ── Sub Story Node ────────────────────────────────────────────────────────────
function SubStoryNode({
  sub, subIndex,
  sideCardHEst, sideCardW, subCardW, subCardHHalf,
  isAdmin, onEdit, onDelete, onTogglePublish, onPositionChange,
}: {
  sub: SubStory
  subIndex: number
  sideCardHEst: number
  sideCardW: number
  subCardW: number
  subCardHHalf: number
  isAdmin: boolean
  onEdit: () => void
  onDelete: () => void
  onTogglePublish: (val: boolean) => void
  onPositionChange: (x: number, y: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [pos, setPos] = useState({ x: sub.position_x, y: sub.position_y })
  const dragStart = useRef({ mx: 0, my: 0, sx: 0, sy: 0 })

  // Default: stack naturally below the side card, one below another
  const defaultSubY = subIndex * (subCardHHalf * 2 + 12)
  const displayX = (pos.x === 0 && pos.y === 0) ? 0         : pos.x
  const displayY = (pos.x === 0 && pos.y === 0) ? defaultSubY : pos.y

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isAdmin) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, sx: displayX, sy: displayY }
  }, [isAdmin, displayX, displayY])

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => {
      setPos({
        x: dragStart.current.sx + (e.clientX - dragStart.current.mx),
        y: dragStart.current.sy + (e.clientY - dragStart.current.my),
      })
    }
    const onUp = () => setIsDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDragging])

  const prevDragging = useRef(isDragging)
  useEffect(() => {
    if (prevDragging.current && !isDragging) onPositionChange(pos.x, pos.y)
    prevDragging.current = isDragging
  }, [isDragging, pos, onPositionChange])

  const sAbsX      = Math.abs(displayX)
  const sPathH     = Math.max(8, displayY + subCardHHalf)
  const sSvgLeft   = displayX >= 0 ? sideCardW / 2         : sideCardW / 2 + displayX
  const sOriginX   = displayX >= 0 ? 0                     : sAbsX
  const sEndX      = displayX >= 0 ? sAbsX                 : 0
  const isVertical = sAbsX < 2

  return (
    <>
      {/* Sub connector — vertical when directly below, elbow otherwise */}
      {isVertical ? (
        <svg
          aria-hidden
          width={3}
          height={sPathH}
          style={{ position:'absolute', left: sideCardW / 2 - 1, top: sideCardHEst, pointerEvents:'none', zIndex:1, display:'block' }}
        >
          <line x1={1.5} y1={0} x2={1.5} y2={sPathH}
            stroke="rgba(52,211,153,0.5)" strokeWidth={1.5} strokeDasharray="5 3" />
          <circle cx={1.5} cy={0}      r={2.5} fill="rgba(52,211,153,0.65)" />
          <circle cx={1.5} cy={sPathH} r={2.5} fill="rgba(52,211,153,0.65)" />
        </svg>
      ) : (
        <svg
          aria-hidden
          width={sAbsX}
          height={sPathH}
          style={{ position:'absolute', left: sSvgLeft, top: sideCardHEst, pointerEvents:'none', zIndex:1, display:'block' }}
        >
          <path
            d={`M ${sOriginX} 0 H ${sEndX} V ${sPathH}`}
            fill="none"
            stroke="rgba(52,211,153,0.5)"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            strokeLinecap="square"
          />
          <circle cx={sOriginX} cy={0}      r={2.5} fill="rgba(52,211,153,0.65)" />
          <circle cx={sEndX}    cy={sPathH} r={2.5} fill="rgba(52,211,153,0.65)" />
        </svg>
      )}

      {/* Sub card wrapper */}
      <div
        className="absolute"
        style={{
          left:      `calc(50% + ${displayX}px)`,
          top:       sideCardHEst + displayY,
          width:     subCardW,
          transform: 'translateX(-50%)',
          zIndex:    20,
        }}
      >
        <div
          className={`
            relative w-full rounded-lg border backdrop-blur-sm overflow-hidden
            transition-shadow duration-300 animate-fade-in
            border-nouveau-emerald/40 hover:border-nouveau-emerald/70
            bg-victorian-900/75
            ${isDragging ? 'scale-105 cursor-grabbing' : ''}
          `}
          style={{ boxShadow: getStatusGlow(sub.status) || (isDragging ? '0 0 18px rgba(46,91,60,0.5)' : undefined) }}
        >
          {isAdmin && (
            <div onMouseDown={handleMouseDown}
              className="absolute top-1 left-1 z-30 p-1 cursor-grab text-victorian-400 hover:text-emerald-300 transition-colors">
              <GripVertical className="w-3 h-3" />
            </div>
          )}
          {isAdmin && !sub.is_published && (
            <div className="absolute top-1 right-1 z-20">
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-900/60 text-red-300 border border-red-500/30">ซ่อน</span>
            </div>
          )}
          {sub.image_url && (
            <div className="relative aspect-[5/4] overflow-hidden">
              <img src={sub.image_url} alt={sub.title} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-victorian-900/95 to-transparent" />
            </div>
          )}
          <div className="p-2.5">
            {sub.goal && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] bg-nouveau-emerald/30 text-emerald-300 mb-1.5">
                <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
                {sub.goal}
              </div>
            )}
            <StatusBadge status={sub.status} xs />
            {(sub.started_at || sub.ended_at) && (
              <div className="flex items-center gap-1 text-[9px] text-victorian-400 mb-1">
                <Calendar className="w-2 h-2 shrink-0" />
                <span>{fmtDate(sub.started_at) ?? '?'}{sub.ended_at ? ` – ${fmtDate(sub.ended_at)}` : ''}</span>
              </div>
            )}
            <h5 className="font-display text-xs text-emerald-300 mb-1">{sub.title}</h5>
            {sub.description && (
              <p className="text-victorian-300 text-[11px] leading-relaxed line-clamp-2">{sub.description}</p>
            )}
            {sub.full_detail && (
              <>
                <button onClick={() => setExpanded(!expanded)}
                  className="mt-1.5 flex items-center gap-1 text-[9px] text-emerald-300/60 hover:text-emerald-300 transition cursor-pointer">
                  {expanded ? <>ย่อ <ChevronUp className="w-2 h-2" /></> : <>เพิ่มเติม <ChevronDown className="w-2 h-2" /></>}
                </button>
                {expanded && (
                  <div className="mt-1.5 pt-1.5 border-t border-nouveau-emerald/20 text-victorian-300 text-[10px] whitespace-pre-wrap animate-fade-in">
                    {sub.full_detail}
                  </div>
                )}
              </>
            )}
            {isAdmin && (
              <div className="mt-2 pt-2 border-t border-nouveau-emerald/20 flex items-center gap-1.5">
                <button onClick={onEdit}
                  className="p-1 rounded text-emerald-300 bg-victorian-800/80 border border-nouveau-emerald/20 hover:bg-victorian-700/80 transition cursor-pointer" title="แก้ไข">
                  <Pencil className="w-2.5 h-2.5" />
                </button>
                <button onClick={() => onTogglePublish(!sub.is_published)}
                  className="p-1 rounded text-emerald-300 bg-victorian-800/80 border border-nouveau-emerald/20 hover:bg-victorian-700/80 transition cursor-pointer"
                  title={sub.is_published ? 'ซ่อน' : 'เผยแพร่'}>
                  {sub.is_published ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                </button>
                <button onClick={onDelete}
                  className="p-1 rounded text-red-400 bg-red-900/30 border border-red-500/20 hover:bg-red-900/50 transition ml-auto cursor-pointer" title="ลบ">
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
