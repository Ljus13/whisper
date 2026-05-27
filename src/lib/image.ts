/**
 * Cloudinary URL optimizer.
 *
 * The app stores raw Cloudinary delivery URLs (e.g.
 * `https://res.cloudinary.com/dehp6efwc/image/upload/v123/foo.png`) which are
 * served at full resolution with `no-transform` — a single AI-generated PNG can
 * be 6–9 MB. Inserting an `f_auto,q_auto,w_…` transformation segment right after
 * `/image/upload/` makes Cloudinary deliver an AVIF/WebP, auto-compressed, and
 * down-scaled variant — typically a >90% byte reduction.
 *
 * Non-Cloudinary URLs (Pinterest, Discord, postimg, data URLs, …) and Cloudinary
 * *video* URLs are returned unchanged. Already-transformed URLs are left alone so
 * we never double-transform.
 */

export interface CldOpts {
  /** Target CSS width in px. Cloudinary caps the longest side (c_limit) so it never upscales. */
  w?: number
  /** Target height in px. */
  h?: number
  /** Quality. Default `'auto'`. */
  q?: number | 'auto'
  /** Crop mode. Default `'limit'` (never upscales, preserves aspect). */
  crop?: 'limit' | 'fill' | 'fit' | 'thumb' | 'scale'
}

const UPLOAD = '/image/upload/'
// First path segment after /image/upload/ already carries a transform if it
// contains any of these param prefixes.
const HAS_TRANSFORM = /(^|,)(f_|q_|w_|h_|c_|dpr_|e_|g_|ar_|b_|bo_|r_)/

export function cldUrl<T extends string | null | undefined>(url: T, opts: CldOpts = {}): T {
  // Preserve falsy values exactly (null/undefined/'') so React/img behaviour is unchanged.
  if (!url) return url
  if (!url.includes('res.cloudinary.com') || !url.includes(UPLOAD)) return url

  const [head, tail] = url.split(UPLOAD)
  if (!tail) return url

  const firstSeg = tail.split('/')[0]
  if (HAS_TRANSFORM.test(firstSeg)) return url // already optimized — don't stack

  const t: string[] = ['f_auto', `q_${opts.q ?? 'auto'}`]
  if (opts.w) t.push(`w_${opts.w}`)
  if (opts.h) t.push(`h_${opts.h}`)
  t.push(`c_${opts.crop ?? 'limit'}`)

  return `${head}${UPLOAD}${t.join(',')}/${tail}` as T
}

/** Small round avatars / logos (~24–64px display, 2× for retina). */
export function cldAvatar<T extends string | null | undefined>(url: T): T {
  return cldUrl(url, { w: 128 })
}

/** Medium thumbnails / detail images. */
export function cldThumb<T extends string | null | undefined>(url: T): T {
  return cldUrl(url, { w: 480 })
}

/** Full-bleed backgrounds / large hero images. */
export function cldBg<T extends string | null | undefined>(url: T): T {
  return cldUrl(url, { w: 1280 })
}

/** Map background (image-based map canvas). Allows large but caps absurd sizes. */
export function cldMap<T extends string | null | undefined>(url: T): T {
  return cldUrl(url, { w: 1920 })
}
