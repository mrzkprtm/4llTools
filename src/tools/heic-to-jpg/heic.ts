/** Pure helpers for the HEIC converter. */

const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']

const ascii = (b: Uint8Array, from: number, len: number) => String.fromCharCode(...b.subarray(from, from + len))

/**
 * Checks the ISO-BMFF "ftyp" box for a HEIF/HEIC brand.
 * Returns 'heic', 'avif' (also HEIF-based, but browsers open it natively) or null.
 */
export function detectHeif(bytes: Uint8Array): 'heic' | 'avif' | null {
  if (bytes.length < 16 || ascii(bytes, 4, 4) !== 'ftyp') return null
  const size = Math.min(bytes.length, (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3] || 32)
  const brands = [ascii(bytes, 8, 4)]
  for (let i = 16; i + 4 <= size; i += 4) brands.push(ascii(bytes, i, 4))
  if (brands.some((b) => b === 'avif' || b === 'avis')) return 'avif'
  return brands.some((b) => HEIF_BRANDS.includes(b)) ? 'heic' : null
}

export const looksLikeHeicName = (name: string) => /\.(heic|heif|hif)$/i.test(name)

export type OutType = 'image/jpeg' | 'image/png'

/** "IMG_1234.HEIC" → "IMG_1234.jpg", adding "-2", "-3"… when the name is taken. */
export function outputName(name: string, type: OutType, taken: Set<string>): string {
  const base = name.replace(/\.[^./\\]+$/, '') || 'photo'
  const ext = type === 'image/png' ? 'png' : 'jpg'
  let candidate = `${base}.${ext}`
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${base}-${n}.${ext}`
  taken.add(candidate.toLowerCase())
  return candidate
}

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(2)} MB`)

/** Friendly text for errors thrown by heic2any or the browser decoder. */
export function friendlyError(err: unknown): string {
  const raw = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err ?? '')
  const code = err && typeof err === 'object' && 'code' in err ? Number((err as { code: unknown }).code) : NaN
  if (code === 1 || /not supported|ERR_USER/i.test(raw)) return 'This file is not a HEIC/HEIF image (or uses a HEIF variant the converter does not support).'
  if (/memory|allocation|RangeError/i.test(raw)) return 'The device ran out of memory decoding this photo. Try converting it on its own or on a computer.'
  if (code === 2 || /LIBHEIF|decode/i.test(raw)) return 'The image data could not be decoded. The file may be damaged or use an unsupported codec.'
  return raw || 'Conversion failed.'
}
