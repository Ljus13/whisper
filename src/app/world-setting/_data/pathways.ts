export interface Pathway {
  id: string
  name: string
  nameEn: string
  logo: string
  highlight: string
  skills: string
  images: [string, string, string]
  /** 'video' if images[0] is actually a video URL */
  firstAssetType?: 'video' | 'image'
  /** ข้อควรทราบพิเศษ — เงื่อนไขที่ส่งผลถาวรต่อตัวละคร */
  warning?: string
}

export const PATHWAYS: Pathway[] = [
  {
    id: 'seer',
    name: 'เส้นทางนักทำนาย',
    nameEn: 'Seer / Fool',
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1770612457/Fool_Symbol2_ydvwem.webp',
    highlight:
      'โดดเด่นไปด้วยสกิลที่เกี่ยวข้องกับความไม่แน่นอน การคาดเดาไม่ได้ ลำดับต่ำเน้นการทำนายและความคล่องตัว แต่เมื่อลำดับสูงขึ้นไปจะเต็มไปด้วยความพิสดารและการเปลี่ยนแปลงความเป็นจริง',
    skills:
      'เชี่ยวชาญการทำนายทุกรูปแบบ (ไพ่ทาโรต์, ลูกตุ้ม, ความฝัน), การอ่านออร่าด้วย Spirit Vision, การใช้ตุ๊กตาเชิด, การควบคุมเส้นด้ายจิตวิญญาณ, การสร้างภาพลวงตา, การใช้ไพ่กระดาษเป็นอาวุธ, การสลับตำแหน่ง',
    images: [
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1770629962/seq_9_ssv3hd.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652273/fool_seq_8_v2_rwneog.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652274/fool_seq_3-_zw9xga.jpg',
    ],
  },
  {
    id: 'marauder',
    name: 'เส้นทางหัวขโมย',
    nameEn: 'Marauder / Error',
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771316056/width_550_hgdcwm.webp',
    highlight:
      'โดดเด่นในเรื่องการขโมยและเล่ห์เหลี่ยม ไม่ใช่เพียงแค่สิ่งของ แต่รวมถึงพลังวิเศษ ความคิด โชคชะตา และเวลา เปรียบเสมือน "ข้อผิดพลาด" (Error) ของกฎเกณฑ์ธรรมชาติ',
    skills:
      'การสิงสู่ (Parasitizing), การขโมยความคิดและความสามารถ, การขโมยโชคและเวลา, การหลอกลวงกฎเกณฑ์ธรรมชาติ, การสร้างช่องโหว่ในพื้นที่-เวลา, และมือที่ว่องไวเหนือธรรมชาติ',
    images: [
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771316058/image_1_c1o0ip.png',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652274/fool_seq_3-_zw9xga.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652331/seq_4_error_dya3p9.jpg',
    ],
  },
  {
    id: 'apprentice',
    name: 'เส้นทางลูกศิษย์',
    nameEn: 'Apprentice / Door',
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771227184/Door_Symbol2_la159u.webp',
    highlight:
      'โดดเด่นในเรื่องการเดินทางผ่านมิติต่างๆ การข้ามผ่านสิ่งกีดขวาง และการเลียนแบบหรือบันทึกพลังของผู้อื่น ยากที่จะถูกกักขังหรือสกัดกั้น',
    skills:
      'การทะลุผ่านกำแพง (Door Opening), การบันทึกและใช้พลังของผู้อื่น (Record/Scribe), การเดินทางข้ามมิติ (Traveling/Blink), การซ่อนพื้นที่, และการใช้เวทมนตร์พื้นฐาน (แก๊ส, แสง, ไฟฟ้า)',
    images: [
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771227220/image_j7bayx.png',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652378/the_door_svailh.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652466/image_uzu2ii.png',
    ],
  },
  {
    id: 'spectator',
    name: 'เส้นทางผู้ชม',
    nameEn: 'Spectator / Visionary',
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1770780495/Visionary_Symbol2_mmcflu.webp',
    highlight:
      'เน้นการสังเกตการณ์ การเข้าใจจิตวิทยา และการบงการความคิดผู้อื่นอย่างแนบเนียน ลำดับสูงสามารถเปลี่ยนจินตนาการหรือความคิดให้กลายเป็นความจริงได้',
    skills:
      'การสะกดจิต (Hypnosis), การปลอบประโลมทางจิต (Placate), การอ่านใจและตรวจจับอารมณ์, การสร้างพายุทางจิต (Mind Storm), การเดินในความฝัน, และการสร้างตัวตนจำลอง (Virtual Persona)',
    images: [
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1770780604/unnamed_t9cprq.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652543/image_vivtan.png',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652545/image_1_mtceiw.png',
    ],
  },
  {
    id: 'sailor',
    name: 'เส้นทางกะลาสี',
    nameEn: 'Sailor / Tyrant',
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1770619961/Tyrant_Symbol2_osgium.webp',
    highlight:
      'เน้นพลังที่เกี่ยวข้องกับน้ำ ทะเล และพายุ มีความสามารถในการต่อสู้และพละกำลังสูงมาก โดยเฉพาะในสภาพแวดล้อมทางน้ำ',
    skills:
      'ความคล่องตัวในน้ำ, การหายใจใต้น้ำ, พละกำลังมหาศาล, การทำนายสภาพอากาศ, การใช้เวทมนตร์สายฟ้าและน้ำ, และการร้องเพลงเพื่อข่มขวัญศัตรู',
    images: [
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771320235/sailor_itbfvm.mp4',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652597/image_2_drla01.png',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652600/image_3_pjdkau.png',
    ],
    firstAssetType: 'video',
  },
  {
    id: 'hunter',
    name: 'เส้นทางนักล่า',
    nameEn: 'Hunter / Red Priest',
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771388609/Red_Priest_Symbol2_bt4qaf.webp',
    highlight:
      'เน้นความสามารถที่เกี่ยวข้องกับการทำสงคราม กลยุทธ์ และการควบคุมสนามรบ เชี่ยวชาญการใช้ไฟ กับดัก และการวิเคราะห์จุดอ่อน',
    skills:
      'เชี่ยวชาญการใช้ไฟ, การวางกับดักและแผนสมคบคิด, พละกำลังและความคล่องตัวสูง, ประสาทสัมผัสแหลมคมในการติดตามร่องรอย, และการยั่วยุอารมณ์ศัตรู',
    warning:
      'เมื่อถึงลำดับ 4 เพศหญิงจะกลายเป็นเพศชายโดยถาวร',
    images: [
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771388629/red_priest_seq_7_v2_irm2jw.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652650/image_4_qespgu.png',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652653/image_5_ocwggf.png',
    ],
  },
  {
    id: 'mystery-pryer',
    name: 'เส้นทางผู้ส่องความลับ',
    nameEn: 'Mystery Pryer / Hermit',
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771390011/Hermit_Symbol2_wqzrnl.webp',
    highlight:
      'เน้นการเจาะลึกความลับของโลกและจักรวาล เข้าถึงความจริงที่ซ่อนเร้นผ่านเนตรพิเศษ ลำดับสูงสามารถดึงพลังจากตำนานและนิทานมาใช้ได้',
    skills:
      'เนตรส่องความลับ (มองเห็นความจริงและพลังวิญญาณ), การทำพิธีกรรมเวทมนตร์ดวงดาว, การจำลองเวทมนตร์จากตำนาน, และความเชี่ยวชาญการต่อสู้ระยะประชิดในลำดับ 8',
    images: [
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771390054/hermit_seq_1_mxb7ih.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652700/hermit_seq_6_%E0%B8%AD2_qq0u9b.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652699/hermit_seq_4_v3_im0n9t.jpg',
    ],
  },
  {
    id: 'savant',
    name: 'เส้นทางนักปราชญ์',
    nameEn: 'Savant / Paragon',
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771389559/Paragon_Symbol2_y8cucj.webp',
    highlight:
      'โดดเด่นในด้านความรู้ทางวิทยาศาสตร์ กลไก และการประดิษฐ์ เชี่ยวชาญการสร้างและปรับแต่งอุปกรณ์วิเศษเพื่อชดเชยพลังการต่อสู้',
    skills:
      'ความจำและการเรียนรู้ที่เป็นเลิศ, การสร้างสิ่งประดิษฐ์และเครื่องจักรไอน้ำ, การสำรวจโบราณสถาน, และสัญชาตญาณในการใช้งานวัตถุต้องสาป',
    images: [
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771389588/paragon_seq_5_whzdy8.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652738/paragon_seq_2_cuwn3d.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652740/paragon_seq_5_v4_baebip.jpg',
    ],
  },
  {
    id: 'warrior',
    name: 'เส้นทางนักรบ',
    nameEn: 'Warrior / Twilight Giant',
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771386373/Twilight_Giant_Symbol2_hfmybg.webp',
    highlight:
      'เน้นการเสริมพลังกายภาพ พละกำลัง และการป้องกันที่แข็งแกร่งที่สุด เชี่ยวชาญการใช้อาวุธและการต่อสู้ทุกรูปแบบ',
    skills:
      'พละกำลังและความทนทานเหนือมนุษย์, ชำนาญอาวุธทุกชนิด, การสร้างเกราะและอาวุธด้วยพลังวิญญาณ, และการทำลายวิญญาณชั่วร้าย',
    images: [
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771386423/twilight_giant_seq_8_v2_ogsrfl.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652805/twilight_giant_seq_1_v2_cdkv5b.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652806/twilight_giant_seq_4_drvgjo.jpg',
    ],
  },
  {
    id: 'assassin',
    name: 'เส้นทางนักฆ่า',
    nameEn: 'Assassin / Demoness',
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771388195/Demoness_Symbol2_z02wxy.webp',
    highlight:
      'เน้นความว่องไว การลอบสังหาร และการสร้างภัยพิบัติหรือความโกลาหล พลิกผันโลกด้วยความยุ่งเหยิงและคำสาป',
    skills:
      'การลอบสังหาร, การอำพรางตัวในเงา, การทำให้ร่างกายเบา, การควบคุมเส้นใยล่องหน, การยุยงปลุกปั่นความชั่วร้าย, และการแพร่กระจายโรคร้าย',
    warning:
      'เมื่อถึงลำดับ 7 เพศชายจะกลายเป็นเพศหญิงอย่างถาวร',
    images: [
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771388221/demoness_seq_9_v2_iu31yn.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652846/demoness_seq_7_v3_nsim0l.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652849/demoness_seq_8_frwxk3.jpg',
    ],
  },
  {
    id: 'bard',
    name: 'เส้นทางนักขับขาน',
    nameEn: 'Bard / Sun',
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1770783110/Sun_Symbol2_smeglb.webp',
    highlight:
      'เน้นการชำระล้างความชั่วร้าย มอบแสงสว่างและบัฟ มีพลังรุนแรงต่อสิ่งมีชีวิตประเภทยมโลก วิญญาณร้าย และความมืด',
    skills:
      'การเรียกแสงศักดิ์สิทธิ์และไฟ, การชำระล้าง (Purification), การขับขานมอบบัฟเพิ่มพลังกายและความกล้า, การสร้างเขตแดนไร้เงา, และการสร้างตราพยาน',
    images: [
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1770783143/sun_seq_9_v2_jwpz1h.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652873/sun_seq_8_cfoesz.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652875/sun_seq_6_v2_acdwfn.jpg',
    ],
  },
  {
    id: 'apothecary',
    name: 'เส้นทางเภสัชกร',
    nameEn: 'Apothecary / Moon',
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771407581/Moon_Symbol2_xxfkrq.webp',
    highlight:
      'โดดเด่นด้านพลังการรักษา การปรุงยา และมีอำนาจเหนือความอุดมสมบูรณ์ พลังผูกพันกับวัฏจักรของดวงจันทร์และธรรมชาติ',
    skills:
      'การปรุงยาบำบัดโรคและยาเพิ่มพลัง (Buff), การทำให้สัตว์เชื่องและใช้งานสัตว์, การฟื้นฟูร่างกายอย่างรวดเร็ว, และการใช้เวทมนตร์แห่งความมืด',
    warning:
      'เมื่อถึงลำดับสูงสุด (ลำดับ 1) เพศชายจะกลายเป็นเพศหญิงอย่างถาวร',
    images: [
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771407595/moon_seq_9_q2damr.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652922/moon_seq_5_ilf5n9.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652924/moon_seq_8_v2_rebw12.jpg',
    ],
  },
  {
    id: 'planter',
    name: 'เส้นทางนักเพาะปลูก',
    nameEn: 'Planter / Mother',
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771407637/Mother_Symbol2_afdigd.webp',
    highlight:
      'เกี่ยวพันกับชีวิต พืชพรรณ และผืนดิน เชี่ยวชาญการเยียวยารักษาร่างกายและจิตวิญญาณ รวมถึงการเพาะปลูก',
    skills:
      'ความรู้เรื่องพืชและสมุนไพร, การผ่าตัดรักษาบาดแผลและวิญญาณ, การพยากรณ์อากาศ, และพละกำลังทางกายภาพที่สูง',
    warning:
      'เมื่อถึงลำดับสูงสุด (ลำดับ 1) เพศชายจะกลายเป็นเพศหญิงอย่างถาวร',
    images: [
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771407622/mother_seq_9_jwhzco.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652963/mother_seq_4_v2_w2owab.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771652966/mother_seq_2_bxs2z1.jpg',
    ],
  },
  {
    id: 'corpse-collector',
    name: 'เส้นทางผู้เก็บซากศพ',
    nameEn: 'Corpse Collector / Death',
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771386274/Death_Symbol2_bazus4.webp',
    highlight:
      'มีอำนาจเหนือคนตายและวิญญาณ สามารถต้านทานพลังงานความเย็นและการเน่าเปื่อยได้ มีออร่าที่เยือกเย็น',
    skills:
      'การควบคุมซอมบี้และวิญญาณ, สื่อสารกับคนตาย, การมองเห็นจุดอ่อนของสิ่งมีชีวิต (ดวงตาแห่งความตาย), และการเดินทางผ่านโลกวิญญาณ',
    images: [
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771386305/death_seq_2_-_v3_jedcw1.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771649690/seq_5_death_cyvqap.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771649690/seq_7_death_tuylzk.jpg',
    ],
  },
  {
    id: 'sleepless',
    name: 'เส้นทางผู้ไม่นิทรา',
    nameEn: 'Sleepless / Darkness',
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771386173/Darkness_Symbol2_qzs7t2.webp',
    highlight:
      'มีพลังเกี่ยวข้องกับรัตติกาลและความเงียบสงัด แข็งแกร่งที่สุดในยามค่ำคืน เชี่ยวชาญการควบคุมความฝันและการซ่อนตัว',
    skills:
      'การมองเห็นในความมืด, ต้องการการนอนน้อยมาก, การกล่อมจิตให้หลับใหลหรือสงบด้วยบทกวี, การเข้าสู่ความฝัน, และเชี่ยวชาญการใช้ปืน',
    images: [
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771386207/darkness_seq_5_v2_phuxww.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771653017/darkness_seq_2_%E0%B8%AD2_lsyvz9.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771653019/darkness_seq_8_v2_qp4pu6.jpg',
    ],
  },
  {
    id: 'lawyer',
    name: 'เส้นทางนักกฎหมาย',
    nameEn: 'Lawyer / Black Emperor',
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771407814/Black_Emperor_Symbol2_gm4upv.webp',
    highlight:
      'เก่งกาจในการหาช่องโหว่ของกฎระเบียบและบิดเบือนกฎเกณฑ์เพื่อประโยชน์ของตนเอง สร้างความวุ่นวายในระเบียบที่มีอยู่',
    skills:
      'วาทศิลป์โน้มน้าวใจ, การติดสินบน (Bribe), การบิดเบือนกฎ (Distortion), การใช้ประโยชน์จากกฎเกณฑ์ (Exploit), และร่างกายที่ทนทาน',
    images: [
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771407864/black_emperor_seq_8_htajmr.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771653055/black_emperor_seq_4_v2_jsosds.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771653057/black_emperor_seq_5_dgonqv.jpg',
    ],
  },
  {
    id: 'arbiter',
    name: 'เส้นทางผู้ตัดสิน',
    nameEn: 'Arbiter / Justiciar',
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771407811/Justiciar_Symbol2_tt9fi9.webp',
    highlight:
      'ยึดมั่นในการปกป้องระเบียบและการลงทัณฑ์ กำหนดกฎเกณฑ์ที่บังคับใช้กับผู้อื่นอย่างเด็ดขาด',
    skills:
      'ออร่าแห่งอำนาจที่ทำให้คนเชื่อฟัง, การตั้งกฎและลงโทษผู้ฝ่าฝืน, การตรวจจับความผิดปกติ, และการจดจำเป้าหมายที่เหนือธรรมชาติ',
    images: [
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771407841/justiciar_seq_6_v2_ao8fxu.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771653073/justiciar_seq_3_utjpue.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771653076/justiciar_seq_5_oy1yrl.jpg',
    ],
  },
  {
    id: 'prisoner',
    name: 'เส้นทางนักโทษ',
    nameEn: 'Prisoner / Chained',
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771408024/Chained_Symbol2_jynmlm.webp',
    highlight:
      'สะท้อนพันธนาการและการปลดปล่อย เกี่ยวพันกับความบิดเบี้ยว คำสาป และสัญชาตญาณดิบท่ามกลางความบ้าคลั่ง',
    skills:
      'การเป็นเจ้าแห่งการหลบหนี, การกลายร่าง (เช่น มนุษย์หมาป่า), การควบคุมวิญญาณและคำสาป, และสภาวะคลุ้มคลั่งเพื่อเพิ่มพลัง',
    images: [
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771408076/chained_seq_5_v2_a9ipcn.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771653141/chained_seq_7_v2_ljogbr.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771653143/chained_seq_2_smzieq.jpg',
    ],
  },
  {
    id: 'criminal',
    name: 'เส้นทางอาชญากร',
    nameEn: 'Criminal / Abyss',
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771408025/Abyss_Symbol2_m8zazv.webp',
    highlight:
      'สะท้อนความปรารถนาและละโมบ เป็นเงาของปีศาจที่ทำลายล้าง มีสัญชาตญาณเฉียบคมในการทำชั่ว',
    skills:
      'เชี่ยวชาญอาวุธทุกชนิด, สัญชาตญาณรับภัยแหลมคม, ร่างกายกึ่งปีศาจ, และเวทมนตร์ปีศาจเบื้องต้น (ไฟพิษ, คำสาป)',
    images: [
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771408035/abyss_seq_8_phicpl.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771653170/abyss_seq_3_c4waam.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771653175/abyss_seq_4_dnvia3.jpg',
    ],
  },
  {
    id: 'secrets-supplicant',
    name: 'เส้นทางผู้วิงวอนความลับ',
    nameEn: 'Secrets Supplicant / Hanged Man',
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771321380/hangman-logo_ikwqca.webp',
    highlight:
      'เกี่ยวพันกับความลึกลับ การเสื่อมสลาย และการรับรู้ทางวิญญาณที่บิดเบี้ยว สามารถกลืนกินวิญญาณและควบคุมเงา',
    skills:
      'การรับรู้เสียงกระซิบจากสิ่งลึกลับ, ความรู้ด้านพิธีสังเวย, การจัดการกับเงาและเนื้อหนัง, และการกลืนกินวิญญาณผู้อื่นเพื่อใช้ความสามารถ',
    images: [
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771321294/unnamed_2_a0gbab.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771653430/rose_bishop_hdi9im.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771653435/shepperd_e9mkl5.jpg',
    ],
  },
  {
    id: 'reader',
    name: 'เส้นทางนักอ่าน',
    nameEn: 'Reader / White Tower',
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771321966/reader-logo_f9hqqv.webp',
    highlight:
      'เป็นตัวแทนแห่งการแสวงหาความรู้ทั้งทางวิทยาศาสตร์และเวทมนตร์ เน้นการวิเคราะห์และเลียนแบบ',
    skills:
      'เสริมความสามารถทางจิตใจ (วิเคราะห์, ความจำ), การใช้เหตุผลเชิงตรรกะ, และการเลียนแบบพลังของผู้อื่นผ่านการวิเคราะห์',
    images: [
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771321926/white_tower_seq_8_kx9f68.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771653234/white_tower_seq_3_rifxqy.jpg',
      'https://res.cloudinary.com/dehp6efwc/image/upload/v1771653237/white_tower_seq_6_v4_dxr5hh.jpg',
    ],
  },
]
