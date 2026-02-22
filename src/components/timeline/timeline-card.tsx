'use client'

import { useState } from 'react'
import { Eye, EyeOff, Pencil, Trash2, ChevronDown, ChevronUp, Plus, GitBranch, Calendar } from 'lucide-react'

function fmtDate(d: string | null): string | null {
  if (!d) return null
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}
import type { TimelineEntry } from './timeline-view'

interface Props {
  entry: TimelineEntry
  isAdmin: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  onEdit: () => void
  onDelete: () => void
  onTogglePublish: (val: boolean) => void
  onAddSideStory: () => void
  variant: 'main' | 'side' | 'sub'
}

const variantStyles = {
  main: {
    border: 'border-gold-400/30',
    borderHover: 'hover:border-gold-400/60',
    bg: 'bg-victorian-900/90',
    glow: 'hover:shadow-gold',
    titleColor: 'text-gold-300',
    badge: 'bg-gold-400/20 text-gold-300',
    imageAspect: 'aspect-[5/4]',
  },
  side: {
    border: 'border-nouveau-sapphire/40',
    borderHover: 'hover:border-nouveau-sapphire/70',
    bg: 'bg-victorian-900/80',
    glow: 'hover:shadow-[0_0_15px_rgba(27,58,92,0.4)]',
    titleColor: 'text-blue-300',
    badge: 'bg-nouveau-sapphire/30 text-blue-300',
    imageAspect: 'aspect-[5/4]',
  },
  sub: {
    border: 'border-nouveau-emerald/40',
    borderHover: 'hover:border-nouveau-emerald/70',
    bg: 'bg-victorian-900/70',
    glow: 'hover:shadow-[0_0_12px_rgba(46,91,60,0.4)]',
    titleColor: 'text-emerald-300',
    badge: 'bg-nouveau-emerald/30 text-emerald-300',
    imageAspect: 'aspect-[5/4]',
  },
}

export default function TimelineCard({
  entry, isAdmin, isExpanded, onToggleExpand,
  onEdit, onDelete, onTogglePublish, onAddSideStory, variant,
}: Props) {
  const s = variantStyles[variant]

  return (
    <div className={`
      relative rounded-lg ${s.border} ${s.borderHover} ${s.bg} ${s.glow}
      backdrop-blur-sm overflow-hidden transition-all duration-500
      animate-fade-in
    `}>
      {/* Unpublished indicator */}
      {isAdmin && !entry.is_published && (
        <div className="absolute top-2 right-2 z-20">
          <span className="px-2 py-0.5 rounded text-xs bg-red-900/60 text-red-300 border border-red-500/30">
            ซ่อนอยู่
          </span>
        </div>
      )}

      {/* Image */}
      {entry.image_url && (
        <div className={`relative ${s.imageAspect} overflow-hidden`}>
          <img
            src={entry.image_url}
            alt={entry.title}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-105"
          />
          {/* Fade overlay at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-victorian-900/95 to-transparent" />
        </div>
      )}

      {/* Content */}
      <div className="p-4 md:p-5">
        {/* Goal badge */}
        {entry.goal && (
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${s.badge} mb-3`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            {entry.goal}
          </div>
        )}

        {(entry.started_at || entry.ended_at) && (
          <div className="flex items-center gap-1.5 text-[11px] text-victorian-400 mb-2">
            <Calendar className="w-3 h-3 shrink-0" />
            <span>
              {fmtDate(entry.started_at) ?? '?'}
              {entry.ended_at ? ` – ${fmtDate(entry.ended_at)}` : ''}
            </span>
          </div>
        )}

        <h3 className={`font-display text-lg md:text-xl ${s.titleColor} mb-2`}>
          {entry.title}
        </h3>

        {entry.description && (
          <p className="text-victorian-300 text-sm leading-relaxed line-clamp-3">
            {entry.description}
          </p>
        )}

        {/* Expandable full detail */}
        {entry.full_detail && (
          <>
            <button
              onClick={onToggleExpand}
              className="mt-3 flex items-center gap-1 text-xs text-gold-400/70 hover:text-gold-400 transition-colors cursor-pointer"
            >
              {isExpanded ? (
                <>ย่อ <ChevronUp className="w-3 h-3" /></>
              ) : (
                <>รายละเอียดเพิ่มเติม <ChevronDown className="w-3 h-3" /></>
              )}
            </button>
            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-gold-400/10 text-victorian-300 text-sm leading-relaxed whitespace-pre-wrap animate-fade-in">
                {entry.full_detail}
              </div>
            )}
          </>
        )}

        {/* Admin actions */}
        {isAdmin && (
          <div className="mt-4 pt-3 border-t border-gold-400/10 flex items-center gap-2 flex-wrap">
            <button
              onClick={onEdit}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded
                         bg-victorian-800/80 border border-gold-400/20 text-gold-400
                         hover:bg-victorian-700/80 hover:border-gold-400/40 transition-colors cursor-pointer"
            >
              <Pencil className="w-3 h-3" /> แก้ไข
            </button>
            <button
              onClick={() => onTogglePublish(!entry.is_published)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded
                         bg-victorian-800/80 border border-gold-400/20 text-gold-400
                         hover:bg-victorian-700/80 hover:border-gold-400/40 transition-colors cursor-pointer"
            >
              {entry.is_published ? (
                <><EyeOff className="w-3 h-3" /> ซ่อน</>
              ) : (
                <><Eye className="w-3 h-3" /> เผยแพร่</>
              )}
            </button>
            {variant === 'main' && (
              <button
                onClick={onAddSideStory}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded
                           bg-nouveau-sapphire/20 border border-nouveau-sapphire/30 text-blue-300
                           hover:bg-nouveau-sapphire/30 hover:border-nouveau-sapphire/50 transition-colors cursor-pointer"
              >
                <GitBranch className="w-3 h-3" /> Side Story
              </button>
            )}
            <button
              onClick={onDelete}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded
                         bg-red-900/30 border border-red-500/20 text-red-400
                         hover:bg-red-900/50 hover:border-red-500/40 transition-colors ml-auto cursor-pointer"
            >
              <Trash2 className="w-3 h-3" /> ลบ
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
