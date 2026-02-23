export interface ReligionData {
  id: string
  name_th: string
  name_en: string
  logo_url: string | null
  /** HSL accent for theming the character card */
  hue: number
  saturation: number
  lightness: number
}

/**
 * Static religion data for the character creator (standalone, no DB needed).
 * Colors are based on each religion's thematic identity.
 */
export const RELIGIONS: ReligionData[] = [
  {
    id: 'none',
    name_th: 'ไม่มีศาสนา',
    name_en: 'None',
    logo_url: null,
    hue: 38,
    saturation: 60,
    lightness: 42,
  },
  {
    id: 'fool',
    name_th: 'โบสถ์คนโง่',
    name_en: 'Church of the Fool',
    logo_url: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1770612457/Fool_Symbol2_ydvwem.webp',
    hue: 38,
    saturation: 82,
    lightness: 48,
  },
  {
    id: 'darkness',
    name_th: 'โบสถ์อันธกาลนิรันดิ์',
    name_en: 'Evernight Goddess',
    logo_url: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771386173/Darkness_Symbol2_qzs7t2.webp',
    hue: 260,
    saturation: 45,
    lightness: 38,
  },
  {
    id: 'earth-mother',
    name_th: 'โบสถ์พระแม่ธรณี',
    name_en: 'Mother Earth',
    logo_url: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771407637/Mother_Symbol2_afdigd.webp',
    hue: 120,
    saturation: 35,
    lightness: 35,
  },
  {
    id: 'wind',
    name_th: 'โบสถ์เทพวายุสลาตัน',
    name_en: 'Lord of Storms',
    logo_url: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1770619961/Tyrant_Symbol2_osgium.webp',
    hue: 200,
    saturation: 50,
    lightness: 40,
  },
  {
    id: 'sun',
    name_th: 'โบสถ์สุริยันเจิดจรัส',
    name_en: 'God of Combat / Eternal Blazing Sun',
    logo_url: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1770783110/Sun_Symbol2_smeglb.webp',
    hue: 30,
    saturation: 85,
    lightness: 50,
  },
  {
    id: 'steam',
    name_th: 'โบสถ์เทพจักรกลไอน้ำ',
    name_en: 'God of Steam & Machinery',
    logo_url: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771389559/Paragon_Symbol2_y8cucj.webp',
    hue: 35,
    saturation: 30,
    lightness: 45,
  },
  {
    id: 'knowledge',
    name_th: 'โบสถ์เทพปัญญาความรู้',
    name_en: 'God of Knowledge & Wisdom',
    logo_url: 'https://res.cloudinary.com/dehp6efwc/image/upload/v1771321966/reader-logo_f9hqqv.webp',
    hue: 210,
    saturation: 40,
    lightness: 45,
  },
]
