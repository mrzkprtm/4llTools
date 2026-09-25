/** Pure layout math for the screenshot beautifier. All numbers are in 1x output pixels. */

export type Frame = 'none' | 'mac' | 'browser'

export interface LayoutInput {
  imgW: number
  imgH: number
  /** Space around the window, as a fraction of the window width (0–0.4). */
  padding: number
  frame: Frame
  /** Target width / height, or null to hug the content. */
  ratio: number | null
}

export interface Layout {
  width: number
  height: number
  /** Window (frame + screenshot) rectangle. */
  winX: number
  winY: number
  winW: number
  winH: number
  /** Title bar height (0 without a frame). */
  bar: number
  /** Screenshot rectangle. */
  imgX: number
  imgY: number
  imgW: number
  imgH: number
  /** Size unit: 1 per 1000 px of window width, used to scale radius, shadow and chrome. */
  unit: number
}

export function barHeight(frame: Frame, width: number): number {
  if (frame === 'none') return 0
  const base = Math.round(Math.min(80, Math.max(22, width * 0.034)))
  return frame === 'browser' ? Math.round(base * 1.45) : base
}

export function computeLayout({ imgW, imgH, padding, frame, ratio }: LayoutInput): Layout {
  const w = Math.max(1, Math.round(imgW))
  const h = Math.max(1, Math.round(imgH))
  const bar = barHeight(frame, w)
  const winW = w
  const winH = h + bar
  const pad = Math.round(Math.min(Math.max(padding, 0), 0.4) * winW)
  let width = winW + 2 * pad
  let height = winH + 2 * pad
  if (ratio && ratio > 0 && Number.isFinite(ratio)) {
    if (width / height > ratio) height = Math.round(width / ratio)
    else width = Math.round(height * ratio)
  }
  const winX = Math.round((width - winW) / 2)
  const winY = Math.round((height - winH) / 2)
  return { width, height, winX, winY, winW, winH, bar, imgX: winX, imgY: winY + bar, imgW: w, imgH: h, unit: winW / 1000 }
}

/** The export scale actually used so neither side exceeds `max` px (browser canvas limits). */
export function safeScale(width: number, height: number, requested: number, max = 8192): number {
  return Math.max(0.01, Math.min(requested, max / width, max / height))
}

export const RATIOS: { label: string; value: number | null }[] = [
  { label: 'Auto', value: null },
  { label: '16:9', value: 16 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: '1:1', value: 1 },
  { label: '4:5 Instagram', value: 4 / 5 },
  { label: '9:16 Story', value: 9 / 16 },
  { label: '1.91:1 Open Graph', value: 1.91 },
  { label: 'X post 16:9', value: 16 / 9 },
]

/** Where to draw a background image so it covers the canvas (CSS background-size: cover). */
export function coverRect(srcW: number, srcH: number, W: number, H: number): { sx: number; sy: number; sw: number; sh: number } {
  const s = Math.max(W / srcW, H / srcH)
  const sw = W / s
  const sh = H / s
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh }
}
