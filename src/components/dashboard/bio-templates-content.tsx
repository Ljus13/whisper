'use client'

import { Copy, Check, ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// เทมเพลต HTML สำหรับ bio ของผู้เล่น
const BIO_TEMPLATE = `<!-- ═══════════════════════════════════════════════════════════
     เทมเพลตประวัติตัวละคร — Whisper of the Shadow
     คำแนะนำ: แก้ไขเฉพาะข้อความในส่วนที่มีคอมเมนต์ "✏️ แก้ไขตรงนี้"
     ═══════════════════════════════════════════════════════════ -->

<!-- โหลดฟอนต์ Kanit จาก Google Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap" rel="stylesheet">

<div style="
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.08) 0%, rgba(26, 22, 18, 0.95) 50%);
  border: 1px solid rgba(212, 175, 55, 0.25);
  border-radius: 0.125rem;
  padding: 2rem;
  color: #F5F0E1;
  font-family: 'Kanit', sans-serif;
  box-shadow: inset 0 0 30px rgba(212, 175, 55, 0.05);
">

  <!-- 🎭 ส่วนหัว: ชื่อตัวละคร -->
  <div style="text-align: center; margin-bottom: 2rem; border-bottom: 1px solid rgba(212, 175, 55, 0.2); padding-bottom: 1.5rem;">
    <h1 style="
      font-size: 2.5rem;
      font-weight: bold;
      background: linear-gradient(135deg, #E8C84D 0%, #D4AF37 50%, #C5A55A 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin: 0 0 0.5rem 0;
      letter-spacing: 0.1em;
    ">
      <!-- ✏️ แก้ไขตรงนี้: ใส่ชื่อตัวละครของคุณ -->
      ชื่อในกิจกรรม
    </h1>
    <p style="
      color: #C5A55A;
      font-size: 1.1rem;
      font-style: italic;
      margin: 0;
    ">
      <!-- ✏️ แก้ไขตรงนี้: ชื่อก่อนข้ามโลก -->
      ชื่อก่อนข้ามโลก
    </p>
  </div>

  <!-- 📋 ข้อมูลพื้นฐาน -->
  <div style="
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: rgba(15, 13, 10, 0.4);
    border-radius: 0.125rem;
    border: 1px solid rgba(212, 175, 55, 0.1);
  ">
    <div>
      <p style="color: #D4AF37; font-weight: bold; margin: 0 0 0.25rem 0; font-size: 0.9rem;">⚜ เชื้อชาติ</p>
      <p style="margin: 0; color: #F5F0E1;">
        <!-- ✏️ แก้ไขตรงนี้: ระบุเชื้อชาติ -->
        มนุษย์
      </p>
    </div>
    <div>
      <p style="color: #D4AF37; font-weight: bold; margin: 0 0 0.25rem 0; font-size: 0.9rem;">⚜ เพศ</p>
      <p style="margin: 0; color: #F5F0E1;">
        <!-- ✏️ แก้ไขตรงนี้: ระบุเพศ -->
        หญิง / ชาย / อื่น ๆ
      </p>
    </div>
  </div>

  <!-- 👤 ลักษณะทางกายภาพ -->
  <div style="margin-bottom: 2rem;">
    <h2 style="
      color: #E8C84D;
      font-size: 1.5rem;
      font-weight: bold;
      margin: 0 0 1rem 0;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgba(212, 175, 55, 0.15);
      letter-spacing: 0.05em;
    ">
      ✦ ลักษณะทางกายภาพ
    </h2>
    <p style="margin: 0; line-height: 1.75; color: #F5F0E1;">
      <!-- ✏️ แก้ไขตรงนี้: อธิบายลักษณะทางกายภาพ เช่น ส่วนสูง น้ำหนัก สีผม สีตา ลักษณะเด่น -->
      สูงประมาณ 165 เซนติเมตร รูปร่างผอมบาง ผมยาวสีดำสนิท ตาสีน้ำตาลเข้ม 
      ผิวขาวซีด มีรอยแผลเป็นเล็ก ๆ บริเวณแขนขวา จากอุบัติเหตุในวัยเด็ก
    </p>
  </div>

  <!-- 📜 ประวัติโดยสังเขป -->
  <div style="margin-bottom: 2rem;">
    <h2 style="
      color: #E8C84D;
      font-size: 1.5rem;
      font-weight: bold;
      margin: 0 0 1rem 0;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgba(212, 175, 55, 0.15);
      letter-spacing: 0.05em;
    ">
      ✦ ประวัติโดยสังเขป
    </h2>
    <p style="margin: 0; line-height: 1.75; color: #F5F0E1;">
      <!-- ✏️ แก้ไขตรงนี้: เล่าประวัติของตัวละคร บ้านเกิด ครอบครัว เหตุการณ์สำคัญในชีวิต -->
      เกิดที่หมู่บ้านเล็ก ๆ ทางตอนเหนือของอาณาจักร เติบโตมาในครอบครัวช่างตีเหล็ก 
      พ่อสอนให้หล่อโลหะและทำอาวุธตั้งแต่เด็ก วันหนึ่งหมู่บ้านถูกโจมตีโดยปีศาจ 
      ครอบครัวเสียชีวิตทั้งหมด รอดชีวิตมาได้เพราะซ่อนตัวในโรงตีเหล็ก 
      หลังจากนั้นจึงเดินทางตามหานักผจญภัยเพื่อแก้แค้นและปกป้องผู้อื่น
    </p>
  </div>

  <!-- 💭 ลักษณะนิสัย -->
  <div style="margin-bottom: 2rem;">
    <h2 style="
      color: #E8C84D;
      font-size: 1.5rem;
      font-weight: bold;
      margin: 0 0 1rem 0;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgba(212, 175, 55, 0.15);
      letter-spacing: 0.05em;
    ">
      ✦ ลักษณะนิสัย
    </h2>
    <p style="margin: 0; line-height: 1.75; color: #F5F0E1;">
      <!-- ✏️ แก้ไขตรงนี้: อธิบายบุคลิกภาพ นิสัย จุดเด่น จุดด้อย -->
      เงียบขรึม ไม่ค่อยพูดมาก แต่จะทำมากกว่าพูด มีความรับผิดชอบสูง 
      เคร่งครัดในหลักการ บางครั้งดื้อรั้นเกินไป ไม่ค่อยไว้ใจคนง่าย ๆ 
      แต่ถ้าไว้ใจแล้วจะภักดีอย่างสุดหัวใจ
    </p>
  </div>

  <!-- 🎨 งานอดิเรก -->
  <div style="margin-bottom: 2rem;">
    <h2 style="
      color: #E8C84D;
      font-size: 1.5rem;
      font-weight: bold;
      margin: 0 0 1rem 0;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgba(212, 175, 55, 0.15);
      letter-spacing: 0.05em;
    ">
      ✦ งานอดิเรก
    </h2>
    <ul style="margin: 0; padding-left: 2rem; line-height: 1.75; color: #F5F0E1;">
      <!-- ✏️ แก้ไขตรงนี้: ลบหรือเพิ่มรายการตามต้องการ -->
      <li>ฝึกหัดการตีดาบและฝึกฝนการต่อสู้</li>
      <li>ศึกษาเกี่ยวกับโลหะและการหล่อโลหะ</li>
      <li>นั่งสมาธิยามเช้า</li>
      <li>อ่านหนังสือเรื่องตำนานโบราณ</li>
    </ul>
  </div>

  <!-- ❤️ สิ่งที่ชอบ -->
  <div style="margin-bottom: 0;">
    <h2 style="
      color: #E8C84D;
      font-size: 1.5rem;
      font-weight: bold;
      margin: 0 0 1rem 0;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgba(212, 175, 55, 0.15);
      letter-spacing: 0.05em;
    ">
      ✦ สิ่งที่ชอบ
    </h2>
    <div style="
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    ">
      <!-- ✏️ แก้ไขตรงนี้: ลบหรือเพิ่ม tag ตามต้องการ -->
      <span style="
        display: inline-block;
        padding: 0.5rem 1rem;
        background: rgba(212, 175, 55, 0.15);
        border: 1px solid rgba(212, 175, 55, 0.3);
        border-radius: 9999px;
        color: #E8C84D;
        font-size: 0.9rem;
      ">☕ กาแฟดำ</span>
      <span style="
        display: inline-block;
        padding: 0.5rem 1rem;
        background: rgba(212, 175, 55, 0.15);
        border: 1px solid rgba(212, 175, 55, 0.3);
        border-radius: 9999px;
        color: #E8C84D;
        font-size: 0.9rem;
      ">🌙 ท้องฟ้ายามค่ำคืน</span>
      <span style="
        display: inline-block;
        padding: 0.5rem 1rem;
        background: rgba(212, 175, 55, 0.15);
        border: 1px solid rgba(212, 175, 55, 0.3);
        border-radius: 9999px;
        color: #E8C84D;
        font-size: 0.9rem;
      ">⚔️ อาวุธที่ทำด้วยมือ</span>
      <span style="
        display: inline-block;
        padding: 0.5rem 1rem;
        background: rgba(212, 175, 55, 0.15);
        border: 1px solid rgba(212, 175, 55, 0.3);
        border-radius: 9999px;
        color: #E8C84D;
        font-size: 0.9rem;
      ">🔥 เสียงไฟแตก</span>
      <span style="
        display: inline-block;
        padding: 0.5rem 1rem;
        background: rgba(212, 175, 55, 0.15);
        border: 1px solid rgba(212, 175, 55, 0.3);
        border-radius: 9999px;
        color: #E8C84D;
        font-size: 0.9rem;
      ">📖 นิทานปรัมปรา</span>
    </div>
  </div>

  <!-- ตกแต่งมุมล่าง -->
  <div style="
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(212, 175, 55, 0.2);
    text-align: center;
    color: #A89070;
    font-size: 0.85rem;
    font-style: italic;
  ">
    ✦ ท่านนักผจญภัยได้เข้าสู่โลกแห่งศาสตร์เร้นลับแล้ว ✦
  </div>

</div>

<!-- 
═══════════════════════════════════════════════════════════
คำแนะนำการใช้งาน:
1. คัดลอกโค้ด HTML ทั้งหมดนี้
2. ไปที่หน้า Dashboard > แก้ไขประวัติ
3. กดปุ่ม "Code" ที่มุมบนขวาของ editor
4. วางโค้ดลงไป
5. แก้ไขข้อความในส่วนที่มีคอมเมนต์ "✏️ แก้ไขตรงนี้"
6. กดบันทึก

หมายเหตุ: สามารถลบหรือเพิ่มส่วนต่าง ๆ ได้ตามต้องการ
═══════════════════════════════════════════════════════════
-->`

export default function BioTemplatesContent() {
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(BIO_TEMPLATE)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      alert('ไม่สามารถคัดลอกได้ กรุณาลองอีกครั้ง')
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-victorian-400 hover:text-gold-400 transition-colors mb-4 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>ย้อนกลับ</span>
          </button>
          
          <h1 className="heading-victorian text-3xl md:text-5xl mb-3">
            เทมเพลตประวัติตัวละคร
          </h1>
          <p className="text-victorian-400 text-base md:text-lg">
            เลือกเทมเพลตสำเร็จรูปสำหรับผู้ที่ไม่ถนัด HTML
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* LEFT: Preview */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-display text-gold-400">🎭 ตัวอย่าง</h2>
            </div>
            <div 
              className="border border-gold-400/20 rounded-sm p-4 overflow-auto"
              style={{ 
                maxHeight: '80vh',
                backgroundColor: '#0F0D0A'
              }}
            >
              <div dangerouslySetInnerHTML={{ __html: BIO_TEMPLATE }} />
            </div>
          </div>

          {/* RIGHT: Code + Instructions */}
          <div className="space-y-6">
            {/* Copy Button */}
            <div className="card-victorian">
              <h2 className="text-xl font-display text-gold-400 mb-4">
                📋 คัดลอกโค้ด
              </h2>
              <p className="text-victorian-400 text-sm mb-4 leading-relaxed">
                กดปุ่มด้านล่างเพื่อคัดลอกโค้ด HTML ตัวอย่าง 
                จากนั้นไปที่หน้า Dashboard → แก้ไขประวัติ → กดปุ่ม <strong className="text-gold-400">Code</strong> → วางโค้ด → แก้ไขข้อความ → บันทึก
              </p>
              <button
                onClick={handleCopy}
                className="btn-gold w-full !py-3"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5" />
                    คัดลอกแล้ว!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    คัดลอกโค้ด HTML
                  </>
                )}
              </button>
            </div>

            {/* Instructions */}
            <div className="card-victorian">
              <h2 className="text-xl font-display text-gold-400 mb-4">
                📖 วิธีใช้งาน
              </h2>
              <ol className="space-y-3 text-victorian-300 text-sm leading-relaxed">
                <li className="flex gap-3">
                  <span className="text-gold-400 font-bold flex-shrink-0">1.</span>
                  <span>กดปุ่ม <strong className="text-gold-400">"คัดลอกโค้ด HTML"</strong> ด้านบน</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-gold-400 font-bold flex-shrink-0">2.</span>
                  <span>ไปที่หน้า <strong className="text-gold-400">Dashboard</strong> → กดที่รูปโปรไฟล์ → <strong className="text-gold-400">แก้ไขประวัติ</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="text-gold-400 font-bold flex-shrink-0">3.</span>
                  <span>ใน Bio Editor กดปุ่ม <strong className="text-gold-400">Code</strong> ที่มุมบนขวา</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-gold-400 font-bold flex-shrink-0">4.</span>
                  <span>วางโค้ดที่คัดลอกมา (Ctrl+V หรือ Cmd+V)</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-gold-400 font-bold flex-shrink-0">5.</span>
                  <span>แก้ไขเฉพาะข้อความในส่วนที่มีคอมเมนต์ <strong className="text-gold-400">"✏️ แก้ไขตรงนี้"</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="text-gold-400 font-bold flex-shrink-0">6.</span>
                  <span>กดบันทึก — เสร็จแล้ว! 🎉</span>
                </li>
              </ol>
            </div>

            {/* Tips */}
            <div 
              className="border border-nouveau-emerald/30 rounded-sm p-5"
              style={{ backgroundColor: 'rgba(88, 129, 87, 0.05)' }}
            >
              <h3 className="text-nouveau-emerald font-display text-lg mb-3">
                💡 เคล็ดลับ
              </h3>
              <ul className="space-y-2 text-victorian-300 text-sm">
                <li>• เทมเพลตนี้ใช้ inline CSS จึงแสดงผลได้ทุก editor</li>
                <li>• สามารถลบหรือเพิ่มส่วนต่าง ๆ ได้ตามต้องการ</li>
                <li>• ถ้าอยากเปลี่ยนสี ให้แก้ไขค่า <code className="text-gold-400">color</code> และ <code className="text-gold-400">background</code></li>
                <li>• แนะนำให้กดปุ่ม "Preview" เพื่อดูผลลัพธ์ก่อนกดบันทึก</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
