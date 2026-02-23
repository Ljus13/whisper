'use client'

import { Copy, Check, ChevronLeft, RotateCcw } from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const STORAGE_KEY = 'whisper_bio_draft'

// --------------- types ---------------
interface BioData {
  imageUrl: string
  name: string
  preName: string
  race: string
  gender: string
  age: string
  appearance: string
  backstory: string
  personality: string
  hobbies: string   // newline-separated
  likes: string     // newline-separated
  footer: string
}

const DEFAULT_DATA: BioData = {
  imageUrl: 'https://i.pravatar.cc/220?img=12',
  name: 'Jane Doe',
  preName: 'Jane (ชื่อเดิมก่อนข้ามโลก)',
  race: 'มนุษย์',
  gender: 'หญิง',
  age: '20 ปี',
  appearance: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. สูงประมาณ 165 เซนติเมตร ผมสั้นสีน้ำตาล ตาสีเขียว รูปร่างบอบบาง',
  backstory: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
  personality: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  hobbies: 'Lorem ipsum — รายการ 1\nDolor sit amet — รายการ 2\nConsectetur adipiscing — รายการ 3',
  likes: '☕ Lorem ipsum\n🌿 Dolor sit amet\n📜 Consectetur\n🌙 Adipiscing elit',
  footer: '✦ ท่านนักผจญภัยได้เข้าสู่โลกแห่งศาสตร์เร้นลับแล้ว ✦',
}

// --------------- html builder ---------------
function buildHtml(d: BioData): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const hobbiesList = d.hobbies
    .split('\n')
    .map(h => h.trim())
    .filter(Boolean)
    .map(h => `<li>${escape(h)}</li>`)
    .join('')

  const tagList = d.likes
    .split('\n')
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => `<span style="padding:0.25rem 0.75rem;background:#f5f5f5;border:1px solid #e5e5e5;border-radius:999px;font-size:0.88rem;color:#444;">${escape(t)}</span>`)
    .join('')

  // build multiline for readability, then minify before copy (prevent CMS br/hr injection)
  const raw = `<!-- ความสูงปรับอัตโนมัติตามเนื้อหา --><link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600&display=swap" rel="stylesheet"><div style="font-family:'Kanit',sans-serif;max-width:640px;margin:0 auto;padding:1.5rem;color:#1a1a1a;background:#fff;border-radius:12px;line-height:1.75;box-sizing:border-box;"><div style="display:flex;gap:1.25rem;align-items:flex-start;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid #eee;"><div style="flex-shrink:0;"><img src="${d.imageUrl}" alt="รูปตัวละคร" style="width:110px;height:140px;object-fit:cover;border-radius:8px;border:1px solid #eee;display:block;" /></div><div style="flex:1;min-width:0;"><h1 style="font-size:1.6rem;font-weight:600;margin:0 0 0.2rem 0;color:#111;line-height:1.3;">${escape(d.name)}</h1><p style="margin:0 0 0.75rem;font-size:0.9rem;color:#888;font-style:italic;">${escape(d.preName)}</p><div style="display:flex;flex-wrap:wrap;gap:0.4rem 1.25rem;font-size:0.9rem;"><span><span style="color:#999;font-size:0.8rem;">เชื้อชาติ</span><br/>${escape(d.race)}</span><span><span style="color:#999;font-size:0.8rem;">เพศ</span><br/>${escape(d.gender)}</span><span><span style="color:#999;font-size:0.8rem;">อายุ</span><br/>${escape(d.age)}</span></div></div></div><div style="margin-bottom:1.5rem;"><h2 style="font-size:0.8rem;font-weight:600;color:#999;margin:0 0 0.4rem 0;text-transform:uppercase;letter-spacing:0.06em;">ลักษณะทางกายภาพ</h2><p style="margin:0;color:#333;">${escape(d.appearance)}</p></div><div style="margin-bottom:1.5rem;"><h2 style="font-size:0.8rem;font-weight:600;color:#999;margin:0 0 0.4rem 0;text-transform:uppercase;letter-spacing:0.06em;">ประวัติโดยสังเขป</h2><p style="margin:0;color:#333;">${escape(d.backstory)}</p></div><div style="margin-bottom:1.5rem;"><h2 style="font-size:0.8rem;font-weight:600;color:#999;margin:0 0 0.4rem 0;text-transform:uppercase;letter-spacing:0.06em;">ลักษณะนิสัย</h2><p style="margin:0;color:#333;">${escape(d.personality)}</p></div><div style="margin-bottom:1.5rem;"><h2 style="font-size:0.8rem;font-weight:600;color:#999;margin:0 0 0.4rem 0;text-transform:uppercase;letter-spacing:0.06em;">งานอดิเรก</h2><ul style="margin:0;padding-left:1.25rem;color:#333;">${hobbiesList}</ul></div><div style="margin-bottom:1rem;"><h2 style="font-size:0.8rem;font-weight:600;color:#999;margin:0 0 0.4rem 0;text-transform:uppercase;letter-spacing:0.06em;">สิ่งที่ชอบ</h2><div style="display:flex;flex-wrap:wrap;gap:0.4rem;">${tagList}</div></div><div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid #eee;text-align:center;color:#bbb;font-size:0.85rem;">${escape(d.footer)}</div></div>`

  return raw
}

// --------------- field components ---------------
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
const textareaCls = `${inputCls} resize-none leading-relaxed`

// --------------- main component ---------------
export default function BioTemplatesContent() {
  const [data, setData] = useState<BioData>(DEFAULT_DATA)
  const [copied, setCopied] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const router = useRouter()

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<BioData>
        setData(prev => ({ ...prev, ...parsed }))
      }
    } catch {}
    setHydrated(true)
  }, [])

  // Save to localStorage on every change (debounced by React batching)
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {}
  }, [data, hydrated])

  const set = (key: keyof BioData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setData(prev => ({ ...prev, [key]: e.target.value }))

  function handleReset() {
    if (!confirm('รีเซ็ตข้อมูลทั้งหมดกลับเป็นตัวอย่างเริ่มต้น?')) return
    localStorage.removeItem(STORAGE_KEY)
    setData(DEFAULT_DATA)
  }

  const html = useMemo(() => buildHtml(data), [data])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(html)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('ไม่สามารถคัดลอกได้ กรุณาลองอีกครั้ง')
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

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
                สร้างประวัติตัวละคร
              </h1>
              <p className="text-victorian-400 text-sm">
                กรอกข้อมูล → ดูตัวอย่างแบบ real-time → คัดลอกโค้ดพร้อมใช้ได้เลย
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

            {/* Image + Basic */}
            <div className="card-victorian space-y-4">
              <p className="text-xs text-victorian-500 uppercase tracking-widest">รูปภาพ & ข้อมูลพื้นฐาน</p>

              <Field label="URL รูปภาพ" hint="(direct link ของรูป)">
                <input
                  type="url"
                  className={inputCls}
                  placeholder="https://..."
                  value={data.imageUrl}
                  onChange={set('imageUrl')}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="ชื่อในกิจกรรม">
                  <input type="text" className={inputCls} value={data.name} onChange={set('name')} />
                </Field>
                <Field label="ชื่อก่อนข้ามโลก">
                  <input type="text" className={inputCls} value={data.preName} onChange={set('preName')} />
                </Field>
                <Field label="เชื้อชาติ">
                  <input type="text" className={inputCls} value={data.race} onChange={set('race')} />
                </Field>
                <Field label="เพศ">
                  <input type="text" className={inputCls} value={data.gender} onChange={set('gender')} />
                </Field>
                <Field label="อายุ">
                  <input type="text" className={inputCls} value={data.age} onChange={set('age')} />
                </Field>
              </div>
            </div>

            {/* Description fields */}
            <div className="card-victorian space-y-4">
              <p className="text-xs text-victorian-500 uppercase tracking-widest">รายละเอียดตัวละคร</p>

              <Field label="ลักษณะทางกายภาพ">
                <textarea className={textareaCls} rows={3} value={data.appearance} onChange={set('appearance')} />
              </Field>
              <Field label="ประวัติโดยสังเขป">
                <textarea className={textareaCls} rows={4} value={data.backstory} onChange={set('backstory')} />
              </Field>
              <Field label="ลักษณะนิสัย">
                <textarea className={textareaCls} rows={3} value={data.personality} onChange={set('personality')} />
              </Field>
            </div>

            {/* Lists */}
            <div className="card-victorian space-y-4">
              <p className="text-xs text-victorian-500 uppercase tracking-widest">งานอดิเรก & สิ่งที่ชอบ</p>

              <Field label="งานอดิเรก" hint="(แต่ละบรรทัด = 1 รายการ)">
                <textarea className={textareaCls} rows={4} value={data.hobbies} onChange={set('hobbies')} />
              </Field>
              <Field label="สิ่งที่ชอบ" hint="(แต่ละบรรทัด = 1 tag)">
                <textarea className={textareaCls} rows={4} value={data.likes} onChange={set('likes')} />
              </Field>
              <Field label="ข้อความปิดท้าย">
                <input type="text" className={inputCls} value={data.footer} onChange={set('footer')} />
              </Field>
            </div>

            {/* Copy button (mobile  below form) */}
            <button
              onClick={handleCopy}
              className="btn-gold w-full !py-3 flex items-center justify-center gap-2 xl:hidden"
            >
              {copied ? <><Check className="w-4 h-4" />คัดลอกแล้ว!</> : <><Copy className="w-4 h-4" />คัดลอกโค้ด HTML</>}
            </button>
          </div>

          {/* RIGHT: Preview + Copy */}
          <div className="sticky top-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-victorian-500 uppercase tracking-widest">ตัวอย่าง (live)</p>
              <button
                onClick={handleCopy}
                className="btn-gold !px-5 !py-2 text-sm flex items-center gap-2 hidden xl:flex"
              >
                {copied ? <><Check className="w-3.5 h-3.5" />คัดลอกแล้ว!</> : <><Copy className="w-3.5 h-3.5" />คัดลอกโค้ด HTML</>}
              </button>
            </div>

            <div className="border border-victorian-700/40 rounded-md overflow-x-auto bg-white">
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </div>

            <p className="text-xs text-victorian-600 text-center">
              โค้ดที่คัดลอกคือ HTML สมบูรณ์ พร้อมนำไปวางใน Bio Editor ได้เลย
              {hydrated && <span className="ml-1 text-victorian-700">· บันทึกอัตโนมัติแล้ว</span>}
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
