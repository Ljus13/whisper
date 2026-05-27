'use client'

import { Copy, Check, ChevronLeft, RotateCcw, ExternalLink } from 'lucide-react'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PATHWAYS as PATHWAY_DATA } from '@/app/world-setting/_data/pathways'
import { RELIGIONS as RELIGION_DATA, type ReligionData } from '@/app/dashboard/character-create/_data/religions'
import { cldAvatar } from '@/lib/image'

const STORAGE_KEY = 'whisper_char_draft'
const GENDERS = ['หญิง', 'ชาย', 'อื่น ๆ']

// --------------- types ---------------
interface CharData {
  imageUrl: string
  imagePos: string
  imageSize: string
  characterName: string
  prevName: string
  race: string
  religion: string
  gender: string
  age: string
  appearance: string
  history: string
  personality: string
  tmi: string
  pathwayPrefs: string[]   // top-3
}

const DEFAULT_DATA: CharData = {
  imageUrl: 'https://i.pravatar.cc/300?img=32',
  imagePos: 'center',
  imageSize: 'cover',
  characterName: 'Jane Doe',
  prevName: 'John Smith',
  race: 'มนุษย์',
  religion: 'โบสถ์คนโง่',
  gender: 'หญิง',
  age: '20',
  appearance: 'ส่วนสูง 165 ซม. ผมดำ ตาสีน้ำตาล ลักษณะเด่น...',
  history: 'เกิดที่เมือง... ครอบครัว... เหตุการณ์ที่สำคัญ...',
  personality: 'ใจเย็น รอบคอบ มีความอยากรู้อยากเห็น...',
  tmi: 'อ่านหนังสือ\nทำสวน\nความสงบ\nดนตรี',
  pathwayPrefs: ['นักทำนาย', 'นักปราชญ์', 'ผู้ชม'],
}

// CSS URL — fetched from GitHub Pages at runtime (always latest)
const CSS_URL = 'https://savant777.github.io/zoecode/whisperoftheshadow.css'
const NATURAL_WIDTH = 900

// --------------- church number mapping ---------------
const CHURCH_MAP: Record<string, number> = {
  'ไม่มีศาสนา':           0,
  'โบสถ์คนโง่':            1,
  'โบสถ์อันธกาลนิรันดิ์':   2,
  'โบสถ์พระแม่ธรณี':       3,
  'โบสถ์เทพวายุสลาตัน':    4,
  'โบสถ์สุริยันเจิดจรัส':   5,
  'โบสถ์เทพจักรกลไอน้ำ':   6,
  'โบสถ์เทพปัญญาความรู้':   7,
}

function getChurchNum(religionName: string): number {
  return CHURCH_MAP[religionName] ?? 0
}

// --------------- helpers for pathway data ---------------
function findPathwayByShortName(shortName: string) {
  return PATHWAY_DATA.find(p => p.name.replace('เส้นทาง', '') === shortName)
}

function getReligionData(nameTh: string): ReligionData {
  return RELIGION_DATA.find(r => r.name_th === nameTh) || RELIGION_DATA[0]
}

// --------------- HTML builders (new wots structure) ---------------

/** Build the pathway section — shared between preview & copy */
function buildPathwaySection(d: CharData): string {
  const tags = d.pathwayPrefs.slice(0, 3).map(p => {
    return `<div class="path-tags" pathway="${p}"><div></div></div>`
  }).join('')
  return tags
    ? `<section class="wots-info"><h1>✦ เส้นทางผู้วิเศษ</h1><div class="wots-path-tags">${tags}</div></section>`
    : ''
}

/** Shared structural HTML — tmiContent differs between preview/copy */
function buildInnerHtml(d: CharData, tmiContent: string): string {
  const churchNum = getChurchNum(d.religion)

  const sec = (h: string, body: string) =>
    `<section class="wots-info"><h1>✦ ${h}</h1><div class="wots-box">${body}</div></section>`

  const sections = [
    d.appearance.trim()  ? sec('ลักษณะทางกายภาพ', d.appearance)  : '',
    d.history.trim()     ? sec('ประวัติโดยสังเขป', d.history)     : '',
    d.personality.trim() ? sec('ลักษณะนิสัย',     d.personality)  : '',
    tmiContent           ? sec('TMI',               tmiContent)    : '',
    buildPathwaySection(d),
  ].filter(Boolean).join('')

  return `<div id="WhisperOfTheShadow"><a href="https://discord.com/users/625292873914515456/"></a><div id="wots-profile" class="wots-container"><div class="wots-basic-info"><div class="wots-pic" style="--wots-pic:url(${d.imageUrl});--wots-pos:${d.imagePos};--wots-size:${d.imageSize};"></div><div class="wots-info-mid"><div class="wots-info-name"><div class="wots-name">${d.characterName}</div><div class="wots-dp-name">${d.prevName}</div></div><div class="wots-info-tags"><div class="info-tags" data="เผ่าพันธุ์">${d.race}</div><div class="info-tags" data="อายุ">${d.age}</div><div class="info-tags" data="เพศ">${d.gender}</div></div></div><div class="wots-info-last" church="${churchNum}"><div class="wots-info-church"><div></div></div></div></div>${sections}</div></div>`
}

/** TMI content for preview — rendered as HTML list */
function buildTmiHtml(d: CharData): string {
  const lines = d.tmi.split('\n').map(l => l.trim()).filter(Boolean)
  if (!lines.length) return ''
  return `<ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul>`
}

/** TMI content for copy — BBCode list format */
function buildTmiBBCode(d: CharData): string {
  const lines = d.tmi.split('\n').map(l => l.trim()).filter(Boolean)
  if (!lines.length) return ''
  return `[list]${lines.map(l => `[*]${l}`).join('')}[/list]`
}

function buildCopyHtml(d: CharData): string {
  return `<link href="${CSS_URL}" rel="stylesheet">${buildInnerHtml(d, buildTmiBBCode(d))}`
}

function buildPreviewSrcdoc(d: CharData, cssText: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=900"><style>${cssText}</style><style>html,body{margin:0;padding:1rem;background:#0a0908;overflow-x:hidden;}::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#4a3f35;border-radius:4px;}::-webkit-scrollbar-thumb:hover{background:#6b5a4e;}*{scrollbar-width:thin;scrollbar-color:#4a3f35 transparent;}</style></head><body>${buildInnerHtml(d, buildTmiHtml(d))}<script>function send(){window.parent.postMessage({type:'rp-height',h:document.body.scrollHeight},'*');}window.addEventListener('load',send);new ResizeObserver(send).observe(document.body);<\/script></body></html>`
}


// --------------- rich text editor ---------------
const EDITOR_COLORS = [
  { color: '#c62828', label: 'Ruby'        },
  { color: '#e53935', label: 'Grapefruit'  },
  { color: '#f4511e', label: 'Bittersweet' },
  { color: '#f9a825', label: 'Sunflower'   },
  { color: '#d4e157', label: 'Straw'       },
  { color: '#7cb342', label: 'Grass'       },
  { color: '#43a047', label: 'Basil'       },
  { color: '#26a69a', label: 'Mint'        },
  { color: '#80cbc4', label: 'Teal'        },
  { color: '#29b6f6', label: 'Aqua'        },
  { color: '#5c6bc0', label: 'Blue Jeans'  },
  { color: '#ab47bc', label: 'Lavender'    },
  { color: '#6a1b9a', label: 'Plum'        },
  { color: '#ec407a', label: 'Pink Rose'   },
  { color: '#a1887f', label: 'Grizzly Bear'},
  { color: '#6d4c41', label: 'Chocolate'   },
  { color: '#bdbdbd', label: 'Light Grey'  },
  { color: '#9e9e9e', label: 'Grey'        },
  { color: '#546e7a', label: 'Dark Grey'   },
  { color: '#37474f', label: 'Charcoal'    },
]

const FONT_SIZES = [
  { label: 'S',  value: '2' },
  { label: 'M',  value: '3' },
  { label: 'L',  value: '4' },
  { label: 'XL', value: '5' },
  { label: '2X', value: '6' },
]

const ALIGN_BTNS = [
  { cmd: 'justifyLeft',   title: 'ชิดซ้าย',  icon: (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current">
      <rect x="1" y="2"  width="10" height="2" rx="1"/><rect x="1" y="6"  width="14" height="2" rx="1"/>
      <rect x="1" y="10" width="10" height="2" rx="1"/><rect x="1" y="14" width="14" height="2" rx="1"/>
    </svg>
  )},
  { cmd: 'justifyCenter', title: 'กึ่งกลาง', icon: (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current">
      <rect x="3" y="2"  width="10" height="2" rx="1"/><rect x="1" y="6"  width="14" height="2" rx="1"/>
      <rect x="3" y="10" width="10" height="2" rx="1"/><rect x="1" y="14" width="14" height="2" rx="1"/>
    </svg>
  )},
  { cmd: 'justifyRight',  title: 'ชิดขวา',  icon: (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current">
      <rect x="5" y="2"  width="10" height="2" rx="1"/><rect x="1" y="6"  width="14" height="2" rx="1"/>
      <rect x="5" y="10" width="10" height="2" rx="1"/><rect x="1" y="14" width="14" height="2" rx="1"/>
    </svg>
  )},
]

function EditorToolbar({ onFormat }: { onFormat: (cmd: string, value?: string) => void }) {
  return (
    <div className="flex items-center gap-1 flex-wrap px-2 py-1.5 bg-victorian-900/80 border border-victorian-700/50 border-b-0 rounded-t-md">
      <button type="button" onMouseDown={e => { e.preventDefault(); onFormat('bold') }}
        className="w-7 h-7 text-sm font-bold text-victorian-200 hover:bg-victorian-700/60 rounded flex items-center justify-center" title="ตัวหนา">B</button>
      <button type="button" onMouseDown={e => { e.preventDefault(); onFormat('italic') }}
        className="w-7 h-7 text-sm italic text-victorian-200 hover:bg-victorian-700/60 rounded flex items-center justify-center" title="ตัวเอียง">I</button>
      <button type="button" onMouseDown={e => { e.preventDefault(); onFormat('underline') }}
        className="w-7 h-7 text-sm underline text-victorian-200 hover:bg-victorian-700/60 rounded flex items-center justify-center" title="ขีดเส้นใต้">U</button>
      <div className="w-px h-4 bg-victorian-700/60 mx-0.5 self-center" />
      {FONT_SIZES.map(({ label, value }) => (
        <button key={value} type="button"
          onMouseDown={e => { e.preventDefault(); onFormat('fontSize', value) }}
          className="h-7 px-1.5 text-xs text-victorian-300 hover:bg-victorian-700/60 rounded flex items-center justify-center"
          title={`ขนาด ${label}`}>{label}</button>
      ))}
      <div className="w-px h-4 bg-victorian-700/60 mx-0.5 self-center" />
      {ALIGN_BTNS.map(({ cmd, title, icon }) => (
        <button key={cmd} type="button"
          onMouseDown={e => { e.preventDefault(); onFormat(cmd) }}
          className="w-7 h-7 text-victorian-300 hover:bg-victorian-700/60 rounded flex items-center justify-center"
          title={title}>{icon}</button>
      ))}
      <div className="w-px h-4 bg-victorian-700/60 mx-0.5 self-center" />
      {EDITOR_COLORS.map(({ color, label }) => (
        <button key={color} type="button"
          onMouseDown={e => { e.preventDefault(); onFormat('foreColor', color) }}
          className="w-5 h-5 rounded-sm border border-victorian-700/50 hover:scale-110 transition-transform flex-shrink-0"
          style={{ background: color }} title={label} />
      ))}
      <button type="button"
        onMouseDown={e => { e.preventDefault(); onFormat('removeFormat') }}
        className="ml-auto flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-300 border border-red-500/40 hover:border-red-400/60 hover:bg-red-500/10 px-2 py-1 rounded transition-colors"
        title="ล้างการจัดรูปแบบทั้งหมด"
      >
        <svg viewBox="0 0 16 16" className="w-3 h-3 fill-current"><path d="M2 3h12l-1.5 10H3.5L2 3zm4 3v5m4-5v5M5 3V2a1 1 0 011-1h4a1 1 0 011 1v1"/><line x1="1" y1="3" x2="15" y2="3" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
        ล้าง
      </button>
    </div>
  )
}

// --------------- helpers ---------------
function Field({ label, hint, linkHref, children }: {
  label: string; hint?: string; linkHref?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-xs font-semibold text-victorian-400 uppercase tracking-wider">
        {label}
        {hint && <span className="text-victorian-600 normal-case font-normal">{hint}</span>}
        {linkHref && (
          <a href={linkHref} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-gold-400/70 hover:text-gold-400 transition-colors normal-case font-normal">
            <ExternalLink className="w-3 h-3" />
            <span>ดูข้อมูล</span>
          </a>
        )}
      </label>
      {children}
    </div>
  )
}

const inputCls = "w-full bg-victorian-900/60 border border-victorian-700/50 rounded-md px-3 py-2 text-sm text-victorian-100 placeholder-victorian-600 focus:outline-none focus:border-gold-400/60 transition-colors"
const selectCls = `${inputCls} cursor-pointer`
const textareaCls = `${inputCls} resize-none leading-relaxed`

// --------------- main component ---------------
export default function CharacterCreateContent() {
  const [data, setData] = useState<CharData>(DEFAULT_DATA)
  const [copied, setCopied] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [cssText, setCssText] = useState<string | null>(null)
  const [cssLoading, setCssLoading] = useState(true)
  const [containerWidth, setContainerWidth] = useState(0)
  const [iframeHeight, setIframeHeight] = useState(400)
  const containerRef = useRef<HTMLDivElement>(null)
  const appearanceEditorRef = useRef<HTMLDivElement>(null)
  const historyEditorRef = useRef<HTMLDivElement>(null)
  const personalityEditorRef = useRef<HTMLDivElement>(null)
  const editorInitialized = useRef(false)
  const router = useRouter()

  // Fetch CSS from GitHub at runtime — always latest, no redeploy needed
  const fetchCss = useCallback(async () => {
    setCssLoading(true)
    try {
      const res = await fetch(CSS_URL, { cache: 'no-cache' })
      const text = await res.text()
      setCssText(text)
    } catch {
      setCssText(null)
    } finally {
      setCssLoading(false)
    }
  }, [])

  useEffect(() => { fetchCss() }, [fetchCss])

  // Track container width for scale
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => setContainerWidth(entries[0].contentRect.width))
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Listen for iframe height
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'rp-height' && typeof e.data.h === 'number') {
        setIframeHeight(e.data.h + 16)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<CharData>
        setData(prev => ({ ...prev, ...parsed }))
      }
    } catch {}
    setHydrated(true)
  }, [])

  // Save to localStorage
  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
  }, [data, hydrated])

  // Initialize editor content after hydration (uncontrolled — set once)
  useEffect(() => {
    if (hydrated && !editorInitialized.current) {
      if (appearanceEditorRef.current) appearanceEditorRef.current.innerHTML = data.appearance
      if (historyEditorRef.current) historyEditorRef.current.innerHTML = data.history
      if (personalityEditorRef.current) personalityEditorRef.current.innerHTML = data.personality
      editorInitialized.current = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  const set = (key: keyof CharData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setData(prev => ({ ...prev, [key]: e.target.value }))

  // Get current religion data for form UI theming
  const currentReligion = getReligionData(data.religion)

  // Short pathway names (strip "เส้นทาง" prefix)
  const pathwayChoices = PATHWAY_DATA.map(p => ({
    shortName: p.name.replace('เส้นทาง', ''),
    fullName: p.name,
    nameEn: p.nameEn,
    logo: p.logo,
    warning: p.warning,
  }))

  // Toggle pathway preference — hard limit of 3 selections
  function togglePathway(name: string) {
    setData(prev => {
      const prefs = prev.pathwayPrefs
      if (prefs.includes(name)) {
        return { ...prev, pathwayPrefs: prefs.filter(p => p !== name) }
      }
      if (prefs.length >= 3) return prev  // already at max
      return { ...prev, pathwayPrefs: [...prefs, name] }
    })
  }

  function handleReset() {
    if (!confirm('รีเซ็ตข้อมูลทั้งหมดกลับเป็นตัวอย่างเริ่มต้น?')) return
    localStorage.removeItem(STORAGE_KEY)
    setData(DEFAULT_DATA)
    if (appearanceEditorRef.current) appearanceEditorRef.current.innerHTML = DEFAULT_DATA.appearance
    if (historyEditorRef.current) historyEditorRef.current.innerHTML = DEFAULT_DATA.history
    if (personalityEditorRef.current) personalityEditorRef.current.innerHTML = DEFAULT_DATA.personality
  }

  function editorInput(ref: React.RefObject<HTMLDivElement | null>, key: 'appearance' | 'history' | 'personality' | 'tmi') {
    if (!ref.current) return
    const html = ref.current.innerHTML.replace(/\n/g, '')
    setData(prev => ({ ...prev, [key]: html }))
  }

  function editorFormat(ref: React.RefObject<HTMLDivElement | null>, key: 'appearance' | 'history' | 'personality' | 'tmi', cmd: string, value?: string) {
    ref.current?.focus()
    document.execCommand(cmd, false, value ?? undefined)
    if (ref.current) {
      const html = ref.current.innerHTML.replace(/\n/g, '')
      setData(prev => ({ ...prev, [key]: html }))
    }
  }

  const previewSrcdoc = useMemo(() => cssText ? buildPreviewSrcdoc(data, cssText) : '', [data, cssText])
  const copyHtml      = useMemo(() => buildCopyHtml(data), [data])
  const scale = Math.min(containerWidth / NATURAL_WIDTH, 1)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(copyHtml)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('ไม่สามารถคัดลอกได้ กรุณาลองอีกครั้ง')
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="w-full xl:w-[80%] mx-auto">

        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-victorian-400 hover:text-gold-400 transition-colors mb-4 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm">ย้อนกลับ</span>
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="heading-victorian title-whisper-gold text-2xl md:text-4xl mb-1">
                สร้างตัวละคร
              </h1>
              <p className="text-victorian-400 text-sm">
                กรอกข้อมูล → ดูตัวอย่าง live → คัดลอกโค้ดพร้อมแปะได้เลย
              </p>
            </div>
            <button
              onClick={handleReset}
              title="รีเซ็ตข้อมูล"
              className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs text-victorian-500 hover:text-red-400 transition-colors mt-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              รีเซ็ต
            </button>
          </div>
        </div>

        <div className="grid xl:grid-cols-2 gap-6 items-start">

          {/* LEFT: Form */}
          <div className="space-y-4">

            {/* รูปภาพ */}
            <div className="card-victorian space-y-4">
              <p className="text-xs text-victorian-500 uppercase tracking-widest">รูปภาพตัวละคร</p>
              <Field label="URL รูปภาพ" hint="(direct link เท่านั้น)">
                <input type="url" className={inputCls} placeholder="https://..." value={data.imageUrl} onChange={set('imageUrl')} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="ตำแหน่งรูป" hint="(--wots-pos)">
                  <select className={selectCls} value={data.imagePos} onChange={set('imagePos')}>
                    <option value="center">กลาง (center)</option>
                    <option value="top">บน (top)</option>
                    <option value="bottom">ล่าง (bottom)</option>
                    <option value="left">ซ้าย (left)</option>
                    <option value="right">ขวา (right)</option>
                    <option value="top center">บน-กลาง</option>
                    <option value="bottom center">ล่าง-กลาง</option>
                    <option value="20% center">เยื้องซ้าย 20%</option>
                    <option value="80% center">เยื้องขวา 80%</option>
                    <option value="center 20%">เยื้องบน 20%</option>
                    <option value="center 80%">เยื้องล่าง 80%</option>
                  </select>
                </Field>

                <Field label="ขนาดรูป" hint="(--wots-size)">
                  <select className={selectCls} value={data.imageSize} onChange={set('imageSize')}>
                    <option value="cover">เต็มกรอบ (cover)</option>
                    <option value="contain">พอดี (contain)</option>
                    <option value="100%">100%</option>
                    <option value="110%">110%</option>
                    <option value="120%">120%</option>
                    <option value="130%">130%</option>
                    <option value="150%">150%</option>
                    <option value="80%">80%</option>
                    <option value="70%">70%</option>
                  </select>
                </Field>
              </div>
            </div>

            {/* ข้อมูลพื้นฐาน */}
            <div className="card-victorian space-y-4">
              <p className="text-xs text-victorian-500 uppercase tracking-widest">ข้อมูลพื้นฐาน</p>

              <Field label="ชื่อตัวละคร">
                <input type="text" className={inputCls} value={data.characterName} onChange={set('characterName')} placeholder="ชื่อในโลกใหม่" />
              </Field>

              <Field label="ชื่อก่อนข้ามโลก">
                <input type="text" className={inputCls} value={data.prevName} onChange={set('prevName')} placeholder="ชื่อเดิมก่อนเข้าสู่โลกนี้" />
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field label="เผ่าพันธุ์">
                  <select className={selectCls} value={data.race} onChange={set('race')}>
                    <option value="มนุษย์">มนุษย์</option>
                    <option value="คนยักษ์">คนยักษ์</option>
                  </select>
                </Field>

                <Field label="อายุ">
                  <input type="text" className={inputCls} value={data.age} onChange={set('age')} placeholder="20" />
                </Field>

                <Field label="เพศ">
                  <select className={selectCls} value={data.gender} onChange={set('gender')}>
                    {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </Field>
              </div>

              <Field
                label="ศาสนา"
                linkHref="https://whisper-one-ochre.vercel.app/docs/religions"
              >
                <div className="space-y-2">
                  <select className={selectCls} value={data.religion} onChange={set('religion')}>
                    {RELIGION_DATA.map(r => <option key={r.id} value={r.name_th}>{r.name_th}</option>)}
                  </select>
                  {/* Religion preview with logo & theme color */}
                  {currentReligion.logo_url && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-victorian-700/50 bg-victorian-900/40">
                      <img src={cldAvatar(currentReligion.logo_url)} alt="" className="w-6 h-6 object-contain rounded" />
                      <span className="text-xs text-victorian-300">{currentReligion.name_en}</span>
                      <span
                        className="ml-auto w-4 h-4 rounded-full border border-victorian-600/50"
                        style={{ background: `hsl(${currentReligion.hue} ${currentReligion.saturation}% ${currentReligion.lightness}%)` }}
                        title="สีธีมของศาสนานี้"
                      />
                    </div>
                  )}
                </div>
              </Field>
            </div>

            {/* เนื้อหาตัวละคร */}
            <div className="card-victorian space-y-4">
              <p className="text-xs text-victorian-500 uppercase tracking-widest">รายละเอียดตัวละคร</p>

              <Field label="ลักษณะทางกายภาพ" hint="(ส่วนสูง น้ำหนัก สีผม สีตา ลักษณะเด่น)">
                <div>
                  <EditorToolbar onFormat={(cmd, val) => editorFormat(appearanceEditorRef, 'appearance', cmd, val)} />
                  <div
                    ref={appearanceEditorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={() => editorInput(appearanceEditorRef, 'appearance')}
                    className="w-full bg-victorian-900/60 border border-victorian-700/50 rounded-b-md px-3 py-2 text-sm text-victorian-100 focus:outline-none focus:border-gold-400/60 transition-colors leading-relaxed min-h-[80px]"
                    style={{ outline: 'none' }}
                  />
                </div>
              </Field>

              <Field label="ประวัติโดยสังเขป" hint="(ความทรงจำของร่างใหม่)">
                <div>
                  <EditorToolbar onFormat={(cmd, val) => editorFormat(historyEditorRef, 'history', cmd, val)} />
                  <div
                    ref={historyEditorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={() => editorInput(historyEditorRef, 'history')}
                    className="w-full bg-victorian-900/60 border border-victorian-700/50 rounded-b-md px-3 py-2 text-sm text-victorian-100 focus:outline-none focus:border-gold-400/60 transition-colors leading-relaxed min-h-[120px]"
                    style={{ outline: 'none' }}
                  />
                </div>
              </Field>

              <Field label="ลักษณะนิสัย" hint="(บุคลิกภาพของร่างใหม่)">
                <div>
                  <EditorToolbar onFormat={(cmd, val) => editorFormat(personalityEditorRef, 'personality', cmd, val)} />
                  <div
                    ref={personalityEditorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={() => editorInput(personalityEditorRef, 'personality')}
                    className="w-full bg-victorian-900/60 border border-victorian-700/50 rounded-b-md px-3 py-2 text-sm text-victorian-100 focus:outline-none focus:border-gold-400/60 transition-colors leading-relaxed min-h-[100px]"
                    style={{ outline: 'none' }}
                  />
                </div>
              </Field>

              <Field label="TMI (ข้อมูลเพิ่มเติม)" hint="(งานอดิเรก สิ่งที่ชอบ ฯลฯ)">
                <div>
                  <textarea
                    className={`${textareaCls} font-mono`}
                    rows={5}
                    value={data.tmi}
                    onChange={set('tmi')}
                    placeholder={`อ่านหนังสือ\nทำสวน\nความสงบ`}
                  />
                  <p className="mt-1.5 text-xs text-victorian-600 leading-relaxed">
                    ✦ 1 บรรทัด = 1 รายการ
                  </p>
                </div>
              </Field>
            </div>

            {/* เส้นทางผู้วิเศษ */}
            <div className="card-victorian space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-victorian-500 uppercase tracking-widest">เส้นทางผู้วิเศษ</p>
                <a href="https://whisper-one-ochre.vercel.app/world-setting" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-gold-400/70 hover:text-gold-400 transition-colors">
                  <ExternalLink className="w-3 h-3" />
                  ดูข้อมูล
                </a>
              </div>
              <p className="text-xs text-victorian-600">
                เลือก <span className="text-gold-400 font-semibold">สูงสุด 3 เส้นทาง</span> ตามลำดับความต้องการ
                {data.pathwayPrefs.length >= 3 && (
                  <span className="ml-1 text-red-400/80">(ครบแล้ว — ยกเลิกก่อนเพื่อเปลี่ยน)</span>
                )}
              </p>

              {/* Selected preview */}
              {data.pathwayPrefs.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {data.pathwayPrefs.map((p, i) => {
                    const pw = findPathwayByShortName(p)
                    return (
                      <span key={p} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-gold-400/50 text-gold-300 bg-gold-400/10">
                        {pw?.logo && <img src={cldAvatar(pw.logo)} alt="" className="w-4 h-4 object-contain rounded" />}
                        <span className="text-gold-500 font-bold">{i + 1}.</span> {p}
                        <button type="button" onClick={() => togglePathway(p)}
                          className="ml-0.5 text-gold-500/60 hover:text-red-400 transition-colors leading-none cursor-pointer">✕</button>
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Pathway grid with logos */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                {pathwayChoices.map(p => {
                  const idx = data.pathwayPrefs.indexOf(p.shortName)
                  const selected = idx !== -1
                  const rank = idx + 1
                  const atLimit = data.pathwayPrefs.length >= 3 && !selected
                  return (
                    <button
                      key={p.shortName}
                      type="button"
                      onClick={() => togglePathway(p.shortName)}
                      disabled={atLimit}
                      className={`
                        relative text-left text-xs px-2.5 py-2 rounded border transition-all flex items-center gap-1.5
                        ${selected
                          ? 'border-gold-400/60 bg-gold-400/10 text-gold-300 cursor-pointer'
                          : atLimit
                            ? 'border-victorian-800/40 text-victorian-700 cursor-not-allowed opacity-40'
                            : 'border-victorian-700/50 text-victorian-400 hover:border-victorian-600 hover:text-victorian-200 cursor-pointer'
                        }
                      `}
                    >
                      <img src={cldAvatar(p.logo)} alt="" className="w-4 h-4 object-contain rounded flex-shrink-0" />
                      <span className="truncate">{p.shortName}</span>
                      {selected && (
                        <span className="absolute top-0.5 right-1.5 text-[10px] font-bold text-gold-500">{rank}</span>
                      )}
                      {p.warning && (
                        <span className="absolute bottom-0.5 right-1.5 text-[8px] text-red-400/70" title={p.warning}>⚠</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

          </div>

          {/* RIGHT: Preview */}
          <div className="space-y-3 xl:sticky xl:top-6 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-xs text-victorian-500 uppercase tracking-widest">ตัวอย่าง (live)</p>
              <button
                onClick={handleCopy}
                className="btn-gold !px-5 !py-2 text-sm flex items-center gap-2"
              >
                {copied
                  ? <><Check className="w-3.5 h-3.5" />คัดลอกแล้ว!</>
                  : <><Copy className="w-3.5 h-3.5" />คัดลอกโค้ด</>}
              </button>
            </div>

            <div
              ref={containerRef}
              className="border border-victorian-700/40 rounded-md overflow-hidden bg-[#0a0908] max-w-full"
              style={{ height: containerWidth > 0 ? iframeHeight * scale : 'auto' }}
            >
              {cssLoading ? (
                <div className="flex items-center justify-center h-40 text-victorian-500 text-sm gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10"/></svg>
                  โหลด CSS...
                </div>
              ) : cssText === null ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2">
                  <p className="text-red-400 text-sm">โหลด CSS ไม่ได้</p>
                  <button onClick={fetchCss} className="text-xs text-gold-400 hover:underline cursor-pointer">ลองใหม่</button>
                </div>
              ) : containerWidth > 0 ? (
                <iframe
                  srcDoc={previewSrcdoc}
                  sandbox="allow-scripts allow-same-origin"
                  title="ตัวอย่างตัวละคร"
                  style={{
                    width: NATURAL_WIDTH,
                    height: iframeHeight,
                    border: 'none',
                    display: 'block',
                    transformOrigin: 'top left',
                    transform: `scale(${scale})`,
                  }}
                />
              ) : null}
            </div>

            <p className="text-xs text-victorian-600 text-center">
              โค้ดที่คัดลอกเป็น single line ป้องกัน CMS แปลง newline เป็น &lt;br&gt;
              {hydrated && <span className="ml-1 text-victorian-700">· บันทึกอัตโนมัติแล้ว</span>}
              {!cssLoading && (
                <button onClick={fetchCss} className="ml-2 text-victorian-600 hover:text-gold-400 transition-colors cursor-pointer" title="รีโหลด CSS ล่าสุด">
                  ↻ sync CSS
                </button>
              )}
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
