'use client'

import { useState, useEffect } from 'react'
import { EmbedButton } from '@/components/embed-button'

/* ──────────────────────────────────────────────────────────────
   Church Data
─────────────────────────────────────────────────────────────── */
type Doctrine = { title: string; body: string }

interface Church {
  id: string
  name: string
  nameEn: string
  god: string
  godEn: string
  intro: string
  doctrines: Doctrine[]
  logo: string
  bg: string
  /* Tailwind token sets — kept as plain strings for PurgeCSS */
  accent: string          // e.g. 'purple'
  colors: ChurchColors
}

interface ChurchColors {
  heroBg: string           // gradient overlay on hero
  heroBorder: string       // hero card border
  logoRing: string         // ring around logo
  badgeBg: string          // intro badge background
  badgeBorder: string      // intro badge border
  badgeText: string        // intro badge text
  docBg: string            // doctrine card bg
  docBorder: string        // doctrine card border
  docNum: string           // doctrine number chip
  docNumText: string       // doctrine number text
  titleText: string        // church name text
  labelText: string        // small label text
  divider: string          // horizontal rule colour
  tabActive: string        // selected tab bg
  tabActiveBorder: string  // selected tab border
  tabActiveText: string    // selected tab text
  tabHover: string         // tab hover
}

const CHURCHES: Church[] = [
  /* ── 1. Church of the Fool ─────────────────────────────── */
  {
    id: 'fool',
    name: 'โบสถ์คนโง่',
    nameEn: 'Church of the Fool',
    god: 'เดอะฟูล',
    godEn: 'The Fool',
    intro:
      'เดอะฟูลจากต่างยุคสมัย ผู้ปกครองลึกลับเหนือสายหมอกสีเทา ราชันเหลืองดำผู้ครองพลังโชคลาภ',
    doctrines: [
      {
        title: 'ความพากเพียรและหัวใจ',
        body: '"จงปรนนิบัติเราด้วยใจ มิใช่ด้วยสิ่งของเครื่องถวาย" — ความร่ำรวยของเครื่องบูชาไม่สำคัญเท่าความซื่อสัตย์และความจงรักภักดีจากก้นบึ้งของจิตใจ',
      },
      {
        title: 'ศีลห้า',
        body: 'ห้ามการสังเวยด้วยมนุษย์ ห้ามประพฤติผิดในกาม ห้ามฆ่าผู้บริสุทธิ์ และเน้นการช่วยเหลือเพื่อนร่วมชาติในยามยาก',
      },
      {
        title: 'ความเท่าเทียมในโชคชะตา',
        body: 'มนุษย์ทุกคนต่างเล็กจ้อยเมื่ออยู่ต่อหน้าชะตากรรม ควรมีความยำเกรงต่อกฎแห่งกรรม และไม่หยิ่งยะโสในโชคที่ได้รับ',
      },
    ],
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1770704124/Sacred_Emblem_-_Church_of_the_Fool2_xozvyn.webp',
    bg: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1770704166/fool_3_rkawkr.jpg',
    accent: 'purple',
    colors: {
      heroBg: 'from-purple-950/90 via-gray-950/80 to-transparent',
      heroBorder: 'border-purple-700/40',
      logoRing: 'ring-purple-600/50',
      badgeBg: 'bg-purple-950/60',
      badgeBorder: 'border-purple-700/40',
      badgeText: 'text-purple-200',
      docBg: 'bg-purple-950/25',
      docBorder: 'border-purple-700/30',
      docNum: 'bg-purple-900/60 border-purple-600/40',
      docNumText: 'text-purple-300',
      titleText: 'text-purple-200',
      labelText: 'text-purple-400/70',
      divider: 'bg-purple-700/20',
      tabActive: 'bg-purple-950/70',
      tabActiveBorder: 'border-purple-600/60',
      tabActiveText: 'text-purple-200',
      tabHover: 'hover:bg-purple-950/40 hover:text-purple-300',
    },
  },

  /* ── 2. Church of Eternal Darkness ─────────────────────── */
  {
    id: 'darkness',
    name: 'โบสถ์อันธกาลนิรันดิ์',
    nameEn: 'Church of the Eternal Darkness',
    god: 'เทพีรัติกาล',
    godEn: 'Evernight Goddess',
    intro:
      'พระองค์สถิตอยู่สูงยิ่งกว่าอวกาศ และนิรันดร์ยิ่งกว่านิรันดร์ ทรงเป็นสตรีสีชาด มารดาแห่งการปกปิด จักพรรดินีแห่งอัปโชคและความสยองขวัญ นายหญิงแห่งการพักผ่อนและความเงียบงัน',
    doctrines: [
      {
        title: 'ความเท่าเทียมระหว่างเพศ',
        body: 'ชายและหญิงมีความเท่าเทียมกัน พึงช่วยเหลือเกื้อกูลกันทั้งในสังคมและครอบครัว ไม่มีผู้ใดสูงส่งหรือต่ำต้อยในสายพระเนตรของเทพี',
      },
      {
        title: 'ความรักต่อผู้ยากไร้',
        body: 'พระองค์ทรงเป็นที่พึ่งของผู้ที่ขาดแคลนเสื้อผ้า อาหาร และที่พักพิง สาวกต้องมอบความรักและไม่ทอดทิ้งคนยากจนที่ถูกบีบให้ออกจากเส้นทางที่ถูกต้อง',
      },
      {
        title: 'ความตายคือการพักผ่อน',
        body: '"ความตายไม่ใช่จุดจบ" แต่เปรียบเสมือนการเข้าสู่การพักผ่อนอย่างสงบภายใต้การเฝ้ามองของเทพี พระองค์จะทรงปกป้องดวงวิญญาณของผู้ล่วงลับในยามค่ำคืน',
      },
      {
        title: 'สถาบันครอบครัว',
        body: 'ทรงสนับสนุนการแต่งงานและการมีชีวิตครอบครัวที่ปกติสุข สมาชิกในครอบครัวต้องดูแลกันและกันตามคำสอนของพระองค์',
      },
      {
        title: 'การขจัดภัยทางจิต',
        body: 'การอธิษฐานต่อพระองค์จะช่วยขจัดความเครียดและรักษาภาวะจิตใจที่สั่นคลอนจากการเผชิญกับโลกที่วุ่นวาย',
      },
    ],
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1770698832/Sacred_Emblem_-_Church_of_the_Evernight_Goddess2_1_zb3dpt.webp',
    bg: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1770699103/darkness_euxpng.jpg',
    accent: 'red',
    colors: {
      heroBg: 'from-black/95 via-red-950/60 to-transparent',
      heroBorder: 'border-red-900/50',
      logoRing: 'ring-red-700/50',
      badgeBg: 'bg-red-950/50',
      badgeBorder: 'border-red-800/50',
      badgeText: 'text-red-200',
      docBg: 'bg-red-950/20',
      docBorder: 'border-red-800/30',
      docNum: 'bg-red-900/50 border-red-700/40',
      docNumText: 'text-red-300',
      titleText: 'text-red-200',
      labelText: 'text-red-400/70',
      divider: 'bg-red-800/25',
      tabActive: 'bg-red-950/70',
      tabActiveBorder: 'border-red-700/60',
      tabActiveText: 'text-red-200',
      tabHover: 'hover:bg-red-950/40 hover:text-red-300',
    },
  },

  /* ── 3. Church of the Earth Mother ─────────────────────── */
  {
    id: 'earth',
    name: 'โบสถ์พระแม่ธรณี',
    nameEn: 'Church of the Earth Mother',
    god: 'พระแม่ธรณี',
    godEn: 'Earth Mother',
    intro:
      'สรรเสริญมารดาแห่งสรรพสิ่ง! สรรเสริญต้นกำเนิดแห่งชีวิต! พระองค์ทรงเป็นผู้มอบความอุดมสมบูรณ์และนำทางจิตวิญญาณให้กลับคืนสู่ผืนดิน',
    doctrines: [
      {
        title: 'คุณค่าของชีวิต',
        body: 'ทรงสั่งสอนให้สาวกเห็นคุณค่าของทุกชีวิตและต่อต้านการใช้ความรุนแรงโดยไม่จำเป็น ทุกสรรพสิ่งล้วนบริสุทธิ์ในสายพระเนตรของแม่ธรณี',
      },
      {
        title: 'วัฏจักรแห่งปฐพี',
        body: '"ทุกชีวิตและทุกสรรพสิ่งล้วนมีจุดจบ และจะกลับคืนสู่ดินเพื่อเป็นปุ๋ยให้กับการเกิดใหม่" — ยอมรับความตายว่าเป็นส่วนหนึ่งของการหลับใหลในอ้อมกอดของมารดา',
      },
      {
        title: 'ความปีติแห่งการเก็บเกี่ยว',
        body: 'ความสำเร็จมาจากการบ่มเพาะอย่างอดทนและการทำงานที่สอดคล้องกับธรรมชาติ มิใช่จากการแย่งชิงหรือกดขี่',
      },
      {
        title: 'ความเท่าเทียมและสันติธรรม',
        body: 'ศาสนจักรสนับสนุนการช่วยเหลือเกื้อกูลกันและการเป็นที่พึ่งให้กับผู้ที่หลงทาง ดุจดังรากไม้ที่ค้ำจุนกันและกัน',
      },
    ],
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1770703342/Sacred_Emblem_-_Church_of_the_Earth_Mother2_gdille.webp',
    bg: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1770703338/moon_wnbmaa.jpg',
    accent: 'emerald',
    colors: {
      heroBg: 'from-emerald-950/90 via-green-950/70 to-transparent',
      heroBorder: 'border-emerald-700/40',
      logoRing: 'ring-emerald-600/50',
      badgeBg: 'bg-emerald-950/50',
      badgeBorder: 'border-emerald-700/40',
      badgeText: 'text-emerald-100',
      docBg: 'bg-emerald-950/20',
      docBorder: 'border-emerald-700/30',
      docNum: 'bg-emerald-900/50 border-emerald-600/40',
      docNumText: 'text-emerald-300',
      titleText: 'text-emerald-200',
      labelText: 'text-emerald-400/70',
      divider: 'bg-emerald-700/20',
      tabActive: 'bg-emerald-950/70',
      tabActiveBorder: 'border-emerald-600/60',
      tabActiveText: 'text-emerald-200',
      tabHover: 'hover:bg-emerald-950/40 hover:text-emerald-300',
    },
  },

  /* ── 4. Church of the Lord of Storms ───────────────────── */
  {
    id: 'storms',
    name: 'โบสถ์เทพวายุสลาตัน',
    nameEn: 'Church of the Lord of Storms',
    god: 'เทพวายุสลาตัน',
    godEn: 'Lord of Storms',
    intro:
      'พระองค์ทรงเป็นราชันแห่งท้องฟ้า จักรพรรดิแห่งท้องทะเล เจ้าแห่งมหันตภัย และเทพเจ้าแห่งพายุ ทรงเป็น "ทรราช" ผู้ปกครองเหนือมวลน้ำและสายฟ้าทั้งปวง',
    doctrines: [
      {
        title: 'ความยำเกรงต่ออำนาจ',
        body: 'ความศรัทธาเริ่มต้นจากความกลัวและความเคารพในพลังอันยิ่งใหญ่ของธรรมชาติและเทพเจ้า ผู้ที่ไม่ยำเกรงย่อมพบกับความพินาศ',
      },
      {
        title: 'บทบาทที่ชัดเจน',
        body: 'ผู้ชายควรเป็นแรงหลักในการทำงานนอกบ้านและปกป้องครอบครัว ส่วนผู้หญิงคือ "เทวดาผู้สนับสนุน" ที่คอยดูแลความเรียบร้อยภายในบ้าน',
      },
      {
        title: 'ความเด็ดขาดและรวดเร็ว',
        body: 'เหล่าสาวกมักมีบุคลิกที่ใจร้อน มุทะลุ และยึดมั่นในการลงมือทำอย่างเด็ดขาด ลังเลคือความตาย',
      },
      {
        title: 'เผชิญหน้ากับความท้าทาย',
        body: 'ศาสนจักรยกย่องความกล้าหาญในการเผชิญหน้ากับอุปสรรคและการต่อสู้เพื่อรักษาเกียรติยศ หนีคือความละอาย',
      },
      {
        title: 'คุ้มครองนักเดินทาง',
        body: 'การสวดอ้อนวอนต่อพระองค์จะช่วยให้การเดินเรือปลอดภัยจากสัตว์ร้ายและพายุ นักเดินเรือทุกคนพกรูปปั้นพระองค์ติดตัว',
      },
    ],
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1770699501/Sacred_Emblem_-_Church_of_the_Lord_of_Storms2_spiyzk.webp',
    bg: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1770699514/the_tyrrant_xa11dj.jpg',
    accent: 'blue',
    colors: {
      heroBg: 'from-blue-950/90 via-slate-950/75 to-transparent',
      heroBorder: 'border-blue-700/40',
      logoRing: 'ring-blue-600/50',
      badgeBg: 'bg-blue-950/55',
      badgeBorder: 'border-blue-700/45',
      badgeText: 'text-blue-100',
      docBg: 'bg-blue-950/20',
      docBorder: 'border-blue-700/30',
      docNum: 'bg-blue-900/50 border-blue-600/40',
      docNumText: 'text-blue-300',
      titleText: 'text-blue-200',
      labelText: 'text-blue-400/70',
      divider: 'bg-blue-700/20',
      tabActive: 'bg-blue-950/70',
      tabActiveBorder: 'border-blue-600/60',
      tabActiveText: 'text-blue-200',
      tabHover: 'hover:bg-blue-950/40 hover:text-blue-300',
    },
  },

  /* ── 5. Church of the Eternal Blazing Sun ──────────────── */
  {
    id: 'sun',
    name: 'โบสถ์สุริยันเจิดจรัส',
    nameEn: 'Church of the Eternal Blazing Sun',
    god: 'องค์สุริยันเจิดจรัส',
    godEn: 'Eternal Blazing Sun',
    intro:
      'พระองค์ทรงเป็นแสงสว่างที่ไม่มีวันดับมอด ร่างอวตารแห่งระเบียบ ผู้พิทักษ์สัญญา และเทพแห่งธุรกิจ ทรงเป็นดวงตะวันเพียงหนึ่งเดียวที่ขจัดปัดเป่าความชั่วร้ายทั้งปวง',
    doctrines: [
      {
        title: 'ความซื่อสัตย์คือหัวใจ',
        body: 'พระองค์ทรงเป็นเทพแห่งสัญญา เหล่าสาวกจึงต้องรักษาคำพูดและดำเนินธุรกิจอย่างเป็นธรรม การผิดสัญญาคือบาปที่ยกโทษไม่ได้',
      },
      {
        title: 'ความดุดันต่อความมืด',
        body: 'ศาสนจักรจะไม่ประนีประนอมต่อสิ่งชั่วร้ายและลัทธินอกรีต โดยเน้นการ "ชำระล้าง" (Purification) ให้สิ้นซาก',
      },
      {
        title: 'ความรุ่งโรจน์และสง่างาม',
        body: 'ผู้ศรัทธามักมีบุคลิกที่มั่นใจ หยิ่งทะนงในศักดิ์ศรี และให้ความสำคัญกับภาพลักษณ์ที่ดูดีและสะอาดสะอ้าน',
      },
      {
        title: 'จารีตนิยม',
        body: 'ยังคงยึดถือโครงสร้างทางสังคมแบบดั้งเดิมที่เน้นระเบียบวินัยและความกตัญญู ต้านทานการเปลี่ยนแปลงที่ไม่จำเป็น',
      },
    ],
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1770703157/Sacred_Emblem_-_Church_of_the_Eternal_Blazing_Sun2_d0b0xc.webp',
    bg: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1770703215/sun_seq_2_v2_oebsiv.jpg',
    accent: 'amber',
    colors: {
      heroBg: 'from-amber-950/90 via-yellow-950/70 to-transparent',
      heroBorder: 'border-amber-600/40',
      logoRing: 'ring-amber-500/50',
      badgeBg: 'bg-amber-950/55',
      badgeBorder: 'border-amber-600/45',
      badgeText: 'text-amber-100',
      docBg: 'bg-amber-950/20',
      docBorder: 'border-amber-700/30',
      docNum: 'bg-amber-900/50 border-amber-600/40',
      docNumText: 'text-amber-300',
      titleText: 'text-amber-200',
      labelText: 'text-amber-400/70',
      divider: 'bg-amber-700/20',
      tabActive: 'bg-amber-950/70',
      tabActiveBorder: 'border-amber-500/60',
      tabActiveText: 'text-amber-200',
      tabHover: 'hover:bg-amber-950/40 hover:text-amber-300',
    },
  },

  /* ── 6. Church of Steam & Machinery ────────────────────── */
  {
    id: 'steam',
    name: 'โบสถ์เทพจักรกลไอน้ำ',
    nameEn: 'Church of the God of Steam and Machinery',
    god: 'เทพจักรกลไอน้ำ',
    godEn: 'God of Steam and Machinery',
    intro:
      'พระองค์ทรงเป็นรากฐานของอารยธรรม ปราชญ์ผู้รอบรู้ทุกสรรพสิ่ง และหัวใจแห่งเครื่องจักรทั้งมวล ทรงเป็นเทพแห่งไอน้ำและกลไก ผู้ขับเคลื่อนความก้าวหน้าของมนุษยชาติ',
    doctrines: [
      {
        title: 'ความรู้คือพลัง',
        body: 'การแสวงหาความรู้คือการเข้าใกล้พระเจ้า ผู้ศรัทธาต้องหมั่นศึกษาและพัฒนาตนเองอยู่เสมอ ไม่มีวันใดที่ไม่ได้เรียนรู้สิ่งใหม่',
      },
      {
        title: 'การทำงานและอุตสาหะ',
        body: 'ความสำเร็จไม่ได้มาจากปาฏิหาริย์เพียงอย่างเดียว แต่มาจากความขยัน การคำนวณที่แม่นยำ และความประณีตในงานช่าง',
      },
      {
        title: 'การเปิดรับสิ่งใหม่',
        body: 'ทรงสอนให้เหล่าสาวกกล้าที่จะท้าทายความเชื่อเก่า ๆ และนำวิทยาการใหม่ ๆ มาปรับใช้เพื่อประโยชน์ของสังคม',
      },
      {
        title: 'ความสำคัญของข้อมูล',
        body: 'การบันทึกและการจดจำคือหัวใจสำคัญของความก้าวหน้า ผู้วิเศษในเส้นทางนี้จะมีความทรงจำและทักษะการเรียนรู้ที่เหนือมนุษย์',
      },
    ],
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1770699754/Sacred_Emblem_-_Church_of_the_God_of_Steam_and_Machinery2_owiunw.webp',
    bg: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1770699794/paragon_qknpel.jpg',
    accent: 'slate',
    colors: {
      heroBg: 'from-slate-950/95 via-zinc-900/80 to-transparent',
      heroBorder: 'border-slate-500/40',
      logoRing: 'ring-slate-400/40',
      badgeBg: 'bg-slate-900/60',
      badgeBorder: 'border-slate-500/40',
      badgeText: 'text-slate-100',
      docBg: 'bg-slate-900/25',
      docBorder: 'border-slate-600/30',
      docNum: 'bg-slate-800/60 border-slate-500/40',
      docNumText: 'text-slate-300',
      titleText: 'text-slate-200',
      labelText: 'text-slate-400/70',
      divider: 'bg-slate-600/25',
      tabActive: 'bg-slate-900/70',
      tabActiveBorder: 'border-slate-500/60',
      tabActiveText: 'text-slate-200',
      tabHover: 'hover:bg-slate-900/40 hover:text-slate-300',
    },
  },

  /* ── 7. Church of Knowledge & Wisdom ───────────────────── */
  {
    id: 'knowledge',
    name: 'โบสถ์เทพปัญญาความรู้',
    nameEn: 'Church of the God of Knowledge and Wisdom',
    god: 'เทพปัญญาความรู้',
    godEn: 'God of Knowledge and Wisdom',
    intro:
      'พระองค์ทรงเป็นเนตรรู้แจ้งผู้มองเห็นความจริงของจักรวาล ปราชญ์ผู้รวบรวมทุกศาสตร์และศิลป์ และประภาคารแห่งปัญญาผู้ขจัดเมฆหมอกแห่งความโง่เขลา ทรงเป็น "หอคอยสีขาว" ผู้พิทักษ์ความรู้ทั้งมวล',
    doctrines: [
      {
        title: 'ความรู้คือวิถีแห่งเทพ',
        body: 'การเรียนรู้และการเข้าใจกฎเกณฑ์ของโลกคือวิถีแห่งการเข้าใกล้เทพเจ้า ผู้ไม่แสวงหาความรู้ย่อมอยู่ห่างจากพระองค์เสมอ',
      },
      {
        title: 'สัพพัญญูเท่ากับสัพพะอานุภาพ',
        body: 'การรู้แจ้งในทุกสรรพสิ่งจะนำมาซึ่งอำนาจที่ไร้ขีดจำกัด ผู้ที่รู้ย่อมมีชัยเหนือผู้ที่แข็งแกร่งแต่ไม่รู้',
      },
      {
        title: 'การสังเกตอย่างเป็นกลาง',
        body: 'ทรงสอนให้เหล่าสาวกมองโลกด้วยสายตาของนักอ่านและนักวิเคราะห์ ไม่ปล่อยให้อารมณ์มาบดบังข้อเท็จจริง',
      },
      {
        title: 'การบันทึกและรวบรวม',
        body: 'การรวบรวมหลักฐานและข้อมูลคือพื้นฐานของการแก้ปัญหาทุกรูปแบบ ห้องสมุดคือวิหารศักดิ์สิทธิ์ที่สุดของศาสนจักร',
      },
    ],
    logo: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1770703801/Sacred_Emblem_-_Church_of_the_God_of_Knowledge_and_Wisdom2_ap4pzu.webp',
    bg: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1770704000/white_tower2_mgfpjt.webp',
    accent: 'stone',
    colors: {
      heroBg: 'from-stone-950/90 via-amber-950/50 to-transparent',
      heroBorder: 'border-amber-800/40',
      logoRing: 'ring-amber-700/40',
      badgeBg: 'bg-stone-900/60',
      badgeBorder: 'border-amber-800/40',
      badgeText: 'text-amber-100',
      docBg: 'bg-stone-900/30',
      docBorder: 'border-amber-800/25',
      docNum: 'bg-stone-800/60 border-amber-700/40',
      docNumText: 'text-amber-300',
      titleText: 'text-amber-200',
      labelText: 'text-amber-500/70',
      divider: 'bg-amber-800/20',
      tabActive: 'bg-stone-900/70',
      tabActiveBorder: 'border-amber-700/50',
      tabActiveText: 'text-amber-200',
      tabHover: 'hover:bg-stone-900/40 hover:text-amber-300',
    },
  },
]

/* ──────────────────────────────────────────────────────────────
   Main Component
─────────────────────────────────────────────────────────────── */
export default function ReligionsClient() {
  const [activeId, setActiveId] = useState<string>(CHURCHES[0].id)
  const [imgError, setImgError] = useState<Record<string, boolean>>({})

  const church = CHURCHES.find((c) => c.id === activeId)!
  const c = church.colors

  // scroll to top of content when changing tab
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeId])

  const handleImgError = (id: string) =>
    setImgError((prev) => ({ ...prev, [id]: true }))

  return (
    <div className="space-y-8">
      {/* ── Page header ────────────────────────────────── */}
      <div>
        <p className="text-[10px] tracking-[0.3em] uppercase text-gold-500/60 font-display mb-3">
          เรื่องราว / Lore
        </p>
        <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
          <h1 className="text-2xl sm:text-3xl font-display text-nouveau-cream tracking-wide">
            ✦ ศาสนาจารีตทั้ง 7 ✦
          </h1>
          <div className="mt-1">
            <EmbedButton embedPath="/embed/religions" label="Embed" />
          </div>
        </div>
        <p className="text-victorian-400 text-sm leading-relaxed max-w-2xl">
          ศาสนาที่เป็นที่ยอมรับและนับถือของผู้คนในทวีป — องค์กรที่มีระบบซับซ้อนและใหญ่โตเทียบเคียงได้กับราชวงศ์
          แต่ละศาสนามีจารีตประเพณีและหลักปฏิบัติที่แตกต่างกันไป
        </p>
        <div className="h-px bg-gold-700/20 mt-6" />
      </div>

      {/* ── Church tab bar ─────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {CHURCHES.map((ch, idx) => {
          const isActive = ch.id === activeId
          const cc = ch.colors
          return (
            <button
              key={ch.id}
              onClick={() => setActiveId(ch.id)}
              className={[
                'group flex items-center gap-2 px-3 py-2 rounded-sm border text-xs font-display tracking-wide transition-all duration-200 cursor-pointer',
                isActive
                  ? `${cc.tabActive} ${cc.tabActiveBorder} ${cc.tabActiveText}`
                  : `bg-victorian-900/30 border-victorian-700/25 text-victorian-400 ${cc.tabHover}`,
              ].join(' ')}
            >
              {/* church logo mini */}
              {!imgError[ch.id] ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={ch.logo}
                  alt={ch.name}
                  onError={() => handleImgError(ch.id)}
                  className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <span className="w-5 h-5 rounded-full bg-victorian-800 flex-shrink-0" />
              )}
              <span className="hidden sm:inline">{ch.name}</span>
              <span className={[
                'w-4 h-4 rounded-full text-[9px] flex items-center justify-center flex-shrink-0 font-display',
                isActive ? 'bg-white/10' : 'bg-victorian-800/50',
              ].join(' ')}>
                {idx + 1}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Church detail card ─────────────────────────── */}
      <div className={`rounded border overflow-hidden ${c.heroBorder}`}>

        {/* Hero banner */}
        <div className="relative h-52 sm:h-64 overflow-hidden">
          {!imgError[`bg-${church.id}`] ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={church.bg}
              alt={church.name}
              onError={() => handleImgError(`bg-${church.id}`)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-victorian-900" />
          )}
          {/* gradient overlay */}
          <div className={`absolute inset-0 bg-gradient-to-r ${c.heroBg}`} />

          {/* Logo + name overlay */}
          <div className="absolute inset-0 flex items-end p-5 sm:p-7">
            <div className="flex items-end gap-4">
              {!imgError[`logo-${church.id}`] ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={church.logo}
                  alt={`ตราสัญลักษณ์ ${church.name}`}
                  onError={() => handleImgError(`logo-${church.id}`)}
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover ring-2 ${c.logoRing} shadow-2xl flex-shrink-0`}
                />
              ) : (
                <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full ring-2 ${c.logoRing} bg-victorian-900 flex-shrink-0`} />
              )}
              <div>
                <p className={`text-[10px] font-display tracking-[0.25em] uppercase mb-0.5 ${c.labelText}`}>
                  Orthodox Church · ลำดับที่ {CHURCHES.findIndex(ch => ch.id === activeId) + 1}
                </p>
                <h2 className={`text-xl sm:text-2xl font-display leading-tight ${c.titleText}`}>
                  {church.name}
                </h2>
                <p className="text-victorian-400 text-xs mt-0.5 font-display tracking-wider">
                  {church.nameEn}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-7 space-y-6 bg-victorian-950/60">

          {/* God info row */}
          <div className="flex flex-wrap gap-3">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-sm border text-xs font-display tracking-wide ${c.badgeBg} ${c.badgeBorder} ${c.badgeText}`}>
              <span className="opacity-60">เทพเจ้า</span>
              <span className="text-white/80">{church.god}</span>
              <span className="opacity-40">·</span>
              <span className="opacity-60 italic">{church.godEn}</span>
            </div>
          </div>

          {/* Intro */}
          <div>
            <p className={`text-[10px] font-display tracking-[0.2em] uppercase mb-2 ${c.labelText}`}>
              คำแนะนำ
            </p>
            <div className={`border-l-2 ${c.docBorder.replace('border-', 'border-l-')} pl-4`}>
              <p className="text-victorian-200 text-sm leading-relaxed italic">
                &ldquo;{church.intro}&rdquo;
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className={`h-px ${c.divider}`} />

          {/* Doctrines */}
          <div>
            <p className={`text-[10px] font-display tracking-[0.2em] uppercase mb-4 ${c.labelText}`}>
              หลักคำสอน — Doctrine
            </p>
            <div className="space-y-3">
              {church.doctrines.map((doc, i) => (
                <div
                  key={i}
                  className={`rounded-sm border p-4 ${c.docBg} ${c.docBorder}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex-shrink-0 w-6 h-6 rounded-sm border text-[11px] font-display
                                  flex items-center justify-center mt-0.5 ${c.docNum} ${c.docNumText}`}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p className={`text-xs font-display tracking-wide mb-1.5 ${c.docNumText}`}>
                        {doc.title}
                      </p>
                      <p className="text-victorian-300 text-sm leading-relaxed">
                        {doc.body}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Overview grid ──────────────────────────────── */}
      <div>
        <div className="h-px bg-gold-700/20 mb-6" />
        <p className="text-[10px] font-display tracking-[0.2em] uppercase text-victorian-400 mb-4">
          ภาพรวมทุกศาสนา
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {CHURCHES.map((ch, idx) => {
            const isActive = ch.id === activeId
            const cc = ch.colors
            return (
              <button
                key={ch.id}
                onClick={() => setActiveId(ch.id)}
                className={[
                  'group text-left rounded-sm border p-3 transition-all duration-200 cursor-pointer',
                  isActive
                    ? `${cc.tabActive} ${cc.tabActiveBorder}`
                    : `bg-victorian-900/30 border-victorian-700/20 hover:border-victorian-600/40`,
                ].join(' ')}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  {!imgError[ch.id] ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={ch.logo}
                      alt={ch.name}
                      onError={() => handleImgError(ch.id)}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-victorian-800 flex-shrink-0" />
                  )}
                  <span className={`text-[10px] font-display tracking-widest ${cc.labelText}`}>
                    #{idx + 1}
                  </span>
                </div>
                <p className={`text-xs font-display leading-snug ${isActive ? cc.titleText : 'text-victorian-300 group-hover:text-nouveau-cream'} transition-colors`}>
                  {ch.name}
                </p>
                <p className="text-[10px] text-victorian-500 mt-0.5 leading-snug">{ch.godEn}</p>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
