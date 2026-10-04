import { wrapText } from '../youtube-banner/banner'

export const CARD = 1080

export interface TweetOpts {
  name: string
  handle: string
  timeLabel: string
  text: string
  avatarBg: string
  avatarImg?: CanvasImageSource | null
  verified: boolean
  replies: string
  retweets: string
  likes: string
  theme: ThemeName
}

export type ThemeName = 'light' | 'dim' | 'dark'

export const THEMES: Record<ThemeName, { bg: string; text: string; sub: string; line: string; accent: string }> = {
  light: { bg: '#ffffff', text: '#0f1419', sub: '#536471', line: '#eff3f4', accent: '#1d9bf0' },
  dim: { bg: '#15202b', text: '#f7f9f9', sub: '#8b98a5', line: '#38444d', accent: '#1d9bf0' },
  dark: { bg: '#000000', text: '#e7e9ea', sub: '#71767b', line: '#2f3336', accent: '#1d9bf0' },
}

/** "Ada Lovelace" → "AL", "cher" → "C", empty → "?". */
export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return [...parts[0]][0].toUpperCase()
  return ([...parts[0]][0] + [...parts[parts.length - 1]][0]).toUpperCase()
}

/**
 * Shrinks the body font until every paragraph of the tweet fits the allowed
 * height. Returns the paragraphs already wrapped into lines.
 */
export function layoutTweet(
  measureAt: (size: number) => (s: string) => number,
  text: string,
  maxWidth: number,
  start: number,
  min: number,
  maxHeight: number,
  lineH = 1.35,
): { size: number; paragraphs: string[][] } {
  const build = (size: number) => {
    const measure = measureAt(size)
    return text.split('\n').map((p) => wrapText(measure, p, maxWidth, 99))
  }
  let size = start
  for (; size > min; size -= 2) {
    const paragraphs = build(size)
    const lines = paragraphs.reduce((n, p) => n + p.length, 0)
    if (lines * size * lineH <= maxHeight) return { size, paragraphs }
  }
  return { size: min, paragraphs: build(min) }
}

const FONT = "'Bricolage Grotesque Variable', ui-sans-serif, system-ui, sans-serif"

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath()
  ctx.moveTo(x, y + s * 0.32)
  ctx.bezierCurveTo(x, y, x - s / 2, y, x - s / 2, y + s * 0.3)
  ctx.bezierCurveTo(x - s / 2, y + s * 0.55, x - s * 0.14, y + s * 0.72, x, y + s)
  ctx.bezierCurveTo(x + s * 0.14, y + s * 0.72, x + s / 2, y + s * 0.55, x + s / 2, y + s * 0.3)
  ctx.bezierCurveTo(x + s / 2, y, x, y, x, y + s * 0.32)
  ctx.fill()
}

function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillRect(x - s / 2, y, s, s * 0.72)
  ctx.beginPath()
  ctx.moveTo(x - s * 0.18, y + s * 0.7)
  ctx.lineTo(x - s * 0.3, y + s)
  ctx.lineTo(x + s * 0.02, y + s * 0.7)
  ctx.fill()
}

function retweet(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.lineWidth = s * 0.14
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x - s * 0.4, y + s * 0.15)
  ctx.lineTo(x + s * 0.18, y + s * 0.15)
  ctx.lineTo(x + s * 0.05, y)
  ctx.moveTo(x + s * 0.18, y + s * 0.15)
  ctx.lineTo(x + s * 0.05, y + s * 0.3)
  ctx.moveTo(x + s * 0.4, y + s * 0.85)
  ctx.lineTo(x - s * 0.18, y + s * 0.85)
  ctx.lineTo(x - s * 0.05, y + s * 0.7)
  ctx.moveTo(x - s * 0.18, y + s * 0.85)
  ctx.lineTo(x - s * 0.05, y + s)
  ctx.stroke()
}

/** Paints the square share card; ctx must be sized CARD×CARD. */
export function drawTweet(ctx: CanvasRenderingContext2D, o: TweetOpts) {
  const t = THEMES[o.theme]
  const PAD = 84
  ctx.fillStyle = t.bg
  ctx.fillRect(0, 0, CARD, CARD)

  const AV = 104
  const ax = PAD + AV / 2
  const ay = PAD + AV / 2
  ctx.save()
  ctx.beginPath()
  ctx.arc(ax, ay, AV / 2, 0, Math.PI * 2)
  ctx.clip()
  if (o.avatarImg) {
    const img = o.avatarImg as HTMLImageElement
    const scale = Math.max(AV / img.width, AV / img.height)
    ctx.drawImage(img, ax - (img.width * scale) / 2, ay - (img.height * scale) / 2, img.width * scale, img.height * scale)
  } else {
    ctx.fillStyle = o.avatarBg
    ctx.fillRect(PAD, PAD, AV, AV)
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 ${o.verified ? 44 : 48}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(initialsFrom(o.name), ax, ay + 4)
  }
  ctx.restore()

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = t.text
  ctx.font = `700 42px ${FONT}`
  const nameX = PAD + AV + 28
  ctx.fillText(o.name.trim() || 'Name', nameX, PAD + 44)
  const nameW = ctx.measureText(o.name.trim() || 'Name').width

  if (o.verified) {
    const vx = nameX + nameW + 16
    const vy = PAD + 30
    ctx.fillStyle = t.accent
    ctx.beginPath()
    ctx.arc(vx + 17, vy, 17, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = t.bg
    ctx.lineWidth = 4.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(vx + 8, vy)
    ctx.lineTo(vx + 14.5, vy + 7)
    ctx.lineTo(vx + 26, vy - 7)
    ctx.stroke()
  }

  ctx.fillStyle = t.sub
  ctx.font = `400 34px ${FONT}`
  const raw = o.handle.trim() || 'handle'
  const handle = raw.startsWith('@') ? raw : `@${raw}`
  ctx.fillText(`${handle} · ${o.timeLabel.trim() || 'now'}`, nameX, PAD + 90)

  const bodyTop = PAD + AV + 56
  const footerH = 150
  const { size, paragraphs } = layoutTweet(
    (s) => (txt) => {
      ctx.font = `400 ${s}px ${FONT}`
      return ctx.measureText(txt).width
    },
    o.text || 'Your post text here.',
    CARD - PAD * 2,
    46,
    30,
    CARD - bodyTop - footerH - PAD,
  )
  ctx.font = `400 ${size}px ${FONT}`
  ctx.fillStyle = t.text
  let y = bodyTop + size
  for (const lines of paragraphs) {
    for (const line of lines) {
      ctx.fillText(line, PAD, y)
      y += size * 1.35
    }
    y += size * 0.2
  }

  const fy = CARD - PAD - 40
  ctx.strokeStyle = t.line
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(PAD, CARD - PAD - 96)
  ctx.lineTo(CARD - PAD, CARD - PAD - 96)
  ctx.stroke()

  ctx.fillStyle = t.sub
  ctx.strokeStyle = t.sub
  ctx.font = `500 36px ${FONT}`
  const actions: [string, (x: number, y: number, s: number) => void][] = [
    [o.replies.trim(), (x, y2) => bubble(ctx, x, y2 - 36, 44)],
    [o.retweets.trim(), (x, y2) => retweet(ctx, x, y2 - 36, 44)],
    [o.likes.trim(), (x, y2) => heart(ctx, x, y2 - 34, 42)],
  ]
  let ax2 = PAD + 30
  for (const [count, icon] of actions) {
    if (!count) continue
    icon(ax2, fy, 44)
    ctx.fillStyle = t.sub
    ctx.textAlign = 'left'
    ctx.fillText(count, ax2 + 34, fy)
    ax2 += 34 + ctx.measureText(count).width + 90
  }
}
