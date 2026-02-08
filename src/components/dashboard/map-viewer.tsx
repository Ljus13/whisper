'use client'

import type { GameMap, MapTokenWithProfile, MapLockedZone, Profile } from '@/lib/types/database'
import {
  addPlayerToMap, addNpcToMap, moveToken, removeTokenFromMap,
  createLockedZone, updateLockedZone, deleteLockedZone, toggleMapEmbed,
} from '@/app/actions/map-tokens'
import {
  ArrowLeft, ZoomIn, ZoomOut, Maximize, Move, Trash2, Lock,
  Users, X, Save, Code, MapPin, UserPlus, Ghost, Shield, Crown, Footprints,
} from 'lucide-react'
import Link from 'next/link'
import { useState, useRef, useCallback, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'

/* ══════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════ */
interface MapViewerProps {
  map: GameMap
  tokens: MapTokenWithProfile[]
  zones: MapLockedZone[]
  currentUser: Profile
  currentUserId: string
  isAdmin: boolean
  allPlayers: { id: string; display_name: string | null; avatar_url: string | null; role: string }[]
}

interface DragState {
  tokenId: string
  startX: number
  startY: number
  origPosX: number
  origPosY: number
  active: boolean
  longPressReady: boolean
}

const MIN_SCALE = 0.5
const MAX_SCALE = 5
const ZOOM_STEP = 0.3
const LONG_PRESS_MS = 400
const CLUSTER_THRESHOLD_PX = 44
const TOKEN_SIZE = 44

/* ══════════════════════════════════════════════
   UTILITY: cluster tokens that overlap
   ══════════════════════════════════════════════ */
interface TokenCluster {
  tokens: MapTokenWithProfile[]
  centerX: number
  centerY: number
}

function clusterTokens(
  tokens: MapTokenWithProfile[],
  scale: number,
  imgWidth: number,
  imgHeight: number,
): TokenCluster[] {
  if (tokens.length === 0) return []
  const used = new Set<number>()
  const clusters: TokenCluster[] = []
  const thresh = CLUSTER_THRESHOLD_PX / scale

  for (let i = 0; i < tokens.length; i++) {
    if (used.has(i)) continue
    const group = [tokens[i]]
    used.add(i)
    for (let j = i + 1; j < tokens.length; j++) {
      if (used.has(j)) continue
      const dx = ((tokens[i].position_x - tokens[j].position_x) / 100) * imgWidth
      const dy = ((tokens[i].position_y - tokens[j].position_y) / 100) * imgHeight
      if (Math.sqrt(dx * dx + dy * dy) < thresh) {
        group.push(tokens[j])
        used.add(j)
      }
    }
    const cx = group.reduce((s, t) => s + t.position_x, 0) / group.length
    const cy = group.reduce((s, t) => s + t.position_y, 0) / group.length
    clusters.push({ tokens: group, centerX: cx, centerY: cy })
  }
  return clusters
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════ */
export default function MapViewer({
  map, tokens: initialTokens, zones: initialZones,
  currentUser, currentUserId, isAdmin, allPlayers,
}: MapViewerProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Transform state ──
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [lastTouchDist, setLastTouchDist] = useState(0)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imgNatural, setImgNatural] = useState({ w: 1, h: 1 })

  // ── Data state (local copy for optimistic updates) ──
  const [tokens, setTokens] = useState(initialTokens)
  const [zones, setZones] = useState(initialZones)
  useEffect(() => { setTokens(initialTokens) }, [initialTokens])
  useEffect(() => { setZones(initialZones) }, [initialZones])

  // ── Token drag state ──
  const [drag, setDrag] = useState<DragState | null>(null)
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number } | null>(null)

  // ── UI state ──
  const [selectedCluster, setSelectedCluster] = useState<TokenCluster | null>(null)
  const [selectedToken, setSelectedToken] = useState<MapTokenWithProfile | null>(null)
  const [showNpcModal, setShowNpcModal] = useState(false)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [showZoneCreator, setShowZoneCreator] = useState(false)
  const [showEmbedModal, setShowEmbedModal] = useState(false)
  const [editingZone, setEditingZone] = useState<MapLockedZone | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'info' } | null>(null)
  const [isPending, startTransition] = useTransition()

  // ── Modal form state (lifted to parent to survive re-renders) ──
  const [npcName, setNpcName] = useState('')
  const [npcUrl, setNpcUrl] = useState('')
  const [selectedPlayerId, setSelectedPlayerId] = useState('')

  // ── My token ──
  const myToken = tokens.find(t => t.user_id === currentUserId)
  const isOnThisMap = myToken?.map_id === map.id

  // ── Toast helper ──
  function showToast(msg: string, type: 'error' | 'info' = 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Fit to screen ──
  const fitToScreen = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  const zoomIn = useCallback(() => setScale(s => Math.min(MAX_SCALE, s + ZOOM_STEP)), [])
  const zoomOut = useCallback(() => setScale(s => Math.max(MIN_SCALE, s - ZOOM_STEP)), [])

  // ── Mouse wheel zoom ──
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function handleWheel(e: WheelEvent) {
      e.preventDefault()
      setScale(s => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + (-e.deltaY * 0.001))))
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  // ── Image load (also handle cached images whose onLoad fires before React attaches) ──
  function onImageLoad() {
    setImageLoaded(true)
    if (imgRef.current) {
      setImgNatural({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight })
    }
  }
  useEffect(() => {
    const img = imgRef.current
    if (img && img.complete && img.naturalWidth > 0) {
      setImageLoaded(true)
      setImgNatural({ w: img.naturalWidth, h: img.naturalHeight })
    }
  }, [])

  /* ════════════════════════════════════════════
     PAN: mouse drag on background
     ════════════════════════════════════════════ */
  function handleBgMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    if (showZoneCreator) return
    setIsPanning(true)
    setPanStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }
  function handleBgMouseMove(e: React.MouseEvent) {
    if (isPanning) {
      setPosition({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
    }
  }
  function handleBgMouseUp() {
    if (isPanning) setIsPanning(false)
    clearLongPress()
  }

  /* ════════════════════════════════════════════
     PAN: touch (1-finger bg, 2-finger zoom)
     ════════════════════════════════════════════ */
  function getTouchDist(touches: React.TouchList) {
    if (touches.length < 2) return 0
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }
  function handleBgTouchStart(e: React.TouchEvent) {
    if (showZoneCreator) return
    if (e.touches.length === 1 && !drag) {
      setIsPanning(true)
      setPanStart({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y })
    } else if (e.touches.length === 2) {
      setLastTouchDist(getTouchDist(e.touches))
    }
  }
  function handleBgTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 1 && isPanning && !drag) {
      setPosition({ x: e.touches[0].clientX - panStart.x, y: e.touches[0].clientY - panStart.y })
    } else if (e.touches.length === 2) {
      const dist = getTouchDist(e.touches)
      if (lastTouchDist > 0) {
        setScale(s => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + (dist - lastTouchDist) * 0.005)))
      }
      setLastTouchDist(dist)
    }
  }
  function handleBgTouchEnd() {
    setIsPanning(false)
    setLastTouchDist(0)
    clearLongPress()
  }

  /* ════════════════════════════════════════════
     POINTER events: token drag move + drop
     (pointer events are NOT suppressed by
      preventDefault on pointerdown, unlike mouse)
     ════════════════════════════════════════════ */
  function handlePointerMove(e: React.PointerEvent) {
    if (drag?.active) {
      const pos = screenToMapPercent(e.clientX, e.clientY)
      if (pos) setDragPreview(pos)
    }
  }
  function handlePointerUp() {
    if (drag?.active) finalizeDrag()
    clearLongPress()
  }

  /* ════════════════════════════════════════════
     Convert screen coords → map percentage
     ════════════════════════════════════════════ */
  function screenToMapPercent(clientX: number, clientY: number) {
    const img = imgRef.current
    const container = containerRef.current
    if (!img || !container) return null
    const cr = container.getBoundingClientRect()
    // Center of the container
    const centerX = cr.width / 2 + cr.left
    const centerY = cr.height / 2 + cr.top
    // The image rendered size at scale=1
    const imgRect = img.getBoundingClientRect()
    const imgW = imgRect.width / scale
    const imgH = imgRect.height / scale
    // Position relative to the map image origin (top-left)
    const mapX = (clientX - centerX - position.x) / scale + imgW / 2
    const mapY = (clientY - centerY - position.y) / scale + imgH / 2
    return {
      x: Math.max(0, Math.min(100, (mapX / imgW) * 100)),
      y: Math.max(0, Math.min(100, (mapY / imgH) * 100)),
    }
  }

  /* ════════════════════════════════════════════
     TOKEN: long-press → drag
     ════════════════════════════════════════════ */
  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function canDragToken(token: MapTokenWithProfile) {
    if (isAdmin) return true
    return token.token_type === 'player' && token.user_id === currentUserId
  }

  function handleTokenPointerDown(e: React.PointerEvent, token: MapTokenWithProfile) {
    e.stopPropagation()
    e.preventDefault()
    if (!canDragToken(token)) return

    const newDrag: DragState = {
      tokenId: token.id,
      startX: e.clientX,
      startY: e.clientY,
      origPosX: token.position_x,
      origPosY: token.position_y,
      active: false,
      longPressReady: false,
    }
    setDrag(newDrag)
    setDragPreview({ x: token.position_x, y: token.position_y })

    clearLongPress()
    longPressTimer.current = setTimeout(() => {
      setDrag(prev => prev ? { ...prev, active: true, longPressReady: true } : null)
      // Haptic feedback on mobile
      if (navigator.vibrate) navigator.vibrate(30)
    }, LONG_PRESS_MS)
  }

  function handleTokenPointerUp(e: React.PointerEvent, token: MapTokenWithProfile) {
    e.stopPropagation()
    if (drag?.active) {
      finalizeDrag()
    } else {
      // Short tap — show info or cluster
      clearLongPress()
      setDrag(null)
      setDragPreview(null)
      handleTokenClick(token)
    }
  }

  function handleTokenClick(token: MapTokenWithProfile) {
    setSelectedToken(token)
    setSelectedCluster(null)
  }

  function handleClusterClick(cluster: TokenCluster) {
    setSelectedCluster(cluster)
    setSelectedToken(null)
  }

  /* ════════════════════════════════════════════
     TOKEN: finalize drag (optimistic + rollback)
     ════════════════════════════════════════════ */
  function finalizeDrag() {
    if (!drag || !dragPreview) {
      setDrag(null)
      setDragPreview(null)
      return
    }

    const tokenId = drag.tokenId
    const newX = dragPreview.x
    const newY = dragPreview.y
    const origX = drag.origPosX
    const origY = drag.origPosY

    // Optimistic update
    setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, position_x: newX, position_y: newY } : t))
    setDrag(null)
    setDragPreview(null)

    // Send to server
    startTransition(async () => {
      const result = await moveToken(tokenId, newX, newY)
      if (result?.error) {
        // Rollback
        setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, position_x: origX, position_y: origY } : t))
        showToast(result.error, 'error')
      } else if (result?.cost && result.cost > 0) {
        showToast(`เดินทางสำเร็จ (−${result.cost} แต้มเดินทาง)`, 'info')
        router.refresh()
      }
    })
  }

  /* ════════════════════════════════════════════
     PLAYER: Join this map
     ════════════════════════════════════════════ */
  function handleJoinMap() {
    startTransition(async () => {
      const result = await addPlayerToMap(map.id)
      if (result?.error) {
        showToast(result.error, 'error')
      } else {
        showToast('เข้าร่วมแมพสำเร็จ!', 'info')
        router.refresh()
      }
    })
  }

  /* ════════════════════════════════════════════
     ADMIN: Locked Zone Creator / Editor
     ════════════════════════════════════════════ */
  function ZoneEditor({ zone, onClose }: { zone?: MapLockedZone | null; onClose: () => void }) {
    const isEdit = !!zone
    const [zx, setZx] = useState(zone?.zone_x ?? 25)
    const [zy, setZy] = useState(zone?.zone_y ?? 25)
    const [zw, setZw] = useState(zone?.zone_width ?? 20)
    const [zh, setZh] = useState(zone?.zone_height ?? 20)
    const [msg, setMsg] = useState(zone?.message ?? 'พื้นที่นี้ถูกล็อค')
    const [allowed, setAllowed] = useState<string[]>(zone?.allowed_user_ids ?? [])
    const [err, setErr] = useState('')

    // ── Resizable preview overlay ──
    const _zoneRef = useRef<HTMLDivElement>(null)
    const resizing = useRef<string | null>(null)
    const resizeStart = useRef({ x: 0, y: 0, zx: 0, zy: 0, zw: 0, zh: 0 })

    function onResizeStart(handle: string, e: React.PointerEvent) {
      e.stopPropagation()
      e.preventDefault()
      resizing.current = handle
      resizeStart.current = { x: e.clientX, y: e.clientY, zx, zy, zw, zh }
      window.addEventListener('pointermove', onResizeMove)
      window.addEventListener('pointerup', onResizeEnd)
    }

    function onResizeMove(e: PointerEvent) {
      if (!resizing.current) return
      const img = imgRef.current
      if (!img) return
      const imgRect = img.getBoundingClientRect()
      const dxPct = ((e.clientX - resizeStart.current.x) / imgRect.width) * 100
      const dyPct = ((e.clientY - resizeStart.current.y) / imgRect.height) * 100
      const h = resizing.current
      let nx = resizeStart.current.zx, ny = resizeStart.current.zy
      let nw = resizeStart.current.zw, nh = resizeStart.current.zh

      if (h.includes('l')) { nx += dxPct; nw -= dxPct }
      if (h.includes('r')) { nw += dxPct }
      if (h.includes('t')) { ny += dyPct; nh -= dyPct }
      if (h.includes('b')) { nh += dyPct }
      if (h === 'move') { nx += dxPct; ny += dyPct }

      nw = Math.max(3, nw); nh = Math.max(3, nh)
      nx = Math.max(0, Math.min(100 - nw, nx))
      ny = Math.max(0, Math.min(100 - nh, ny))
      setZx(nx); setZy(ny); setZw(nw); setZh(nh)
    }

    function onResizeEnd() {
      resizing.current = null
      window.removeEventListener('pointermove', onResizeMove)
      window.removeEventListener('pointerup', onResizeEnd)
    }

    function handleSave() {
      const data = { zone_x: zx, zone_y: zy, zone_width: zw, zone_height: zh, message: msg, allowed_user_ids: allowed }
      startTransition(async () => {
        const r = isEdit ? await updateLockedZone(zone!.id, data) : await createLockedZone(map.id, data)
        if (r?.error) setErr(r.error)
        else { onClose(); router.refresh() }
      })
    }

    function handleDeleteZone() {
      if (!zone || !confirm('ลบพื้นที่ล็อคนี้?')) return
      startTransition(async () => {
        await deleteLockedZone(zone.id)
        onClose()
        router.refresh()
      })
    }

    function toggleAllowed(uid: string) {
      setAllowed(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid])
    }

    return (
      <>
        {/* Live zone preview on the map */}
        <div className="absolute pointer-events-auto" style={{
          left: `${zx}%`, top: `${zy}%`, width: `${zw}%`, height: `${zh}%`,
          border: '2px dashed #D4AF37', backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 9999, position: 'absolute',
        }}
        onMouseDown={e => { e.stopPropagation(); e.preventDefault() }}
        onMouseMove={e => e.stopPropagation()}
        onMouseUp={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}>
          {/* Resize handles — scaled inversely so they stay usable at any zoom */}
          {['tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r', 'move'].map(h => {
            const handleSize = h === 'move' ? undefined : Math.max(16, 16 / scale)
            return (
              <div key={h}
                onPointerDown={e => onResizeStart(h, e)}
                className="absolute touch-none"
                style={{
                  ...handlePosition(h),
                  width: h === 'move' ? '60%' : handleSize, height: h === 'move' ? '60%' : handleSize,
                  cursor: h === 'move' ? 'move' : `${h.replace('t', 'n').replace('b', 's')}-resize`,
                  backgroundColor: h === 'move' ? 'transparent' : '#D4AF37',
                  borderRadius: h === 'move' ? 0 : '50%',
                  zIndex: h === 'move' ? 0 : 2,
                  transform: h === 'move' ? undefined : `translate(-50%, -50%) scale(${1 / scale})`,
                }}
              />
            )
          })}
          <Lock className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-gold-400" />
        </div>

        {/* Settings panel */}
        <div className="fixed right-0 top-0 bottom-0 w-80 z-50 border-l border-gold-400/20 p-5 overflow-y-auto"
          style={{ backgroundColor: '#1A1612' }}
          onMouseDown={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="heading-victorian text-xl">{isEdit ? 'แก้ไขพื้นที่ล็อค' : 'สร้างพื้นที่ล็อค'}</h3>
            <button onClick={onClose} className="text-victorian-400 hover:text-gold-400 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
          {err && <p className="text-nouveau-ruby text-sm mb-3">{err}</p>}
          <label className="block text-xs text-gold-400 mb-1 font-display uppercase tracking-wider">ข้อความแจ้งเตือน</label>
          <input value={msg} onChange={e => setMsg(e.target.value)} className="input-victorian !py-2 !px-3 w-full mb-4" />
          
          <p className="text-xs text-gold-400 mb-2 font-display uppercase tracking-wider">อนุญาตให้ผู้เล่น</p>
          <div className="max-h-40 overflow-y-auto space-y-1 mb-4 border border-gold-400/10 rounded-sm p-2">
            {allPlayers.filter(p => p.role === 'player').map(p => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-victorian-300 cursor-pointer hover:text-nouveau-cream">
                <input type="checkbox" checked={allowed.includes(p.id)} onChange={() => toggleAllowed(p.id)}
                  className="accent-gold-400" />
                {p.display_name || p.id.slice(0, 8)}
              </label>
            ))}
          </div>

          <p className="text-[10px] text-victorian-500 mb-4">ลากมุมบนแผนที่เพื่อปรับขนาดพื้นที่</p>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={isPending}
              className="btn-gold !py-2 !px-4 !text-sm flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
              <Save className="w-4 h-4" />{isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            {isEdit && (
              <button onClick={handleDeleteZone} disabled={isPending}
                className="px-3 py-2 text-nouveau-ruby border border-nouveau-ruby/30 rounded-sm hover:bg-nouveau-ruby/10 cursor-pointer disabled:opacity-50">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </>
    )
  }

  /* ════════════════════════════════════════════
     EMBED MODAL
     ════════════════════════════════════════════ */
  function EmbedModal() {
    const embedUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/embed/maps/${map.id}`
      : ''
    const iframeCode = `<iframe src="${embedUrl}" width="800" height="600" frameborder="0" style="border:1px solid #333;border-radius:4px;"></iframe>`
    const [copied, setCopied] = useState(false)

    function copy() {
      navigator.clipboard.writeText(iframeCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }

    function toggleEmbed() {
      startTransition(async () => {
        await toggleMapEmbed(map.id, !map.embed_enabled)
        router.refresh()
      })
    }

    return (
      <ModalOverlay onClose={() => setShowEmbedModal(false)} title="Embed แผนที่">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-victorian-300">เปิด Public Embed</span>
          <button onClick={toggleEmbed}
            className={`w-12 h-6 rounded-full transition-colors cursor-pointer ${map.embed_enabled ? 'bg-gold-400' : 'bg-victorian-700'}`}>
            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${map.embed_enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {map.embed_enabled ? (
          <>
            <pre className="text-[11px] text-victorian-400 bg-victorian-900 p-3 rounded-sm overflow-x-auto mb-3 border border-gold-400/10">
              {iframeCode}
            </pre>
            <button onClick={copy} className="btn-gold !py-2 !px-4 !text-sm w-full">
              {copied ? 'คัดลอกแล้ว!' : 'คัดลอก iframe'}
            </button>
          </>
        ) : (
          <p className="text-victorian-500 text-sm">เปิดสวิตช์ด้านบน เพื่อเปิดใช้ลิงก์ embed สาธารณะ</p>
        )}
      </ModalOverlay>
    )
  }

  /* ════════════════════════════════════════════
     RENDER: Compute clusters
     ════════════════════════════════════════════ */
  const imgDisplay = imgRef.current
    ? { w: imgRef.current.clientWidth, h: imgRef.current.clientHeight }
    : { w: imgNatural.w, h: imgNatural.h }
  const clusters = clusterTokens(tokens, scale, imgDisplay.w, imgDisplay.h)

  /* ════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════ */
  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ backgroundColor: '#0D0B09' }}>
      {/* ── TOP BAR ── */}
      <div className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-gold-400/10 gap-4"
        style={{ backgroundColor: '#1A1612' }}>
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/dashboard/maps"
            className="p-4 text-victorian-400 hover:text-gold-400 border border-gold-400/10 hover:border-gold-400/30 rounded-sm transition-all shrink-0 cursor-pointer">
            <ArrowLeft className="w-8 h-8" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-display text-gold-400 text-4xl truncate leading-tight">{map.name}</h1>
            {map.description && <p className="text-victorian-500 text-lg truncate">{map.description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Travel points indicator */}
          <div className="hidden sm:flex items-center gap-2 text-victorian-400 text-xl mr-4 border border-gold-400/10 rounded-sm px-4 py-2 bg-black/20">
            <Footprints className="w-6 h-6 text-gold-400" />
            <span className="tabular-nums font-bold text-nouveau-cream">{currentUser.travel_points}/{currentUser.max_travel_points}</span>
          </div>

          <button onClick={zoomOut} className="p-3 text-victorian-400 hover:text-gold-400 border border-gold-400/10 hover:border-gold-400/30 rounded-sm cursor-pointer"><ZoomOut className="w-8 h-8" /></button>
          <span className="text-victorian-400 text-xl font-display min-w-[3.5rem] text-center tabular-nums">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} className="p-3 text-victorian-400 hover:text-gold-400 border border-gold-400/10 hover:border-gold-400/30 rounded-sm cursor-pointer"><ZoomIn className="w-8 h-8" /></button>
          <button onClick={fitToScreen} className="p-3 text-victorian-400 hover:text-gold-400 border border-gold-400/10 hover:border-gold-400/30 rounded-sm cursor-pointer"><Maximize className="w-8 h-8" /></button>

          {/* Admin controls */}
          {isAdmin && (
            <>
              <div className="w-px h-10 bg-gold-400/10 mx-2" />
              <button onClick={() => { setNpcName(''); setNpcUrl(''); setShowNpcModal(true) }} title="เพิ่ม NPC"
                className="p-3 text-victorian-400 hover:text-gold-400 border border-gold-400/10 hover:border-gold-400/30 rounded-sm cursor-pointer"><Ghost className="w-8 h-8" /></button>
              <button onClick={() => { setSelectedPlayerId(''); setShowAddPlayer(true) }} title="เพิ่มผู้เล่น"
                className="p-3 text-victorian-400 hover:text-gold-400 border border-gold-400/10 hover:border-gold-400/30 rounded-sm cursor-pointer"><UserPlus className="w-8 h-8" /></button>
              <button onClick={() => { setShowZoneCreator(true); setEditingZone(null) }} title="ล็อคพื้นที่"
                className="p-3 text-victorian-400 hover:text-gold-400 border border-gold-400/10 hover:border-gold-400/30 rounded-sm cursor-pointer"><Lock className="w-8 h-8" /></button>
              <button onClick={() => setShowEmbedModal(true)} title="Embed"
                className="p-3 text-victorian-400 hover:text-gold-400 border border-gold-400/10 hover:border-gold-400/30 rounded-sm cursor-pointer"><Code className="w-8 h-8" /></button>
            </>
          )}
        </div>
      </div>

      {/* ── YOU ARE HERE banner ── */}
      {isOnThisMap && (
        <div className="relative z-10 flex items-center justify-center gap-3 px-6 py-4 border-b border-gold-400/20 shadow-lg shadow-gold-900/10"
          style={{ backgroundColor: '#1d1a14' }}>
          <span className="relative flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-gold-400" />
          </span>
          <span className="text-gold-400 text-2xl font-display tracking-widest uppercase text-shadow-glow">คุณกำลังอยู่ในแมพนี้</span>
        </div>
      )}

      {/* ── PLAYER JOIN BUTTON ── */}
      {!isOnThisMap && !isAdmin && (
        <div className="relative z-10 flex items-center justify-center gap-4 px-6 py-4 border-b border-gold-400/10"
          style={{ backgroundColor: '#1d1a14' }}>
          <button onClick={handleJoinMap} disabled={isPending}
            className="btn-gold !py-3 !px-8 !text-xl flex items-center gap-3 disabled:opacity-50">
            <MapPin className="w-6 h-6" />
            {myToken ? `ย้ายมาแมพนี้ (−3 แต้ม)` : 'เข้าร่วมแมพนี้'}
          </button>
          {myToken && (
            <span className="text-victorian-500 text-lg">แต้มเดินทาง: {currentUser.travel_points}</span>
          )}
        </div>
      )}

      {/* ── MAP CANVAS ── */}
      <div ref={containerRef}
        className={`flex-1 overflow-hidden relative ${showZoneCreator ? 'cursor-default' : drag?.active ? 'cursor-grabbing' : isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleBgMouseDown}
        onMouseMove={handleBgMouseMove}
        onMouseUp={handleBgMouseUp}
        onMouseLeave={handleBgMouseUp}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleBgTouchStart}
        onTouchMove={handleBgTouchMove}
        onTouchEnd={handleBgTouchEnd}
        style={{ touchAction: 'none' }}>

        {/* Loading */}
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-victorian-500 text-sm font-display">กำลังโหลดแผนที่...</p>
            </div>
          </div>
        )}

        {/* Map image + token layer + zone layer */}
        <div className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isPanning || drag?.active ? 'none' : 'transform 0.15s ease-out',
          }}>
          {/* Image */}
          <div className="relative">
            <img ref={imgRef} src={map.image_url} alt={map.name}
              className="max-w-full max-h-full object-contain select-none block"
              draggable={false} onLoad={onImageLoad} />

            {/* ── LOCKED ZONES ── */}
            {imageLoaded && zones.map(z => (
              <div key={z.id}
                className="absolute group/zone"
                style={{ left: `${z.zone_x}%`, top: `${z.zone_y}%`, width: `${z.zone_width}%`, height: `${z.zone_height}%` }}
                onClick={e => { e.stopPropagation(); if (isAdmin) { setEditingZone(z); setShowZoneCreator(true) } }}>
                <div className="absolute inset-0 bg-black/60 border border-gold-400/20" />
                <Lock className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gold-400/40"
                  style={{ width: `${Math.min(24, 24 / scale)}px`, height: `${Math.min(24, 24 / scale)}px` }} />
                {isAdmin && (
                  <div className="absolute -top-6 left-0 opacity-0 group-hover/zone:opacity-100 transition-opacity bg-victorian-900/90 border border-gold-400/20 rounded-sm px-2 py-0.5 text-[10px] text-gold-400 whitespace-nowrap"
                    style={{ transform: `scale(${1 / scale})`, transformOrigin: 'bottom left' }}>
                    คลิกเพื่อแก้ไข
                  </div>
                )}
              </div>
            ))}

            {/* ── Zone editor live preview ── */}
            {showZoneCreator && (
              <ZoneEditor zone={editingZone} onClose={() => { setShowZoneCreator(false); setEditingZone(null) }} />
            )}

            {/* ── TOKEN CLUSTERS ── */}
            {imageLoaded && clusters.map((cluster, ci) => {
              const isCluster = cluster.tokens.length > 1
              const displayToken = cluster.tokens[0]
              const isDragTarget = drag?.active && cluster.tokens.some(t => t.id === drag.tokenId)

              // If dragging this token, use preview position
              const cx = isDragTarget && dragPreview ? dragPreview.x : cluster.centerX
              const cy = isDragTarget && dragPreview ? dragPreview.y : cluster.centerY

              return (
                <div key={ci}
                  className={`absolute ${isDragTarget ? 'z-50' : 'z-20'}`}
                  style={{
                    left: `${cx}%`, top: `${cy}%`,
                    transform: `translate(-50%, -50%) scale(${1 / scale})`,
                    transition: isDragTarget ? 'none' : 'left 0.3s ease, top 0.3s ease',
                  }}>
                  {/* Token circle */}
                  <div
                    className={`relative select-none touch-none cursor-pointer
                      ${isDragTarget ? 'ring-2 ring-gold-400 scale-125' : ''}
                      ${drag?.tokenId === displayToken.id && !drag.active ? 'ring-2 ring-gold-400/50 animate-pulse' : ''}
                    `}
                    style={{ width: TOKEN_SIZE, height: TOKEN_SIZE }}
                    onPointerDown={e => !isCluster && handleTokenPointerDown(e, displayToken)}
                    onPointerUp={e => !isCluster && handleTokenPointerUp(e, displayToken)}
                    onClick={e => { e.stopPropagation(); if (isCluster) { handleClusterClick(cluster) } else { handleTokenClick(displayToken) } }}
                  >
                    <div className={`w-full h-full rounded-full overflow-hidden border-2 
                      ${displayToken.user_id === currentUserId ? 'border-gold-400 shadow-[0_0_8px_rgba(212,175,55,0.5)]' : 
                        displayToken.token_type === 'npc' ? 'border-nouveau-ruby/60' : 'border-victorian-400/60'}`}>
                      {(displayToken.avatar_url || displayToken.npc_image_url) ? (
                        <img src={displayToken.avatar_url || displayToken.npc_image_url || ''}
                          className="w-full h-full object-cover" draggable={false} alt="" />
                      ) : (
                        <div className="w-full h-full bg-victorian-800 flex items-center justify-center text-gold-400 text-xs font-display">
                          {(displayToken.display_name || displayToken.npc_name || '?')[0]}
                        </div>
                      )}
                    </div>
                    {/* Name label */}
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-display text-nouveau-cream/80 bg-black/60 px-1 rounded-sm">
                      {displayToken.display_name || displayToken.npc_name || '?'}
                    </div>
                    {/* Cluster count badge */}
                    {isCluster && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-nouveau-ruby text-white text-[10px] flex items-center justify-center font-bold">
                        {cluster.tokens.length}
                      </div>
                    )}
                    {/* Role icon */}
                    {displayToken.role === 'admin' && (
                      <Crown className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 text-gold-400" />
                    )}
                    {displayToken.role === 'dm' && (
                      <Shield className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 text-gold-400" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Drag hint ── */}
        {imageLoaded && !drag && scale <= 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5
                          bg-victorian-900/80 border border-gold-400/10 rounded-full text-victorian-500 text-[10px]
                          pointer-events-none animate-fade-in">
            <Move className="w-3 h-3" />
            ลากเพื่อเลื่อน • ซูมด้วยสกรอลล์ • กดค้างตัวละครเพื่อย้าย
          </div>
        )}

        {/* ── Drag active indicator ── */}
        {drag?.active && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2
                          bg-gold-400/20 border border-gold-400/40 rounded-full text-gold-400 text-xs font-display
                          pointer-events-none animate-pulse">
            <Footprints className="w-4 h-4" />
            กำลังย้ายตัวละคร — ปล่อยเพื่อวาง (−1 แต้ม)
          </div>
        )}
      </div>

      {/* ══ MODALS / POPUPS ══ */}

      {/* Token info popup */}
      {selectedToken && !showZoneCreator && (
        <TokenInfoPopup token={selectedToken} isAdmin={isAdmin}
          isMe={selectedToken.user_id === currentUserId}
          onClose={() => setSelectedToken(null)}
          onRemove={() => {
            startTransition(async () => {
              await removeTokenFromMap(selectedToken.id)
              setSelectedToken(null)
              router.refresh()
            })
          }}
        />
      )}

      {/* Cluster popup */}
      {selectedCluster && !showZoneCreator && (
        <ClusterPopup cluster={selectedCluster} currentUserId={currentUserId} isAdmin={isAdmin}
          onSelectToken={t => { setSelectedCluster(null); setSelectedToken(t) }}
          onClose={() => setSelectedCluster(null)}
          onDragToken={(t, e) => { setSelectedCluster(null); handleTokenPointerDown(e, t) }}
        />
      )}

      {/* NPC Modal — inline to avoid inner-component re-mount */}
      {showNpcModal && (
        <ModalOverlay onClose={() => setShowNpcModal(false)} title="เพิ่ม NPC">
          <label className="block text-xs text-gold-400 mb-1 font-display uppercase tracking-wider">ชื่อ NPC *</label>
          <input value={npcName} onChange={e => setNpcName(e.target.value)} className="input-victorian !py-2 !px-3 w-full mb-3" placeholder="เช่น ดาบ์แห่งเงา" />
          <label className="block text-xs text-gold-400 mb-1 font-display uppercase tracking-wider">URL รูป *</label>
          <input value={npcUrl} onChange={e => setNpcUrl(e.target.value)} className="input-victorian !py-2 !px-3 w-full mb-4" placeholder="https://..." />
          <button onClick={() => {
            startTransition(async () => {
              const r = await addNpcToMap(map.id, npcName, npcUrl)
              if (r?.error) showToast(r.error, 'error')
              else { setShowNpcModal(false); setNpcName(''); setNpcUrl(''); router.refresh() }
            })
          }} disabled={isPending} className="btn-gold !py-2 !px-4 !text-sm w-full flex items-center justify-center gap-2">
            <Ghost className="w-4 h-4" />{isPending ? 'กำลังเพิ่ม...' : 'เพิ่ม NPC'}
          </button>
        </ModalOverlay>
      )}

      {/* Add Player — inline to avoid inner-component re-mount */}
      {showAddPlayer && (
        <ModalOverlay onClose={() => setShowAddPlayer(false)} title="เพิ่มผู้เล่นเข้าแมพ">
          <select value={selectedPlayerId} onChange={e => setSelectedPlayerId(e.target.value)}
            className="input-victorian !py-2 !px-3 w-full mb-4">
            <option value="">— เลือกผู้เล่น —</option>
            {allPlayers.map(p => (
              <option key={p.id} value={p.id}>{p.display_name || p.id.slice(0, 8)} ({p.role})</option>
            ))}
          </select>
          <button onClick={() => {
            if (!selectedPlayerId) return
            startTransition(async () => {
              const r = await addPlayerToMap(map.id, selectedPlayerId)
              if (r?.error) showToast(r.error, 'error')
              else { setShowAddPlayer(false); setSelectedPlayerId(''); router.refresh() }
            })
          }} disabled={isPending || !selectedPlayerId}
            className="btn-gold !py-2 !px-4 !text-sm w-full flex items-center justify-center gap-2 disabled:opacity-50">
            <UserPlus className="w-4 h-4" />{isPending ? 'กำลังเพิ่ม...' : 'เพิ่มเข้าแมพ'}
          </button>
        </ModalOverlay>
      )}

      {/* Embed Modal */}
      {showEmbedModal && <EmbedModal />}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-sm border text-sm font-display
          ${toast.type === 'error' ? 'bg-nouveau-ruby/20 border-nouveau-ruby/40 text-nouveau-ruby' : 'bg-gold-400/10 border-gold-400/30 text-gold-400'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}


/* ══════════════════════════════════════════════
   SUB-COMPONENTS
   ══════════════════════════════════════════════ */

function ModalOverlay({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 shadow-2xl" onClick={onClose}
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-2xl border-2 border-gold-400/30 rounded-sm p-8"
        style={{ backgroundColor: '#1A1612' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-8 border-b border-gold-400/20 pb-4">
          <h3 className="heading-victorian text-4xl text-shadow-glow">{title}</h3>
          <button onClick={onClose} className="text-victorian-400 hover:text-gold-400 cursor-pointer p-2 hover:bg-white/5 rounded-full"><X className="w-10 h-10" /></button>
        </div>
        <div className="text-xl">
          {children}
        </div>
      </div>
    </div>
  )
}

function TokenInfoPopup({ token, isAdmin, isMe, onClose, onRemove }: {
  token: MapTokenWithProfile; isAdmin: boolean; isMe: boolean;
  onClose: () => void; onRemove: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-lg border-2 border-gold-400/40 rounded-sm p-8 shadow-2xl shadow-gold-900/20"
        style={{ backgroundColor: '#1A1612' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-6 mb-6">
          <div className={`w-24 h-24 rounded-full overflow-hidden border-4 shrink-0 shadow-lg
            ${token.user_id && isMe ? 'border-gold-400 shadow-gold-400/20' : token.token_type === 'npc' ? 'border-nouveau-ruby/60' : 'border-victorian-400/60'}`}>
            {(token.avatar_url || token.npc_image_url) ? (
              <img src={token.avatar_url || token.npc_image_url || ''} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full bg-victorian-800 flex items-center justify-center text-gold-400 font-display text-4xl">
                {(token.display_name || token.npc_name || '?')[0]}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-gold-400 text-3xl truncate mb-1 text-shadow-glow">{token.display_name || token.npc_name}</p>
            <p className="text-xl text-victorian-400">
              {token.token_type === 'npc' ? 'NPC' : token.role === 'admin' ? 'แอดมิน' : token.role === 'dm' ? 'DM' : 'ผู้เล่น'}
              {isMe && ' (คุณ)'}
            </p>
          </div>
          <button onClick={onClose} className="self-start -mt-2 -mr-2 text-victorian-400 hover:text-gold-400 cursor-pointer p-2"><X className="w-8 h-8" /></button>
        </div>
        {isAdmin && (
          <button onClick={onRemove}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 text-xl font-bold text-nouveau-ruby border-2 border-nouveau-ruby/30 hover:border-nouveau-ruby/60 rounded-sm cursor-pointer hover:bg-nouveau-ruby/10 transition-colors">
            <Trash2 className="w-6 h-6" /> ลบออกจากแมพ
          </button>
        )}
      </div>
    </div>
  )
}

function ClusterPopup({ cluster, currentUserId, isAdmin: _isAdmin, onSelectToken, onClose, onDragToken: _onDragToken }: {
  cluster: TokenCluster; currentUserId: string; isAdmin: boolean;
  onSelectToken: (t: MapTokenWithProfile) => void; onClose: () => void;
  onDragToken: (t: MapTokenWithProfile, e: React.PointerEvent) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-lg border-2 border-gold-400/30 rounded-sm p-6 shadow-2xl"
        style={{ backgroundColor: '#1A1612' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6 border-b border-gold-400/10 pb-4">
          <h4 className="heading-victorian text-2xl flex items-center gap-3 text-gold-400">
            <Users className="w-6 h-6" /> ผู้ที่อยู่ในพื้นที่นี้ ({cluster.tokens.length})
          </h4>
          <button onClick={onClose} className="text-victorian-400 hover:text-gold-400 cursor-pointer p-2"><X className="w-6 h-6" /></button>
        </div>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {cluster.tokens.map(t => (
            <button key={t.id} onClick={() => onSelectToken(t)}
              className="w-full flex items-center gap-4 p-4 rounded-sm border border-gold-400/10 hover:border-gold-400/50 hover:bg-white/5 transition-all cursor-pointer text-left group">
              <div className={`w-16 h-16 rounded-full overflow-hidden border-2 shrink-0 shadow-md group-hover:scale-105 transition-transform
                ${t.user_id === currentUserId ? 'border-gold-400' : t.token_type === 'npc' ? 'border-nouveau-ruby/40' : 'border-victorian-400/40'}`}>
                {(t.avatar_url || t.npc_image_url) ? (
                  <img src={t.avatar_url || t.npc_image_url || ''} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full bg-victorian-800 flex items-center justify-center text-gold-400 text-xl font-display">
                    {(t.display_name || t.npc_name || '?')[0]}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xl font-display text-nouveau-cream truncate group-hover:text-gold-400 transition-colors">{t.display_name || t.npc_name}</p>
                <p className="text-sm text-victorian-400">{t.token_type === 'npc' ? 'NPC' : t.user_id === currentUserId ? 'คุณ' : 'ผู้เล่น'}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* Resize handle CSS positions */
function handlePosition(h: string): React.CSSProperties {
  switch (h) {
    case 'tl': return { top: -6, left: -6 }
    case 'tr': return { top: -6, right: -6 }
    case 'bl': return { bottom: -6, left: -6 }
    case 'br': return { bottom: -6, right: -6 }
    case 't': return { top: -6, left: '50%', transform: 'translateX(-50%)' }
    case 'b': return { bottom: -6, left: '50%', transform: 'translateX(-50%)' }
    case 'l': return { top: '50%', left: -6, transform: 'translateY(-50%)' }
    case 'r': return { top: '50%', right: -6, transform: 'translateY(-50%)' }
    case 'move': return { top: '20%', left: '20%' }
    default: return {}
  }
}
