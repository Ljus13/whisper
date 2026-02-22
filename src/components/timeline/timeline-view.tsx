'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState,
  BackgroundVariant,
  type Node, type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { nodeTypes, type MainNodeData } from './flow-nodes'
import TimelineFormModal from './timeline-form-modal'
import TimelineListView from './timeline-list-view'
import {
  createTimelineEntry, updateTimelineEntry, deleteTimelineEntry, toggleTimelinePublish,
  createSideStory, updateSideStory, deleteSideStory, updateSideStoryPosition, toggleSideStoryPublish,
  createSubStory, updateSubStory, deleteSubStory, updateSubStoryPosition, toggleSubStoryPublish,
  updateEventStoryPosition,
  getAdminDmProfiles, getPlayerProfiles, getPunishmentsList,
} from '@/app/actions/timeline'

// ── Interfaces (exported for use in other components) ─────────────────────────
export interface SubStory {
  id: string; side_story_id: string; title: string
  description: string | null; full_detail: string | null; goal: string | null
  image_url: string | null; position_x: number; position_y: number
  sort_order: number; started_at: string | null; ended_at: string | null; is_published: boolean
  moderators?: { id: string; display_name: string; avatar_url: string | null }[]
  participants?: { id: string; display_name: string; avatar_url: string | null }[]
}

export interface SideStory {
  id: string; timeline_id: string; title: string
  description: string | null; full_detail: string | null; goal: string | null
  image_url: string | null; position_x: number; position_y: number
  sort_order: number; started_at: string | null; ended_at: string | null; is_published: boolean
  timeline_sub_stories: SubStory[]
  event_punishments?: EventPunishment[]
  moderators?: { id: string; display_name: string; avatar_url: string | null }[]
  participants?: { id: string; display_name: string; avatar_url: string | null }[]
}

export interface TimelineEntry {
  id: string; title: string; description: string | null; full_detail: string | null
  goal: string | null; image_url: string | null; sort_order: number
  started_at: string | null; ended_at: string | null; is_published: boolean
  created_at: string; timeline_side_stories: SideStory[]
}

export type EventPunishment = {
  punishment_id: string
  punishment_name: string
  punishment_description: string | null
  required_tasks: string[] | null
  position_x?: number
  position_y?: number
}

interface Props { entries: TimelineEntry[]; isAdmin: boolean }

export type ModalMode =
  | { type: 'create-entry' }
  | { type: 'edit-entry'; entry: TimelineEntry }
  | { type: 'create-side'; timelineId: string }
  | { type: 'edit-side'; side: SideStory; entries: TimelineEntry[] }
  | { type: 'create-sub'; sideStoryId: string }
  | { type: 'edit-sub'; sub: SubStory; sideStories: SideStory[] }
  | null

// ── Layout constants ───────────────────────────────────────────────────────────
const CANVAS_CX  = 400   // visual centre of canvas
const MAIN_W     = 360   // main card width  (w-[360px])
const SIDE_W     = 224   // side card width  (w-[224px])
const SUB_W      = 192   // sub  card width  (w-[192px])
const _ENTRY_GAP = 380   // vertical gap between main entries (now computed dynamically via computeMainYs)
const SIDE_OFFS  = 390   // horizontal offset: centre of main → centre of side
const SIDE_H_EST = 260   // estimated side card height for default sub Y
const SUB_GAP    = 210   // vertical gap between sub stories

function defaultSideX(j: number) {
  return j % 2 === 0
    ? CANVAS_CX + SIDE_OFFS - SIDE_W / 2   // right side
    : CANVAS_CX - SIDE_OFFS - SIDE_W / 2   // left side
}

function computeMainYs(entries: TimelineEntry[]): number[] {
  const ys: number[] = []
  let y = 0
  for (const e of entries) {
    ys.push(y)
    y += (e.image_url ? 460 : 280) + 80
  }
  return ys
}

// ── Graph builder ──────────────────────────────────────────────────────────────
const _EVENT_W = 180 // event story card width
type Cbs = {
  getEntries:    () => TimelineEntry[]
  getAllSides:    () => SideStory[]
  setModal:          (m: ModalMode) => void
  deleteEntry:       (id: string)   => void
  toggleEntryPub:    (id: string, v: boolean) => void
  deleteSide:        (id: string)   => void
  toggleSidePub:     (id: string, v: boolean) => void
  deleteSub:         (id: string)   => void
  toggleSubPub:      (id: string, v: boolean) => void
}

function buildGraph(
  entries: TimelineEntry[],
  isAdmin: boolean,
  cbs: Cbs,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const mainX = CANVAS_CX - MAIN_W / 2

  let currentY = 0
  entries.forEach((entry, i) => {
    const cardH  = entry.image_url ? 460 : 280
    const mainY  = currentY
    const mainId = `entry-${entry.id}`

    nodes.push({
      id: mainId,
      type: 'mainEntry',
      position: { x: mainX, y: mainY },
      draggable: isAdmin,
      data: {
        entry,
        isAdmin,
        onEdit:           () => cbs.setModal({ type: 'edit-entry', entry }),
        onDelete:         () => cbs.deleteEntry(entry.id),
        onTogglePublish:  (v: boolean) => cbs.toggleEntryPub(entry.id, v),
        onAddSideStory:   () => cbs.setModal({ type: 'create-side', timelineId: entry.id }),
      } satisfies MainNodeData,
    })

    currentY += cardH + 50

    if (i > 0) {
      edges.push({
        id:           `spine-${entry.id}`,
        source:       `entry-${entries[i - 1].id}`,
        target:       mainId,
        sourceHandle: 'bottom',
        targetHandle: 'top',
        type:         'straight',
        className: 'rf-spine',
        style: { stroke: 'rgba(184,134,11,0.35)', strokeDasharray: '8 4', strokeWidth: 1.5 },
        selectable: false,
      })
    }

    entry.timeline_side_stories?.forEach((side, j) => {
      const hasPos = (side.position_x != null && side.position_x !== 0) || (side.position_y != null && side.position_y !== 0)
      const sideX  = hasPos ? side.position_x : defaultSideX(j)
      const sideY  = hasPos ? side.position_y : mainY + 30
      const sideId = `side-${side.id}`

      nodes.push({
        id: sideId,
        type: 'sideStory',
        position: { x: sideX, y: sideY },
        draggable: isAdmin,
        data: {
          side,
          isAdmin,
          onEdit:          () => cbs.setModal({ type: 'edit-side', side, entries: cbs.getEntries() }),
          onDelete:        () => cbs.deleteSide(side.id),
          onTogglePublish: (v: boolean) => cbs.toggleSidePub(side.id, v),
          onAddSubStory:   () => cbs.setModal({ type: 'create-sub', sideStoryId: side.id }),
        },
      })

      const sideCx = sideX + SIDE_W / 2
      const mainCx = mainX + MAIN_W / 2
      edges.push({
        id:           `ms-${side.id}`,
        source:       mainId,
        target:       sideId,
        sourceHandle: sideCx >= mainCx ? 'right' : 'left',
        targetHandle: sideCx >= mainCx ? 'left'  : 'right',
        type:         'step',
        className: 'rf-side',
        style: { stroke: 'rgba(99,179,237,0.6)', strokeDasharray: '6 3', strokeWidth: 1.5 },
        selectable: false,
      })

      // actual rendered height of the side card (mirrors flow-nodes.tsx)
      const sideCardH = side.image_url ? 340 : 200

      side.timeline_sub_stories?.forEach((sub, k) => {
        const hasSubPos = (sub.position_x != null && sub.position_x !== 0) || (sub.position_y != null && sub.position_y !== 0)
        // center sub horizontally under its parent side card
        const subX = hasSubPos ? sub.position_x : sideX + SIDE_W / 2 - SUB_W / 2
        // stack subs below the side card with a 24px gap
        const subCardH = sub.image_url ? 300 : 170
        const subY = hasSubPos ? sub.position_y : sideY + sideCardH + 24 + k * (subCardH + 20)

        nodes.push({
          id:       `sub-${sub.id}`,
          type:     'subStory',
          position: { x: subX, y: subY },
          draggable: isAdmin,
          data: {
            sub,
            isAdmin,
            onEdit:          () => cbs.setModal({ type: 'edit-sub', sub, sideStories: cbs.getAllSides() }),
            onDelete:        () => cbs.deleteSub(sub.id),
            onTogglePublish: (v: boolean) => cbs.toggleSubPub(sub.id, v),
          },
        })

        edges.push({
          id:           `ss-${sub.id}`,
          source:       sideId,
          target:       `sub-${sub.id}`,
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type:         'step',
          className: 'rf-sub',
          style: { stroke: 'rgba(52,211,153,0.5)', strokeDasharray: '5 3', strokeWidth: 1.5 },
          selectable: false,
        })
      })

      // ── Event Story nodes (from linked punishments) ──
      side.event_punishments?.forEach((ep, ei) => {
        const eventId = `event-${side.id}-${ep.punishment_id}`
        const hasEvPos = (ep.position_x != null && ep.position_x !== 0) || (ep.position_y != null && ep.position_y !== 0)
        const eventX = hasEvPos ? (ep.position_x ?? 0) : sideX + SIDE_W + 30
        const eventY = hasEvPos ? (ep.position_y ?? 0) : sideY + 60 + ei * 140

        nodes.push({
          id: eventId,
          type: 'eventStory',
          position: { x: eventX, y: eventY },
          draggable: isAdmin,
          data: {
            punishment: ep,
            isAdmin,
          },
        })

        edges.push({
          id:           `ev-${side.id}-${ep.punishment_id}`,
          source:       sideId,
          target:       eventId,
          sourceHandle: 'right',
          targetHandle: 'left',
          type:         'step',
          className:    'rf-event',
          style: { stroke: 'rgba(245,158,11,0.5)', strokeDasharray: '6 3', strokeWidth: 1.5 },
          selectable:   false,
        })
      })
    })
  })

  return { nodes, edges }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TimelineView({ entries, isAdmin }: Props) {
  const router = useRouter()
  const [modal, setModal]                 = useState<ModalMode>(null)
  const [isPending, setIsPending]         = useState(false)
  const [confirmModal, setConfirmModal]   = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [isMobile, setIsMobile]           = useState(false)

  // Detect mobile screen (< 768px = Tailwind md breakpoint)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Lists for moderators/participants/punishments multi-selects
  const [adminDmProfiles, setAdminDmProfiles] = useState<{ id: string; display_name: string; avatar_url: string | null }[]>([])
  const [playerProfiles, setPlayerProfiles]   = useState<{ id: string; display_name: string; avatar_url: string | null }[]>([])
  const [punishmentsList, setPunishmentsList] = useState<{ id: string; name: string; description: string | null; archived: boolean }[]>([])

  // Fetch helper lists once for admin
  useEffect(() => {
    if (!isAdmin) return
    Promise.all([getAdminDmProfiles(), getPlayerProfiles(), getPunishmentsList()])
      .then(([adm, plr, pun]) => {
        setAdminDmProfiles(adm)
        setPlayerProfiles(plr)
        setPunishmentsList(pun)
      })
      .catch(() => {})
  }, [isAdmin])

  const askConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise(resolve => {
      setConfirmModal({
        message,
        onConfirm: () => { setConfirmModal(null); resolve(true) },
      })
    })
  }, [])

  // ── Server action wrappers ──────────────────────────────────────────────────
  const run = useCallback(async (fn: () => Promise<unknown>, close = false) => {
    setIsPending(true)
    try { await fn(); if (close) setModal(null); router.refresh() }
    finally { setIsPending(false) }
  }, [router])

  const handleCreateEntry  = (fd: FormData)               => run(() => createTimelineEntry(fd), true)
  const handleUpdateEntry  = (id: string, fd: FormData)   => run(() => updateTimelineEntry(id, fd), true)
  const handleDeleteEntry  = useCallback(async (id: string) => {
    if (!await askConfirm('ลบไทม์ไลน์หลักนี้? (Side Story และ Sub Story ที่เชื่อมจะถูกลบด้วย)')) return
    run(() => deleteTimelineEntry(id))
  }, [run, askConfirm])
  const handleToggleEntry  = useCallback((id: string, v: boolean) => run(() => toggleTimelinePublish(id, v)), [run])

  const handleCreateSide   = (fd: FormData)               => run(() => createSideStory(fd), true)
  const handleUpdateSide   = (id: string, fd: FormData)   => run(() => updateSideStory(id, fd), true)
  const handleDeleteSide   = useCallback(async (id: string) => {
    if (!await askConfirm('ลบ Side Story นี้? (Sub Story ที่เชื่อมจะถูกลบด้วย)')) return
    run(() => deleteSideStory(id))
  }, [run, askConfirm])
  const handleToggleSide   = useCallback((id: string, v: boolean) => run(() => toggleSideStoryPublish(id, v)), [run])

  const handleCreateSub    = (fd: FormData)               => run(() => createSubStory(fd), true)
  const handleUpdateSub    = (id: string, fd: FormData)   => run(() => updateSubStory(id, fd), true)
  const handleDeleteSub    = useCallback(async (id: string) => {
    if (!await askConfirm('ลบ Sub Story นี้?')) return
    run(() => deleteSubStory(id))
  }, [run, askConfirm])
  const handleToggleSub    = useCallback((id: string, v: boolean) => run(() => toggleSubStoryPublish(id, v)), [run])

  // ── Stable callback bundle (liveRef → no stale closures in node data) ───────
  const liveRef = useRef({
    entries, setModal,
    handleDeleteEntry, handleToggleEntry,
    handleDeleteSide, handleToggleSide,
    handleDeleteSub, handleToggleSub,
  })
  liveRef.current = {
    entries, setModal,
    handleDeleteEntry, handleToggleEntry,
    handleDeleteSide, handleToggleSide,
    handleDeleteSub, handleToggleSub,
  }

  const cbs = useMemo<Cbs>(() => ({
    getEntries:    () => liveRef.current.entries,
    getAllSides:    () => liveRef.current.entries.flatMap(e => e.timeline_side_stories ?? []),
    setModal:      (m) => liveRef.current.setModal(m),
    deleteEntry:   (id) => liveRef.current.handleDeleteEntry(id),
    toggleEntryPub:(id, v) => liveRef.current.handleToggleEntry(id, v),
    deleteSide:    (id) => liveRef.current.handleDeleteSide(id),
    toggleSidePub: (id, v) => liveRef.current.handleToggleSide(id, v),
    deleteSub:     (id) => liveRef.current.handleDeleteSub(id),
    toggleSubPub:  (id, v) => liveRef.current.handleToggleSub(id, v),
  }), []) // truly stable — always reads latest via liveRef

  // ── React Flow state ────────────────────────────────────────────────────────
  const { nodes: initN, edges: initE } = useMemo(
    () => buildGraph(entries, isAdmin, cbs), []
  )
  const [nodes, setNodes, onNodesChange] = useNodesState(initN)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initE)

  // Full rebuild when server data refreshes (after CRUD + router.refresh)
  useEffect(() => {
    const { nodes: n, edges: e } = buildGraph(entries, isAdmin, cbs)
    setNodes(n)
    setEdges(e)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, isAdmin])

  // Persist dragged positions silently (no router.refresh — React Flow already shows correct pos)
  const onNodeDragStop = useCallback(async (_: React.MouseEvent, node: Node) => {
    // Main entry nodes must not move — snap back to grid position
    if (node.type === 'mainEntry') {
      const entryId = node.id.replace('entry-', '')
      const idx = entries.findIndex(e => e.id === entryId)
      if (idx >= 0) {
        const canonicalY = computeMainYs(entries)[idx]
        const origPos = { x: CANVAS_CX - MAIN_W / 2, y: canonicalY }
        setNodes(nds => nds.map(n => n.id === node.id ? { ...n, position: origPos } : n))
      }
      return
    }
    if (node.type === 'sideStory') {
      await updateSideStoryPosition(node.id.slice(5), node.position.x, node.position.y).catch(() => {})
    }
    if (node.type === 'subStory') {
      await updateSubStoryPosition(node.id.slice(4), node.position.x, node.position.y).catch(() => {})
    }
    if (node.type === 'eventStory') {
      // event-{sideId}-{punishmentId}
      const _parts = node.id.replace('event-', '').split('-')
      // side_story_id is everything from first part to second-to-last, punishment_id is last part
      // Actually format: event-{sideId}-{punishmentId} — both are UUIDs
      // UUIDs contain dashes, so we need a different approach
      // The node id is: `event-${side.id}-${ep.punishment_id}` where both are UUIDs (36 chars each)
      const rest = node.id.slice(6) // remove "event-"
      const sideStoryId = rest.slice(0, 36)
      const punishmentId = rest.slice(37) // skip the dash
      await updateEventStoryPosition(sideStoryId, punishmentId, node.position.x, node.position.y).catch(() => {})
    }
  }, [entries, setNodes])

  const allSideStories = entries.flatMap(e => e.timeline_side_stories ?? [])

  return (
    <div
      className="flex flex-col"
      style={isMobile ? undefined : { height: 'calc(100vh - 80px)' }}
    >
      {/* ── Header ── */}
      <div className="text-center py-8 shrink-0 px-4">
        <h2 className="font-display text-3xl md:text-5xl heading-victorian mb-2">
          เส้นเรื่องแห่งเงามืด
        </h2>
        <p className="text-victorian-400 text-sm md:text-base max-w-xl mx-auto">
          ติดตามเหตุการณ์และเรื่องราวที่เกิดขึ้นในโลกแห่งศาสตร์เร้นลับ
        </p>
        {isAdmin && (
          <button
            onClick={() => setModal({ type: 'create-entry' })}
            disabled={isPending}
            className="mt-5 btn-gold text-sm !px-5 !py-2.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> เพิ่มไทม์ไลน์หลัก
          </button>
        )}
        {!isMobile && entries.length === 0 && (
          <p className="mt-10 text-victorian-400 text-lg">
            ยังไม่มีเส้นเรื่อง {isAdmin && '— กดปุ่มด้านบนเพื่อเริ่มสร้าง'}
          </p>
        )}
      </div>

      {/* ── Mobile: scrollable list view ── */}
      {isMobile && (
        <TimelineListView
          entries={entries}
          isAdmin={isAdmin}
          setModal={setModal}
          handleDeleteEntry={handleDeleteEntry}
          handleToggleEntry={handleToggleEntry}
          handleDeleteSide={handleDeleteSide}
          handleToggleSide={handleToggleSide}
          handleDeleteSub={handleDeleteSub}
          handleToggleSub={handleToggleSub}
        />
      )}

      {/* ── Desktop: React Flow canvas ── */}
      {!isMobile && (
      <div className="flex-1 min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.1, maxZoom: 1.5 }}
          nodesDraggable={isAdmin}
          panOnDrag
          nodesConnectable={false}
          zoomOnScroll
          style={{ background: 'transparent' }}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            color="rgba(184,134,11,0.07)"
            gap={28}
            size={1.5}
          />
          <Controls
            showInteractive={false}
            className="[&>button]:bg-victorian-900 [&>button]:border-gold-700/30 [&>button]:text-gold-300 [&>button:hover]:bg-victorian-800"
          />
          <MiniMap
            nodeColor={n => {
              if (n.type === 'mainEntry') return 'rgba(184,134,11,0.55)'
              if (n.type === 'sideStory') return 'rgba(99,179,237,0.55)'
              if (n.type === 'eventStory') return 'rgba(245,158,11,0.55)'
              return 'rgba(52,211,153,0.55)'
            }}
            maskColor="rgba(7,6,4,0.75)"
            style={{ background: 'rgba(10,9,6,0.9)', border: '1px solid rgba(184,134,11,0.2)', borderRadius: '6px' }}
          />
        </ReactFlow>
      </div>
      )}

      {/* ── Form Modal ── */}
      {modal && (
        <TimelineFormModal
          mode={modal}
          entries={entries}
          allSideStories={allSideStories}
          isPending={isPending}
          onClose={() => setModal(null)}
          onCreateEntry={handleCreateEntry}
          onUpdateEntry={handleUpdateEntry}
          onCreateSide={handleCreateSide}
          onUpdateSide={handleUpdateSide}
          onCreateSub={handleCreateSub}
          onUpdateSub={handleUpdateSub}
          adminDmProfiles={adminDmProfiles}
          playerProfiles={playerProfiles}
          punishments={punishmentsList}
        />
      )}

      {/* ── Confirm Modal ── */}
      {confirmModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setConfirmModal(null) }} />
          <div className="relative z-10 w-full max-w-sm mx-4 rounded-xl border border-red-500/30 bg-victorian-900 shadow-[0_0_40px_rgba(239,68,68,0.15)] overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-3 mb-5">
                <div className="mt-0.5 p-2 rounded-lg bg-red-900/40 border border-red-500/30 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-display text-lg text-gold-200 mb-1">ยืนยันการลบ</h3>
                  <p className="text-victorian-300 text-sm leading-relaxed">{confirmModal.message}</p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2 rounded-lg text-sm text-victorian-300 bg-victorian-800 border border-victorian-700 hover:bg-victorian-700 transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className="px-4 py-2 rounded-lg text-sm text-white bg-red-700 border border-red-500/50 hover:bg-red-600 transition cursor-pointer"
                >
                  ลบ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

