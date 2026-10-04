export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

export type RedactMode = 'blur' | 'pixelate' | 'blackout'

export const REDACT_MODES: RedactMode[] = ['blur', 'pixelate', 'blackout']

/** The rectangle between two drag points, whichever way the drag went. */
export function normalizeRect(a: Point, b: Point): Rect {
  return {
    x: Math.round(Math.min(a.x, b.x)),
    y: Math.round(Math.min(a.y, b.y)),
    w: Math.round(Math.abs(b.x - a.x)),
    h: Math.round(Math.abs(b.y - a.y)),
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Trims a rectangle to the image: nothing outside can be redacted. */
export function clampRect(rect: Rect, w: number, h: number): Rect {
  const width = Math.max(0, w)
  const height = Math.max(0, h)
  const x = clamp(rect.x, 0, width)
  const y = clamp(rect.y, 0, height)
  return {
    x,
    y,
    w: Math.max(0, Math.min(width, rect.x + rect.w) - x),
    h: Math.max(0, Math.min(height, rect.y + rect.h) - y),
  }
}

/**
 * Averages the rectangle into square blocks in place, which is what makes a
 * face or a number plate unreadable. `data` is RGBA, `block` is in pixels.
 */
export function pixelate(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  rect: Rect,
  block: number,
): Uint8ClampedArray {
  const area = clampRect(rect, w, h)
  if (area.w === 0 || area.h === 0 || !(w > 0) || !(h > 0)) return data
  const size = Math.max(2, Math.round(block) || 2)

  for (let by = area.y; by < area.y + area.h; by += size) {
    for (let bx = area.x; bx < area.x + area.w; bx += size) {
      const bw = Math.min(size, area.x + area.w - bx)
      const bh = Math.min(size, area.y + area.h - by)
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0
      for (let y = by; y < by + bh; y++) {
        for (let x = bx; x < bx + bw; x++) {
          const i = (y * w + x) * 4
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
          a += data[i + 3]
          n++
        }
      }
      if (n === 0) continue
      const ar = Math.round(r / n)
      const ag = Math.round(g / n)
      const ab = Math.round(b / n)
      const aa = Math.round(a / n)
      for (let y = by; y < by + bh; y++) {
        for (let x = bx; x < bx + bw; x++) {
          const i = (y * w + x) * 4
          data[i] = ar
          data[i + 1] = ag
          data[i + 2] = ab
          data[i + 3] = aa
        }
      }
    }
  }
  return data
}

/** A human label for the redaction mode, for buttons and list rows. */
export function redactLabel(mode: RedactMode): string {
  if (mode === 'blur') return 'Blur'
  if (mode === 'pixelate') return 'Pixelate'
  if (mode === 'blackout') return 'Blackout'
  return 'Redact'
}
