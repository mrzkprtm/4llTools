/** Pure helpers for the favicon generator: ICO encoding, layout math, manifest and HTML snippet. */

export interface IcoImage {
  /** Width and height in pixels (1–256). */
  size: number
  /** A complete PNG file. */
  png: Uint8Array
}

/**
 * Bundles PNG images into one .ico file. Every modern browser and Windows
 * (Vista+) reads PNG-compressed ICO entries.
 */
export function encodeIco(images: IcoImage[]): Uint8Array<ArrayBuffer> {
  if (!images.length) throw new Error('An ICO file needs at least one image.')
  const headerSize = 6 + 16 * images.length
  const total = headerSize + images.reduce((n, im) => n + im.png.length, 0)
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)
  view.setUint16(0, 0, true) // reserved
  view.setUint16(2, 1, true) // type 1 = icon
  view.setUint16(4, images.length, true)
  let offset = headerSize
  images.forEach((im, i) => {
    if (!Number.isInteger(im.size) || im.size < 1 || im.size > 256) throw new Error(`Icon size ${im.size} is outside 1–256.`)
    const e = 6 + 16 * i
    out[e] = im.size === 256 ? 0 : im.size // width (0 means 256)
    out[e + 1] = im.size === 256 ? 0 : im.size // height
    out[e + 2] = 0 // palette colours
    out[e + 3] = 0 // reserved
    view.setUint16(e + 4, 1, true) // colour planes
    view.setUint16(e + 6, 32, true) // bits per pixel
    view.setUint32(e + 8, im.png.length, true)
    view.setUint32(e + 12, offset, true)
    out.set(im.png, offset)
    offset += im.png.length
  })
  return out
}

/** Reads the directory of an .ico file (used by the tests and as a self-check). */
export function readIco(data: Uint8Array): { size: number; bytes: number; offset: number; isPng: boolean }[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  if (data.length < 6 || view.getUint16(0, true) !== 0 || view.getUint16(2, true) !== 1) throw new Error('Not an ICO file.')
  const count = view.getUint16(4, true)
  const entries = []
  for (let i = 0; i < count; i++) {
    const e = 6 + 16 * i
    const bytes = view.getUint32(e + 8, true)
    const offset = view.getUint32(e + 12, true)
    if (offset + bytes > data.length) throw new Error('ICO entry points past the end of the file.')
    const isPng = data[offset] === 0x89 && data[offset + 1] === 0x50 && data[offset + 2] === 0x4e && data[offset + 3] === 0x47
    entries.push({ size: data[e] || 256, bytes, offset, isPng })
  }
  return entries
}

export type Fit = 'contain' | 'cover'

/** Where to draw a source image inside a square icon of `size` px, keeping `padding` (0–0.45 of the size) free on each side. */
export function fitSquare(srcW: number, srcH: number, size: number, padding: number, fit: Fit): { dx: number; dy: number; dw: number; dh: number } {
  const inner = size * (1 - 2 * Math.min(Math.max(padding, 0), 0.45))
  const scale = fit === 'contain' ? inner / Math.max(srcW, srcH) : inner / Math.min(srcW, srcH)
  const dw = srcW * scale
  const dh = srcH * scale
  return { dx: (size - dw) / 2, dy: (size - dh) / 2, dw, dh }
}

/**
 * Maskable icons are cropped by Android to a circle (or other shape) whose
 * guaranteed-visible safe zone is a centered circle with 40% radius, so
 * content should fit in the middle 80%.
 */
export const MASKABLE_SAFE = 0.8

export type Shape = 'square' | 'rounded' | 'circle'

export interface LetterIcon {
  text: string
  fg: string
  bg: string
  shape: Shape
  /** Font size relative to the icon (0.3–0.9). */
  scale: number
  bold: boolean
}

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
const EMOJI = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif"

export function letterFont(icon: LetterIcon, px: number): string {
  return `${icon.bold ? 700 : 500} ${Math.round(px)}px ${hasEmoji(icon.text) ? EMOJI : FONT}`
}

export function hasEmoji(text: string): boolean {
  return /\p{Extended_Pictographic}/u.test(text)
}

/** Keeps at most three visible characters (grapheme-ish: emoji sequences stay whole). */
export function clampText(text: string): string {
  return graphemes(text.trim()).slice(0, 3).join('')
}

/** Splits text into user-visible characters, keeping emoji sequences whole where Intl.Segmenter exists. */
export function graphemes(text: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter
  return Seg ? [...new Seg(undefined, { granularity: 'grapheme' }).segment(text)].map((s) => s.segment) : [...text]
}

export function shapeRadius(shape: Shape, size: number): number {
  return shape === 'circle' ? size / 2 : shape === 'rounded' ? size * 0.22 : 0
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A scalable favicon.svg for a letter/emoji icon. */
export function letterSvg(icon: LetterIcon): string {
  const text = clampText(icon.text) || '?'
  const r = shapeRadius(icon.shape, 100)
  const fontSize = Math.round(letterFontSize(icon, 100))
  const bg = icon.shape === 'circle'
    ? `<circle cx="50" cy="50" r="50" fill="${esc(icon.bg)}"/>`
    : `<rect width="100" height="100"${r ? ` rx="${r}"` : ''} fill="${esc(icon.bg)}"/>`
  const family = hasEmoji(text) ? EMOJI : FONT
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${bg}<text x="50" y="50" dy=".35em" text-anchor="middle" font-family="${esc(family)}" font-weight="${icon.bold ? 700 : 500}" font-size="${fontSize}" fill="${esc(icon.fg)}">${esc(text)}</text></svg>`
}

/** The font size (px) a letter icon uses at a given icon size. */
export function letterFontSize(icon: LetterIcon, size: number): number {
  const n = Math.min(3, graphemes(clampText(icon.text) || '?').length)
  return (size * icon.scale) / (n * 0.55 + 0.45)
}

export interface SiteInfo {
  name: string
  shortName: string
  themeColor: string
  backgroundColor: string
  /** Path prefix where the files will live, e.g. "/" or "/assets/icons/". */
  path: string
  hasSvg: boolean
}

export function normalizePath(p: string): string {
  let s = p.trim() || '/'
  if (!s.startsWith('/') && !/^https?:\/\//.test(s)) s = `/${s}`
  if (!s.endsWith('/')) s += '/'
  return s
}

export function buildManifest(site: SiteInfo): string {
  const p = normalizePath(site.path)
  return JSON.stringify(
    {
      name: site.name,
      short_name: site.shortName || site.name,
      icons: [
        { src: `${p}android-chrome-192x192.png`, sizes: '192x192', type: 'image/png' },
        { src: `${p}android-chrome-512x512.png`, sizes: '512x512', type: 'image/png' },
        { src: `${p}maskable-icon-512x512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      theme_color: site.themeColor,
      background_color: site.backgroundColor,
      display: 'standalone',
    },
    null,
    2,
  )
}

export function buildHtml(site: SiteInfo): string {
  const p = normalizePath(site.path)
  return [
    `<link rel="icon" href="${p}favicon.ico" sizes="48x48">`,
    site.hasSvg ? `<link rel="icon" href="${p}favicon.svg" type="image/svg+xml">` : `<link rel="icon" href="${p}favicon-32x32.png" type="image/png" sizes="32x32">`,
    `<link rel="apple-touch-icon" href="${p}apple-touch-icon.png">`,
    `<link rel="manifest" href="${p}site.webmanifest">`,
    `<meta name="theme-color" content="${esc(site.themeColor)}">`,
  ].join('\n')
}
