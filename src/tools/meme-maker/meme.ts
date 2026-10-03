export interface MemeOpts {
  top: string
  bottom: string
  /** Font size in px before fitting. */
  size: number
  caps: boolean
}

export const BACKGROUNDS = ['#000000', '#1f2937', '#7c2d12', '#14532d', '#1e3a8a'] as const

/** Splits a caption into lines, keeping at most `max` and joining the overflow. */
export function memeLines(text: string, max = 3): string[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, max)
  return lines
}

/** Shrinks the caption font until the longest line fits the image width. */
export function fitMemeFont(
  measureAt: (size: number) => (s: string) => number,
  lines: string[],
  maxWidth: number,
  start: number,
  min: number,
): number {
  if (lines.length === 0) return start
  for (let size = start; size > min; size -= 2) {
    const measure = measureAt(size)
    if (lines.every((l) => measure(l) <= maxWidth)) return size
  }
  return min
}

const FONT = "'Arial Black', 'Helvetica Neue', Arial, sans-serif"

function drawCaption(
  ctx: CanvasRenderingContext2D,
  text: string,
  anchor: 'top' | 'bottom',
  o: MemeOpts,
  w: number,
  h: number,
) {
  const lines = memeLines(o.caps ? text.toUpperCase() : text)
  if (lines.length === 0) return
  const pad = w * 0.04
  const size = fitMemeFont(
    (s) => (t) => {
      ctx.font = `800 ${s}px ${FONT}`
      return ctx.measureText(t).width
    },
    lines,
    w - pad * 2,
    o.size,
    18,
  )
  ctx.font = `800 ${size}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(4, size / 7)
  ctx.strokeStyle = '#000000'
  ctx.fillStyle = '#ffffff'
  const lineH = size * 1.12
  const blockH = lines.length * lineH
  let y = anchor === 'top' ? pad + lineH / 2 + size * 0.18 : h - pad - blockH + lineH / 2
  for (const line of lines) {
    ctx.strokeText(line, w / 2, y)
    ctx.fillText(line, w / 2, y)
    y += lineH
  }
}

/** Paints the meme at the canvas's current size. */
export function drawMeme(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, bg: string, o: MemeOpts) {
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  if (img) {
    ctx.drawImage(img, 0, 0, w, h)
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.font = `700 ${Math.round(w / 18)}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('UPLOAD AN IMAGE', w / 2, h / 2 - w / 24)
    ctx.font = `400 ${Math.round(w / 34)}px ${FONT}`
    ctx.fillText('or just caption this square', w / 2, h / 2 + w / 18)
  }
  drawCaption(ctx, o.top, 'top', o, w, h)
  drawCaption(ctx, o.bottom, 'bottom', o, w, h)
}

/** Largest canvas (capped at 1600px wide) that keeps the image's aspect. */
export function memeCanvasSize(img: HTMLImageElement | null): { w: number; h: number } {
  if (!img || !img.naturalWidth) return { w: 800, h: 800 }
  const scale = Math.min(1, 1600 / img.naturalWidth)
  return { w: Math.round(img.naturalWidth * scale), h: Math.round(img.naturalHeight * scale) }
}
