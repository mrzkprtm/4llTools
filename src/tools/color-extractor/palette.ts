/** Pure palette extraction (median cut) and color helpers for the image color extractor. */

export interface Swatch {
  r: number
  g: number
  b: number
  hex: string
  /** Pixels in this color's bucket. */
  count: number
  /** Share of all opaque pixels, 0–1. */
  share: number
}

type Px = [number, number, number]

export const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`

/**
 * Median-cut style palette from RGBA pixel data. Pixels with alpha under
 * `minAlpha` are ignored. Repeatedly splits the box with the widest channel
 * range (weighted by population) at the point that best separates it
 * (lowest within-box variance), then averages each box.
 * Near-identical results are merged, so fewer than `count` colors may return.
 */
export function extractPalette(data: ArrayLike<number>, count: number, { minAlpha = 125, step = 1 } = {}): Swatch[] {
  const px: Px[] = []
  for (let i = 0; i + 3 < data.length; i += 4 * Math.max(1, step)) {
    if (data[i + 3] < minAlpha) continue
    px.push([data[i], data[i + 1], data[i + 2]])
  }
  if (!px.length) return []
  const k = Math.max(1, Math.min(32, Math.floor(count)))

  const range = (box: Px[]) => {
    let best = 0
    let size = -1
    for (let c = 0; c < 3; c++) {
      let lo = 255
      let hi = 0
      for (const p of box) {
        if (p[c] < lo) lo = p[c]
        if (p[c] > hi) hi = p[c]
      }
      if (hi - lo > size) {
        size = hi - lo
        best = c
      }
    }
    return { channel: best, size }
  }

  let boxes: Px[][] = [px]
  while (boxes.length < k) {
    // Split the box whose (range × population) is largest.
    let pick = -1
    let score = 0
    let channel = 0
    boxes.forEach((b, i) => {
      if (b.length < 2) return
      const r = range(b)
      const s = r.size * Math.sqrt(b.length)
      if (r.size > 0 && s > score) {
        score = s
        pick = i
        channel = r.channel
      }
    })
    if (pick < 0) break
    const box = boxes[pick].slice().sort((a, b) => a[channel] - b[channel])
    // Cut where the two halves have the least total variance along that channel
    // (a smarter median: it never slices through the middle of a tight cluster).
    const n = box.length
    let sum = 0
    let sq = 0
    for (const p of box) {
      sum += p[channel]
      sq += p[channel] * p[channel]
    }
    let mid = 0
    let best = Infinity
    let ls = 0
    let lq = 0
    for (let i = 1; i < n; i++) {
      const x = box[i - 1][channel]
      ls += x
      lq += x * x
      if (box[i][channel] === x) continue
      const rs = sum - ls
      const rq = sq - lq
      const sse = lq - (ls * ls) / i + rq - (rs * rs) / (n - i)
      if (sse < best) {
        best = sse
        mid = i
      }
    }
    if (mid <= 0 || mid >= box.length) break
    boxes = [...boxes.slice(0, pick), box.slice(0, mid), box.slice(mid), ...boxes.slice(pick + 1)]
  }

  const total = px.length
  const out: Swatch[] = []
  for (const b of boxes) {
    let r = 0
    let g = 0
    let bl = 0
    for (const p of b) {
      r += p[0]
      g += p[1]
      bl += p[2]
    }
    const n = b.length
    const c = { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(bl / n) }
    const same = out.find((o) => distance(o, c) < 6)
    if (same) {
      const m = same.count + n
      same.r = Math.round((same.r * same.count + c.r * n) / m)
      same.g = Math.round((same.g * same.count + c.g * n) / m)
      same.b = Math.round((same.b * same.count + c.b * n) / m)
      same.count = m
    } else out.push({ ...c, hex: '', count: n, share: 0 })
  }
  return out
    .map((s) => ({ ...s, hex: toHex(s.r, s.g, s.b), share: s.count / total }))
    .sort((a, b) => b.count - a.count)
}

export function distance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  // "Redmean" approximation of perceived distance.
  const rm = (a.r + b.r) / 2
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db) / 3
}

export function toHsl(r: number, g: number, b: number): [number, number, number] {
  const R = r / 255
  const G = g / 255
  const B = b / 255
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  const l = (max + min) / 2
  if (max === min) return [0, 0, Math.round(l * 100)]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4
  return [Math.round(h * 60), Math.round(s * 100), Math.round(l * 100)]
}

/** Relative luminance per WCAG. */
export function luminance(r: number, g: number, b: number): number {
  const f = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** Black or white, whichever reads better on the color. */
export const inkFor = (r: number, g: number, b: number) => (luminance(r, g, b) > 0.179 ? '#000000' : '#ffffff')

export type ExportFormat = 'css' | 'scss' | 'json' | 'tailwind'

export function exportPalette(sw: { hex: string; share: number }[], format: ExportFormat, prefix = 'color'): string {
  const name = (i: number) => `${prefix}-${i + 1}`
  switch (format) {
    case 'css':
      return `:root {\n${sw.map((s, i) => `  --${name(i)}: ${s.hex};`).join('\n')}\n}`
    case 'scss':
      return sw.map((s, i) => `$${name(i)}: ${s.hex};`).join('\n')
    case 'tailwind':
      return `// tailwind.config.js → theme.extend.colors\n${JSON.stringify({ [prefix]: Object.fromEntries(sw.map((s, i) => [String((i + 1) * 100), s.hex])) }, null, 2)}`
    case 'json':
      return JSON.stringify(sw.map((s) => ({ hex: s.hex, percent: Math.round(s.share * 1000) / 10 })), null, 2)
  }
}

/** Fits an image into at most `max` pixels on its longest side (for fast sampling). */
export function sampleSize(w: number, h: number, max = 160): { w: number; h: number } {
  const s = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) }
}
