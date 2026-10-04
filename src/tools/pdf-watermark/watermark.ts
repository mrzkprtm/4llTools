/**
 * Placement maths for the PDF Watermark tool.
 * PDF units are points (1/72 inch) and the origin is the bottom-left corner.
 */

export type WatermarkPosition = 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'tile'

export interface Position {
  id: WatermarkPosition
  label: string
}

export const POSITIONS: Position[] = [
  { id: 'center', label: 'Center' },
  { id: 'top-left', label: 'Top left' },
  { id: 'top-right', label: 'Top right' },
  { id: 'bottom-left', label: 'Bottom left' },
  { id: 'bottom-right', label: 'Bottom right' },
  { id: 'tile', label: 'Tiled across the page' },
]

/** Keeps an opacity inside 0…1; anything unusable becomes 0. */
export function clampOpacity(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0
}

/** Angle of the page diagonal in degrees, so a watermark runs corner to corner. */
export function diagonalAngle(w: number, h: number): number {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return 0
  return (Math.atan2(h, w) * 180) / Math.PI
}

/** Auto font size for a page: about one ninth of the width, kept usable. */
export function watermarkFontSize(pageW: number): number {
  const width = Number.isFinite(pageW) ? Math.max(0, pageW) : 0
  return Math.min(160, Math.max(18, Math.round(width / 9)))
}

/** Gap between a corner watermark and the page edge. */
export const CORNER_GAP = 36

/** Centre point of the text box for a position. */
export function anchorFor(
  pos: WatermarkPosition,
  pageW: number,
  pageH: number,
  textW: number,
  textH: number,
  gap = CORNER_GAP,
): { x: number; y: number } {
  const g = Math.max(0, gap)
  const left = g + textW / 2
  const right = pageW - g - textW / 2
  const bottom = g + textH / 2
  const top = pageH - g - textH / 2
  switch (pos) {
    case 'top-left':
      return { x: left, y: top }
    case 'top-right':
      return { x: right, y: top }
    case 'bottom-left':
      return { x: left, y: bottom }
    case 'bottom-right':
      return { x: right, y: bottom }
    default:
      return { x: pageW / 2, y: pageH / 2 }
  }
}

/**
 * Text origin (baseline start) such that rotating the text by `angleDeg`
 * around that origin keeps the text box centred on (cx, cy).
 */
export function rotatedOrigin(cx: number, cy: number, textW: number, textH: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { x: cx - (textW / 2) * cos + (textH / 2) * sin, y: cy - (textW / 2) * sin - (textH / 2) * cos }
}

/** Grid of text centres for the tiled position, left to right and bottom to top. */
export function tileAnchors(pageW: number, pageH: number, stepX: number, stepY: number): { x: number; y: number }[] {
  const width = Number.isFinite(pageW) ? Math.max(1, pageW) : 1
  const height = Number.isFinite(pageH) ? Math.max(1, pageH) : 1
  let cols = Number.isFinite(stepX) && stepX > 0 ? Math.max(1, Math.round(width / stepX)) : 1
  let rows = Number.isFinite(stepY) && stepY > 0 ? Math.max(1, Math.round(height / stepY)) : 1
  while (rows > 1 && cols * rows > 2000) rows--
  while (cols > 1 && cols * rows > 2000) cols--
  const out: { x: number; y: number }[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) out.push({ x: (c + 0.5) * (width / cols), y: (r + 0.5) * (height / rows) })
  }
  return out
}

/** #rgb or #rrggbb to 0…1 components; null when the string is not a hex colour. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const v = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1]
  return {
    r: parseInt(v.slice(0, 2), 16) / 255,
    g: parseInt(v.slice(2, 4), 16) / 255,
    b: parseInt(v.slice(4, 6), 16) / 255,
  }
}

/** Safe download name for the stamped PDF. */
export function fileNameFor(name: string): string {
  const base = name.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\.pdf$/i, '')
  return `${base || 'document'}-watermarked.pdf`
}

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(2)} MB`)

/** Turns pdf-lib load errors into something a person can act on. */
export function pdfError(err: unknown, name: string): string {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err)
  if (/encrypt/i.test(msg)) return `“${name}” is password-protected or encrypted. Remove the protection first, then try again.`
  if (/No PDF header|Failed to parse|invalid|Expected/i.test(msg)) return `“${name}” does not look like a valid PDF file, or it is damaged.`
  return `Could not read “${name}”: ${err instanceof Error ? err.message : msg}`
}
