'use client'

import type { GameMap, MapTokenWithProfile, MapLockedZone } from '@/lib/types/database'
import { Lock, ZoomIn, ZoomOut, Maximize, Move, Crown, Shield } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface Props {
  map: GameMap
  tokens: MapTokenWithProfile[]
  zones: MapLockedZone[]
}

const MIN_SCALE = 0.5
const MAX_SCALE = 5
const TOKEN_SIZE = 40

export default function EmbedMapViewer({ map, tokens, zones }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [lastTouchDist, setLastTouchDist] = useState(0)
  const [imageLoaded, setImageLoaded] = useState(false)

  // Mouse wheel zoom
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

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    setIsPanning(true)
    setPanStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }
  function handleMouseMove(e: React.MouseEvent) {
    if (isPanning) setPosition({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
  }
  function handleMouseUp() { setIsPanning(false) }

  function getTouchDist(touches: React.TouchList) {
    if (touches.length < 2) return 0
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }
  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1) {
      setIsPanning(true)
      setPanStart({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y })
    } else if (e.touches.length === 2) {
      setLastTouchDist(getTouchDist(e.touches))
    }
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 1 && isPanning) {
      setPosition({ x: e.touches[0].clientX - panStart.x, y: e.touches[0].clientY - panStart.y })
    } else if (e.touches.length === 2) {
      const dist = getTouchDist(e.touches)
      if (lastTouchDist > 0) setScale(s => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + (dist - lastTouchDist) * 0.005)))
      setLastTouchDist(dist)
    }
  }
  function handleTouchEnd() { setIsPanning(false); setLastTouchDist(0) }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: '#0D0B09', fontFamily: "'Cinzel', serif" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b" 
        style={{ backgroundColor: '#1A1612', borderColor: 'rgba(212,175,55,0.1)' }}>
        <h1 style={{ color: '#D4AF37', fontSize: '0.9rem' }}>{map.name}</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => setScale(s => Math.max(MIN_SCALE, s - 0.3))} className="p-1.5 cursor-pointer" style={{ color: '#8B7D6B' }}>
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span style={{ color: '#8B7D6B', fontSize: '10px', minWidth: '2rem', textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>
          <button onClick={() => setScale(s => Math.min(MAX_SCALE, s + 0.3))} className="p-1.5 cursor-pointer" style={{ color: '#8B7D6B' }}>
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }) }} className="p-1.5 cursor-pointer" style={{ color: '#8B7D6B' }}>
            <Maximize className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Map canvas */}
      <div ref={containerRef}
        className={`flex-1 overflow-hidden relative ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'none' }}>

        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div style={{ color: '#8B7D6B', fontSize: '0.85rem' }}>กำลังโหลดแผนที่...</div>
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isPanning ? 'none' : 'transform 0.15s ease-out',
          }}>
          <div className="relative">
            <img ref={imgRef} src={map.image_url} alt={map.name}
              className="max-w-full max-h-full object-contain select-none block"
              draggable={false} onLoad={() => setImageLoaded(true)} />

            {/* Locked zones */}
            {imageLoaded && zones.map(z => (
              <div key={z.id} className="absolute" style={{
                left: `${z.zone_x}%`, top: `${z.zone_y}%`,
                width: `${z.zone_width}%`, height: `${z.zone_height}%`,
              }}>
                <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.6)', border: '1px solid rgba(212,175,55,0.2)' }} />
                <Lock className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ color: 'rgba(212,175,55,0.4)', width: Math.min(24, 24 / scale), height: Math.min(24, 24 / scale) }} />
              </div>
            ))}

            {/* Tokens */}
            {imageLoaded && tokens.map(t => (
              <div key={t.id} className="absolute" style={{
                left: `${t.position_x}%`, top: `${t.position_y}%`,
                transform: `translate(-50%, -50%) scale(${1 / scale})`,
                zIndex: 20,
              }}>
                <div style={{
                  width: TOKEN_SIZE, height: TOKEN_SIZE,
                  borderRadius: '50%', overflow: 'hidden',
                  border: `2px solid ${t.token_type === 'npc' ? 'rgba(180,60,60,0.6)' : 'rgba(212,175,55,0.5)'}`,
                }}>
                  {(t.avatar_url || t.npc_image_url) ? (
                    <img src={t.avatar_url || t.npc_image_url || ''} className="w-full h-full object-cover" alt="" draggable={false} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"
                      style={{ backgroundColor: '#2a2520', color: '#D4AF37', fontSize: '11px' }}>
                      {(t.display_name || t.npc_name || '?')[0]}
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap px-1 rounded-sm"
                  style={{ fontSize: '9px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'rgba(255,245,230,0.8)' }}>
                  {t.display_name || t.npc_name || '?'}
                </div>
                {t.role === 'admin' && <Crown className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3" style={{ color: '#D4AF37' }} />}
                {t.role === 'dm' && <Shield className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3" style={{ color: '#D4AF37' }} />}
              </div>
            ))}
          </div>
        </div>

        {imageLoaded && scale <= 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1"
            style={{ backgroundColor: 'rgba(26,22,18,0.8)', border: '1px solid rgba(212,175,55,0.1)', borderRadius: '999px', color: '#8B7D6B', fontSize: '10px' }}>
            <Move className="w-3 h-3" /> ลากเพื่อเลื่อน • ซูมด้วยสกรอลล์
          </div>
        )}
      </div>

      {/* Powered by */}
      <div className="text-center py-1" style={{ backgroundColor: '#1A1612', borderTop: '1px solid rgba(212,175,55,0.1)' }}>
        <span style={{ fontSize: '9px', color: '#5a5247' }}>Whisper DND</span>
      </div>
    </div>
  )
}
