'use client'

import { createMap, updateMap, deleteMap } from '@/app/actions/maps'
import type { GameMap } from '@/lib/types/database'
import { ArrowLeft, Plus, Pencil, Trash2, X, Save, MapIcon } from 'lucide-react'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import SanityLockOverlay from '@/components/sanity-lock-overlay'

interface MapsContentProps {
  maps: GameMap[]
  isAdmin: boolean
  myMapId: string | null
  sanity: number
}

/* ── Art Nouveau Corner Ornament ── */
function CornerOrnament({ className }: { className?: string }) {
  return (
    <svg className={className} width="40" height="40" viewBox="0 0 60 60" fill="none">
      <path d="M2 58V20C2 10 10 2 20 2H58" stroke="url(#gold-c)" strokeWidth="1.5" fill="none" />
      <path d="M8 58V26C8 16 16 8 26 8H58" stroke="url(#gold-c)" strokeWidth="0.5" opacity="0.4" fill="none" />
      <circle cx="20" cy="20" r="2" fill="#D4AF37" opacity="0.6"/>
      <defs>
        <linearGradient id="gold-c" x1="2" y1="58" x2="58" y2="2">
          <stop stopColor="#D4AF37" stopOpacity="0.8"/>
          <stop offset="1" stopColor="#C5A55A" stopOpacity="0.2"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

/* ══════════════════════════════════════════════
   MAP ADD / EDIT MODAL
   ══════════════════════════════════════════════ */
function MapModal({ 
  map, 
  onClose, 
  onSaved 
}: { 
  map?: GameMap | null
  onClose: () => void
  onSaved: () => void 
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!map

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = isEdit
        ? await updateMap(map!.id, formData)
        : await createMap(formData)
        
      if (result?.error) {
        setError(result.error)
      } else {
        onSaved()
        onClose()
      }
    })
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
    >
      <div 
        className="w-full max-w-lg rounded-sm border border-gold-400/30 p-6 md:p-8 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: '#1A1612' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="heading-victorian text-2xl">
            {isEdit ? 'แก้ไขแผนที่' : 'เพิ่มแผนที่ใหม่'}
          </h3>
          <button 
            type="button"
            onClick={onClose}
            className="text-victorian-400 hover:text-gold-400 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-nouveau-ruby/10 border border-nouveau-ruby/30 rounded-sm text-nouveau-ruby text-sm">
            {error}
          </div>
        )}

        <form action={handleSubmit} className="space-y-5">
          {/* ชื่อแผนที่ */}
          <div>
            <label className="block text-xs text-gold-400 mb-1.5 font-display tracking-wider uppercase">
              ชื่อแผนที่ <span className="text-nouveau-ruby">*</span>
            </label>
            <input
              name="name"
              type="text"
              required
              defaultValue={map?.name ?? ''}
              placeholder="เช่น เมืองหลวงแห่งอาณาจักร..."
              className="input-victorian !py-2.5 !px-3 !text-base w-full"
            />
          </div>

          {/* คำอธิบาย */}
          <div>
            <label className="block text-xs text-victorian-300 mb-1.5 font-display tracking-wider uppercase">
              คำอธิบาย
            </label>
            <textarea
              name="description"
              rows={3}
              defaultValue={map?.description ?? ''}
              placeholder="รายละเอียดเกี่ยวกับแผนที่นี้..."
              className="input-victorian !py-2.5 !px-3 !text-base w-full resize-none"
            />
          </div>

          {/* Direct URL Image */}
          <div>
            <label className="block text-xs text-gold-400 mb-1.5 font-display tracking-wider uppercase">
              URL รูปแผนที่ <span className="text-nouveau-ruby">*</span>
            </label>
            <input
              name="image_url"
              type="url"
              required
              defaultValue={map?.image_url ?? ''}
              placeholder="https://example.com/map-image.jpg"
              className="input-victorian !py-2.5 !px-3 !text-base w-full"
            />
            <p className="text-victorian-500 text-[10px] mt-1">
              ใส่ Direct URL ของรูปภาพ — รูปที่ไม่ใช่ 1:1 จะถูกครอปอัตโนมัติในหน้ารายการ
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-victorian-400 hover:text-nouveau-cream cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="btn-gold !py-2 !px-4 !text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มแผนที่'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


/* ══════════════════════════════════════════════
   MAIN: Maps Gallery Content
   ══════════════════════════════════════════════ */
export default function MapsContent({ maps, isAdmin, myMapId, sanity }: MapsContentProps) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [editingMap, setEditingMap] = useState<GameMap | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  
  // ตรวจสอบว่าสติเหลือ 0 หรือไม่
  const isSanityLocked = sanity === 0

  function handleEdit(map: GameMap) {
    setEditingMap(map)
    setShowModal(true)
  }

  function handleDelete(mapId: string) {
    if (!confirm('ลบแผนที่นี้หรือไม่?')) return
    setDeletingId(mapId)
    startTransition(async () => {
      await deleteMap(mapId)
      setDeletingId(null)
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1A1612' }}>
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <a 
              href="/dashboard" 
              className="p-2 text-victorian-400 hover:text-gold-400 border border-gold-400/10 hover:border-gold-400/30 rounded-sm transition-all cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </a>
            <div>
              <h1 className="heading-victorian text-4xl md:text-5xl">แผนที่</h1>
              <p className="text-victorian-400 mt-1">สำรวจโลกกว้างและสถานที่สำคัญ</p>
            </div>
          </div>
          
          {isAdmin && (
            <button
              type="button"
              onClick={() => { setEditingMap(null); setShowModal(true) }}
              className="btn-gold !py-2 !px-4 !text-sm flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              เพิ่มแผนที่
            </button>
          )}
        </div>

        {/* Maps Grid */}
        {maps.length === 0 ? (
          <div className="text-center py-20">
            <MapIcon className="w-16 h-16 text-victorian-600 mx-auto mb-4" />
            <p className="text-victorian-400 text-lg font-display">ยังไม่มีแผนที่</p>
            {isAdmin && (
              <p className="text-victorian-500 text-sm mt-2">กดปุ่ม &quot;เพิ่มแผนที่&quot; เพื่อเริ่มต้น</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {maps.map((map) => (
              <div 
                key={map.id}
                className={`group relative card-victorian overflow-hidden transition-all duration-300
                           hover:border-gold-400/50 hover:shadow-gold
                           ${deletingId === map.id ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {/* Image — forced 1:1 crop */}
                <a href={`/dashboard/maps/${map.id}`} className="block">
                  <div className="relative aspect-square overflow-hidden">
                    <img 
                      src={map.image_url} 
                      alt={map.name}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {/* Gradient overlay at bottom */}
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#1A1612] to-transparent" />
                    
                    {/* Corner ornaments */}
                    <CornerOrnament className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <CornerOrnament className="absolute top-2 right-2 -scale-x-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    {/* You are here badge */}
                    {myMapId === map.id && (
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full
                                       bg-gold-400/20 border border-gold-400/40 backdrop-blur-sm z-10">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-gold-400" />
                        </span>
                        <span className="text-gold-400 text-[10px] font-display">คุณอยู่ที่นี่</span>
                      </div>
                    )}
                  </div>
                </a>

                {/* Info */}
                <div className="p-4">
                  <a href={`/dashboard/maps/${map.id}`} className="block">
                    <h3 className="heading-victorian text-xl group-hover:text-gold-300 transition-colors">
                      {map.name}
                    </h3>
                    {map.description && (
                      <p className="text-victorian-400 text-sm mt-1 line-clamp-2">
                        {map.description}
                      </p>
                    )}
                  </a>

                  {/* Admin actions */}
                  {isAdmin && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gold-400/10">
                      <button
                        type="button"
                        onClick={() => handleEdit(map)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-victorian-400 hover:text-gold-400
                                   border border-gold-400/10 hover:border-gold-400/30 rounded-sm transition-all cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(map.id)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-nouveau-ruby/60 hover:text-nouveau-ruby
                                   border border-nouveau-ruby/10 hover:border-nouveau-ruby/30 rounded-sm transition-all cursor-pointer
                                   disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3" />
                        ลบ
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <MapModal
          map={editingMap}
          onClose={() => { setShowModal(false); setEditingMap(null) }}
          onSaved={() => router.refresh()}
        />
      )}
      
      {/* Sanity Lock Overlay */}
      {isSanityLocked && <SanityLockOverlay />}
    </div>
  )
}
