/** Canvas drawing shortcuts shared by the simulations. */

type Ctx = CanvasRenderingContext2D

export const MONO = '"JetBrains Mono Variable", ui-monospace, monospace'
export const SANS = '"Bricolage Grotesque Variable", ui-sans-serif, system-ui, sans-serif'

export function clear(ctx: Ctx, w: number, h: number, color?: string) {
  if (color) {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, w, h)
  } else ctx.clearRect(0, 0, w, h)
}

export function circle(ctx: Ctx, x: number, y: number, r: number, fill?: string, stroke?: string, lineWidth = 1) {
  ctx.beginPath()
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2)
  if (fill) {
    ctx.fillStyle = fill
    ctx.fill()
  }
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = lineWidth
    ctx.stroke()
  }
}

export function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, width = 1, dash?: number[]) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.setLineDash(dash ?? [])
  ctx.stroke()
  ctx.setLineDash([])
}

/** A line with an arrowhead at (x2, y2). Skipped when shorter than a pixel. */
export function arrow(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, width = 2, head = 8) {
  const len = Math.hypot(x2 - x1, y2 - y1)
  if (len < 1) return
  const a = Math.atan2(y2 - y1, x2 - x1)
  const hd = Math.min(head, len * 0.6)
  line(ctx, x1, y1, x2 - Math.cos(a) * hd * 0.5, y2 - Math.sin(a) * hd * 0.5, color, width)
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - hd * Math.cos(a - 0.45), y2 - hd * Math.sin(a - 0.45))
  ctx.lineTo(x2 - hd * Math.cos(a + 0.45), y2 - hd * Math.sin(a + 0.45))
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

interface TextOpts {
  color?: string
  size?: number
  align?: CanvasTextAlign
  baseline?: CanvasTextBaseline
  mono?: boolean
  weight?: number
}

export function text(ctx: Ctx, s: string, x: number, y: number, { color = '#000', size = 12, align = 'left', baseline = 'alphabetic', mono = true, weight = 500 }: TextOpts = {}) {
  ctx.font = `${weight} ${size}px ${mono ? MONO : SANS}`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = baseline
  ctx.fillText(s, x, y)
}

export function grid(ctx: Ctx, w: number, h: number, step: number, color: string, ox = 0, oy = 0) {
  ctx.beginPath()
  for (let x = ((ox % step) + step) % step; x <= w; x += step) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
  }
  for (let y = ((oy % step) + step) % step; y <= h; y += step) {
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
  }
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.stroke()
}

export interface Series {
  data: ArrayLike<number>
  color: string
  width?: number
  fill?: boolean
}

interface ChartOpts {
  min?: number
  max?: number
  axis?: string
  /** Number of x slots; defaults to the longest series. */
  span?: number
  label?: string
  labelColor?: string
}

/** A compact line chart inside the rectangle (x, y, w, h). */
export function chart(ctx: Ctx, x: number, y: number, w: number, h: number, series: Series[], { min, max, axis, span, label, labelColor }: ChartOpts = {}) {
  let lo = min ?? Infinity
  let hi = max ?? -Infinity
  if (min === undefined || max === undefined)
    for (const s of series)
      for (let i = 0; i < s.data.length; i++) {
        if (min === undefined) lo = Math.min(lo, s.data[i])
        if (max === undefined) hi = Math.max(hi, s.data[i])
      }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return
  if (hi - lo < 1e-9) hi = lo + 1
  const n = span ?? Math.max(2, ...series.map((s) => s.data.length))
  if (axis) {
    line(ctx, x, y + h, x + w, y + h, axis)
    line(ctx, x, y, x, y + h, axis)
  }
  for (const s of series) {
    if (s.data.length < 2) continue
    ctx.beginPath()
    for (let i = 0; i < s.data.length; i++) {
      const px = x + (i / (n - 1)) * w
      const py = y + h - ((s.data[i] - lo) / (hi - lo)) * h
      if (i) ctx.lineTo(px, py)
      else ctx.moveTo(px, py)
    }
    if (s.fill) {
      ctx.lineTo(x + ((s.data.length - 1) / (n - 1)) * w, y + h)
      ctx.lineTo(x, y + h)
      ctx.closePath()
      ctx.fillStyle = s.color
      ctx.fill()
    } else {
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.width ?? 1.5
      ctx.lineJoin = 'round'
      ctx.stroke()
    }
  }
  if (label) text(ctx, label, x + 4, y + 12, { color: labelColor ?? axis ?? '#888', size: 10 })
}

/** A bar histogram inside (x, y, w, h). */
export function bars(ctx: Ctx, x: number, y: number, w: number, h: number, values: ArrayLike<number>, color: string, max?: number, gap = 1) {
  let hi = max ?? 0
  if (max === undefined) for (let i = 0; i < values.length; i++) hi = Math.max(hi, values[i])
  if (hi <= 0) hi = 1
  const bw = w / values.length
  ctx.fillStyle = color
  for (let i = 0; i < values.length; i++) {
    const bh = (values[i] / hi) * h
    ctx.fillRect(x + i * bw + gap / 2, y + h - bh, Math.max(0.5, bw - gap), bh)
  }
}

/** Rounded rectangle path (filled and/or stroked). */
export function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lineWidth = 1) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  if (fill) {
    ctx.fillStyle = fill
    ctx.fill()
  }
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = lineWidth
    ctx.stroke()
  }
}

/** Saves the canvas as a PNG download. */
export function downloadCanvas(canvas: HTMLCanvasElement | null, name: string) {
  if (!canvas) return
  canvas.toBlob((blob) => {
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }, 'image/png')
}

/** An offscreen canvas of a given pixel size, for per-pixel sims drawn with putImageData. */
export function makeBuffer(w: number, h: number) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(w, h)
  return { canvas, ctx, image, data: image.data, flush: () => ctx.putImageData(image, 0, 0) }
}
