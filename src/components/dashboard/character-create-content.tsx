'use client'

import { Copy, Check, ChevronLeft, RotateCcw, ExternalLink } from 'lucide-react'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const STORAGE_KEY = 'whisper_char_draft'

// --------------- pathway data (same list, used for TOP-3 preference) ---------------
const PATHWAYS = [
  'นักทำนาย', 'หัวขโมย', 'ลูกศิษย์', 'ผู้ชม', 'กะลาสี',
  'นักล่า', 'ผู้ส่องความลับ', 'นักปราชญ์', 'นักรบ', 'นักฆ่า',
  'นักขับขาน', 'เภสัชกร', 'นักเพาะปลูก', 'ผู้เก็บซากศพ', 'ผู้ไม่นิทรา',
  'นักกฎหมาย', 'ผู้ตัดสิน', 'นักโทษ', 'อาชญากร', 'ผู้วิงวอนความลับ', 'นักอ่าน',
]

const RELIGIONS = [
  'ไม่มีศาสนา',
  'โบสถ์คนโง่',
  'โบสถ์อันธกาลนิรันดิ์',
  'โบสถ์พระแม่ธรณี',
  'โบสถ์เทพวายุสลาตัน',
  'โบสถ์สุริยันเจิดจรัส',
  'โบสถ์เทพจักรกลไอน้ำ',
  'โบสถ์เทพปัญญาความรู้',
]

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
  hobbies: string
  likes: string
  pathwayPrefs: string[]   // top-3
  psNote: string
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
  hobbies: 'อ่านหนังสือ ทำสวน',
  likes: 'ความสงบ ดนตรี',
  pathwayPrefs: ['นักทำนาย', 'นักปราชญ์', 'ผู้ชม'],
  psNote: '',
}

const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&family=Kanit:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap'
const CSS_URL = 'https://savant777.github.io/zoecode/whisperoftheshadow.css'
const NATURAL_WIDTH = 650

// Inline style constants
const S = {
  char:        'width:650px;max-width:90%;margin:auto;',
  player:      'display:flex;column-gap:1rem;margin-bottom:1rem;',
  pic:         (url: string, pos: string, size: string) => `flex-shrink:0;width:175px;aspect-ratio:1/1;border-radius:2px;border:1px solid hsl(38 60% 42% / 0.5);background:url(${url}) ${pos}/${size} no-repeat;`,
  info:        "flex:1;display:flex;flex-direction:column;gap:0.75rem;justify-content:flex-end;font-family:'Kanit',sans-serif;",
  name:        "font-weight:600;font-size:3.5rem;line-height:1;letter-spacing:0.025em;font-style:italic;font-family:'Kanit',sans-serif;background:linear-gradient(135deg,hsl(38 82% 58%),#D4AF37 40%,hsl(38 60% 48%));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;",
  prevName:    "font-size:0.82rem;color:hsl(38 30% 45%);font-style:italic;font-family:'Kanit',sans-serif;",
  badges:      'border:1px solid hsl(38 60% 42% / 0.3);border-radius:2px;overflow:hidden;padding:0.75rem 1rem;display:flex;flex-wrap:wrap;gap:6px;align-items:center;background:linear-gradient(to right,hsl(38 15% 5% / 0.85),hsl(38 15% 9% / 0.75),hsl(38 15% 5% / 0.85));',
  badge:       "font-family:'Kanit',sans-serif;font-size:0.74rem;padding:2px 10px;border-radius:20px;border:1px solid hsl(38 40% 30% / 0.8);color:hsl(38 82% 78%);background:rgba(255,255,255,0.03);letter-spacing:0.03em;",
  badgeGender: "font-family:'Kanit',sans-serif;font-size:0.74rem;padding:2px 10px;border-radius:20px;border:1px solid hsl(285 30% 45% / 0.8);color:hsl(285 60% 80%);background:rgba(255,255,255,0.03);letter-spacing:0.03em;",
  boxBase:     "background:linear-gradient(135deg,hsl(38 60% 42% / 0.02),transparent 50%),linear-gradient(225deg,rgba(255,255,255,0.01),transparent 50%),linear-gradient(135deg,hsl(38 60% 42% / 0.08),transparent 40% 60%,hsl(38 60% 42% / 0.02));background-color:hsl(38 18% 8% / 0.88);border:1px solid hsl(38 60% 42% / 0.3);border-radius:2px;box-shadow:inset 0 0 20px hsl(38 60% 42% / 0.08);font-family:'Google Sans',sans-serif;font-size:1rem;",
  boxRole:     'margin-bottom:1rem;padding:1.5rem 2rem;color:#fff;',
  boxPs:       'padding:0.875rem 2rem;color:hsl(38 82% 78%);',
  section:     'margin-bottom:18px;',
  sectionLast: 'margin-bottom:0;',
  label:       "font-family:'Kanit',sans-serif;font-size:0.65rem;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:hsl(38 55% 48%);margin-bottom:6px;filter:drop-shadow(0 0 5px hsl(38 96% 56% / 0.45));",
  value:       "font-family:'Google Sans',sans-serif;font-size:0.9rem;color:#e0d8cc;line-height:1.75;white-space:pre-wrap;",
  pathList:    'display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;',
  pathItem:    (rank: number) => {
    const base = "font-family:'Kanit',sans-serif;font-size:0.78rem;padding:3px 10px;border:1px solid;border-radius:2px;"
    if (rank === 1) return base + 'border-color:#D4AF37;color:#D4AF37;background:rgba(212,175,55,0.08);filter:drop-shadow(0 0 5px hsl(38 96% 56% / 0.35));'
    if (rank === 2) return base + 'border-color:hsl(38 42% 42%);color:hsl(38 62% 65%);background:rgba(212,175,55,0.04);'
    if (rank === 3) return base + 'border-color:hsl(38 30% 35%);color:hsl(38 45% 56%);background:rgba(212,175,55,0.04);'
    return base + 'border-color:hsl(38 40% 28%);color:hsl(38 55% 58%);background:rgba(212,175,55,0.04);'
  },
}

function buildSection(label: string, value: string, last = false): string {
  return `<div style="${last ? S.sectionLast : S.section}"><div style="${S.label}">${label}</div><div style="${S.value}">${value}</div></div>`
}

function buildInnerHtml(d: CharData): string {
  const pathwayItems = d.pathwayPrefs
    .filter(Boolean)
    .map((p, i) => `<div style="${S.pathItem(i + 1)}">${i + 1}. ${p}</div>`)
    .join('')
  const pathwayBlock = pathwayItems
    ? `<div style="${S.sectionLast}"><div style="${S.label}">เส้นทางผู้วิเศษ (Top 3)</div><div style="${S.pathList}">${pathwayItems}</div></div>`
    : ''

  // build sections, last text section is last only if no pathwayBlock
  const textSections: string[] = [
    d.appearance.trim()  ? buildSection('ลักษณะทางกายภาพ', d.appearance)  : '',
    d.history.trim()     ? buildSection('ประวัติโดยสังเขป', d.history)     : '',
    d.personality.trim() ? buildSection('ลักษณะนิสัย', d.personality)      : '',
    d.hobbies.trim()     ? buildSection('งานอดิเรก', d.hobbies)            : '',
    d.likes.trim()       ? buildSection('สิ่งที่ชอบ', d.likes, !pathwayBlock) : '',
  ].filter(Boolean)

  const sections = [...textSections, pathwayBlock].filter(Boolean).join('')

  const badges = [
    `<span style="${S.badge}">${d.race}</span>`,
    d.age.trim() ? `<span style="${S.badge}">${d.age} ปี</span>` : '',
    `<span style="${S.badge}">${d.religion}</span>`,
    `<span style="${S.badgeGender}">${d.gender}</span>`,
  ].filter(Boolean).join('')

  const psBlock = d.psNote.trim()
    ? `<div style="${S.boxBase}${S.boxPs}">✦ หมายเหตุ: ${d.psNote}</div>`
    : '<!--หมายเหตุ (PS) | รองรับ HTML เช่น <iframe>-->'

  return `<div id="WhisperOfTheShadow"><a href="https://discord.com/users/625292873914515456/"></a><div id="wots-char" style="${S.char}"><div style="${S.player}"><div style="${S.pic(d.imageUrl, d.imagePos, d.imageSize)}"></div><div style="${S.info}"><div style="${S.name}">${d.characterName}</div>${d.prevName.trim() ? `<div style="${S.prevName}">ชื่อก่อนข้ามโลก: ${d.prevName}</div>` : ''}<div style="${S.badges}">${badges}</div></div></div><div style="${S.boxBase}${S.boxRole}">${sections}</div>${psBlock}</div></div>`
}

function buildCopyHtml(d: CharData): string {
  return `<link href="${FONTS_URL}" rel="stylesheet"><link href="${CSS_URL}" rel="stylesheet">${buildInnerHtml(d)}`
}

function buildPreviewSrcdoc(d: CharData, css: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=650"><style>${css}</style><style>html,body{margin:0;padding:1rem;background:#0a0908;overflow-x:hidden;}::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#4a3f35;border-radius:4px;}::-webkit-scrollbar-thumb:hover{background:#6b5a4e;}*{scrollbar-width:thin;scrollbar-color:#4a3f35 transparent;}</style></head><body>${buildInnerHtml(d)}<script>function send(){window.parent.postMessage({type:'rp-height',h:document.body.scrollHeight},'*');}window.addEventListener('load',send);new ResizeObserver(send).observe(document.body);<\/script></body></html>`
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

  const set = (key: keyof CharData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setData(prev => ({ ...prev, [key]: e.target.value }))

  // Toggle pathway preference (max 3)
  function togglePathway(name: string) {
    setData(prev => {
      const prefs = prev.pathwayPrefs
      if (prefs.includes(name)) {
        return { ...prev, pathwayPrefs: prefs.filter(p => p !== name) }
      }
      return { ...prev, pathwayPrefs: [...prefs, name] }
    })
  }

  function handleReset() {
    if (!confirm('รีเซ็ตข้อมูลทั้งหมดกลับเป็นตัวอย่างเริ่มต้น?')) return
    localStorage.removeItem(STORAGE_KEY)
    setData(DEFAULT_DATA)
  }

  const previewSrcdoc = useMemo(() => cssText ? buildPreviewSrcdoc(data, cssText) : '', [data, cssText])
  const copyHtml      = useMemo(() => buildCopyHtml(data),       [data])
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
                <Field label="เชื้อชาติ">
                  <input type="text" className={inputCls} value={data.race} onChange={set('race')} placeholder="มนุษย์" />
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
                <select className={selectCls} value={data.religion} onChange={set('religion')}>
                  {RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>

            {/* เนื้อหาตัวละคร */}
            <div className="card-victorian space-y-4">
              <p className="text-xs text-victorian-500 uppercase tracking-widest">รายละเอียดตัวละคร</p>

              <Field label="ลักษณะทางกายภาพ" hint="(ส่วนสูง น้ำหนัก สีผม สีตา ลักษณะเด่น)">
                <textarea className={textareaCls} rows={3} value={data.appearance} onChange={set('appearance')}
                  placeholder="เช่น ส่วนสูง 165 ซม. น้ำหนัก 55 กก. ผมดำยาวถึงไหล่ ตาสีน้ำตาล..." />
              </Field>

              <Field label="ประวัติโดยสังเขป" hint="(ความทรงจำของร่างใหม่)">
                <textarea className={textareaCls} rows={5} value={data.history} onChange={set('history')}
                  placeholder="บ้านเกิด ครอบครัว เหตุการณ์สำคัญในชีวิต..." />
              </Field>

              <Field label="ลักษณะนิสัย" hint="(บุคลิกภาพของร่างใหม่)">
                <textarea className={textareaCls} rows={4} value={data.personality} onChange={set('personality')}
                  placeholder="บุคลิกภาพ นิสัย จุดเด่น จุดด้อย..." />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="งานอดิเรก">
                  <input type="text" className={inputCls} value={data.hobbies} onChange={set('hobbies')} placeholder="อ่านหนังสือ วาดรูป..." />
                </Field>

                <Field label="สิ่งที่ชอบ">
                  <input type="text" className={inputCls} value={data.likes} onChange={set('likes')} placeholder="ความสงบ ดนตรี..." />
                </Field>
              </div>
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
                เลือก <span className="text-gold-400 font-semibold">TOP 3</span> รายการที่ต้องการมากที่สุด
                {' '}(เลือกได้มากกว่า 3 ได้ ทีมงานจะโยนเต๋า d20 เพื่อสุ่มให้เหลือ 3 ตัวเลือก)
              </p>

              {/* Selected preview */}
              {data.pathwayPrefs.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {data.pathwayPrefs.map((p, i) => (
                    <span key={p} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-gold-400/50 text-gold-300 bg-gold-400/10">
                      <span className="text-gold-500 font-bold">{i + 1}.</span> {p}
                      <button type="button" onClick={() => togglePathway(p)}
                        className="ml-0.5 text-gold-500/60 hover:text-red-400 transition-colors leading-none">✕</button>
                    </span>
                  ))}
                </div>
              )}

              {/* Checkbox grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                {PATHWAYS.map(p => {
                  const idx = data.pathwayPrefs.indexOf(p)
                  const selected = idx !== -1
                  const rank = idx + 1
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePathway(p)}
                      className={`
                        relative text-left text-xs px-2.5 py-2 rounded border transition-all
                        ${selected
                          ? 'border-gold-400/60 bg-gold-400/10 text-gold-300 cursor-pointer'
                          : 'border-victorian-700/50 text-victorian-400 hover:border-victorian-600 hover:text-victorian-200 cursor-pointer'
                        }
                      `}
                    >
                      {selected && (
                        <span className="absolute top-1 right-1.5 text-[10px] font-bold text-gold-500">{rank}</span>
                      )}
                      {p}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* หมายเหตุ */}
            <div className="card-victorian space-y-4">
              <p className="text-xs text-victorian-500 uppercase tracking-widest">หมายเหตุ</p>
              <Field label="หมายเหตุ (PS)" hint="(หากไม่มีให้เว้นว่าง จะไม่แสดงผล — รองรับ HTML)">
                <textarea className={textareaCls} rows={2} value={data.psNote} onChange={set('psNote')}
                  placeholder="ข้อความเพิ่มเติมหรือ HTML..."/>
              </Field>
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
