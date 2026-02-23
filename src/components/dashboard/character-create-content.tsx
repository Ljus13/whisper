'use client'

import { Copy, Check, ChevronLeft, RotateCcw, ExternalLink } from 'lucide-react'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PATHWAYS as PATHWAY_DATA } from '@/app/world-setting/_data/pathways'
import { RELIGIONS as RELIGION_DATA, type ReligionData } from '@/app/dashboard/character-create/_data/religions'

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

/** TMI content for iframe preview — rendered as HTML list */
function buildTmiHtml(d: CharData): string {
  const items = [
    d.hobbies.trim() ? `<li>งานอดิเรก: ${d.hobbies}</li>` : '',
    d.likes.trim()   ? `<li>สิ่งที่ชอบ: ${d.likes}</li>`  : '',
    d.psNote.trim()  ? `<li>${d.psNote}</li>`               : '',
  ].filter(Boolean)
  return items.length ? `<ul style="margin:0;padding-left:1.4em">${items.join('')}</ul>` : ''
}

/** TMI content for copy output — BBCode format used by forum CMS */
function buildTmiBBCode(d: CharData): string {
  const items = [
    d.hobbies.trim() ? `[*]งานอดิเรก: ${d.hobbies}` : '',
    d.likes.trim()   ? `[*]สิ่งที่ชอบ: ${d.likes}`  : '',
    d.psNote.trim()  ? `[*]${d.psNote}`               : '',
  ].filter(Boolean)
  return items.length ? `[list]${items.join('')}[/list]` : ''
}

function buildCopyHtml(d: CharData): string {
  return `<link href="${CSS_URL}" rel="stylesheet">${buildInnerHtml(d, buildTmiBBCode(d))}`
}

function buildPreviewSrcdoc(d: CharData, cssText: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=900"><style>${cssText}</style><style>html,body{margin:0;padding:1rem;background:#0a0908;overflow-x:hidden;}::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#4a3f35;border-radius:4px;}::-webkit-scrollbar-thumb:hover{background:#6b5a4e;}*{scrollbar-width:thin;scrollbar-color:#4a3f35 transparent;}</style></head><body>${buildInnerHtml(d, buildTmiHtml(d))}<script>function send(){window.parent.postMessage({type:'rp-height',h:document.body.scrollHeight},'*');}window.addEventListener('load',send);new ResizeObserver(send).observe(document.body);<\/script></body></html>`
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
                <div className="space-y-2">
                  <select className={selectCls} value={data.religion} onChange={set('religion')}>
                    {RELIGION_DATA.map(r => <option key={r.id} value={r.name_th}>{r.name_th}</option>)}
                  </select>
                  {/* Religion preview with logo & theme color */}
                  {currentReligion.logo_url && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-victorian-700/50 bg-victorian-900/40">
                      <img src={currentReligion.logo_url} alt="" className="w-6 h-6 object-contain rounded" />
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
                        {pw?.logo && <img src={pw.logo} alt="" className="w-4 h-4 object-contain rounded" />}
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
                      <img src={p.logo} alt="" className="w-4 h-4 object-contain rounded flex-shrink-0" />
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
