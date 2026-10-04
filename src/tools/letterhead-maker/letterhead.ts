/**
 * Header geometry for the Letterhead Maker. Pure functions only.
 * Sizes are page units; the preview uses a 794 × 1123 viewBox (A4 at 96 dpi).
 */

export const PAGE_W = 794
export const PAGE_H = 1123

export interface HeaderLayout {
  /** Left edge of the content column. */
  x: number
  /** Width of the content column. */
  width: number
  nameSize: number
  /** Baseline of the company name, measured from the top of the page. */
  nameY: number
  taglineSize: number
  taglineY: number
  addressSize: number
  /** Baseline of the first address line, right aligned to the content column. */
  addressY: number
  /** Vertical step between address lines. */
  lineHeight: number
  /** Baseline of the accent rule below the header. */
  ruleY: number
  /** Space between the rule and the first line of the letter. */
  ruleGap: number
  bodySize: number
  bodyTop: number
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Where everything in the header sits for a page of this size. */
export function headerLayout(pageW: number, pageH: number, margin: number, addressCount = 1): HeaderLayout {
  const width = Number.isFinite(pageW) ? Math.max(1, pageW) : 1
  const height = Number.isFinite(pageH) ? Math.max(1, pageH) : 1
  const limit = Math.min(width, height) / 2
  const m = clamp(Number.isFinite(margin) ? margin : 0, 0, limit)
  const count = Math.max(1, Math.floor(Number.isFinite(addressCount) ? addressCount : 1))

  const nameSize = clamp(Math.round(height * 0.028), 16, 48)
  const taglineSize = clamp(Math.round(height * 0.013), 9, 20)
  const addressSize = clamp(Math.round(height * 0.0115), 8, 18)
  const bodySize = clamp(Math.round(height * 0.012), 8, 18)
  const lineHeight = Math.round(addressSize * 1.45)

  const nameY = m + nameSize
  const taglineY = nameY + Math.max(10, Math.round(taglineSize * 1.7))
  const addressY = nameY
  const nameBlock = taglineY + taglineSize * 0.4
  const addressBlock = addressY + (count - 1) * lineHeight + addressSize * 0.35
  const ruleY = Math.round(Math.max(nameBlock, addressBlock) + height * 0.018)
  const ruleGap = Math.round(height * 0.045)

  return {
    x: Math.round(m),
    width: Math.round(width - 2 * m),
    nameSize,
    nameY: Math.round(nameY),
    taglineSize,
    taglineY: Math.round(taglineY),
    addressSize,
    addressY: Math.round(addressY),
    lineHeight,
    ruleY,
    ruleGap,
    bodySize,
    bodyTop: ruleY + ruleGap,
  }
}

/** One entry per non-empty line of the address block. */
export function addressLines(text: string): string[] {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Ink colour that stays readable on the given background. */
export function contrastText(hex: string): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex ?? '').trim())
  if (!m) return '#111111'
  const v = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1]
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  return luminance > 153 ? '#111111' : '#ffffff'
}
