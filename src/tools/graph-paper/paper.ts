/**
 * Paper geometry for the Printable Graph Paper tool.
 * All maths is in points with the origin at the bottom-left, matching PDF space.
 */

export type PageSizeKey = 'a4' | 'letter' | 'legal'

export interface PaperSize {
  label: string
  /** Portrait width in points. */
  w: number
  /** Portrait height in points. */
  h: number
}

export const PAGE_SIZES: Record<PageSizeKey, PaperSize> = {
  a4: { label: 'A4 (210 × 297 mm)', w: 595.28, h: 841.89 },
  letter: { label: 'US Letter (8.5 × 11 in)', w: 612, h: 792 },
  legal: { label: 'US Legal (8.5 × 14 in)', w: 612, h: 1008 },
}

export const PAGE_KEYS: PageSizeKey[] = ['a4', 'letter', 'legal']

export const MM_TO_PT = 72 / 25.4

export function mmToPt(mm: number): number {
  return (Number.isFinite(mm) ? mm : 0) * MM_TO_PT
}

export type PaperMode = 'graph' | 'grid' | 'dots' | 'isometric'

export interface PaperModeSpec {
  id: PaperMode
  label: string
  hint: string
  /** Smallest sensible spacing in millimetres. */
  minSpacingMm: number
}

export const MODES: PaperModeSpec[] = [
  { id: 'graph', label: 'Graph paper', hint: 'Fine squares with a heavier line every fifth square.', minSpacingMm: 2 },
  { id: 'grid', label: 'Grid', hint: 'Evenly spaced squares, all lines the same weight.', minSpacingMm: 2 },
  { id: 'dots', label: 'Dot grid', hint: 'A dot at every intersection, for bullet journals.', minSpacingMm: 5 },
  { id: 'isometric', label: 'Isometric', hint: 'Triangular grid for 3D drawings, with 30° diagonals.', minSpacingMm: 4 },
]

export interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface GridSpec extends Rect {
  spacing: number
  /** Gaps between the first and last line, horizontally and vertically. */
  cols: number
  rows: number
  /** Vertical line positions, from the left margin outwards. */
  xs: number[]
  /** Horizontal line positions, from the bottom margin upwards. */
  ys: number[]
}

/** Line counts and bounds for a grid: `cols × rows` squares inside the margins. */
export function gridSpec(pageW: number, pageH: number, spacing: number, margin: number): GridSpec {
  const width = Number.isFinite(pageW) ? Math.max(1, pageW) : 1
  const height = Number.isFinite(pageH) ? Math.max(1, pageH) : 1
  const limit = Math.min(width, height) / 2
  const m = Math.min(Math.max(0, Number.isFinite(margin) ? margin : 0), limit)
  const step = Number.isFinite(spacing) && spacing > 0 ? spacing : 1
  const x0 = m
  const y0 = m
  const x1 = width - m
  const y1 = height - m
  const cols = Math.max(0, Math.floor((x1 - x0) / step))
  const rows = Math.max(0, Math.floor((y1 - y0) / step))
  const xs = Array.from({ length: cols + 1 }, (_, i) => x0 + i * step)
  const ys = Array.from({ length: rows + 1 }, (_, i) => y0 + i * step)
  return { x0, y0, x1, y1, spacing: step, cols, rows, xs, ys }
}

/** Graph paper draws a heavier line every `every` squares. */
export const HEAVY_EVERY = 5

export const isHeavy = (index: number, every = HEAVY_EVERY) => every > 0 && index % every === 0

export interface Segment {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Liang–Barsky clip: the part of `s` inside `r`, or null when it misses entirely. */
export function clipSegment(s: Segment, r: Rect): Segment | null {
  const dx = s.x2 - s.x1
  const dy = s.y2 - s.y1
  let t0 = 0
  let t1 = 1
  const edges: [number, number][] = [
    [-dx, s.x1 - r.x0],
    [dx, r.x1 - s.x1],
    [-dy, s.y1 - r.y0],
    [dy, r.y1 - s.y1],
  ]
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null
      continue
    }
    const t = q / p
    if (p < 0) {
      if (t > t1) return null
      if (t > t0) t0 = t
    } else {
      if (t < t0) return null
      if (t < t1) t1 = t
    }
  }
  return { x1: s.x1 + t0 * dx, y1: s.y1 + t0 * dy, x2: s.x1 + t1 * dx, y2: s.y1 + t1 * dy }
}

const TAN_30 = Math.tan(Math.PI / 6)

/** The two families of 30° diagonals, clipped to the drawing area. */
export function isoLines(pageW: number, pageH: number, spacing: number, margin: number): Segment[] {
  const spec = gridSpec(pageW, pageH, spacing, margin)
  const rect: Rect = { x0: spec.x0, y0: spec.y0, x1: spec.x1, y1: spec.y1 }
  const run = (spec.y1 - spec.y0) / TAN_30
  const out: Segment[] = []
  const push = (s: Segment | null) => {
    if (!s) return
    // Lines that only touch a corner collapse to a point; skip them.
    if (Math.abs(s.x2 - s.x1) + Math.abs(s.y2 - s.y1) < 1e-6) return
    out.push(s)
  }
  for (let o = -run; o <= spec.x1 - spec.x0 + run; o += spec.spacing) {
    push(clipSegment({ x1: spec.x0 + o, y1: spec.y0, x2: spec.x0 + o + run, y2: spec.y1 }, rect))
    push(clipSegment({ x1: spec.x0 + o, y1: spec.y1, x2: spec.x0 + o + run, y2: spec.y0 }, rect))
  }
  return out
}

/** Every dot of a dot grid. */
export function dotPoints(pageW: number, pageH: number, spacing: number, margin: number): { x: number; y: number }[] {
  const spec = gridSpec(pageW, pageH, spacing, margin)
  const out: { x: number; y: number }[] = []
  for (const y of spec.ys) for (const x of spec.xs) out.push({ x, y })
  return out
}

/** How many lines, dots or segments a page will need. */
export function opsFor(mode: PaperMode, spec: GridSpec, isoCount = 0): number {
  if (mode === 'dots') return spec.xs.length * spec.ys.length
  if (mode === 'isometric') return spec.xs.length + spec.ys.length + isoCount
  return spec.xs.length + spec.ys.length
}

/** Above this the drawing gets slow on phones, so the tool asks for a wider spacing. */
export const MAX_ELEMENTS = 6000

/** `#abc` or `abcdef` to a lowercase `#aabbcc`; anything else becomes the fallback. */
export function normalizeHex(hex: string, fallback = '#8aa0c0'): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex ?? '').trim())
  if (!m) return fallback
  const v = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1]
  return `#${v.toLowerCase()}`
}

/** 0…1 colour components for pdf-lib. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const v = normalizeHex(hex).slice(1)
  return {
    r: parseInt(v.slice(0, 2), 16) / 255,
    g: parseInt(v.slice(2, 4), 16) / 255,
    b: parseInt(v.slice(4, 6), 16) / 255,
  }
}

/** Safe download name for the generated PDF. */
export function fileNameFor(mode: PaperMode): string {
  return `${mode}-paper.pdf`
}

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(2)} MB`)
