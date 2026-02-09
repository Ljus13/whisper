'use client'

import type { GameMap, MapTokenWithProfile, MapLockedZone, Profile } from '@/lib/types/database'
import {
  addPlayerToMap, addNpcToMap, moveToken, removeTokenFromMap,
  createLockedZone, updateLockedZone, deleteLockedZone, toggleMapEmbed,
} from '@/app/actions/map-tokens'
import {
  ArrowLeft, ZoomIn, ZoomOut, Maximize, Move, Trash2, Lock,
  Users, X, Save, Code, MapPin, UserPlus, Ghost, Shield, Crown, Footprints,
  Info,
} from 'lucide-react'
import Link from 'next/link'
import { useState, useRef, useCallback, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import SanityLockOverlay from '@/components/sanity-lock-overlay'
import { createClient } from '@/lib/supabase/client'
import { getCached, setCache } from '@/lib/client-cache'

/* ══════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════ */
interface MapViewerProps {
  userId: string
  mapId: string
}

type AllPlayer = { id: string; display_name: string | null; avatar_url: string | null; role: string }

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
export default function MapViewer({ userId, mapId }: MapViewerProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── Fix #3: Track pending moves to prevent realtime overwrite ── */
  const pendingMovesRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  /* ── Fix #4: Track if a drag just ended to prevent click handler ── */
  const justDraggedRef = useRef(false)

  /* ── client-side data ── */
  const currentUserId = userId
  const [map, setMap] = useState<GameMap>(getCached(`mv:${mapId}:map`) ?? {} as GameMap)
  const [currentUser, setCurrentUser] = useState<Profile>(getCached(`mv:${mapId}:me`) ?? {} as Profile)
  const [isAdmin, setIsAdmin] = useState<boolean>(getCached(`mv:${mapId}:admin`) ?? false)
  const [allPlayers, setAllPlayers] = useState<AllPlayer[]>(getCached(`mv:${mapId}:players`) ?? [])
  const [loaded, setLoaded] = useState(!!getCached(`mv:${mapId}:map`))

  // ── Transform state ──
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [lastTouchDist, setLastTouchDist] = useState(0)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imgNatural, setImgNatural] = useState({ w: 1, h: 1 })

  // ── Data state (local copy for optimistic updates) ──
  const [tokens, setTokens] = useState<MapTokenWithProfile[]>(getCached(`mv:${mapId}:tokens`) ?? [])
  const [zones, setZones] = useState<MapLockedZone[]>(getCached(`mv:${mapId}:zones`) ?? [])

  useEffect(() => {
    const supabase = createClient()

    const fetchMapData = () => {
      Promise.all([
        supabase.from('maps').select('*').eq('id', mapId).single(),
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('map_tokens').select('*').eq('map_id', mapId),
        supabase.from('map_locked_zones').select('*').eq('map_id', mapId),
      ]).then(async ([mapRes, profileRes, rawTokensRes, zonesRes]) => {
        if (mapRes.error || !mapRes.data || !profileRes.data) {
          if (mapRes.error) console.error('Map fetch error:', mapRes.error)
          return
        }
        const mapData = mapRes.data as GameMap
        const profile = profileRes.data as Profile
        const rawTokens = rawTokensRes.data ?? []
        const zoneData = (zonesRes.data ?? []) as MapLockedZone[]
        const admin = profile.role === 'admin' || profile.role === 'dm'

        const playerIds = rawTokens.filter(t => t.token_type === 'player' && t.user_id).map(t => t.user_id!)
        const [playerProfiles, adminPlayers] = await Promise.all([
          playerIds.length > 0
            ? supabase.from('profiles').select('id, display_name, avatar_url, role').in('id', playerIds)
            : Promise.resolve({ data: null }),
          admin
            ? supabase.from('profiles').select('id, display_name, avatar_url, role').order('display_name')
            : Promise.resolve({ data: null }),
        ])

        let profileMap: Record<string, { display_name: string | null; avatar_url: string | null; role: string }> = {}
        if (playerProfiles.data) {
          profileMap = Object.fromEntries(playerProfiles.data.map(p => [p.id, p]))
        }
        let builtTokens = rawTokens.map(t => ({
          ...t,
          display_name: t.user_id ? (profileMap[t.user_id]?.display_name ?? null) : t.npc_name,
          avatar_url: t.user_id ? (profileMap[t.user_id]?.avatar_url ?? null) : t.npc_image_url,
          role: t.user_id ? (profileMap[t.user_id]?.role ?? null) : null,
        })) as MapTokenWithProfile[]

        /* ── Fix #3: Preserve pending optimistic positions ── */
        const pending = pendingMovesRef.current
        if (pending.size > 0) {
          builtTokens = builtTokens.map(t => {
            const p = pending.get(t.id)
            if (p) return { ...t, position_x: p.x, position_y: p.y }
            return t
          })
        }

        const ap = (adminPlayers.data ?? []) as AllPlayer[]
        setMap(mapData); setCurrentUser(profile); setIsAdmin(admin); setAllPlayers(ap)
        setTokens(builtTokens); setZones(zoneData)
        setCache(`mv:${mapId}:map`, mapData); setCache(`mv:${mapId}:me`, profile)
        setCache(`mv:${mapId}:admin`, admin); setCache(`mv:${mapId}:players`, ap)
        setCache(`mv:${mapId}:tokens`, builtTokens); setCache(`mv:${mapId}:zones`, zoneData)
        setLoaded(true)
      })
    }

    fetchMapData()

    const channel = supabase
      .channel(`map_view:${mapId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_tokens', filter: `map_id=eq.${mapId}` }, fetchMapData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_locked_zones', filter: `map_id=eq.${mapId}` }, fetchMapData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maps', filter: `id=eq.${mapId}` }, fetchMapData)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, mapId, router])

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

  /* ── Fix #3: Move notification modal ── */
  const [moveNotif, setMoveNotif] = useState<{ name: string; status: 'moving' | 'success' | 'error'; msg?: string } | null>(null)

  // ── Modal form state (lifted to parent to survive re-renders) ──
  const [npcName, setNpcName] = useState('')
  const [npcUrl, setNpcUrl] = useState('')
  const [selectedPlayerId, setSelectedPlayerId] = useState('')

  // ── My token ──
  const myToken = tokens.find(t => t.user_id === currentUserId)
  const isOnThisMap = myToken?.map_id === map.id
  
  // ── Sanity Lock ──
  const isSanityLocked = (currentUser?.sanity ?? 10) === 0

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

  // ── Image load ──
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

  /* ── Loading guard (after all hooks) ── */
  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#1A1612' }}>
        <div className="text-center">
          <div className="inline-block w-10 h-10 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin mb-4" />
          <p className="text-victorian-400 font-display">กำลังโหลดแผนที่...</p>
        </div>
      </div>
    )
  }

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
    const centerX = cr.width / 2 + cr.left
    const centerY = cr.height / 2 + cr.top
    const imgRect = img.getBoundingClientRect()
    const imgW = imgRect.width / scale
    const imgH = imgRect.height / scale
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

  /* ── Fix #5: Only allow dragging own token (unless admin) ── */
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
      if (navigator.vibrate) navigator.vibrate(30)
    }, LONG_PRESS_MS)
  }

  function handleTokenPointerUp(e: React.PointerEvent, token: MapTokenWithProfile) {
    e.stopPropagation()
    if (drag?.active) {
      finalizeDrag()
    } else {
      clearLongPress()
      setDrag(null)
      setDragPreview(null)
      /* ── Fix #4: Only open info on short tap, not after drag ── */
      if (!justDraggedRef.current) {
        handleTokenClick(token)
      }
    }
  }

  function handleTokenClick(token: MapTokenWithProfile) {
    /* ── Fix #4: Skip if drag just ended ── */
    if (justDraggedRef.current) return
    setSelectedToken(token)
    setSelectedCluster(null)
  }

  function handleClusterClick(cluster: TokenCluster) {
    /* ── Fix #4: Skip if drag just ended ── */
    if (justDraggedRef.current) return
    setSelectedCluster(cluster)
    setSelectedToken(null)
  }

  /* ════════════════════════════════════════════
     TOKEN: finalize drag (optimistic + small notification)
     Fix #3: Proper optimistic UI with pending tracking
     ════════════════════════════════════════════ */
  function finalizeDrag() {
    if (!drag || !dragPreview) {
      setDrag(null)
      setDragPreview(null)
      return
    }

    /* ── Fix #4: Flag that a drag just ended ── */
    justDraggedRef.current = true
    setTimeout(() => { justDraggedRef.current = false }, 300)

    const tokenId = drag.tokenId
    const newX = dragPreview.x
    const newY = dragPreview.y
    const origX = drag.origPosX
    const origY = drag.origPosY

    // Find the token for name display
    const draggedToken = tokens.find(t => t.id === tokenId)
    const tokenName = draggedToken?.display_name || draggedToken?.npc_name || 'ตัวละคร'

    /* ── Optimistic update: position ── */
    setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, position_x: newX, position_y: newY } : t))
    
    /* ── Optimistic update: travel points (own token, non-admin) ── */
    const isOwnToken = draggedToken?.user_id === currentUserId
    if (!isAdmin && isOwnToken) {
      setCurrentUser(prev => ({ ...prev, travel_points: Math.max(0, prev.travel_points - 1) }))
    }

    /* ── Track pending move so realtime won't overwrite ── */
    pendingMovesRef.current.set(tokenId, { x: newX, y: newY })

    setDrag(null)
    setDragPreview(null)

    /* ── Show small notification ── */
    setMoveNotif({ name: tokenName, status: 'moving' })

    // Send to server
    startTransition(async () => {
      const result = await moveToken(tokenId, newX, newY)

      /* ── Clear pending move ── */
      pendingMovesRef.current.delete(tokenId)

      if (result?.error) {
        // Rollback position
        setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, position_x: origX, position_y: origY } : t))
        // Rollback travel points
        if (!isAdmin && isOwnToken) {
          setCurrentUser(prev => ({ ...prev, travel_points: prev.travel_points + 1 }))
        }
        setMoveNotif({ name: tokenName, status: 'error', msg: result.error })
        setTimeout(() => setMoveNotif(null), 3000)
      } else {
        const cost = result?.cost ?? 0
        setMoveNotif({
          name: tokenName,
          status: 'success',
          msg: cost > 0 ? `−${cost} แต้มเดินทาง` : 'สำเร็จ',
        })
        setTimeout(() => setMoveNotif(null), 2000)
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
     RENDER — NEW LAYOUT
     Fix #1: Left sidebar for tools, right for map (no overlays)
     Fix #2: All tools visible on all screen sizes
     ════════════════════════════════════════════ */
  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ backgroundColor: '#0D0B09' }}>
      {/* ── TOP BAR (simplified: back + title only) ── */}
      <div className="relative z-20 flex items-center px-4 py-3 lg:px-6 lg:py-4 border-b border-gold-400/10 gap-3"
        style={{ backgroundColor: '#1A1612' }}>
        <Link href="/dashboard/maps"
          className="p-2 lg:p-3 text-victorian-400 hover:text-gold-400 border border-gold-400/10 hover:border-gold-400/30 rounded-sm transition-all shrink-0 cursor-pointer">
          <ArrowLeft className="w-5 h-5 lg:w-7 lg:h-7" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-gold-400 text-xl lg:text-3xl truncate leading-tight">{map.name}</h1>
          {map.description && <p className="text-victorian-500 text-xs lg:text-sm truncate">{map.description}</p>}
        </div>
      </div>

      {/* ── MAIN CONTENT: Sidebar + Map ── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">

        {/* ══ LEFT SIDEBAR (desktop) / TOP PANEL (mobile) ══ */}
        <aside className="shrink-0 lg:w-72 border-b lg:border-b-0 lg:border-r border-gold-400/10 overflow-y-auto overflow-x-hidden"
          style={{ backgroundColor: '#1A1612' }}>

          {/* ── You are here indicator ── */}
          {isOnThisMap && (
            <div className="flex items-center gap-2 px-4 py-2 lg:py-3 border-b border-gold-400/20"
              style={{ backgroundColor: '#1d1a14' }}>
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-gold-400" />
              </span>
              <span className="text-gold-400 font-display text-xs lg:text-sm tracking-wider uppercase">คุณกำลังอยู่ในแมพนี้</span>
            </div>
          )}

          {/* ── Travel Points (visible on ALL screen sizes) ── */}
          <div className="px-4 py-2 lg:py-3 border-b border-gold-400/10">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gold-400 font-display text-[10px] lg:text-xs uppercase tracking-wider">แต้มเดินทาง</span>
              <span className="tabular-nums font-bold text-nouveau-cream text-xs lg:text-sm">{currentUser.travel_points}/{currentUser.max_travel_points}</span>
            </div>
            <div className="w-full h-1.5 lg:h-2 bg-victorian-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold-400 to-gold-300 transition-all duration-300"
                style={{ width: `${(currentUser.travel_points / currentUser.max_travel_points) * 100}%` }}
              />
            </div>
          </div>

          {/* ── Join Map Button ── */}
          {!isOnThisMap && !isAdmin && (
            <div className="px-4 py-2 lg:py-3 border-b border-gold-400/10">
              <button onClick={handleJoinMap} disabled={isPending}
                className="btn-gold !py-2 !px-4 !text-xs lg:!text-sm w-full flex items-center justify-center gap-2 disabled:opacity-50">
                <MapPin className="w-4 h-4" />
                {myToken ? `ย้ายมาแมพนี้ (−3 แต้ม)` : 'เข้าร่วมแมพนี้'}
              </button>
              {myToken && (
                <p className="text-victorian-500 text-[10px] lg:text-xs text-center mt-1">แต้มเดินทาง: {currentUser.travel_points}</p>
              )}
            </div>
          )}

          {/* ── Zoom Controls ── */}
          <div className="px-4 py-2 lg:py-3 border-b border-gold-400/10">
            <p className="text-gold-400 font-display text-[10px] lg:text-xs uppercase tracking-wider mb-1.5 hidden lg:block">ซูม</p>
            <div className="flex items-center gap-1.5 lg:gap-2">
              <button onClick={zoomOut} className="p-1.5 lg:p-2 text-victorian-400 hover:text-gold-400 border border-gold-400/10 hover:border-gold-400/30 rounded-sm cursor-pointer">
                <ZoomOut className="w-4 h-4 lg:w-5 lg:h-5" />
              </button>
              <span className="text-victorian-400 text-xs lg:text-sm font-display min-w-[2.5rem] lg:min-w-[3rem] text-center tabular-nums">{Math.round(scale * 100)}%</span>
              <button onClick={zoomIn} className="p-1.5 lg:p-2 text-victorian-400 hover:text-gold-400 border border-gold-400/10 hover:border-gold-400/30 rounded-sm cursor-pointer">
                <ZoomIn className="w-4 h-4 lg:w-5 lg:h-5" />
              </button>
              <button onClick={fitToScreen} className="p-1.5 lg:p-2 text-victorian-400 hover:text-gold-400 border border-gold-400/10 hover:border-gold-400/30 rounded-sm cursor-pointer">
                <Maximize className="w-4 h-4 lg:w-5 lg:h-5" />
              </button>
            </div>
          </div>

          {/* ── Admin Tools ── */}
          {isAdmin && (
            <div className="px-4 py-2 lg:py-3 border-b border-gold-400/10">
              <p className="text-gold-400 font-display text-[10px] lg:text-xs uppercase tracking-wider mb-1.5">เครื่องมือ DM</p>
              <div className="flex flex-wrap gap-1.5 lg:gap-2">
                <button onClick={() => { setNpcName(''); setNpcUrl(''); setShowNpcModal(true) }} title="เพิ่ม NPC"
                  className="p-1.5 lg:p-2 text-victorian-400 hover:text-gold-400 border border-gold-400/10 hover:border-gold-400/30 rounded-sm cursor-pointer flex items-center gap-1.5">
                  <Ghost className="w-4 h-4 lg:w-5 lg:h-5" />
                  <span className="text-[10px] lg:text-xs">NPC</span>
                </button>
                <button onClick={() => { setSelectedPlayerId(''); setShowAddPlayer(true) }} title="เพิ่มผู้เล่น"
                  className="p-1.5 lg:p-2 text-victorian-400 hover:text-gold-400 border border-gold-400/10 hover:border-gold-400/30 rounded-sm cursor-pointer flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 lg:w-5 lg:h-5" />
                  <span className="text-[10px] lg:text-xs">ผู้เล่น</span>
                </button>
                <button onClick={() => { setShowZoneCreator(true); setEditingZone(null) }} title="ล็อคพื้นที่"
                  className="p-1.5 lg:p-2 text-victorian-400 hover:text-gold-400 border border-gold-400/10 hover:border-gold-400/30 rounded-sm cursor-pointer flex items-center gap-1.5">
                  <Lock className="w-4 h-4 lg:w-5 lg:h-5" />
                  <span className="text-[10px] lg:text-xs">ล็อค</span>
                </button>
                <button onClick={() => setShowEmbedModal(true)} title="Embed"
                  className="p-1.5 lg:p-2 text-victorian-400 hover:text-gold-400 border border-gold-400/10 hover:border-gold-400/30 rounded-sm cursor-pointer flex items-center gap-1.5">
                  <Code className="w-4 h-4 lg:w-5 lg:h-5" />
                  <span className="text-[10px] lg:text-xs">Embed</span>
                </button>
              </div>
            </div>
          )}

          {/* ── Tips (in sidebar, not overlaying map) ── */}
          <div className="px-4 py-2 lg:py-3 space-y-1.5">
            <div className="flex items-center gap-2 text-victorian-400 text-[10px] lg:text-xs">
              <Info className="w-3.5 h-3.5 text-gold-400/60 shrink-0" />
              <span>กดค้างที่ตัวละครเพื่อเดิน (ใช้ 1 แต้ม)</span>
            </div>
            <div className="flex items-center gap-2 text-victorian-400 text-[10px] lg:text-xs">
              <Move className="w-3.5 h-3.5 text-gold-400/60 shrink-0" />
              <span>ลากพื้นหลังเพื่อเลื่อน</span>
            </div>
            <div className="flex items-center gap-2 text-victorian-400 text-[10px] lg:text-xs">
              <ZoomIn className="w-3.5 h-3.5 text-gold-400/60 shrink-0" />
              <span>ซูมด้วยสกรอลล์</span>
            </div>
          </div>
        </aside>

        {/* ══ MAP CANVAS (right side, full area) ══ */}
        <div ref={containerRef}
          className={`flex-1 min-h-0 overflow-hidden relative ${showZoneCreator ? 'cursor-default' : drag?.active ? 'cursor-grabbing' : isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
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
                      onClick={e => {
                        e.stopPropagation()
                        /* ── Fix #4: Don't open dialog if just finished dragging ── */
                        if (justDraggedRef.current) return
                        if (isCluster) { handleClusterClick(cluster) } else { handleTokenClick(displayToken) }
                      }}
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

          {/* ── Drag active indicator (minimal, top of canvas only) ── */}
          {drag?.active && (
            <div className="absolute top-4 inset-x-0 z-50 flex justify-center pointer-events-none px-4">
              <div className="bg-black/90 border border-gold-400/60 text-gold-400 text-sm font-display font-bold 
                              px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                <Footprints className="w-4 h-4" />
                <span>ปล่อยเพื่อวาง (−1 แต้ม)</span>
              </div>
            </div>
          )}
        </div>
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

      {/* NPC Modal */}
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

      {/* Add Player */}
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

      {/* ── Fix #3: Move notification (small modal, top-right) ── */}
      {moveNotif && (
        <div className="fixed top-4 right-4 z-[60] animate-fade-in">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-xl backdrop-blur-sm text-sm font-display
            ${moveNotif.status === 'error'
              ? 'bg-nouveau-ruby/20 border-nouveau-ruby/40 text-nouveau-ruby'
              : moveNotif.status === 'success'
                ? 'bg-emerald-900/30 border-emerald-500/40 text-emerald-400'
                : 'bg-gold-400/10 border-gold-400/30 text-gold-400'
            }`}>
            {moveNotif.status === 'moving' && (
              <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            )}
            {moveNotif.status === 'success' && <Footprints className="w-4 h-4" />}
            {moveNotif.status === 'error' && <X className="w-4 h-4" />}
            <div>
              <p className="font-bold">{moveNotif.name}</p>
              <p className="text-xs opacity-80">
                {moveNotif.status === 'moving' ? 'กำลังย้าย...' : moveNotif.msg}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-sm border text-sm font-display
          ${toast.type === 'error' ? 'bg-nouveau-ruby/20 border-nouveau-ruby/40 text-nouveau-ruby' : 'bg-gold-400/10 border-gold-400/30 text-gold-400'}`}>
          {toast.msg}
        </div>
      )}
      
      {/* Sanity Lock Overlay */}
      {isSanityLocked && <SanityLockOverlay />}
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
