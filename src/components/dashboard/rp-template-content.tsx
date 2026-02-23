'use client'

import { Copy, Check, ChevronLeft, RotateCcw } from 'lucide-react'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const STORAGE_KEY = 'whisper_rp_draft'

// --------------- pathway data ---------------
const PATHWAYS: { name: string; levels: number[] }[] = [
  { name: 'นักทำนาย',          levels: [9,8,7,6,5,4] },
  { name: 'หัวขโมย',           levels: [9,8,7,6,5,4] },
  { name: 'ลูกศิษย์',          levels: [9,8,7,6,5,4] },
  { name: 'ผู้ชม',             levels: [9,8,7,6,5,4] },
  { name: 'กะลาสี',            levels: [9,8,7,6,5] },
  { name: 'นักล่า',            levels: [9,8,7,6,5,4] },
  { name: 'ผู้ส่องความลับ',    levels: [9,8,7,6,5,4] },
  { name: 'นักปราชญ์',         levels: [9,8,7,6,5,4] },
  { name: 'นักรบ',             levels: [9,8,7,6,5,4] },
  { name: 'นักฆ่า',            levels: [9,8,7,6,5,4] },
  { name: 'นักขับขาน',         levels: [9,8,7,6,5,4] },
  { name: 'เภสัชกร',           levels: [9,8,7,6,5,4] },
  { name: 'นักเพาะปลูก',       levels: [9,8,7,6,5,4] },
  { name: 'ผู้เก็บซากศพ',      levels: [9,8,7,6,5,4] },
  { name: 'ผู้ไม่นิทรา',       levels: [9,8,7,6,5,4] },
  { name: 'นักกฎหมาย',         levels: [9,8,7,6,5,4] },
  { name: 'ผู้ตัดสิน',         levels: [9,8,7,6,5,4] },
  { name: 'นักโทษ',            levels: [9,8,7,6,5,4] },
  { name: 'อาชญากร',           levels: [8,7,6,5,4] },
  { name: 'ผู้วิงวอนความลับ',  levels: [9,8,7,6,5,4] },
  { name: 'นักอ่าน',           levels: [9,8,7,6,5,4] },
]

// --------------- types ---------------
interface RpData {
  pathway: string
  lv: string
  imageUrl: string
  imagePos: string
  imageSize: string
  characterName: string
  roleplayContent: string
  psNote: string
}

const DEFAULT_DATA: RpData = {
  pathway: 'นักทำนาย',
  lv: '9',
  imageUrl: 'https://i.pravatar.cc/300?img=12',
  imagePos: 'center',
  imageSize: 'cover',
  characterName: 'Jane Doe',
  roleplayContent: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  psNote: '',
}

const RP_PS_NOTE = '✦ หมายเหตุ:'

const CSS_URL = 'https://savant777.github.io/zoecode/whisperoftheshadow.css'
const NATURAL_WIDTH = 650

// For copy: includes <link> tag
function buildCopyHtml(d: RpData): string {
  const psContent = `${RP_PS_NOTE}${d.psNote.trim() ? ` ${d.psNote}` : ''}`
  return `<link href="${CSS_URL}" rel="stylesheet"><div id="WhisperOfTheShadow"><a href="https://discord.com/users/625292873914515456/"></a><div id="wots-role" class="wots-container" pathway="${d.pathway}" lv="${d.lv}"><div class="wots-player"><div class="wots-pic" style="--wots-pic: url(${d.imageUrl});--wots-pos: ${d.imagePos};--wots-size: ${d.imageSize};"></div><div class="wots-info"><div class="wots-name">${d.characterName}</div><div class="wots-pathway"><div class="path-info"><div></div></div></div></div></div><div class="wots-box role">${d.roleplayContent}</div><div class="wots-box ps">${psContent}</div></div></div>`
}
function buildPreviewSrcdoc(d: RpData, css: string): string {
  const psContent = `${RP_PS_NOTE}${d.psNote.trim() ? ` ${d.psNote}` : ''}`
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=${NATURAL_WIDTH}"><style>${css}</style><style>html,body{margin:0;padding:1rem;background:#0a0908;overflow-x:hidden;}::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#4a3f35;border-radius:4px;}::-webkit-scrollbar-thumb:hover{background:#6b5a4e;}*{scrollbar-width:thin;scrollbar-color:#4a3f35 transparent;}</style></head><body><div id="WhisperOfTheShadow"><a href="https://discord.com/users/625292873914515456/"></a><div id="wots-role" class="wots-container" pathway="${d.pathway}" lv="${d.lv}"><div class="wots-player"><div class="wots-pic" style="--wots-pic: url(${d.imageUrl});--wots-pos: ${d.imagePos};--wots-size: ${d.imageSize};"></div><div class="wots-info"><div class="wots-name">${d.characterName}</div><div class="wots-pathway"><div class="path-info"><div></div></div></div></div></div><div class="wots-box role">${d.roleplayContent}</div><div class="wots-box ps">${psContent}</div></div></div><script>function send(){window.parent.postMessage({type:'rp-height',h:document.body.scrollHeight},'*');}window.addEventListener('load',send);new ResizeObserver(send).observe(document.body);<\/script></body></html>`
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
  { cmd: 'justifyLeft',   title: 'ชิดซ้าย',   icon: (
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
  { cmd: 'justifyRight',  title: 'ชิดขวา',   icon: (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current">
      <rect x="5" y="2"  width="10" height="2" rx="1"/><rect x="1" y="6"  width="14" height="2" rx="1"/>
      <rect x="5" y="10" width="10" height="2" rx="1"/><rect x="1" y="14" width="14" height="2" rx="1"/>
    </svg>
  )},
]

function EditorToolbar({ onFormat }: { onFormat: (cmd: string, value?: string) => void }) {
  return (
    <div className="flex items-center gap-1 flex-wrap px-2 py-1.5 bg-victorian-900/80 border border-victorian-700/50 border-b-0 rounded-t-md">
      {/* B I U */}
      <button type="button" onMouseDown={e => { e.preventDefault(); onFormat('bold') }}
        className="w-7 h-7 text-sm font-bold text-victorian-200 hover:bg-victorian-700/60 rounded flex items-center justify-center" title="ตัวหนา">B</button>
      <button type="button" onMouseDown={e => { e.preventDefault(); onFormat('italic') }}
        className="w-7 h-7 text-sm italic text-victorian-200 hover:bg-victorian-700/60 rounded flex items-center justify-center" title="ตัวเอียง">I</button>
      <button type="button" onMouseDown={e => { e.preventDefault(); onFormat('underline') }}
        className="w-7 h-7 text-sm underline text-victorian-200 hover:bg-victorian-700/60 rounded flex items-center justify-center" title="ขีดเส้นใต้">U</button>

      <div className="w-px h-4 bg-victorian-700/60 mx-0.5 self-center" />

      {/* Font size */}
      {FONT_SIZES.map(({ label, value }) => (
        <button key={value} type="button"
          onMouseDown={e => { e.preventDefault(); onFormat('fontSize', value) }}
          className="h-7 px-1.5 text-xs text-victorian-300 hover:bg-victorian-700/60 rounded flex items-center justify-center"
          title={`ขนาด ${label}`}>{label}</button>
      ))}

      <div className="w-px h-4 bg-victorian-700/60 mx-0.5 self-center" />

      {/* Align */}
      {ALIGN_BTNS.map(({ cmd, title, icon }) => (
        <button key={cmd} type="button"
          onMouseDown={e => { e.preventDefault(); onFormat(cmd) }}
          className="w-7 h-7 text-victorian-300 hover:bg-victorian-700/60 rounded flex items-center justify-center"
          title={title}>{icon}</button>
      ))}

      <div className="w-px h-4 bg-victorian-700/60 mx-0.5 self-center" />

      {/* Colors */}
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

// --------------- field component ---------------
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-victorian-400 uppercase tracking-wider">
        {label}
        {hint && <span className="ml-2 text-victorian-600 normal-case font-normal">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = "w-full bg-victorian-900/60 border border-victorian-700/50 rounded-md px-3 py-2 text-sm text-victorian-100 placeholder-victorian-600 focus:outline-none focus:border-gold-400/60 transition-colors"
const selectCls = `${inputCls} cursor-pointer`
const textareaCls = `${inputCls} resize-none leading-relaxed`

// --------------- main component ---------------
export default function RpTemplateContent() {
  const [data, setData] = useState<RpData>(DEFAULT_DATA)
  const [copied, setCopied] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [cssText, setCssText] = useState<string | null>(null)
  const [cssLoading, setCssLoading] = useState(true)
  const [containerWidth, setContainerWidth] = useState(0)
  const [iframeHeight, setIframeHeight] = useState(400)
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
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
    const ro = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Listen for iframe height via postMessage
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'rp-height' && typeof e.data.h === 'number') {
        setIframeHeight(e.data.h + 16)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<RpData>
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
    if (hydrated && editorRef.current && !editorInitialized.current) {
      editorRef.current.innerHTML = data.roleplayContent
      editorInitialized.current = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  // Remove postMessage listener (no longer needed)

  const currentPathway = PATHWAYS.find(p => p.name === data.pathway) ?? PATHWAYS[0]

  const set = (key: keyof RpData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setData(prev => ({ ...prev, [key]: e.target.value }))

  // When pathway changes, reset lv to highest available
  const setPathway = (pathway: string) => {
    const p = PATHWAYS.find(x => x.name === pathway) ?? PATHWAYS[0]
    setData(prev => ({ ...prev, pathway, lv: String(p.levels[0]) }))
  }

  function handleEditorInput() {
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML.replace(/\n/g, '')
    setData(prev => ({ ...prev, roleplayContent: html }))
  }

  function handleFormat(cmd: string, value?: string) {
    editorRef.current?.focus()
    document.execCommand(cmd, false, value ?? undefined)
    if (editorRef.current) {
      const html = editorRef.current.innerHTML.replace(/\n/g, '')
      setData(prev => ({ ...prev, roleplayContent: html }))
    }
  }

  function handleReset() {
    if (!confirm('รีเซ็ตข้อมูลทั้งหมดกลับเป็นตัวอย่างเริ่มต้น?')) return
    localStorage.removeItem(STORAGE_KEY)
    setData(DEFAULT_DATA)
    if (editorRef.current) editorRef.current.innerHTML = DEFAULT_DATA.roleplayContent
  }

  const copyHtml = useMemo(() => buildCopyHtml(data), [data])
  const previewSrcdoc = useMemo(() => cssText ? buildPreviewSrcdoc(data, cssText) : '', [data, cssText])
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
              <h1 className="heading-victorian text-2xl md:text-4xl mb-1">
                สร้างโรลเพลย์
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

            {/* ข้อมูลตัวละคร */}
            <div className="card-victorian space-y-4">
              <p className="text-xs text-victorian-500 uppercase tracking-widest">ตัวละคร</p>

              <Field label="ชื่อตัวละคร">
                <input type="text" className={inputCls} value={data.characterName} onChange={set('characterName')} placeholder="Jane Doe" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="เส้นทาง (Pathway)">
                  <select
                    className={selectCls}
                    value={data.pathway}
                    onChange={e => setPathway(e.target.value)}
                  >
                    {PATHWAYS.map(p => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </Field>

                <Field label="ลำดับ (Level)">
                  <select className={selectCls} value={data.lv} onChange={set('lv')}>
                    {currentPathway.levels.map(lv => (
                      <option key={lv} value={String(lv)}>ลำดับ {lv}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>

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
                    <option value="center top">กลาง-บน</option>
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

            {/* เนื้อหา */}
            <div className="card-victorian space-y-4">
              <p className="text-xs text-victorian-500 uppercase tracking-widest">เนื้อหา</p>

              <Field label="เนื้อหาโรลเพลย์">
                <div>
                  <EditorToolbar onFormat={handleFormat} />
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleEditorInput}
                    className="w-full bg-victorian-900/60 border border-victorian-700/50 rounded-b-md px-3 py-2 text-sm text-victorian-100 focus:outline-none focus:border-gold-400/60 transition-colors leading-relaxed min-h-[200px]"
                    style={{ outline: 'none' }}
                  />
                </div>
              </Field>

              <Field label="หมายเหตุ (PS)" hint="(รองรับ HTML — ✦ หมายเหตุ: แสดงอยู่หน้าเสมอ, พิมพ์เนื้อหาต่อท้าย)">  
                <textarea className={textareaCls} rows={3} value={data.psNote} onChange={set('psNote')} placeholder="ใส่ข้อความหรือ HTML เช่น <iframe> ได้เลย (ไม่ต้องใส่ ✦ หมายเหตุ: เอง)"/>
              </Field>
            </div>
          </div>

          {/* RIGHT on desktop / BELOW on mobile: Preview */}
          <div className="space-y-3 xl:sticky xl:top-6 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-xs text-victorian-500 uppercase tracking-widest">
                ตัวอย่าง (live)
              </p>
              <button
                onClick={handleCopy}
                className="btn-gold !px-5 !py-2 text-sm flex items-center gap-2"
              >
                {copied ? <><Check className="w-3.5 h-3.5" />คัดลอกแล้ว!</> : <><Copy className="w-3.5 h-3.5" />คัดลอกโค้ด</>}
              </button>
            </div>

            {/* iframe preview — CSS fetched from GitHub, viewport locked at 650px, transform:scale to fit */}
            <div
              ref={containerRef}
              className="border border-victorian-700/40 rounded-md overflow-hidden bg-[#0a0908] max-w-full"
              style={{ height: containerWidth > 0 ? iframeHeight * scale : 'auto' }}
            >
              {cssLoading ? (
                <div className="flex items-center justify-center h-40 text-victorian-500 text-sm gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10"/></svg>
                  โหลด CSS จาก GitHub...
                </div>
              ) : cssText === null ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2">
                  <p className="text-red-400 text-sm">โหลด CSS ไม่ได้</p>
                  <button onClick={fetchCss} className="text-xs text-gold-400 hover:underline">ลองใหม่</button>
                </div>
              ) : containerWidth > 0 ? (
                <iframe
                  srcDoc={previewSrcdoc}
                  sandbox="allow-scripts allow-same-origin"
                  title="ตัวอย่างโรลเพลย์"
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
                <button onClick={fetchCss} className="ml-2 text-victorian-600 hover:text-gold-400 transition-colors" title="รีโหลด CSS ล่าสุดจาก GitHub">
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
