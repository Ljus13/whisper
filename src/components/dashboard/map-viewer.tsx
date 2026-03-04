'use client'

import type { GameMap, MapTokenWithProfile, MapLockedZone, Profile, MapChurchWithReligion, Religion, MapRestPoint } from '@/lib/types/database'
import {
  addPlayerToMap, addPlayerToMapWithRoleplay, addNpcToMap, moveToken, moveTokenWithRoleplay, removeTokenFromMap,
  createLockedZone, updateLockedZone, deleteLockedZone, toggleMapEmbed,
  updateNpcRadius,
} from '@/app/actions/map-tokens'
import {
  getReligions, addChurchToMap, moveChurch, updateChurchRadius, deleteChurch,
} from '@/app/actions/religions'
import {
  addRestPoint, moveRestPoint as moveRestPointAction, updateRestPointRadius, deleteRestPoint,
  getPlayerSleepPendingStatus,
} from '@/app/actions/rest-points'
import {
  ArrowLeft, ZoomIn, ZoomOut, Maximize, Move, Trash2, Lock,
  Users, X, Save, Code, MapPin, UserPlus, Ghost, Shield, Crown, Footprints,
  Info, Church, Tent, Moon, ScrollText,
} from 'lucide-react'
import Link from 'next/link'
import { useState, useRef, useCallback, useEffect, useTransition } from 'react'
import SanityLockOverlay from '@/components/sanity-lock-overlay'
import { createClient } from '@/lib/supabase/client'
import { getCached, setCache } from '@/lib/client-cache'
import { DEFAULT_TRAVEL_RULE, normalizePathwayRows, resolveTravelRule, type TravelRule } from '@/lib/travel-rules'

/* ══════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════ */
interface MapViewerProps {
  userId: string
  mapId: string
}

type AllPlayer = { id: string; display_name: string | null; avatar_url: string | null; role: string }

const MIN_SCALE = 0.5
const MAX_SCALE = 5
const ZOOM_STEP = 0.3
const CLUSTER_THRESHOLD_PX = 44
const TOKEN_SIZE_DESKTOP = 44
const TOKEN_SIZE_MOBILE = 56

/* ══════════════════════════════════════════════
   UTILITY: Responsive token size
   ══════════════════════════════════════════════ */
function getTokenSize() {
  if (typeof window === 'undefined') return TOKEN_SIZE_DESKTOP
  return window.innerWidth < 768 ? TOKEN_SIZE_MOBILE : TOKEN_SIZE_DESKTOP
}

/* ══════════════════════════════════════════════
   UTILITY: Calculate move cost - FLAT 1 POINT
   ══════════════════════════════════════════════ */
function calculateMoveCost(): number {
  return 1 // Always 1 point per move
}

/* ══════════════════════════════════════════════
   UTILITY: Responsive scale (min 0.6 for labels)
   ══════════════════════════════════════════════ */
function getResponsiveScale(currentScale: number): number {
  if (currentScale < 1) return 1 / currentScale
  return Math.max(0.6, 1 / currentScale)
}

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
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  /* ── Track pending moves to prevent realtime overwrite ── */
  const pendingMovesRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  /* ── Ref to call fetchMapData from outside useEffect ── */
  const fetchMapDataRef = useRef<(() => void) | null>(null)
  const broadcastRef = useRef<(event: string, payload: Record<string, unknown>) => void>(() => {})

  /* ── client-side data ── */
  const currentUserId = userId
  const [map, setMap] = useState<GameMap>(getCached(`mv:${mapId}:map`) ?? {} as GameMap)
  const [currentUser, setCurrentUser] = useState<Profile>(getCached(`mv:${mapId}:me`) ?? {} as Profile)
  const [isAdmin, setIsAdmin] = useState<boolean>(getCached(`mv:${mapId}:admin`) ?? false)
  const [allPlayers, setAllPlayers] = useState<AllPlayer[]>(getCached(`mv:${mapId}:players`) ?? [])
  const [travelRule, setTravelRule] = useState<TravelRule>(getCached(`mv:${mapId}:travelRule`) ?? DEFAULT_TRAVEL_RULE)
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
  const [churches, setChurches] = useState<MapChurchWithReligion[]>(getCached(`mv:${mapId}:churches`) ?? [])
  const [restPoints, setRestPoints] = useState<MapRestPoint[]>(getCached(`mv:${mapId}:restpoints`) ?? [])
  const [religions, setReligions] = useState<Religion[]>([])

  useEffect(() => {
    const supabase = createClient()

    const fetchMapData = () => {
      Promise.all([
        supabase.from('maps').select('*').eq('id', mapId).single(),
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('map_tokens').select('*').eq('map_id', mapId),
        supabase.from('map_locked_zones').select('*').eq('map_id', mapId),
        supabase.from('map_churches').select('*, religions(name_th, logo_url)').eq('map_id', mapId),
        supabase.from('map_rest_points').select('*').eq('map_id', mapId),
        supabase
          .from('player_pathways')
          .select('pathway:skill_pathways(name), sequence:skill_sequences(seq_number)')
          .eq('player_id', userId)
          ,
      ]).then(async ([mapRes, profileRes, rawTokensRes, zonesRes, churchesRes, restPointsRes, pathwayRes]) => {
        if (mapRes.error || !mapRes.data || !profileRes.data) {
          if (mapRes.error) console.error('Map fetch error:', mapRes.error)
          return
        }
        const mapData = mapRes.data as GameMap
        const profile = profileRes.data as Profile
        const entries = normalizePathwayRows(pathwayRes.data ?? [])
        const rule = resolveTravelRule(entries)
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
        setMap(mapData); setCurrentUser(profile); setIsAdmin(admin); setAllPlayers(ap); setTravelRule(rule)
        setTokens(builtTokens); setZones(zoneData)

        // Build church data with religion join
        const rawChurches = churchesRes.data ?? []
        const builtChurches: MapChurchWithReligion[] = rawChurches.map((c: Record<string, unknown>) => {
          const rel = c.religions as { name_th: string; logo_url: string | null } | null
          return {
            id: c.id as string,
            map_id: c.map_id as string,
            religion_id: c.religion_id as string,
            position_x: c.position_x as number,
            position_y: c.position_y as number,
            radius: c.radius as number,
            created_by: c.created_by as string | null,
            created_at: c.created_at as string,
            updated_at: c.updated_at as string,
            religion_name_th: rel?.name_th ?? 'ไม่ทราบ',
            religion_logo_url: rel?.logo_url ?? null,
          }
        })
        setChurches(builtChurches)

        // Set rest points
        const rpData = (restPointsRes.data ?? []) as MapRestPoint[]
        setRestPoints(rpData)

        setCache(`mv:${mapId}:map`, mapData); setCache(`mv:${mapId}:me`, profile)
        setCache(`mv:${mapId}:admin`, admin); setCache(`mv:${mapId}:players`, ap)
        setCache(`mv:${mapId}:travelRule`, rule)
        setCache(`mv:${mapId}:tokens`, builtTokens); setCache(`mv:${mapId}:zones`, zoneData)
        setCache(`mv:${mapId}:churches`, builtChurches); setCache(`mv:${mapId}:restpoints`, rpData)
        setLoaded(true)
      })
    }

    fetchMapDataRef.current = fetchMapData
    fetchMapData()

    const fetchProfile = () => {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
        .then(({ data }) => {
          if (!data) return
          const profile = data as Profile
          setCurrentUser(profile)
          setCache(`mv:${mapId}:me`, profile)
        })
    }

    const channel = supabase
      .channel(`map_view:${mapId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'token_moved' }, ({ payload }) => {
        const id = payload?.id as string | undefined
        const x = payload?.x as number | undefined
        const y = payload?.y as number | undefined
        if (!id || typeof x !== 'number' || typeof y !== 'number') return
        setTokens(prev => prev.map(t => {
          if (t.id !== id) return t
          if (pendingMovesRef.current.has(id)) return t
          return { ...t, position_x: x, position_y: y }
        }))
      })
      .on('broadcast', { event: 'token_removed' }, ({ payload }) => {
        const id = payload?.id as string | undefined
        if (!id) return
        setTokens(prev => prev.filter(t => t.id !== id))
      })
      .on('broadcast', { event: 'profile_travel_delta' }, ({ payload }) => {
        const userIdPayload = payload?.userId as string | undefined
        const delta = payload?.delta as number | undefined
        if (!userIdPayload || typeof delta !== 'number') return
        if (userIdPayload !== currentUserId) return
        setCurrentUser(prev => ({ ...prev, travel_points: Math.max(0, prev.travel_points + delta) }))
      })
      .on('broadcast', { event: 'profile_spirit_delta' }, ({ payload }) => {
        const userIdPayload = payload?.userId as string | undefined
        const delta = payload?.delta as number | undefined
        if (!userIdPayload || typeof delta !== 'number') return
        if (userIdPayload !== currentUserId) return
        setCurrentUser(prev => ({ ...prev, spirituality: Math.max(0, (prev.spirituality ?? 0) + delta) }))
      })
      .on('broadcast', { event: 'token_added' }, () => {
        fetchMapDataRef.current?.()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_tokens', filter: `map_id=eq.${mapId}` }, fetchMapData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_locked_zones', filter: `map_id=eq.${mapId}` }, fetchMapData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_churches', filter: `map_id=eq.${mapId}` }, fetchMapData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_rest_points', filter: `map_id=eq.${mapId}` }, fetchMapData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maps', filter: `id=eq.${mapId}` }, fetchMapData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, fetchProfile)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_pathways', filter: `player_id=eq.${userId}` }, fetchMapData)
      .subscribe()

    broadcastRef.current = (event, payload) => {
      channel.send({ type: 'broadcast', event, payload })
    }

    return () => {
      broadcastRef.current = () => {}
      supabase.removeChannel(channel)
    }
  }, [userId, mapId])

  // ── Fetch sleep pending status ──
  useEffect(() => {
    getPlayerSleepPendingStatus().then(r => {
      setIsSleepPending(r.isSleeping)
      setSleepAutoApproveTime(r.autoApproveTime ?? null)
    })
  }, [])

  // ── Token move state (button-based flow) ──
  const [movingTokenId, setMovingTokenId] = useState<string | null>(null)
  const [movePreview, setMovePreview] = useState<{ x: number; y: number } | null>(null)
  const [moveOriginalPos, setMoveOriginalPos] = useState<{ x: number; y: number } | null>(null)
  const [isMoveModeActive, setIsMoveModeActive] = useState(false) // Global move mode toggle
  
  // ── Join map position selector state ──
  const [isJoiningMap, setIsJoiningMap] = useState(false)
  const [joinPreviewPos, setJoinPreviewPos] = useState<{ x: number; y: number } | null>(null)
  
  // ── Tutorial state ──
  const [hasSeenTutorial, setHasSeenTutorial] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('whisper_map_tutorial_seen') === 'true'
  })
  
  // ── Responsive token size ──
  const [tokenSize, setTokenSize] = useState(TOKEN_SIZE_DESKTOP)
  useEffect(() => {
    setTokenSize(getTokenSize())
    const handleResize = () => setTokenSize(getTokenSize())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
  const [isSavingMoves, setIsSavingMoves] = useState(false)
  const isDragActiveRef = useRef(false)
  const [showRoleplayMoveModal, setShowRoleplayMoveModal] = useState(false)
  const [showRoleplayJoinModal, setShowRoleplayJoinModal] = useState(false)
  const [roleplayMoveDestinationUrl, setRoleplayMoveDestinationUrl] = useState('')
  const [roleplayJoinDestinationUrl, setRoleplayJoinDestinationUrl] = useState('')
  const [isRoleplayMoveMode, setIsRoleplayMoveMode] = useState(false)
  const [isRoleplayJoinMode, setIsRoleplayJoinMode] = useState(false)
  const [isRoleplayLoading, setIsRoleplayLoading] = useState(false)

  /* ── Church UI state ── */
  const [showChurchModal, setShowChurchModal] = useState(false)
  const [selectedChurch, setSelectedChurch] = useState<MapChurchWithReligion | null>(null)
  const [movingChurchId, setMovingChurchId] = useState<string | null>(null)
  const [churchMovePreview, setChurchMovePreview] = useState<{ x: number; y: number } | null>(null)

  /* ── Rest Point UI state ── */
  const [showRestPointModal, setShowRestPointModal] = useState(false)
  const [selectedRestPoint, setSelectedRestPoint] = useState<MapRestPoint | null>(null)
  const [movingRestPointId, setMovingRestPointId] = useState<string | null>(null)
  const [restPointMovePreview, setRestPointMovePreview] = useState<{ x: number; y: number } | null>(null)

  /* ── Batch move state (NO server call until save button pressed) ── */
  const positionSnapshotRef = useRef<{
    tokens: { id: string; x: number; y: number }[]
    churches: { id: string; x: number; y: number }[]
    restPoints: { id: string; x: number; y: number }[]
  } | null>(null)
  const batchMovesRef = useRef<{
    tokens: Map<string, { x: number; y: number }>
    churches: Map<string, { x: number; y: number }>
    restPoints: Map<string, { x: number; y: number }>
  }>({ tokens: new Map(), churches: new Map(), restPoints: new Map() })
  const [batchMoveCount, setBatchMoveCount] = useState(0)

  /* ── Move notification modal ── */
  const [moveNotif, setMoveNotif] = useState<{ name: string; status: 'moving' | 'success' | 'error'; msg?: string } | null>(null)

  // ── Modal form state (lifted to parent to survive re-renders) ──
  const [npcName, setNpcName] = useState('')
  const [npcUrl, setNpcUrl] = useState('')
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [churchReligionId, setChurchReligionId] = useState('')
  const [churchRadius, setChurchRadius] = useState(10)
  const [restPointName, setRestPointName] = useState('')
  const [restPointUrl, setRestPointUrl] = useState('')
  const [restPointRadius, setRestPointRadius] = useState(10)

  // ── Sleep pending state ──
  const [isSleepPending, setIsSleepPending] = useState(false)
  const [sleepAutoApproveTime, setSleepAutoApproveTime] = useState<string | null>(null)

  // ── My token ──
  const myToken = tokens.find(t => t.user_id === currentUserId)
  const isOnThisMap = myToken?.map_id === map.id
  
  // ── Sanity Lock ──
  const isSanityLocked = (currentUser?.sanity ?? 10) === 0
  const useSpiritForTravel = travelRule.resource === 'spirit'
  const travelLabel = useSpiritForTravel ? 'พลังวิญญาณ' : 'แต้มเดินทาง'
  const travelPoints = useSpiritForTravel ? (currentUser.spirituality ?? 0) : (currentUser.travel_points ?? 0)
  const travelMax = useSpiritForTravel ? (currentUser.max_spirituality ?? 0) : (currentUser.max_travel_points ?? 0)
  const travelPct = travelMax > 0 ? (travelPoints / travelMax) * 100 : 0

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

  /* ════════════════════════════════════════════
     ESC key: cancel move mode
     ════════════════════════════════════════════ */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (movingTokenId) { setMovingTokenId(null); setMovePreview(null) }
        if (movingChurchId) { setMovingChurchId(null); setChurchMovePreview(null) }
        if (movingRestPointId) { setMovingRestPointId(null); setRestPointMovePreview(null) }
        isDragActiveRef.current = false
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [movingTokenId, movingChurchId, movingRestPointId])

  /* ── Loading guard (after all hooks) ── */
  if (!loaded) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#1A1612' }}>
        <div className="border-b border-[#D4AF37]/10" style={{ backgroundColor: 'rgba(15,13,10,0.9)' }}>
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center gap-4">
            <div className="w-9 h-9 rounded border border-[#D4AF37]/10 bg-[#2A2520] animate-pulse" />
            <div className="h-6 w-40 rounded bg-[#2A2520] animate-pulse" />
          </div>
        </div>
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 60px)' }}>
          <div className="w-full h-full bg-[#2A2520] animate-pulse relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-4 w-32 rounded bg-[#1A1612]/60 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ════════════════════════════════════════════
     PAN: mouse drag on background
     ════════════════════════════════════════════ */
  function handleBgMouseDown(e: React.MouseEvent) {
    // Join mode: click to set position (don't confirm yet, just update)
    if (isJoiningMap) {
      e.preventDefault()
      const pos = screenToMapPercent(e.clientX, e.clientY)
      if (pos) {
        const isDesktop = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches
        if (isDesktop) {
          // Check if this is roleplay join mode
          if (isRoleplayJoinMode) {
            submitJoinMapRoleplay(pos)
          } else {
            submitJoinMap(pos)
          }
        } else {
          setJoinPreviewPos(pos)
        }
      }
      return
    }
    if (movingTokenId || movingChurchId || movingRestPointId) {
      e.preventDefault()
      return
    }
    if (e.button !== 0) return
    if (showZoneCreator) return
    setIsPanning(true)
    setPanStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }
  function handleBgMouseMove(e: React.MouseEvent) {
    if (movingTokenId || movingChurchId || movingRestPointId) return // Handled by onPointerMove
    if (isPanning) {
      setPosition({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
    }
  }
  function handleBgMouseUp() {
    if (isPanning) setIsPanning(false)
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
    if (movingTokenId) {
      if (e.touches.length === 1) {
        const pos = screenToMapPercent(e.touches[0].clientX, e.touches[0].clientY)
        if (pos) setMovePreview(pos)
      }
      return
    }
    if (movingChurchId) {
      if (e.touches.length === 1) {
        const pos = screenToMapPercent(e.touches[0].clientX, e.touches[0].clientY)
        if (pos) setChurchMovePreview(pos)
      }
      return
    }
    if (movingRestPointId) {
      if (e.touches.length === 1) {
        const pos = screenToMapPercent(e.touches[0].clientX, e.touches[0].clientY)
        if (pos) setRestPointMovePreview(pos)
      }
      return
    }
    if (showZoneCreator) return
    if (e.touches.length === 1) {
      setIsPanning(true)
      setPanStart({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y })
    } else if (e.touches.length === 2) {
      setLastTouchDist(getTouchDist(e.touches))
    }
  }
  function handleBgTouchMove(e: React.TouchEvent) {
    if (movingTokenId) {
      if (e.touches.length === 1) {
        const pos = screenToMapPercent(e.touches[0].clientX, e.touches[0].clientY)
        if (pos) setMovePreview(pos)
      }
      return
    }
    if (movingChurchId) {
      if (e.touches.length === 1) {
        const pos = screenToMapPercent(e.touches[0].clientX, e.touches[0].clientY)
        if (pos) setChurchMovePreview(pos)
      }
      return
    }
    if (movingRestPointId) {
      if (e.touches.length === 1) {
        const pos = screenToMapPercent(e.touches[0].clientX, e.touches[0].clientY)
        if (pos) setRestPointMovePreview(pos)
      }
      return
    }
    if (e.touches.length === 1 && isPanning) {
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
    // Drop item at current preview position on touch release
    if (movingTokenId && movePreview) {
      dropItemLocally(movePreview.x, movePreview.y)
      setIsPanning(false)
      setLastTouchDist(0)
      return
    }
    if (movingChurchId && churchMovePreview) {
      dropItemLocally(churchMovePreview.x, churchMovePreview.y)
      setIsPanning(false)
      setLastTouchDist(0)
      return
    }
    if (movingRestPointId && restPointMovePreview) {
      dropItemLocally(restPointMovePreview.x, restPointMovePreview.y)
      setIsPanning(false)
      setLastTouchDist(0)
      return
    }
    setIsPanning(false)
    setLastTouchDist(0)
  }

  /* ════════════════════════════════════════════
     POINTER events: move preview tracking
     ════════════════════════════════════════════ */
  function handlePointerMove(e: React.PointerEvent) {
    // Join mode: update join preview position
    if (isJoiningMap) {
      const pos = screenToMapPercent(e.clientX, e.clientY)
      if (pos) setJoinPreviewPos(pos)
      return
    }
    
    if (e.pointerType !== 'mouse' || !isDragActiveRef.current) return

    // Token follows cursor continuously (existing behavior)
    if (movingTokenId) {
      const pos = screenToMapPercent(e.clientX, e.clientY)
      if (pos) setMovePreview(pos)
    }
    // Church follows cursor continuously (same pattern as token)
    if (movingChurchId) {
      const pos = screenToMapPercent(e.clientX, e.clientY)
      if (pos) setChurchMovePreview(pos)
    }
    // RestPoint follows cursor continuously (same pattern as token)
    if (movingRestPointId) {
      const pos = screenToMapPercent(e.clientX, e.clientY)
      if (pos) setRestPointMovePreview(pos)
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (e.pointerType !== 'mouse') return
    if (e.button !== 0) return
    if (!movingTokenId && !movingChurchId && !movingRestPointId) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    isDragActiveRef.current = true
    const pos = screenToMapPercent(e.clientX, e.clientY)
    if (!pos) return
    if (movingTokenId) setMovePreview(pos)
    if (movingChurchId) setChurchMovePreview(pos)
    if (movingRestPointId) setRestPointMovePreview(pos)
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (e.pointerType !== 'mouse') return
    if (!isDragActiveRef.current) return
    isDragActiveRef.current = false
    if (!movingTokenId && !movingChurchId && !movingRestPointId) return
    const pos = screenToMapPercent(e.clientX, e.clientY)
    if (pos) {
      dropItemLocally(pos.x, pos.y)
    } else {
      if (movingTokenId && movePreview) dropItemLocally(movePreview.x, movePreview.y)
      if (movingChurchId && churchMovePreview) dropItemLocally(churchMovePreview.x, churchMovePreview.y)
      if (movingRestPointId && restPointMovePreview) dropItemLocally(restPointMovePreview.x, restPointMovePreview.y)
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
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
     TOKEN: Move mode (button-based flow)
     ════════════════════════════════════════════ */
  function canMoveToken(token: MapTokenWithProfile) {
    if (isAdmin) return true
    return token.token_type === 'player' && token.user_id === currentUserId
  }

  function getLockedZoneMessage(x: number, y: number, token?: MapTokenWithProfile | null) {
    if (isAdmin) return null
    if (!token?.user_id) return null
    for (const z of zones) {
      const inZone =
        x >= z.zone_x &&
        x <= z.zone_x + z.zone_width &&
        y >= z.zone_y &&
        y <= z.zone_y + z.zone_height
      if (inZone) {
        const allowed = z.allowed_user_ids?.includes(token.user_id)
        if (!allowed) return z.message || 'พื้นที่นี้ถูกล็อค'
      }
    }
    return null
  }

  // Toggle global move mode - all moveable tokens wiggle
  function startMoveMode(skipCostCheck?: boolean) {
    if (!isAdmin && isSleepPending) {
      showToast('💤 กำลังนอนหลับ — ไม่สามารถย้ายตัวละครได้', 'error')
      return
    }
    if (!skipCostCheck && !isAdmin && travelPoints <= 0) {
      showToast(`🚫 ${travelLabel}หมดแล้ว!`, 'error')
      return
    }
    positionSnapshotRef.current = {
      tokens: tokens.map(t => ({ id: t.id, x: t.position_x, y: t.position_y })),
      churches: churches.map(c => ({ id: c.id, x: c.position_x, y: c.position_y })),
      restPoints: restPoints.map(r => ({ id: r.id, x: r.position_x, y: r.position_y })),
    }
    batchMovesRef.current = { tokens: new Map(), churches: new Map(), restPoints: new Map() }
    setBatchMoveCount(0)
    setIsMoveModeActive(true)
    if (navigator.vibrate) navigator.vibrate([30, 20, 30])
  }

  function toggleMoveMode() {
    if (isMoveModeActive) {
      cancelMoveMode()
    } else {
      startMoveMode(false)
    }
  }

  // Select a specific token to move (when in move mode)
  function selectTokenToMove(token: MapTokenWithProfile) {
    if (!isMoveModeActive) return
    if (!canMoveToken(token)) return
    
    setMovingTokenId(token.id)
    setMovePreview({ x: token.position_x, y: token.position_y })
    setMoveOriginalPos({ x: token.position_x, y: token.position_y })
    setSelectedToken(null)
    setSelectedCluster(null)
    if (navigator.vibrate) navigator.vibrate(20)
  }

  function cancelMoveMode() {
    // Restore ALL positions from snapshot (undo ALL local changes)
    const snap = positionSnapshotRef.current
    if (snap) {
      setTokens(prev => prev.map(t => {
        const orig = snap.tokens.find(s => s.id === t.id)
        return orig ? { ...t, position_x: orig.x, position_y: orig.y } : t
      }))
      setChurches(prev => prev.map(c => {
        const orig = snap.churches.find(s => s.id === c.id)
        return orig ? { ...c, position_x: orig.x, position_y: orig.y } : c
      }))
      setRestPoints(prev => prev.map(r => {
        const orig = snap.restPoints.find(s => s.id === r.id)
        return orig ? { ...r, position_x: orig.x, position_y: orig.y } : r
      }))
    }
    // Clear pending moves from batch
    for (const tokenId of batchMovesRef.current.tokens.keys()) {
      pendingMovesRef.current.delete(tokenId)
    }
    batchMovesRef.current = { tokens: new Map(), churches: new Map(), restPoints: new Map() }
    setBatchMoveCount(0)
    positionSnapshotRef.current = null
    isDragActiveRef.current = false
    setMovingTokenId(null)
    setMovePreview(null)
    setMoveOriginalPos(null)
    setMovingChurchId(null)
    setChurchMovePreview(null)
    setMovingRestPointId(null)
    setRestPointMovePreview(null)
    setIsRoleplayMoveMode(false)
    setIsMoveModeActive(false)
  }

  function openRoleplayMoveModal() {
    if (!isAdmin && isSleepPending) {
      showToast('💤 กำลังนอนหลับ — ไม่สามารถย้ายตัวละครได้', 'error')
      return
    }
    setRoleplayMoveDestinationUrl('')
    setShowRoleplayMoveModal(true)
  }

  function confirmRoleplayMoveLinks() {
    if (!roleplayMoveDestinationUrl.trim()) {
      showToast('กรุณากรอกลิงก์โรลเพลย์', 'error')
      return
    }
    setShowRoleplayMoveModal(false)
    setIsRoleplayMoveMode(true)
    startMoveMode(true)
  }

  function openRoleplayJoinModal() {
    if (!isAdmin && isSleepPending) {
      showToast('กำลังนอนหลับ — ไม่สามารถย้ายแมพได้', 'error')
      return
    }
    setRoleplayJoinDestinationUrl('')
    setShowRoleplayJoinModal(true)
  }

  function confirmRoleplayJoinLinks() {
    if (!roleplayJoinDestinationUrl.trim()) {
      showToast('กรุณากรอกลิงก์โรลเพลย์', 'error')
      return
    }
    setShowRoleplayJoinModal(false)
    setIsRoleplayJoinMode(true)
    setIsJoiningMap(true)
    setJoinPreviewPos({ x: 50, y: 50 })
    showToast('📍 คลิกบนแมพเพื่อเลือกจุดเกิด', 'info')
  }

  async function waitRoleplayDelay() {
    await new Promise(resolve => setTimeout(resolve, 4000))
  }

  // Drop the currently-moving item at the given position (LOCAL ONLY — no server call)
  function dropItemLocally(x: number, y: number) {
    if (movingTokenId) {
      const tokenId = movingTokenId
      const token = tokens.find(t => t.id === tokenId)
      const lockMsg = getLockedZoneMessage(x, y, token)
      if (lockMsg) {
        showToast(lockMsg, 'error')
        if (moveOriginalPos) {
          setMovePreview({ x: moveOriginalPos.x, y: moveOriginalPos.y })
        } else if (token) {
          setMovePreview({ x: token.position_x, y: token.position_y })
        }
        return
      }
      setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, position_x: x, position_y: y } : t))
      pendingMovesRef.current.set(tokenId, { x, y })
      batchMovesRef.current.tokens.set(tokenId, { x, y })
      const newCount = batchMovesRef.current.tokens.size + batchMovesRef.current.churches.size + batchMovesRef.current.restPoints.size
      setBatchMoveCount(newCount)
      setMovingTokenId(null)
      setMovePreview(null)
      setMoveOriginalPos(null)
    } else if (movingChurchId) {
      const churchId = movingChurchId
      setChurches(prev => prev.map(c => c.id === churchId ? { ...c, position_x: x, position_y: y } : c))
      batchMovesRef.current.churches.set(churchId, { x, y })
      setBatchMoveCount(batchMovesRef.current.tokens.size + batchMovesRef.current.churches.size + batchMovesRef.current.restPoints.size)
      setMovingChurchId(null)
      setChurchMovePreview(null)
    } else if (movingRestPointId) {
      const rpId = movingRestPointId
      setRestPoints(prev => prev.map(r => r.id === rpId ? { ...r, position_x: x, position_y: y } : r))
      batchMovesRef.current.restPoints.set(rpId, { x, y })
      setBatchMoveCount(batchMovesRef.current.tokens.size + batchMovesRef.current.churches.size + batchMovesRef.current.restPoints.size)
      setMovingRestPointId(null)
      setRestPointMovePreview(null)
    }
  }

  // Send ALL batched moves to server (called ONLY when user clicks "บันทึกตำแหน่ง")
  async function saveAllMoves() {
    setIsSavingMoves(true)
    try {
      const tokenMoves = new Map(batchMovesRef.current.tokens)
      const churchMoves = new Map(batchMovesRef.current.churches)
      const restPointMoves = new Map(batchMovesRef.current.restPoints)

      batchMovesRef.current = { tokens: new Map(), churches: new Map(), restPoints: new Map() }
      setBatchMoveCount(0)
      positionSnapshotRef.current = null
      setIsMoveModeActive(false)
      setMovingTokenId(null)
      setMovePreview(null)
      setMoveOriginalPos(null)
      setMovingChurchId(null)
      setChurchMovePreview(null)
      setMovingRestPointId(null)
      setRestPointMovePreview(null)

      setMoveNotif({ name: 'บันทึกทั้งหมด', status: 'moving' })
      const errors: string[] = []

      const tokenOwnerMap = new Map(tokens.map(t => [t.id, t.user_id]))
      let travelDelta = 0
      let spiritDelta = 0

      for (const [tokenId, pos] of tokenMoves) {
        const result = await moveToken(tokenId, pos.x, pos.y)
        pendingMovesRef.current.delete(tokenId)
        if (result?.error) {
          errors.push(result.error)
        } else {
          const x = Math.max(0, Math.min(100, pos.x))
          const y = Math.max(0, Math.min(100, pos.y))
          broadcastRef.current('token_moved', { id: tokenId, x, y })
          const cost = result?.cost ?? 0
          if (!isAdmin && cost > 0 && tokenOwnerMap.get(tokenId) === currentUserId) {
            if (useSpiritForTravel) spiritDelta -= cost
            else travelDelta -= cost
          }
        }
      }
      for (const [churchId, pos] of churchMoves) {
        const result = await moveChurch(churchId, pos.x, pos.y)
        if (result?.error) errors.push(result.error)
      }
      for (const [rpId, pos] of restPointMoves) {
        const result = await moveRestPointAction(rpId, pos.x, pos.y)
        if (result?.error) errors.push(result.error)
      }

      if (travelDelta !== 0) {
        setCurrentUser(prev => ({ ...prev, travel_points: Math.max(0, prev.travel_points + travelDelta) }))
        broadcastRef.current('profile_travel_delta', { userId: currentUserId, delta: travelDelta })
      }
      if (spiritDelta !== 0) {
        setCurrentUser(prev => ({ ...prev, spirituality: Math.max(0, (prev.spirituality ?? 0) + spiritDelta) }))
        broadcastRef.current('profile_spirit_delta', { userId: currentUserId, delta: spiritDelta })
      }

      if (errors.length > 0) {
        setMoveNotif({ name: 'บันทึก', status: 'error', msg: errors.join(', ') })
        setTimeout(() => setMoveNotif(null), 3000)
      } else {
        setMoveNotif({ name: 'บันทึก', status: 'success', msg: 'บันทึกตำแหน่งทั้งหมดสำเร็จ' })
        setTimeout(() => setMoveNotif(null), 2000)
      }
    } finally {
      setIsSavingMoves(false)
    }
  }

  async function saveRoleplayMoves() {
    if (!roleplayMoveDestinationUrl.trim()) {
      showToast('กรุณากรอกลิงก์โรลเพลย์', 'error')
      return
    }
    setIsSavingMoves(true)
    let shouldCleanup = false
    try {
      const tokenMoves = new Map(batchMovesRef.current.tokens)
      const churchMoves = new Map(batchMovesRef.current.churches)
      const restPointMoves = new Map(batchMovesRef.current.restPoints)

      if (churchMoves.size > 0 || restPointMoves.size > 0) {
        showToast('โหมดโรลเพลย์ใช้ได้เฉพาะตัวละครเท่านั้น', 'error')
        return
      }
      if (tokenMoves.size === 0) {
        showToast('กรุณาเลือก Token ที่จะย้าย', 'error')
        return
      }

      setIsRoleplayLoading(true)
      await waitRoleplayDelay()

      shouldCleanup = true
      const errors: string[] = []
      for (const [tokenId, pos] of tokenMoves) {
        try {
          const result = await moveTokenWithRoleplay(
            tokenId,
            pos.x,
            pos.y,
            roleplayMoveDestinationUrl
          )
          pendingMovesRef.current.delete(tokenId)
          if (result?.error) {
            errors.push(result.error)
          } else {
            const x = Math.max(0, Math.min(100, pos.x))
            const y = Math.max(0, Math.min(100, pos.y))
            broadcastRef.current('token_moved', { id: tokenId, x, y })
          }
        } catch (err) {
          console.error('[saveRoleplayMoves] moveTokenWithRoleplay threw:', err)
          errors.push(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก')
          pendingMovesRef.current.delete(tokenId)
        }
      }

      if (errors.length > 0) {
        setMoveNotif({ name: 'บันทึก', status: 'error', msg: errors.join(', ') })
        setTimeout(() => setMoveNotif(null), 3000)
      } else {
        setMoveNotif({ name: 'บันทึก', status: 'success', msg: 'บันทึกตำแหน่งทั้งหมดสำเร็จ' })
        setTimeout(() => setMoveNotif(null), 2000)
      }
    } catch (err) {
      console.error('[saveRoleplayMoves] unexpected error:', err)
      setMoveNotif({ name: 'บันทึก', status: 'error', msg: 'เกิดข้อผิดพลาดไม่คาดคิด' })
      setTimeout(() => setMoveNotif(null), 3000)
      shouldCleanup = true
    } finally {
      setIsRoleplayLoading(false)
      if (shouldCleanup) {
        batchMovesRef.current = { tokens: new Map(), churches: new Map(), restPoints: new Map() }
        setBatchMoveCount(0)
        positionSnapshotRef.current = null
        setIsMoveModeActive(false)
        setMovingTokenId(null)
        setMovePreview(null)
        setMoveOriginalPos(null)
        setMovingChurchId(null)
        setChurchMovePreview(null)
        setMovingRestPointId(null)
        setRestPointMovePreview(null)
      }
      setIsRoleplayMoveMode(false)
      setIsSavingMoves(false)
    }
  }

  // Start move from popup (used by TokenInfoPopup)
  function startMoveFromPopup(token: MapTokenWithProfile) {
    if (!canMoveToken(token)) return
    const isOwnToken = token.user_id === currentUserId
    if (!isAdmin && isOwnToken && isSleepPending) {
      showToast('💤 กำลังนอนหลับ — ไม่สามารถย้ายตัวละครได้', 'error')
      return
    }
    if (!isAdmin && isOwnToken && travelPoints <= 0) {
      showToast(`🚫 ${travelLabel}หมดแล้ว!`, 'error')
      return
    }
    // If not already in move mode, snapshot positions first
    if (!isMoveModeActive) {
      positionSnapshotRef.current = {
        tokens: tokens.map(t => ({ id: t.id, x: t.position_x, y: t.position_y })),
        churches: churches.map(c => ({ id: c.id, x: c.position_x, y: c.position_y })),
        restPoints: restPoints.map(r => ({ id: r.id, x: r.position_x, y: r.position_y })),
      }
      batchMovesRef.current = { tokens: new Map(), churches: new Map(), restPoints: new Map() }
      setBatchMoveCount(0)
      setIsMoveModeActive(true)
    }
    selectTokenToMove(token)
    setSelectedToken(null)
  }

  function resetToOriginalPosition() {
    if (moveOriginalPos) {
      setMovePreview({ x: moveOriginalPos.x, y: moveOriginalPos.y })
    }
  }

  function handleTokenClick(token: MapTokenWithProfile) {
    // In move mode, select token to move
    if (isMoveModeActive && canMoveToken(token)) {
      selectTokenToMove(token)
      return
    }
    if (movingTokenId) return
    setSelectedToken(token)
    setSelectedCluster(null)
  }

  function handleClusterClick(cluster: TokenCluster) {
    // In move mode with cluster, select first moveable token
    if (isMoveModeActive) {
      const moveableToken = cluster.tokens.find(t => canMoveToken(t))
      if (moveableToken) {
        selectTokenToMove(moveableToken)
      }
      return
    }
    if (movingTokenId) return
    setSelectedCluster(cluster)
    setSelectedToken(null)
  }

  /* ════════════════════════════════════════════
     TOKEN: finalize move (optimistic + notification)
     ════════════════════════════════════════════ */
  function finalizeMove(targetX?: number, targetY?: number) {
    const newX = targetX ?? movePreview?.x
    const newY = targetY ?? movePreview?.y
    if (!movingTokenId || newX == null || newY == null) return

    const tokenId = movingTokenId
    const movedToken = tokens.find(t => t.id === tokenId)
    if (!movedToken) return

    const tokenName = movedToken.display_name || movedToken.npc_name || 'ตัวละคร'
    const origX = movedToken.position_x
    const origY = movedToken.position_y
    const isOwnToken = movedToken.user_id === currentUserId

    /* ── Optimistic update: position ── */
    setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, position_x: newX, position_y: newY } : t))

    /* ── Optimistic update: travel points (own token, non-admin) ── */
    if (!isAdmin && isOwnToken) {
      if (useSpiritForTravel) {
        setCurrentUser(prev => ({ ...prev, spirituality: Math.max(0, (prev.spirituality ?? 0) - 1) }))
      } else {
        setCurrentUser(prev => ({ ...prev, travel_points: Math.max(0, prev.travel_points - 1) }))
      }
    }

    /* ── Track pending move so realtime won't overwrite ── */
    pendingMovesRef.current.set(tokenId, { x: newX, y: newY })

    /* ── Exit move mode ── */
    setMovingTokenId(null)
    setMovePreview(null)

    /* ── Show notification ── */
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
          if (useSpiritForTravel) {
            setCurrentUser(prev => ({ ...prev, spirituality: (prev.spirituality ?? 0) + 1 }))
          } else {
            setCurrentUser(prev => ({ ...prev, travel_points: prev.travel_points + 1 }))
          }
        }
        setMoveNotif({ name: tokenName, status: 'error', msg: result.error })
        setTimeout(() => setMoveNotif(null), 3000)
      } else {
        const x = Math.max(0, Math.min(100, newX))
        const y = Math.max(0, Math.min(100, newY))
        broadcastRef.current('token_moved', { id: tokenId, x, y })
        const cost = result?.cost ?? 0
        const resource = result?.resource ?? (useSpiritForTravel ? 'spirit' : 'travel')
        if (!isAdmin && isOwnToken && cost > 0) {
          if (resource === 'spirit') {
            broadcastRef.current('profile_spirit_delta', { userId: currentUserId, delta: -cost })
          } else if (resource === 'travel') {
            broadcastRef.current('profile_travel_delta', { userId: currentUserId, delta: -cost })
          }
        }
        setMoveNotif({
          name: tokenName,
          status: 'success',
          msg: cost > 0 ? `−${cost} ${resource === 'spirit' ? 'พลังวิญญาณ' : 'แต้มเดินทาง'}` : 'สำเร็จ',
        })
        setTimeout(() => setMoveNotif(null), 2000)
      }
    })
  }

  /* ════════════════════════════════════════════
     CHURCH: move mode
     ════════════════════════════════════════════ */
  function startChurchMoveMode(church: MapChurchWithReligion) {
    if (isRoleplayMoveMode) {
      showToast('โหมดโรลเพลย์ใช้ได้เฉพาะตัวละครเท่านั้น', 'error')
      return
    }
    if (!isMoveModeActive) {
      positionSnapshotRef.current = {
        tokens: tokens.map(t => ({ id: t.id, x: t.position_x, y: t.position_y })),
        churches: churches.map(c => ({ id: c.id, x: c.position_x, y: c.position_y })),
        restPoints: restPoints.map(r => ({ id: r.id, x: r.position_x, y: r.position_y })),
      }
      batchMovesRef.current = { tokens: new Map(), churches: new Map(), restPoints: new Map() }
      setBatchMoveCount(0)
      setIsMoveModeActive(true)
    }
    setMovingChurchId(church.id)
    setChurchMovePreview({ x: church.position_x, y: church.position_y })
    setSelectedChurch(null)
  }

  function cancelChurchMoveMode() {
    setMovingChurchId(null)
    setChurchMovePreview(null)
  }

  function finalizeChurchMove(targetX: number, targetY: number) {
    if (!movingChurchId) return
    const churchId = movingChurchId
    const church = churches.find(c => c.id === churchId)
    if (!church) return

    // Optimistic update
    setChurches(prev => prev.map(c => c.id === churchId ? { ...c, position_x: targetX, position_y: targetY } : c))
    setMovingChurchId(null)
    setChurchMovePreview(null)

    startTransition(async () => {
      const r = await moveChurch(churchId, targetX, targetY)
      if (r?.error) {
        // Rollback
        setChurches(prev => prev.map(c => c.id === churchId ? { ...c, position_x: church.position_x, position_y: church.position_y } : c))
        showToast(r.error, 'error')
      } else {
        showToast(`ย้ายโบสถ์ ${church.religion_name_th} สำเร็จ`, 'info')
      }
    })
  }

  function openChurchModal() {
    setChurchReligionId('')
    setChurchRadius(10)
    // Fetch religions for dropdown
    getReligions().then(res => setReligions(res.religions ?? []))
    setShowChurchModal(true)
  }

  function handleAddChurch() {
    if (!churchReligionId) return
    startTransition(async () => {
      const r = await addChurchToMap(map.id, churchReligionId, churchRadius)
      if (r?.error) showToast(r.error, 'error')
      else { setShowChurchModal(false); fetchMapDataRef.current?.() }
    })
  }

  function handleDeleteChurch(churchId: string) {
    if (!confirm('ลบโบสถ์นี้ออกจากแมพ?')) return
    startTransition(async () => {
      const r = await deleteChurch(churchId)
      if (r?.error) showToast(r.error, 'error')
      else { setSelectedChurch(null); fetchMapDataRef.current?.() }
    })
  }

  function handleUpdateChurchRadius(churchId: string, radius: number) {
    startTransition(async () => {
      const r = await updateChurchRadius(churchId, radius)
      if (r?.error) showToast(r.error, 'error')
      else { setSelectedChurch(null); fetchMapDataRef.current?.() }
    })
  }

  /* ════════════════════════════════════════════
     REST POINT: move mode
     ════════════════════════════════════════════ */
  function startRestPointMoveMode(rp: MapRestPoint) {
    if (isRoleplayMoveMode) {
      showToast('โหมดโรลเพลย์ใช้ได้เฉพาะตัวละครเท่านั้น', 'error')
      return
    }
    if (!isMoveModeActive) {
      positionSnapshotRef.current = {
        tokens: tokens.map(t => ({ id: t.id, x: t.position_x, y: t.position_y })),
        churches: churches.map(c => ({ id: c.id, x: c.position_x, y: c.position_y })),
        restPoints: restPoints.map(r => ({ id: r.id, x: r.position_x, y: r.position_y })),
      }
      batchMovesRef.current = { tokens: new Map(), churches: new Map(), restPoints: new Map() }
      setBatchMoveCount(0)
      setIsMoveModeActive(true)
    }
    setMovingRestPointId(rp.id)
    setRestPointMovePreview({ x: rp.position_x, y: rp.position_y })
    setSelectedRestPoint(null)
  }

  function cancelRestPointMoveMode() {
    setMovingRestPointId(null)
    setRestPointMovePreview(null)
  }

  function finalizeRestPointMove(targetX: number, targetY: number) {
    if (!movingRestPointId) return
    const rpId = movingRestPointId
    const rp = restPoints.find(r => r.id === rpId)
    if (!rp) return

    // Optimistic update
    setRestPoints(prev => prev.map(r => r.id === rpId ? { ...r, position_x: targetX, position_y: targetY } : r))
    setMovingRestPointId(null)
    setRestPointMovePreview(null)

    startTransition(async () => {
      const r = await moveRestPointAction(rpId, targetX, targetY)
      if (r?.error) {
        // Rollback
        setRestPoints(prev => prev.map(r2 => r2.id === rpId ? { ...r2, position_x: rp.position_x, position_y: rp.position_y } : r2))
        showToast(r.error, 'error')
      } else {
        showToast(`ย้ายจุดพัก ${rp.name} สำเร็จ`, 'info')
      }
    })
  }

  function openRestPointModal() {
    setRestPointName('')
    setRestPointUrl('')
    setRestPointRadius(10)
    setShowRestPointModal(true)
  }

  function handleAddRestPoint() {
    if (!restPointName.trim()) return
    startTransition(async () => {
      const r = await addRestPoint(map.id, restPointName, restPointRadius, restPointUrl || undefined)
      if (r?.error) showToast(r.error, 'error')
      else { setShowRestPointModal(false); fetchMapDataRef.current?.() }
    })
  }

  function handleDeleteRestPoint(rpId: string) {
    if (!confirm('ลบจุดพักนี้ออกจากแมพ?')) return
    startTransition(async () => {
      const r = await deleteRestPoint(rpId)
      if (r?.error) showToast(r.error, 'error')
      else { setSelectedRestPoint(null); fetchMapDataRef.current?.() }
    })
  }

  function handleUpdateRestPointRadius(rpId: string, radius: number) {
    startTransition(async () => {
      const r = await updateRestPointRadius(rpId, radius)
      if (r?.error) showToast(r.error, 'error')
      else { setSelectedRestPoint(null); fetchMapDataRef.current?.() }
    })
  }

  /* ════════════════════════════════════════════
     PLAYER: Join this map (enter position selection mode)
     ════════════════════════════════════════════ */
  function handleJoinMap() {
    // Block join/transfer map when sleeping
    if (!isAdmin && isSleepPending) {
      showToast('กำลังนอนหลับ — ไม่สามารถย้ายแมพได้', 'error')
      return
    }
    // Enter position selection mode
    setIsJoiningMap(true)
    setJoinPreviewPos({ x: 50, y: 50 }) // Start at center
    showToast('📍 คลิกบนแมพเพื่อเลือกจุดเกิด', 'info')
  }
  
  /* ════════════════════════════════════════════
     PLAYER: Confirm join with selected position
     ════════════════════════════════════════════ */
  function submitJoinMap(pos: { x: number; y: number }) {
    startTransition(async () => {
      const result = await addPlayerToMap(map.id, undefined, pos.x, pos.y)
      if (result?.error) {
        showToast(result.error, 'error')
      } else {
        showToast('เข้าร่วมแมพสำเร็จ!', 'info')
        fetchMapDataRef.current?.()
        broadcastRef.current('token_added', { mapId: map.id })
      }
      // Reset join mode
      setIsJoiningMap(false)
      setJoinPreviewPos(null)
    })
  }

  function submitJoinMapRoleplay(pos: { x: number; y: number }) {
    startTransition(async () => {
      if (!roleplayJoinDestinationUrl.trim()) {
        showToast('กรุณากรอกลิงก์โรลเพลย์', 'error')
        return
      }
      setIsRoleplayLoading(true)
      await waitRoleplayDelay()
      const result = await addPlayerToMapWithRoleplay(
        map.id,
        roleplayJoinDestinationUrl,
        undefined,
        pos.x,
        pos.y
      )
      if (result?.error) {
        showToast(result.error, 'error')
      } else {
        showToast('เข้าร่วมแมพสำเร็จ!', 'info')
        fetchMapDataRef.current?.()
        broadcastRef.current('token_added', { mapId: map.id })
      }
      setIsRoleplayLoading(false)
      setIsRoleplayJoinMode(false)
      setIsJoiningMap(false)
      setJoinPreviewPos(null)
    })
  }

  function confirmJoinMap() {
    if (!joinPreviewPos) return
    if (isRoleplayJoinMode) submitJoinMapRoleplay(joinPreviewPos)
    else submitJoinMap(joinPreviewPos)
  }
  
  /* ════════════════════════════════════════════
     PLAYER: Cancel join mode
     ════════════════════════════════════════════ */
  function cancelJoinMode() {
    setIsJoiningMap(false)
    setJoinPreviewPos(null)
    setIsRoleplayJoinMode(false)
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
        else { onClose(); fetchMapDataRef.current?.() }
      })
    }

    function handleDeleteZone() {
      if (!zone || !confirm('ลบพื้นที่ล็อคนี้?')) return
      startTransition(async () => {
        await deleteLockedZone(zone.id)
        onClose()
        fetchMapDataRef.current?.()
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
        fetchMapDataRef.current?.()
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
        <aside className="shrink-0 lg:w-72 max-h-[32vh] lg:max-h-none min-h-0 border-b lg:border-b-0 lg:border-r border-gold-400/10 overflow-y-auto overflow-x-hidden"
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
              <span className="text-gold-400 font-display text-[10px] lg:text-xs uppercase tracking-wider">{travelLabel}</span>
              <span className="tabular-nums font-bold text-nouveau-cream text-xs lg:text-sm">{travelPoints}/{travelMax}</span>
            </div>
            <div className="w-full h-1.5 lg:h-2 bg-victorian-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold-400 to-gold-300 transition-all duration-300"
                style={{ width: `${travelPct}%` }}
              />
            </div>
          </div>

          {/* ── Sleep Pending Alert ── */}
          {isSleepPending && !isAdmin && (
            <div className="px-4 py-2 lg:py-3 border-b border-indigo-400/30 bg-indigo-950/40">
              <div className="flex items-center gap-2 mb-1">
                <Moon className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span className="text-indigo-300 font-display text-[10px] lg:text-xs font-bold uppercase tracking-wider">💤 กำลังนอนหลับ</span>
              </div>
              <p className="text-indigo-400/70 text-[10px] lg:text-xs">
                ย้ายตัวละครไม่ได้ขณะรออนุมัติ
              </p>
              {sleepAutoApproveTime && (
                <p className="text-indigo-400/50 text-[9px] lg:text-[10px] mt-0.5">
                  ⏰ อนุมัติอัตโนมัติ: {new Date(sleepAutoApproveTime).toLocaleString('th-TH', { timeStyle: 'short' })}
                </p>
              )}
            </div>
          )}

          {/* ── Join Map Button / Position Selector ── */}
          {!isOnThisMap && !isAdmin && (
            <div className="px-4 py-2 lg:py-3 border-b border-gold-400/10 space-y-2">
              {isJoiningMap ? (
                // ── Position selection mode ──
                <>
                  <div className="flex items-center gap-2 text-emerald-300 text-xs lg:text-sm font-display animate-pulse">
                    <MapPin className="w-4 h-4" />
                    <span>📍 คลิกบนแมพเพื่อเลือกจุดเกิด</span>
                  </div>
                  {joinPreviewPos && (
                    <p className="text-victorian-500 text-[10px] lg:text-xs text-center">
                      ตำแหน่ง: ({joinPreviewPos.x.toFixed(0)}%, {joinPreviewPos.y.toFixed(0)}%)
                    </p>
                  )}
                  <button onClick={confirmJoinMap} disabled={isPending || !joinPreviewPos}
                    className="w-full flex items-center justify-center gap-2 py-2.5 lg:py-3 px-4 rounded-sm font-display text-sm lg:text-base uppercase tracking-wider transition-all bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-400 hover:to-emerald-300 text-white shadow-lg shadow-green-500/40 disabled:opacity-50">
                    <Save className="w-5 h-5" />
                    ✅ ยืนยันจุดเกิด
                  </button>
                  <button onClick={cancelJoinMode}
                    className="w-full flex items-center justify-center gap-2 py-2 lg:py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-sm font-display text-sm lg:text-base transition-colors shadow-lg shadow-red-900/30">
                    <X className="w-4 h-4 lg:w-5 lg:h-5" />
                    ❌ ยกเลิก
                  </button>
                </>
              ) : (
                // ── Normal join button ──
                <>
                  <button onClick={handleJoinMap} disabled={isPending || isSleepPending}
                    className="btn-gold !py-2 !px-4 !text-xs lg:!text-sm w-full flex items-center justify-center gap-2 disabled:opacity-50">
                    <MapPin className="w-4 h-4" />
                    {isSleepPending ? '💤 กำลังหลับ — ย้ายแมพไม่ได้' : myToken ? `ย้ายมาแมพนี้ (−3 แต้ม)` : 'เข้าร่วมแมพนี้'}
                  </button>
                  <button onClick={openRoleplayJoinModal} disabled={isPending || isSleepPending}
                    className="w-full flex items-center justify-center gap-2 py-2 lg:py-2.5 px-4 rounded-sm font-display text-xs lg:text-sm uppercase tracking-wider transition-all bg-victorian-900/70 border border-emerald-400/30 text-emerald-300 hover:bg-victorian-800/80 disabled:opacity-50">
                    <Footprints className="w-4 h-4" />
                    เข้าร่วมแมพนี้ (โรลเพลย์)
                  </button>
                  {isRoleplayLoading && (
                    <div className="flex items-center justify-center gap-2 rounded-sm border border-emerald-400/30 bg-victorian-900/70 px-3 py-2 text-emerald-200 text-[10px] font-display">
                      <div className="relative w-24 h-5 rounded-full border border-emerald-400/40 bg-victorian-900/60 overflow-hidden">
                        <div
                          className="absolute inset-0"
                          style={{
                            background: 'linear-gradient(90deg, rgba(16,185,129,0.05), rgba(16,185,129,0.35), rgba(16,185,129,0.05))',
                            backgroundSize: '200% 100%',
                            animation: 'roadFlow 1.2s linear infinite',
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center" style={{ animation: 'travelerMove 1s ease-in-out infinite alternate' }}>
                          <span className="text-xs" style={{ animation: 'walkBob .6s ease-in-out infinite' }}>🚶‍♂️</span>
                        </div>
                      </div>
                      <span style={{ animation: 'travelGlow 1.2s ease-in-out infinite' }}>กำลังเดินทาง...</span>
                    </div>
                  )}
                  {myToken && (
                    <p className="text-victorian-500 text-[10px] lg:text-xs text-center mt-1">{travelLabel}: {travelPoints}</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── 🚶‍♂️ Move / Save Position Button ── */}
          {(isOnThisMap || isAdmin) && (isAdmin || !isSleepPending) && (
            <div className="px-4 py-2 lg:py-3 border-b border-gold-400/10 flex flex-wrap gap-1.5 lg:flex-col">
              {isMoveModeActive ? (
                <>
                  {/* Currently dragging indicator */}
                  {(movingTokenId || movingChurchId || movingRestPointId) && (
                    <div className="flex items-center gap-2 text-amber-300 text-xs lg:text-sm font-display">
                      <Move className="w-4 h-4 animate-bounce" />
                      <span>📌 คลิกบนแมพเพื่อวาง</span>
                    </div>
                  )}

                  {/* Batch count badge */}
                  {batchMoveCount > 0 && (
                    <div className="text-center text-amber-400/80 text-xs font-display">
                      🔄 เปลี่ยนตำแหน่งแล้ว {batchMoveCount} รายการ
                    </div>
                  )}
                  {isRoleplayMoveMode && (
                    <div className="text-center text-emerald-300/90 text-xs font-display">
                      🛤️ โหมดโรลเพลย์ — ไม่เสียแต้มเดินทาง
                    </div>
                  )}
                  {isRoleplayLoading && (
                    <div className="flex items-center justify-center gap-2 rounded-sm border border-emerald-400/30 bg-victorian-900/70 px-3 py-2 text-emerald-200 text-xs font-display">
                      <style dangerouslySetInnerHTML={{ __html: `
                        @keyframes travelGlow { 0% { opacity: .35 } 50% { opacity: 1 } 100% { opacity: .35 } }
                        @keyframes walkBob { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
                        @keyframes roadFlow { 0% { background-position: 0% 50% } 100% { background-position: 200% 50% } }
                        @keyframes travelerMove { 0% { transform: translateX(-10px) } 100% { transform: translateX(10px) } }
                      `}} />
                      <div className="relative w-28 h-6 rounded-full border border-emerald-400/40 bg-victorian-900/60 overflow-hidden">
                        <div
                          className="absolute inset-0"
                          style={{
                            background: 'linear-gradient(90deg, rgba(16,185,129,0.05), rgba(16,185,129,0.35), rgba(16,185,129,0.05))',
                            backgroundSize: '200% 100%',
                            animation: 'roadFlow 1.2s linear infinite',
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center" style={{ animation: 'travelerMove 1s ease-in-out infinite alternate' }}>
                          <span className="text-sm" style={{ animation: 'walkBob .6s ease-in-out infinite' }}>🚶‍♂️</span>
                        </div>
                      </div>
                      <span style={{ animation: 'travelGlow 1.2s ease-in-out infinite' }}>กำลังเดินทาง...</span>
                    </div>
                  )}

                  {/* Save ALL / Select prompt */}
                  <button
                    onClick={() => (isRoleplayMoveMode ? saveRoleplayMoves() : startTransition(() => saveAllMoves()))}
                    disabled={isPending || isSavingMoves || batchMoveCount === 0}
                    className={`w-full flex items-center justify-center gap-2 py-2 lg:py-3 px-4 rounded-xl lg:rounded-sm font-display text-xs lg:text-sm lg:uppercase lg:tracking-wider transition-all ${
                      isSavingMoves || batchMoveCount > 0
                        ? 'bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-400 hover:to-emerald-300 text-white shadow-lg shadow-green-500/40'
                        : 'bg-amber-400 text-amber-900 hover:bg-amber-300 shadow-lg shadow-amber-400/30 animate-pulse'
                    } ${(isPending || batchMoveCount === 0) && !isSavingMoves ? 'opacity-50' : ''}`}
                  >
                    {isSavingMoves ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        กำลังบันทึก...
                      </>
                    ) : batchMoveCount > 0 ? (
                      <>
                        <Save className="w-5 h-5" />
                        💾 บันทึกตำแหน่ง ({batchMoveCount})
                      </>
                    ) : (
                      <>
                        <Move className="w-5 h-5" />
                        🔍 เลือก Token ที่จะย้าย
                      </>
                    )}
                  </button>
                  {isRoleplayLoading && (
                    <div className="relative w-full overflow-hidden rounded-sm border border-emerald-400/40 bg-victorian-900/80 px-3 py-2 text-emerald-200 text-xs font-display">
                      <style dangerouslySetInnerHTML={{ __html: `
                        @keyframes travelGlow { 0% { opacity: .35 } 50% { opacity: 1 } 100% { opacity: .35 } }
                        @keyframes walkBob { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
                        @keyframes roadFlow { 0% { background-position: 0% 50% } 100% { background-position: 200% 50% } }
                        @keyframes travelerMove { 0% { transform: translateX(-12px) } 100% { transform: translateX(12px) } }
                      `}} />
                      <div className="absolute inset-0 opacity-60" style={{
                        background: 'linear-gradient(90deg, rgba(16,185,129,0.05), rgba(16,185,129,0.35), rgba(16,185,129,0.05))',
                        backgroundSize: '200% 100%',
                        animation: 'roadFlow 1.2s linear infinite',
                      }} />
                      <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base" style={{ animation: 'walkBob .6s ease-in-out infinite' }}>🚶‍♂️</span>
                          <span style={{ animation: 'travelGlow 1.2s ease-in-out infinite' }}>กำลังเดินทาง...</span>
                        </div>
                        <div className="flex items-center gap-2" style={{ animation: 'travelerMove 1s ease-in-out infinite alternate' }}>
                          <Footprints className="w-4 h-4 text-emerald-300/80" />
                          <Footprints className="w-4 h-4 text-emerald-300/50" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Cancel button */}
                  <button
                    onClick={cancelMoveMode}
                    className="w-full flex items-center justify-center gap-2 py-1.5 lg:py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl lg:rounded-sm font-display text-xs lg:text-base transition-colors shadow-lg shadow-red-900/30"
                  >
                    <X className="w-4 h-4 lg:w-5 lg:h-5" />
                    ❌ ยกเลิก
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={toggleMoveMode}
                    disabled={!isAdmin && travelPoints <= 0}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 lg:py-3 px-2 lg:px-4 rounded-xl lg:rounded-sm font-display text-xs lg:text-sm lg:uppercase lg:tracking-wider transition-all bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-900 hover:from-amber-400 hover:to-yellow-300 shadow-md hover:shadow-lg hover:shadow-amber-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Move className="w-4 h-4 lg:w-5 lg:h-5" />
                    <span className="truncate">✨ ย้ายตำแหน่ง</span>
                  </button>
                  <button
                    onClick={openRoleplayMoveModal}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 lg:py-3 px-2 lg:px-4 rounded-xl lg:rounded-sm font-display text-xs lg:text-sm lg:uppercase lg:tracking-wider transition-all bg-victorian-900/70 border border-emerald-400/30 text-emerald-300 hover:bg-victorian-800/80"
                  >
                    <Footprints className="w-4 h-4 lg:w-5 lg:h-5" />
                    <span className="truncate">ย้าย (โรลเพลย์)</span>
                  </button>
                  {!isAdmin && travelPoints <= 0 && (
                    <p className="text-red-500 text-[10px] lg:text-xs text-center mt-1 font-semibold">🚫 {travelLabel}หมด</p>
                  )}
                </>
              )}
            </div>
          )}

          <div className="px-4 py-1.5 lg:py-3 border-b border-gold-400/10">
            <Link
              href="/dashboard/maps/travel-logs"
              className="w-full flex items-center justify-center gap-1.5 py-2 lg:py-3 px-3 lg:px-4 rounded-xl lg:rounded-sm font-display text-xs lg:text-sm lg:uppercase lg:tracking-wider transition-all bg-victorian-900/70 border border-gold-400/20 text-gold-300 hover:bg-victorian-800/80"
            >
              <ScrollText className="w-4 h-4 lg:w-5 lg:h-5" />
              <span>ประวัติการเดินทาง</span>
            </Link>
          </div>

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
            <div className="px-3 py-2 lg:px-4 lg:py-3 border-b border-gold-400/10">
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
                <button onClick={openChurchModal} title="วางโบสถ์"
                  className="p-1.5 lg:p-2 text-victorian-400 hover:text-gold-400 border border-gold-400/10 hover:border-gold-400/30 rounded-sm cursor-pointer flex items-center gap-1.5">
                  <Church className="w-4 h-4 lg:w-5 lg:h-5" />
                  <span className="text-[10px] lg:text-xs">โบสถ์</span>
                </button>
                <button onClick={openRestPointModal} title="วางจุดพัก"
                  className="p-1.5 lg:p-2 text-victorian-400 hover:text-gold-400 border border-gold-400/10 hover:border-gold-400/30 rounded-sm cursor-pointer flex items-center gap-1.5">
                  <Tent className="w-4 h-4 lg:w-5 lg:h-5" />
                  <span className="text-[10px] lg:text-xs">จุดพัก</span>
                </button>
              </div>
            </div>
          )}

          {/* ── Tips - Colorful Guide ── */}
          <div className="px-4 py-3 lg:py-4 space-y-2.5">
            <p className="text-gold-400 font-display text-xs lg:text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
              📖 <span>วิธีใช้งาน</span>
            </p>
            <div className="flex items-start gap-2 p-2 bg-amber-900/20 border border-amber-400/20 rounded-lg">
              <span className="text-lg">👆</span>
              <span className="text-amber-200 text-xs lg:text-sm font-medium">
                {useSpiritForTravel
                  ? `⚠️ ใช้ ${travelRule.moveCost} พลังวิญญาณเมื่อย้ายในแมพ, ${travelRule.crossMapCost} เมื่อข้ามแมพ`
                  : `⚠️ ระบบหัก${travelLabel}เมื่อย้ายตัวละคร: ย้ายในแมพเดียว ${travelRule.moveCost} แต้ม, ย้ายข้ามแมพ ${travelRule.crossMapCost} แต้ม`}
              </span>
            </div>
            <div className="flex items-start gap-2 p-2 bg-blue-900/20 border border-blue-400/20 rounded-lg">
              <span className="text-lg">✋</span>
              <span className="text-blue-200 text-xs lg:text-sm font-medium">ลากพื้นหลังเพื่อเลื่อน</span>
            </div>
            <div className="flex items-start gap-2 p-2 bg-purple-900/20 border border-purple-400/20 rounded-lg">
              <span className="text-lg">🔍</span>
              <span className="text-purple-200 text-xs lg:text-sm font-medium">ซูมด้วยสกรอลล์</span>
            </div>
          </div>
        </aside>

        {/* ══ MAP CANVAS (right side, full area) ══ */}
        <div ref={containerRef}
          className={`flex-1 min-h-0 overflow-hidden relative ${showZoneCreator ? 'cursor-default' : (movingTokenId || movingChurchId || movingRestPointId || isJoiningMap) ? 'cursor-crosshair' : isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleBgMouseDown}
          onMouseMove={handleBgMouseMove}
          onMouseUp={handleBgMouseUp}
          onMouseLeave={handleBgMouseUp}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onTouchStart={handleBgTouchStart}
          onTouchMove={handleBgTouchMove}
          onTouchEnd={handleBgTouchEnd}
          style={{ touchAction: 'none' }}>

          {/* Loading */}
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="w-3/4 max-w-md space-y-3">
                <div className="h-48 w-full bg-[#2A2520] animate-pulse rounded" />
                <div className="h-4 w-32 mx-auto bg-[#2A2520] animate-pulse rounded" />
              </div>
            </div>
          )}

          {/* Map image + token layer + zone layer */}
          <div className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: isPanning ? 'none' : 'transform 0.15s ease-out',
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

              {/* ── NPC INTERACTION RADIUS CIRCLES ── */}
              {imageLoaded && tokens.filter(t => t.token_type === 'npc' && (t.interaction_radius ?? 0) > 0).map(npc => (
                <div key={`radius-${npc.id}`}
                  className="absolute z-10 pointer-events-none"
                  style={{
                    left: `${npc.position_x}%`,
                    top: `${npc.position_y}%`,
                    width: `${(npc.interaction_radius ?? 0) * 2}%`,
                    height: `${(npc.interaction_radius ?? 0) * 2}%`,
                    transform: 'translate(-50%, -50%)',
                  }}>
                  {/* Ripple effect */}
                  <div className="absolute inset-0 rounded-full border border-yellow-400/40 animate-ripple" />
                  <div className="absolute inset-0 rounded-full border border-yellow-400/30 animate-ripple" style={{ animationDelay: '1.5s' }} />
                  {/* Core circle */}
                  <div className="relative w-full h-full rounded-full border-[3px] sm:border-2 border-yellow-400/60 bg-yellow-400/50"
                    style={{ boxShadow: '0 0 24px rgba(250, 204, 21, 0.35), inset 0 0 12px rgba(250, 204, 21, 0.2)' }} />
                  <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] sm:text-[8px] text-yellow-400/80 font-display font-semibold drop-shadow-md"
                    style={{ transform: `translateX(-50%) scale(${getResponsiveScale(scale)})`, transformOrigin: 'center top' }}>
                    เขตทำการ {npc.npc_name}
                  </div>
                </div>
              ))}

              {/* ── CHURCH RADIUS CIRCLES + MARKERS ── */}
              {imageLoaded && churches.map(ch => {
                const isMovingThisChurch = movingChurchId === ch.id
                const displayChurchX = isMovingThisChurch && churchMovePreview ? churchMovePreview.x : ch.position_x
                const displayChurchY = isMovingThisChurch && churchMovePreview ? churchMovePreview.y : ch.position_y
                
                return (
                  <div key={`church-${ch.id}`} className="absolute inset-0 z-10 pointer-events-none">
                    {/* Radius circle */}
                    <div className="absolute pointer-events-none"
                      style={{
                        left: `${displayChurchX}%`,
                        top: `${displayChurchY}%`,
                        width: `${ch.radius * 2}%`,
                        height: `${ch.radius * 2}%`,
                        transform: 'translate(-50%, -50%)',
                        transition: isMovingThisChurch && churchMovePreview ? 'none' : 'left 0.3s ease, top 0.3s ease',
                      }}>
                      {/* Ripple effect */}
                      <div className="absolute inset-0 rounded-full border border-emerald-400/40 animate-ripple" />
                      <div className="absolute inset-0 rounded-full border border-emerald-400/30 animate-ripple" style={{ animationDelay: '1.5s' }} />
                      {/* Core circle */}
                      <div className="relative w-full h-full rounded-full border-[3px] sm:border-2 border-emerald-400/60 bg-emerald-400/50"
                        style={{ boxShadow: '0 0 28px rgba(52, 211, 153, 0.35), inset 0 0 12px rgba(52, 211, 153, 0.2)' }} />
                    </div>
                    {/* Church marker icon */}
                    <div
                      className={`absolute ${isMovingThisChurch ? 'z-50' : 'z-20'} cursor-pointer pointer-events-auto group/church`}
                      style={{
                        left: `${displayChurchX}%`,
                        top: `${displayChurchY}%`,
                        transform: `translate(-50%, -50%) scale(${getResponsiveScale(scale)})`,
                        transition: isMovingThisChurch && churchMovePreview ? 'none' : 'left 0.3s ease, top 0.3s ease',
                      }}
                      onClick={e => {
                        e.stopPropagation()
                        if (movingChurchId === ch.id) return
                        if (movingChurchId) return
                        if (isMoveModeActive && isAdmin) {
                          startChurchMoveMode(ch)
                          return
                        }
                        if (!isMoveModeActive && isAdmin) setSelectedChurch(ch)
                      }}>
                      <div className={`${isMovingThisChurch ? 'animate-wiggle' : ''} ${isMoveModeActive && isAdmin && !movingChurchId ? 'animate-wiggle' : ''}`}>
                      <div className="w-12 h-12 sm:w-10 sm:h-10 rounded-full border-[3px] sm:border-2 border-amber-400/70 bg-[#1A1612] flex items-center justify-center shadow-lg shadow-amber-900/30
                        group-hover/church:border-amber-400 group-hover/church:shadow-amber-400/30 transition-all">
                        {ch.religion_logo_url ? (
                          <img src={ch.religion_logo_url} alt="" className="w-8 h-8 sm:w-6 sm:h-6 rounded-full object-cover" />
                        ) : (
                          <Church className="w-6 h-6 sm:w-5 sm:h-5 text-amber-400" />
                        )}
                      </div>
                      {/* Enhanced label - bigger and clearer */}
                      <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap">
                        <span className="inline-block px-2 py-1 rounded-md text-xs font-display font-bold text-amber-100 bg-gradient-to-r from-amber-700/90 to-amber-600/90 border border-amber-400/50 shadow-lg">
                          ⛪ {ch.religion_name_th}
                        </span>
                      </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* ── REST POINT RADIUS CIRCLES + MARKERS ── */}
              {imageLoaded && restPoints.map(rp => {
                const isMovingThisRP = movingRestPointId === rp.id
                const displayRPX = isMovingThisRP && restPointMovePreview ? restPointMovePreview.x : rp.position_x
                const displayRPY = isMovingThisRP && restPointMovePreview ? restPointMovePreview.y : rp.position_y
                
                return (
                  <div key={`rp-${rp.id}`} className="absolute inset-0 z-10 pointer-events-none">
                    {/* Radius circle */}
                    <div className="absolute pointer-events-none"
                      style={{
                        left: `${displayRPX}%`,
                        top: `${displayRPY}%`,
                        width: `${rp.radius * 2}%`,
                        height: `${rp.radius * 2}%`,
                        transform: 'translate(-50%, -50%)',
                        transition: isMovingThisRP && restPointMovePreview ? 'none' : 'left 0.3s ease, top 0.3s ease',
                      }}>
                      {/* Ripple effect */}
                      <div className="absolute inset-0 rounded-full border border-indigo-400/40 animate-ripple" />
                      <div className="absolute inset-0 rounded-full border border-indigo-400/30 animate-ripple" style={{ animationDelay: '1.5s' }} />
                      {/* Core circle */}
                      <div className="relative w-full h-full rounded-full border-[3px] sm:border-2 border-indigo-400/60 bg-indigo-400/50"
                        style={{ boxShadow: '0 0 28px rgba(129, 140, 248, 0.35), inset 0 0 12px rgba(129, 140, 248, 0.2)' }} />
                    </div>
                    {/* Rest point marker icon */}
                    <div
                      className={`absolute ${isMovingThisRP ? 'z-50' : 'z-20'} cursor-pointer pointer-events-auto group/restpoint`}
                      style={{
                        left: `${displayRPX}%`,
                        top: `${displayRPY}%`,
                        transform: `translate(-50%, -50%) scale(${getResponsiveScale(scale)})`,
                        transition: isMovingThisRP && restPointMovePreview ? 'none' : 'left 0.3s ease, top 0.3s ease',
                      }}
                      onClick={e => {
                        e.stopPropagation()
                        if (movingRestPointId === rp.id) return
                        if (movingRestPointId) return
                        if (isMoveModeActive && isAdmin) {
                          startRestPointMoveMode(rp)
                          return
                        }
                        if (!isMoveModeActive && isAdmin) setSelectedRestPoint(rp)
                      }}>
                      <div className={`${isMovingThisRP ? 'animate-wiggle' : ''} ${isMoveModeActive && isAdmin && !movingRestPointId ? 'animate-wiggle' : ''}`}>
                      <div className="w-12 h-12 sm:w-10 sm:h-10 rounded-full border-[3px] sm:border-2 border-indigo-400/70 bg-[#1A1612] flex items-center justify-center shadow-lg shadow-indigo-900/30
                        group-hover/restpoint:border-indigo-400 group-hover/restpoint:shadow-indigo-400/30 transition-all">
                        {rp.image_url ? (
                          <img src={rp.image_url} alt="" className="w-8 h-8 sm:w-6 sm:h-6 rounded-full object-cover" />
                        ) : (
                          <Tent className="w-6 h-6 sm:w-5 sm:h-5 text-indigo-400" />
                        )}
                      </div>
                      {/* Enhanced label - bigger and clearer */}
                      <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap">
                        <span className="inline-block px-2 py-1 rounded-md text-xs font-display font-bold text-indigo-100 bg-gradient-to-r from-indigo-700/90 to-indigo-600/90 border border-indigo-400/50 shadow-lg">
                          ⛺ {rp.name}
                        </span>
                      </div>
                      </div>
                    </div>
                  </div>
                )
              })}



              {/* ── JOIN POSITION GHOST PREVIEW ── */}
              {imageLoaded && isJoiningMap && joinPreviewPos && (
                <div className="absolute z-30 pointer-events-none"
                  style={{
                    left: `${joinPreviewPos.x}%`,
                    top: `${joinPreviewPos.y}%`,
                    transform: 'translate(-50%, -50%)'
                  }}>
                  <div className="relative animate-pulse" style={{ width: tokenSize, height: tokenSize }}>
                    <div className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping" />
                    <div className="w-full h-full rounded-full border-4 border-emerald-400 bg-emerald-500/50 flex items-center justify-center shadow-lg shadow-emerald-500/50">
                      <MapPin className="w-6 h-6 text-white" />
                    </div>
                    <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <span className="inline-block px-3 py-1 rounded-md text-sm font-display font-bold text-white bg-gradient-to-r from-emerald-600 to-green-500 border border-emerald-300/50 shadow-lg">
                        📍 จุดเกิดของคุณ
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TOKEN CLUSTERS ── */}
              {imageLoaded && clusters.map((cluster, ci) => {
                const isCluster = cluster.tokens.length > 1
                const displayToken = cluster.tokens[0]
                const isMovingThis = cluster.tokens.some(t => t.id === movingTokenId)
                
                // Use movePreview position for the token being moved (real-time follow)
                const displayX = isMovingThis && movePreview ? movePreview.x : cluster.centerX
                const displayY = isMovingThis && movePreview ? movePreview.y : cluster.centerY

                return (
                  <div key={ci}
                    className={`absolute ${isMovingThis ? 'z-50' : 'z-20'}`}
                    style={{
                      left: `${displayX}%`, top: `${displayY}%`,
                      transform: `translate(-50%, -50%) scale(${getResponsiveScale(scale)})`,
                      transition: isMovingThis && movePreview ? 'none' : 'left 0.3s ease, top 0.3s ease',
                    }}>
                    {/* Token circle */}
                    <div
                      className={`relative select-none cursor-pointer
                        ${isMovingThis ? 'animate-wiggle' : ''}
                        ${isMoveModeActive && !isMovingThis && cluster.tokens.some(t => canMoveToken(t)) ? 'animate-wiggle' : ''}
                      `}
                      style={{ width: tokenSize, height: tokenSize }}
                      onClick={e => {
                        e.stopPropagation()
                        if (movingTokenId) {
                          const pos = screenToMapPercent(e.clientX, e.clientY)
                          if (pos) dropItemLocally(pos.x, pos.y)
                          return
                        }
                        if (isCluster) { handleClusterClick(cluster) } else { handleTokenClick(displayToken) }
                      }}
                    >
                      <div className={`w-full h-full rounded-full overflow-hidden border-[3px] sm:border-2 
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
                      {/* Name label - enhanced visibility */}
                      <div className={`absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[12px] sm:text-[11px] font-display font-bold px-2 py-0.5 rounded-sm border shadow-lg ${
                        displayToken.token_type === 'npc' 
                          ? 'text-amber-200 bg-gradient-to-r from-amber-900/90 to-amber-800/90 border-amber-500/40' 
                          : displayToken.user_id === currentUserId
                            ? 'text-gold-300 bg-gradient-to-r from-gold-900/90 to-amber-900/90 border-gold-400/50'
                            : 'text-nouveau-cream bg-gradient-to-r from-victorian-900/90 to-gray-900/90 border-victorian-400/40'
                      }`}>
                        {displayToken.token_type === 'npc' ? '👤 ' : ''}{displayToken.display_name || displayToken.npc_name || '?'}
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

          {/* ── Church move mode indicator ── */}
          {movingChurchId && (
            <div className="absolute top-4 inset-x-0 z-50 flex justify-center px-4">
              <div className="bg-black/95 border-2 border-amber-400 text-amber-300 text-sm sm:text-base font-display font-bold 
                              px-4 sm:px-6 py-3 rounded-xl shadow-2xl shadow-amber-900/30 flex items-center gap-3 pointer-events-auto">
                <Church className="w-5 h-5 animate-bounce text-amber-400" />
                <span>⛪ คลิกบนแมพเพื่อย้าย แล้วกดบันทึก</span>
                <button onClick={cancelChurchMoveMode}
                  className="ml-2 px-4 py-1.5 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg cursor-pointer transition-colors font-bold shadow-lg shadow-red-900/20">
                  ❌ ยกเลิก
                </button>
              </div>
            </div>
          )}

          {/* ── Rest point move mode indicator ── */}
          {movingRestPointId && (
            <div className="absolute top-4 inset-x-0 z-50 flex justify-center px-4">
              <div className="bg-black/95 border-2 border-indigo-400 text-indigo-300 text-sm sm:text-base font-display font-bold 
                              px-4 sm:px-6 py-3 rounded-xl shadow-2xl shadow-indigo-900/30 flex items-center gap-3 pointer-events-auto">
                <Tent className="w-5 h-5 animate-bounce text-indigo-400" />
                <span>⛺ คลิกบนแมพเพื่อย้าย แล้วกดบันทึก</span>
                <button onClick={cancelRestPointMoveMode}
                  className="ml-2 px-4 py-1.5 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg cursor-pointer transition-colors font-bold shadow-lg shadow-red-900/20">
                  ❌ ยกเลิก
                </button>
              </div>
            </div>
          )}
          
          {/* ── Join map position selector indicator ── */}
          {isJoiningMap && (
            <div className="absolute top-4 inset-x-0 z-50 flex justify-center px-4">
              <div className="bg-black/95 border-2 border-emerald-400 text-emerald-300 text-sm sm:text-base font-display font-bold 
                              px-4 sm:px-6 py-3 rounded-xl shadow-2xl shadow-emerald-900/30 flex items-center gap-3 pointer-events-auto">
                <MapPin className="w-5 h-5 animate-bounce text-emerald-400" />
                <span>📍 คลิกบนแมพเพื่อเลือกจุดเกิดของคุณ!</span>
                <button onClick={cancelJoinMode}
                  className="ml-2 px-4 py-1.5 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg cursor-pointer transition-colors font-bold shadow-lg shadow-red-900/20">
                  ❌ ยกเลิก
                </button>
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
          canMove={canMoveToken(selectedToken)}
          onClose={() => setSelectedToken(null)}
          onRemove={() => {
            startTransition(async () => {
              await removeTokenFromMap(selectedToken.id)
              setSelectedToken(null)
              fetchMapDataRef.current?.()
              broadcastRef.current('token_removed', { id: selectedToken.id })
            })
          }}
          onMove={() => startMoveFromPopup(selectedToken)}
          onSaveRadius={(radius) => {
            startTransition(async () => {
              const r = await updateNpcRadius(selectedToken.id, radius)
              if (r?.error) showToast(r.error, 'error')
              else { setSelectedToken(null); fetchMapDataRef.current?.() }
            })
          }}
          isPending={isPending}
        />
      )}

      {/* Cluster popup */}
      {selectedCluster && !showZoneCreator && (
        <ClusterPopup cluster={selectedCluster} currentUserId={currentUserId} isAdmin={isAdmin}
          onSelectToken={t => { setSelectedCluster(null); setSelectedToken(t) }}
          onClose={() => setSelectedCluster(null)}
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
              else { setShowNpcModal(false); setNpcName(''); setNpcUrl(''); fetchMapDataRef.current?.(); broadcastRef.current('token_added', { mapId: map.id }) }
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
              else { setShowAddPlayer(false); setSelectedPlayerId(''); fetchMapDataRef.current?.(); broadcastRef.current('token_added', { mapId: map.id }) }
            })
          }} disabled={isPending || !selectedPlayerId}
            className="btn-gold !py-2 !px-4 !text-sm w-full flex items-center justify-center gap-2 disabled:opacity-50">
            <UserPlus className="w-4 h-4" />{isPending ? 'กำลังเพิ่ม...' : 'เพิ่มเข้าแมพ'}
          </button>
        </ModalOverlay>
      )}

      {showRoleplayMoveModal && (
        <ModalOverlay onClose={() => setShowRoleplayMoveModal(false)} title="ย้ายตำแหน่ง (โรลเพลย์)">
          <div className="mb-4 p-3 bg-green-900/60 border border-green-400 rounded-sm text-xs text-green-100 font-display leading-relaxed shadow-[0_0_10px_rgba(74,222,128,0.2)]">
            <div className="flex items-center gap-2 mb-2 text-green-300 font-bold uppercase tracking-wider">
              <Info className="w-4 h-4" />
              <span>ข้อควรทราบ</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 opacity-90">
              <li>การย้ายตัวละคร หรือ ย้ายแมพ ผ่านการโรลเพลย์ <strong>จะใช้เวลาสักครู่</strong> แต่หากใช้แต้มเดินทางจะย้ายทันที</li>
              <li>เส้นทาง <strong>ลูกศิษย์</strong> บางลำดับจะมีเงื่อนไขพิเศษ ที่เดินทางโดยใช้แต้มจะคุ้มค่ากว่า</li>
              <li>ทีมงานสามารถตรวจสอบประวัติการเดินทางแบบโรลเพลย์ได้ ดังนั้นโปรดโรลเพลย์เดินทางตามจริง</li>
            </ul>
          </div>
          <label className="block text-xs text-gold-400 mb-1 font-display uppercase tracking-wider">ลิงก์โรลเพลย์ *</label>
          <input
            value={roleplayMoveDestinationUrl}
            onChange={e => setRoleplayMoveDestinationUrl(e.target.value)}
            className="input-victorian !py-2 !px-3 w-full mb-4"
            placeholder="https://..."
          />
          <button
            onClick={confirmRoleplayMoveLinks}
            className="btn-gold !py-2 !px-4 !text-sm w-full flex items-center justify-center gap-2"
          >
            ยืนยันและเลือกตำแหน่ง
          </button>
        </ModalOverlay>
      )}

      {showRoleplayJoinModal && (
        <ModalOverlay onClose={() => setShowRoleplayJoinModal(false)} title="เข้าร่วมแมพ (โรลเพลย์)">
          <div className="mb-4 p-3 bg-green-900/60 border border-green-400 rounded-sm text-xs text-green-100 font-display leading-relaxed shadow-[0_0_10px_rgba(74,222,128,0.2)]">
            <div className="flex items-center gap-2 mb-2 text-green-300 font-bold uppercase tracking-wider">
              <Info className="w-4 h-4" />
              <span>ข้อควรทราบ</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 opacity-90">
              <li>การย้ายแมพด้วยโรลเพลย์จะ<strong>ใช้เวลาสักครู่</strong> (ไม่ทันทีเหมือนใช้แต้ม)</li>
              <li>บางเส้นทาง/เงื่อนไขพิเศษ การใช้แต้มอาจ<strong>คุ้มค่ากว่า</strong></li>
              <li>ทีมงานสามารถตรวจสอบประวัติย้อนหลังได้ โปรด<strong>โรลเพลย์ตามจริง</strong></li>
              <li>แนบลิงก์โรลเพลย์ที่แสดงการเดินทางมาถึงสถานที่นี้</li>
            </ul>
          </div>
          <label className="block text-xs text-gold-400 mb-1 font-display uppercase tracking-wider">ลิงก์โรลเพลย์ *</label>
          <input
            value={roleplayJoinDestinationUrl}
            onChange={e => setRoleplayJoinDestinationUrl(e.target.value)}
            className="input-victorian !py-2 !px-3 w-full mb-4"
            placeholder="https://..."
          />
          <button
            onClick={confirmRoleplayJoinLinks}
            className="btn-gold !py-2 !px-4 !text-sm w-full flex items-center justify-center gap-2"
          >
            ยืนยันและเลือกจุดเกิด
          </button>
        </ModalOverlay>
      )}

      {/* Embed Modal */}
      {showEmbedModal && <EmbedModal />}

      {/* Add Church Modal */}
      {showChurchModal && (
        <ModalOverlay onClose={() => setShowChurchModal(false)} title="วางโบสถ์บนแมพ">
          <label className="block text-xs text-gold-400 mb-1 font-display uppercase tracking-wider">ศาสนา *</label>
          <select value={churchReligionId} onChange={e => setChurchReligionId(e.target.value)}
            className="input-victorian !py-2 !px-3 w-full mb-3">
            <option value="">— เลือกศาสนา —</option>
            {religions.map(r => (
              <option key={r.id} value={r.id}>{r.name_th} ({r.name_en})</option>
            ))}
          </select>
          <label className="block text-xs text-gold-400 mb-1 font-display uppercase tracking-wider">รัศมีเขตทำการ (%)</label>
          <div className="flex items-center gap-3 mb-4">
            <input type="range" min={1} max={50} step={0.5} value={churchRadius}
              onChange={e => setChurchRadius(parseFloat(e.target.value))}
              className="flex-1 accent-amber-400" />
            <span className="text-amber-400 font-mono text-sm w-14 text-right">{churchRadius}%</span>
          </div>
          <p className="text-victorian-500 text-xs mb-4">โบสถ์จะถูกวางที่กลางแมพ แล้วลากย้ายได้ทีหลัง</p>
          <button onClick={handleAddChurch} disabled={isPending || !churchReligionId}
            className="btn-gold !py-2 !px-4 !text-sm w-full flex items-center justify-center gap-2 disabled:opacity-50">
            <Church className="w-4 h-4" />{isPending ? 'กำลังเพิ่ม...' : 'วางโบสถ์'}
          </button>
        </ModalOverlay>
      )}

      {/* Church Info Popup (admin) */}
      {selectedChurch && (
        <ChurchInfoPopup
          church={selectedChurch}
          onClose={() => setSelectedChurch(null)}
          onMove={() => startChurchMoveMode(selectedChurch)}
          onDelete={() => handleDeleteChurch(selectedChurch.id)}
          onSaveRadius={(radius) => handleUpdateChurchRadius(selectedChurch.id, radius)}
          isPending={isPending}
        />
      )}

      {/* Add Rest Point Modal */}
      {showRestPointModal && (
        <ModalOverlay onClose={() => setShowRestPointModal(false)} title="วางจุดพักบนแมพ">
          <label className="block text-xs text-gold-400 mb-1 font-display uppercase tracking-wider">ชื่อจุดพัก *</label>
          <input value={restPointName} onChange={e => setRestPointName(e.target.value)} className="input-victorian !py-2 !px-3 w-full mb-3" placeholder="เช่น กระท่อมริมป่า" />
          <label className="block text-xs text-gold-400 mb-1 font-display uppercase tracking-wider">URL รูปภาพ (ไม่บังคับ)</label>
          <input value={restPointUrl} onChange={e => setRestPointUrl(e.target.value)} className="input-victorian !py-2 !px-3 w-full mb-3" placeholder="https://..." />
          <label className="block text-xs text-gold-400 mb-1 font-display uppercase tracking-wider">รัศมีเขตพัก (%)</label>
          <div className="flex items-center gap-3 mb-4">
            <input type="range" min={1} max={50} step={0.5} value={restPointRadius}
              onChange={e => setRestPointRadius(parseFloat(e.target.value))}
              className="flex-1 accent-indigo-400" />
            <span className="text-indigo-400 font-mono text-sm w-14 text-right">{restPointRadius}%</span>
          </div>
          <p className="text-victorian-500 text-xs mb-4">จุดพักจะถูกวางที่กลางแมพ แล้วลากย้ายได้ทีหลัง</p>
          <button onClick={handleAddRestPoint} disabled={isPending || !restPointName.trim()}
            className="btn-gold !py-2 !px-4 !text-sm w-full flex items-center justify-center gap-2 disabled:opacity-50">
            <Tent className="w-4 h-4" />{isPending ? 'กำลังเพิ่ม...' : 'วางจุดพัก'}
          </button>
        </ModalOverlay>
      )}

      {/* Rest Point Info Popup (admin) */}
      {selectedRestPoint && (
        <RestPointInfoPopup
          restPoint={selectedRestPoint}
          onClose={() => setSelectedRestPoint(null)}
          onMove={() => startRestPointMoveMode(selectedRestPoint)}
          onDelete={() => handleDeleteRestPoint(selectedRestPoint.id)}
          onSaveRadius={(radius) => handleUpdateRestPointRadius(selectedRestPoint.id, radius)}
          isPending={isPending}
        />
      )}

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
          ${toast.type === 'error' ? 'bg-red-600 border-red-500 text-white' : 'bg-gold-400/10 border-gold-400/30 text-gold-400'}`}>
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

function TokenInfoPopup({ token, isAdmin, isMe, canMove, onClose, onRemove, onMove, onSaveRadius, isPending }: {
  token: MapTokenWithProfile; isAdmin: boolean; isMe: boolean;
  canMove: boolean;
  onClose: () => void; onRemove: () => void; onMove: () => void
  onSaveRadius: (radius: number) => void; isPending: boolean
}) {
  const [editRadius, setEditRadius] = useState<number>(token.interaction_radius ?? 0)
  const [pathwayInfo, setPathwayInfo] = useState<string | null>(null)

  useEffect(() => {
    if (token.token_type !== 'player' || !token.user_id) return
    const supabase = createClient()
    supabase
      .from('player_pathways')
      .select('pathway:skill_pathways(name), sequence:skill_sequences(seq_number)')
      .eq('player_id', token.user_id)
      .then(({ data }) => {
        if (!data || data.length === 0) return
        const row = data[0] as unknown as { pathway: { name: string } | null; sequence: { seq_number: number } | null }
        if (row.pathway) {
          const label = row.sequence ? `${row.pathway.name} ลำดับ ${row.sequence.seq_number}` : row.pathway.name
          setPathwayInfo(label)
        }
      })
  }, [token.user_id, token.token_type])

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
            <p className="font-display text-gold-400 text-3xl leading-tight mb-1 text-shadow-glow break-words">{token.display_name || token.npc_name}</p>
            <p className="text-xl text-victorian-400">
              {token.token_type === 'npc' ? 'NPC' : token.role === 'admin' ? 'แอดมิน' : token.role === 'dm' ? 'DM' : 'ผู้เล่น'}
              {isMe && ' (คุณ)'}
            </p>
            {pathwayInfo && (
              <p className="text-sm text-victorian-500 mt-1">🛤️ {pathwayInfo}</p>
            )}
          </div>
          <button onClick={onClose} className="self-start -mt-2 -mr-2 text-victorian-400 hover:text-gold-400 cursor-pointer p-2"><X className="w-8 h-8" /></button>
        </div>

        {/* NPC Interaction Radius Editor (admin only) */}
        {isAdmin && token.token_type === 'npc' && (
          <div className="mb-4 p-4 rounded-sm border border-nouveau-ruby/20 bg-nouveau-ruby/5">
            <label className="block text-sm font-display text-nouveau-ruby/80 mb-2 uppercase tracking-wider">
              เขตทำการ (รัศมี %)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0} max={50} step={0.5}
                value={editRadius}
                onChange={e => setEditRadius(parseFloat(e.target.value))}
                className="flex-1 accent-nouveau-ruby"
              />
              <span className="text-nouveau-ruby font-mono text-sm w-14 text-right">{editRadius}%</span>
            </div>
            <p className="text-victorian-500 text-xs mt-1.5">
              {editRadius === 0
                ? 'ไม่แสดงรัศมี (ไม่สามารถใช้เป็นเงื่อนไขภารกิจได้)'
                : `ผู้เล่นต้องอยู่ภายในรัศมี ${editRadius}% ของแมพ เพื่อส่งภารกิจกับ NPC นี้`}
            </p>
            {editRadius !== (token.interaction_radius ?? 0) && (
              <button
                onClick={() => onSaveRadius(editRadius)}
                disabled={isPending}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-nouveau-cream border-2 border-nouveau-ruby/40 hover:border-nouveau-ruby/70 rounded-sm cursor-pointer hover:bg-nouveau-ruby/10 transition-colors disabled:opacity-50">
                <Save className="w-4 h-4" /> {isPending ? 'กำลังบันทึก...' : 'บันทึกรัศมี'}
              </button>
            )}
          </div>
        )}

        <div className="space-y-3">
          {isAdmin && (
            <button onClick={onRemove}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 text-xl font-bold text-nouveau-ruby border-2 border-nouveau-ruby/30 hover:border-nouveau-ruby/60 rounded-lg cursor-pointer hover:bg-nouveau-ruby/10 transition-colors">
              <Trash2 className="w-6 h-6" /> 🗑️ ลบออกจากแมพ
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ClusterPopup({ cluster, currentUserId, isAdmin: _isAdmin, onSelectToken, onClose }: {
  cluster: TokenCluster; currentUserId: string; isAdmin: boolean;
  onSelectToken: (t: MapTokenWithProfile) => void; onClose: () => void;
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

function ChurchInfoPopup({ church, onClose, onMove, onDelete, onSaveRadius, isPending }: {
  church: MapChurchWithReligion
  onClose: () => void
  onMove: () => void
  onDelete: () => void
  onSaveRadius: (radius: number) => void
  isPending: boolean
}) {
  const [editRadius, setEditRadius] = useState<number>(church.radius)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-lg border-2 border-amber-400/40 rounded-sm p-8 shadow-2xl shadow-amber-900/20"
        style={{ backgroundColor: '#1A1612' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-6 mb-6">
          <div className="w-20 h-20 rounded-full overflow-hidden border-4 shrink-0 shadow-lg border-amber-400/60">
            {church.religion_logo_url ? (
              <img src={church.religion_logo_url} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full bg-victorian-800 flex items-center justify-center">
                <Church className="w-10 h-10 text-amber-400" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-amber-400 text-2xl truncate mb-1">โบสถ์ {church.religion_name_th}</p>
            <p className="text-sm text-victorian-400">ตำแหน่ง: {church.position_x.toFixed(1)}%, {church.position_y.toFixed(1)}%</p>
          </div>
          <button onClick={onClose} className="self-start -mt-2 -mr-2 text-victorian-400 hover:text-gold-400 cursor-pointer p-2">
            <X className="w-8 h-8" />
          </button>
        </div>

        {/* Radius editor */}
        <div className="mb-4 p-4 rounded-sm border border-amber-400/20 bg-amber-400/5">
          <label className="block text-sm font-display text-amber-400/80 mb-2 uppercase tracking-wider">
            เขตทำการโบสถ์ (รัศมี %)
          </label>
          <div className="flex items-center gap-3">
            <input type="range" min={1} max={50} step={0.5} value={editRadius}
              onChange={e => setEditRadius(parseFloat(e.target.value))}
              className="flex-1 accent-amber-400" />
            <span className="text-amber-400 font-mono text-sm w-14 text-right">{editRadius}%</span>
          </div>
          <p className="text-victorian-500 text-xs mt-1.5">
            ผู้เล่นต้องอยู่ภายในรัศมี {editRadius}% เพื่อภาวนาที่โบสถ์นี้
          </p>
          {editRadius !== church.radius && (
            <button onClick={() => onSaveRadius(editRadius)} disabled={isPending}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-nouveau-cream border-2 border-amber-400/40 hover:border-amber-400/70 rounded-sm cursor-pointer hover:bg-amber-400/10 transition-colors disabled:opacity-50">
              <Save className="w-4 h-4" /> {isPending ? 'กำลังบันทึก...' : 'บันทึกรัศมี'}
            </button>
          )}
        </div>

        <div className="space-y-3">
          <button onClick={onMove}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 text-xl font-bold text-amber-400 border-2 border-amber-400/30 hover:border-amber-400/60 rounded-lg cursor-pointer hover:bg-amber-400/10 transition-colors">
            <Move className="w-6 h-6" /> 📍 ย้ายตำแหน่ง
          </button>
          <button onClick={onDelete}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 text-xl font-bold text-nouveau-ruby border-2 border-nouveau-ruby/30 hover:border-nouveau-ruby/60 rounded-lg cursor-pointer hover:bg-nouveau-ruby/10 transition-colors">
            <Trash2 className="w-6 h-6" /> 🗑️ ลบออกจากแมพ
          </button>
        </div>
      </div>
    </div>
  )
}

function RestPointInfoPopup({ restPoint, onClose, onMove, onDelete, onSaveRadius, isPending }: {
  restPoint: MapRestPoint
  onClose: () => void
  onMove: () => void
  onDelete: () => void
  onSaveRadius: (radius: number) => void
  isPending: boolean
}) {
  const [editRadius, setEditRadius] = useState<number>(restPoint.radius)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-lg border-2 border-indigo-400/40 rounded-sm p-8 shadow-2xl shadow-indigo-900/20"
        style={{ backgroundColor: '#1A1612' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-6 mb-6">
          <div className="w-20 h-20 rounded-full overflow-hidden border-4 shrink-0 shadow-lg border-indigo-400/60">
            {restPoint.image_url ? (
              <img src={restPoint.image_url} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full bg-victorian-800 flex items-center justify-center">
                <Tent className="w-10 h-10 text-indigo-400" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-indigo-400 text-2xl truncate mb-1">จุดพัก {restPoint.name}</p>
            <p className="text-sm text-victorian-400">ตำแหน่ง: {restPoint.position_x.toFixed(1)}%, {restPoint.position_y.toFixed(1)}%</p>
          </div>
          <button onClick={onClose} className="self-start -mt-2 -mr-2 text-victorian-400 hover:text-gold-400 cursor-pointer p-2">
            <X className="w-8 h-8" />
          </button>
        </div>

        {/* Radius editor */}
        <div className="mb-4 p-4 rounded-sm border border-indigo-400/20 bg-indigo-400/5">
          <label className="block text-sm font-display text-indigo-400/80 mb-2 uppercase tracking-wider">
            เขตพัก (รัศมี %)
          </label>
          <div className="flex items-center gap-3">
            <input type="range" min={1} max={50} step={0.5} value={editRadius}
              onChange={e => setEditRadius(parseFloat(e.target.value))}
              className="flex-1 accent-indigo-400" />
            <span className="text-indigo-400 font-mono text-sm w-14 text-right">{editRadius}%</span>
          </div>
          <p className="text-victorian-500 text-xs mt-1.5">
            ผู้เล่นต้องอยู่ภายในรัศมี {editRadius}% จึงจะนอนหลับได้
          </p>
          {editRadius !== restPoint.radius && (
            <button onClick={() => onSaveRadius(editRadius)} disabled={isPending}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-nouveau-cream border-2 border-indigo-400/40 hover:border-indigo-400/70 rounded-sm cursor-pointer hover:bg-indigo-400/10 transition-colors disabled:opacity-50">
              <Save className="w-4 h-4" /> {isPending ? 'กำลังบันทึก...' : 'บันทึกรัศมี'}
            </button>
          )}
        </div>

        <div className="space-y-3">
          <button onClick={onMove}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 text-xl font-bold text-indigo-400 border-2 border-indigo-400/30 hover:border-indigo-400/60 rounded-lg cursor-pointer hover:bg-indigo-400/10 transition-colors">
            <Move className="w-6 h-6" /> 📍 ย้ายตำแหน่ง
          </button>
          <button onClick={onDelete}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 text-xl font-bold text-nouveau-ruby border-2 border-nouveau-ruby/30 hover:border-nouveau-ruby/60 rounded-lg cursor-pointer hover:bg-nouveau-ruby/10 transition-colors">
            <Trash2 className="w-6 h-6" /> 🗑️ ลบออกจากแมพ
          </button>
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

