export const POSITIONS = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const

export type Position = (typeof POSITIONS)[number]

export type TextAlign = 'left' | 'center' | 'right'

export interface Anchor {
  x: number
  y: number
  textAlign: TextAlign
}

export const MIN_FONT = 8

/** Font size kept readable and never wider than a quarter of the image. */
export function clampFontSize(px: number, w: number): number {
  const size = Math.round(px)
  const max = Math.max(MIN_FONT, Math.round(Math.max(0, w) * 0.25))
  if (!Number.isFinite(size)) return MIN_FONT
  return Math.min(max, Math.max(MIN_FONT, size))
}

/**
 * Where to draw the watermark: `x` is the anchor the text aligns against and
 * `y` is the baseline. Text wider than the padded image falls back to centered
 * so it cannot be pushed off the canvas.
 */
export function watermarkAnchor(
  pos: Position,
  w: number,
  h: number,
  textW: number,
  textH: number,
  pad: number,
): Anchor {
  const p = Number.isFinite(pad) ? Math.max(0, pad) : 0
  const width = Number.isFinite(w) ? Math.max(1, w) : 1
  const height = Number.isFinite(h) ? Math.max(1, h) : 1
  const tw = Number.isFinite(textW) ? Math.max(0, textW) : 0
  const th = Number.isFinite(textH) ? Math.max(0, textH) : 0
  const col = pos.endsWith('left') ? 'left' : pos.endsWith('right') ? 'right' : 'center'
  const row = pos.startsWith('top') ? 'top' : pos.startsWith('bottom') ? 'bottom' : 'middle'
  const fits = tw <= width - 2 * p
  const textAlign: TextAlign = !fits ? 'center' : col === 'left' ? 'left' : col === 'right' ? 'right' : 'center'
  const x = textAlign === 'left' ? p : textAlign === 'right' ? Math.max(p, width - p) : width / 2
  const y =
    row === 'top'
      ? Math.min(height, p + th)
      : row === 'bottom'
        ? Math.min(height, Math.max(p + th, height - p))
        : Math.min(height, height / 2 + th / 2)
  return { x, y, textAlign }
}

/** A slant that matches the corner, so a corner badge reads diagonally. */
export function rotateFor(pos: Position): number {
  const row = pos.startsWith('top') ? 'top' : pos.startsWith('bottom') ? 'bottom' : 'middle'
  const col = pos.endsWith('left') ? 'left' : pos.endsWith('right') ? 'right' : 'center'
  if (row === 'middle' || col === 'center') return 0
  if (row === 'top') return col === 'left' ? -45 : 45
  return col === 'left' ? 45 : -45
}
