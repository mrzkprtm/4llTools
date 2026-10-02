import { bounds, tracePath, type El } from './logic'

export const INK = ['#1b1a17', '#e03131', '#1c7ed6', '#2f9e44', '#f08c00', '#ae3ec9']
export const NOTE_COLORS = ['#ffe066', '#ffc9c9', '#a5d8ff', '#b2f2bb']
const FONT = 'ui-sans-serif, system-ui, sans-serif'

/** Wraps text to fit a width with the current ctx font. */
function wrap(ctx: CanvasRenderingContext2D, text: string, w: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word
      if (ctx.measureText(next).width > w && line) {
        out.push(line)
        line = word
      } else line = next
    }
    out.push(line)
  }
  return out
}

/** Draws one element. `scale` is an extra pop-in factor around its center (1 = normal). */
export function drawEl(ctx: CanvasRenderingContext2D, el: El, scale = 1, opacity = 1) {
  ctx.save()
  ctx.globalAlpha = opacity
  if (scale !== 1) {
    const b = bounds(el)
    const cx = b.x + b.w / 2
    const cy = b.y + b.h / 2
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    ctx.translate(-cx, -cy)
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  switch (el.type) {
    case 'pen':
    case 'hl':
      ctx.strokeStyle = el.color
      ctx.lineWidth = el.width
      if (el.type === 'hl') {
        ctx.globalAlpha = 0.35 * opacity
        ctx.lineCap = 'square'
      }
      ctx.beginPath()
      tracePath(ctx, el.pts)
      ctx.stroke()
      break
    case 'rect':
      ctx.strokeStyle = el.color
      ctx.lineWidth = el.width
      ctx.beginPath()
      ctx.roundRect(Math.min(el.x1, el.x2), Math.min(el.y1, el.y2), Math.abs(el.x2 - el.x1), Math.abs(el.y2 - el.y1), 4)
      ctx.stroke()
      break
    case 'ellipse':
      ctx.strokeStyle = el.color
      ctx.lineWidth = el.width
      ctx.beginPath()
      ctx.ellipse((el.x1 + el.x2) / 2, (el.y1 + el.y2) / 2, Math.abs(el.x2 - el.x1) / 2, Math.abs(el.y2 - el.y1) / 2, 0, 0, Math.PI * 2)
      ctx.stroke()
      break
    case 'arrow': {
      ctx.strokeStyle = el.color
      ctx.fillStyle = el.color
      ctx.lineWidth = el.width
      const a = Math.atan2(el.y2 - el.y1, el.x2 - el.x1)
      const hd = Math.min(12 + el.width * 2, Math.hypot(el.x2 - el.x1, el.y2 - el.y1) * 0.6)
      ctx.beginPath()
      ctx.moveTo(el.x1, el.y1)
      ctx.lineTo(el.x2 - Math.cos(a) * hd * 0.6, el.y2 - Math.sin(a) * hd * 0.6)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(el.x2, el.y2)
      ctx.lineTo(el.x2 - hd * Math.cos(a - 0.45), el.y2 - hd * Math.sin(a - 0.45))
      ctx.lineTo(el.x2 - hd * Math.cos(a + 0.45), el.y2 - hd * Math.sin(a + 0.45))
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'text':
      ctx.fillStyle = el.color
      ctx.font = `600 ${el.size}px ${FONT}`
      ctx.textBaseline = 'top'
      el.text.split('\n').forEach((l, i) => ctx.fillText(l, el.x, el.y + i * el.size * 1.25))
      break
    case 'note': {
      ctx.shadowColor = 'rgba(0,0,0,0.18)'
      ctx.shadowBlur = 10
      ctx.shadowOffsetY = 4
      ctx.fillStyle = el.color
      ctx.beginPath()
      ctx.roundRect(el.x, el.y, el.w, el.h, 6)
      ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.fillStyle = '#1b1a17'
      ctx.font = `500 16px ${FONT}`
      ctx.textBaseline = 'top'
      wrap(ctx, el.text, el.w - 24)
        .slice(0, Math.floor((el.h - 20) / 20))
        .forEach((l, i) => ctx.fillText(l, el.x + 12, el.y + 12 + i * 20))
      break
    }
  }
  ctx.restore()
}

/** Dashed selection box around an element. */
export function drawSelection(ctx: CanvasRenderingContext2D, el: El, k: number) {
  const b = bounds(el)
  const p = 6 / k
  ctx.save()
  ctx.strokeStyle = '#1c7ed6'
  ctx.lineWidth = 1.5 / k
  ctx.setLineDash([6 / k, 4 / k])
  ctx.strokeRect(b.x - p, b.y - p, b.w + 2 * p, b.h + 2 * p)
  ctx.restore()
}
