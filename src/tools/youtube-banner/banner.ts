/** Channel art spec: full canvas, and the centered rectangle every device keeps visible. */
export const BANNER_W = 2560
export const BANNER_H = 1440
export const SAFE = { x: 507, y: 508.5, w: 1546, h: 423 }

export interface Crop {
  name: string
  hint: string
  x: number
  y: number
  w: number
  h: number
}

/** What each device family actually shows of the banner. */
export const DEVICES: Crop[] = [
  { name: 'TV', hint: 'full art', x: 0, y: 0, w: BANNER_W, h: BANNER_H },
  { name: 'Desktop', hint: 'center strip', x: 0, y: 508.5, w: BANNER_W, h: 423 },
  { name: 'Tablet', hint: 'narrower strip', x: 352.5, y: 508.5, w: 1855, h: 423 },
  { name: 'Mobile', hint: 'safe area', x: SAFE.x, y: SAFE.y, w: SAFE.w, h: SAFE.h },
]

export type Pattern = 'none' | 'rings' | 'dots'

export interface BannerOpts {
  title: string
  subtitle: string
  from: string
  to: string
  angle: number
  textColor: string
  pattern: Pattern
  showSafe: boolean
}

export const FONT = "'Bricolage Grotesque Variable', ui-sans-serif, system-ui, sans-serif"

/** Endpoints of a linear gradient spanning a w×h box at the given angle (degrees, 0 = right, clockwise). */
export function gradientEnds(angleDeg: number, w: number, h: number): [number, number, number, number] {
  const a = ((angleDeg % 360) * Math.PI) / 180
  const dx = Math.cos(a)
  const dy = Math.sin(a)
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2
  return [w / 2 - dx * half, h / 2 - dy * half, w / 2 + dx * half, h / 2 + dy * half]
}

/** Greedy word wrap against any measure function (canvas measureText in the tool, a stub in tests). */
export function wrapText(measure: (s: string) => number, text: string, maxWidth: number, maxLines = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word
    if (cur && measure(test) > maxWidth) {
      lines.push(cur)
      cur = word
      if (lines.length === maxLines) return lines
    } else {
      cur = test
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur)
  return lines
}

function drawPattern(ctx: CanvasRenderingContext2D, pattern: Pattern, w: number, h: number) {
  if (pattern === 'none') return
  ctx.save()
  ctx.globalAlpha = 0.12
  ctx.strokeStyle = '#ffffff'
  ctx.fillStyle = '#ffffff'
  if (pattern === 'rings') {
    ctx.lineWidth = 10
    const cx = w * 0.82
    const cy = h * 0.3
    for (let r = 90; r < 900; r += 105) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
    }
  } else {
    for (let x = w * 0.06; x < w * 0.5; x += 74) {
      for (let y = h * 0.62; y < h * 0.96; y += 74) {
        ctx.beginPath()
        ctx.arc(x, y, 9, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  ctx.restore()
}

/** Paints the full 2560×1440 banner. The ctx must already be sized to that. */
export function drawBanner(ctx: CanvasRenderingContext2D, o: BannerOpts) {
  const [x0, y0, x1, y1] = gradientEnds(o.angle, BANNER_W, BANNER_H)
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  g.addColorStop(0, o.from)
  g.addColorStop(1, o.to)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, BANNER_W, BANNER_H)
  drawPattern(ctx, o.pattern, BANNER_W, BANNER_H)

  const cx = SAFE.x + SAFE.w / 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = o.textColor

  let size = 200
  let lines: string[] = []
  for (; size > 40; size -= 8) {
    ctx.font = `800 ${size}px ${FONT}`
    const measure = (s: string) => ctx.measureText(s).width
    const needed = wrapText(measure, o.title, SAFE.w - 160, Number.MAX_SAFE_INTEGER).length
    if (needed <= 3) {
      lines = wrapText(measure, o.title, SAFE.w - 160, 3)
      break
    }
  }
  const lineH = size * 1.08
  const subH = o.subtitle.trim() ? 78 : 0
  const blockH = lines.length * lineH + subH
  let y = SAFE.y + SAFE.h / 2 - blockH / 2 + lineH / 2
  for (const line of lines) {
    ctx.fillText(line, cx, y)
    y += lineH
  }
  if (o.subtitle.trim()) {
    ctx.font = `500 62px ${FONT}`
    ctx.globalAlpha = 0.85
    const sub = wrapText((s) => ctx.measureText(s).width, o.subtitle, SAFE.w - 200, 2)
    for (const line of sub) {
      ctx.fillText(line, cx, y - lineH / 2 + 52)
      y += 66
    }
    ctx.globalAlpha = 1
  }

  if (o.showSafe) {
    ctx.save()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)'
    ctx.fillRect(SAFE.x, SAFE.y, SAFE.w, SAFE.h)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.lineWidth = 6
    ctx.setLineDash([28, 20])
    ctx.strokeRect(SAFE.x, SAFE.y, SAFE.w, SAFE.h)
    ctx.restore()
  }
}
