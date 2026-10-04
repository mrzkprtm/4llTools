export type FrameStyle = 'border' | 'polaroid' | 'rounded' | 'shadow' | 'film'

export const FRAME_STYLES: { id: FrameStyle; label: string }[] = [
  { id: 'border', label: 'Simple border' },
  { id: 'polaroid', label: 'Polaroid' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'shadow', label: 'Drop shadow' },
  { id: 'film', label: 'Film strip' },
]

/** Extra room a style needs beyond the border: a shadow needs blur space, film needs a gutter. */
const EXTRA: Record<FrameStyle, number> = {
  border: 0,
  polaroid: 0,
  rounded: 0,
  shadow: 20,
  film: 12,
}

export interface FrameLayout {
  canvasW: number
  canvasH: number
  imageX: number
  imageY: number
  imageW: number
  imageH: number
  /** Vertical middle of the caption band under the photo. */
  captionY: number
}

/**
 * The canvas to build: the photo plus a margin on every side and, when
 * `captionSpace` is set, a matching band at the bottom for the caption.
 */
export function frameLayout(
  w: number,
  h: number,
  style: FrameStyle,
  border: number,
  captionSpace: number,
): FrameLayout {
  const width = Math.max(1, Math.round(w) || 1)
  const height = Math.max(1, Math.round(h) || 1)
  const b = Math.max(0, Math.round(border) || 0)
  const cap = Math.max(0, Math.round(captionSpace) || 0)
  const margin = b + (EXTRA[style] ?? 0)
  return {
    canvasW: width + 2 * margin,
    canvasH: height + 2 * margin + cap,
    imageX: margin,
    imageY: margin,
    imageW: width,
    imageH: height,
    captionY: margin + height + cap / 2,
  }
}

/** The corner radius a style brings, scaled to the photo size. */
export function cornerRadius(style: FrameStyle, w: number): number {
  const width = Number.isFinite(w) ? Math.max(0, w) : 0
  if (style === 'rounded') return Math.max(8, Math.min(32, Math.round(width * 0.05)))
  if (style === 'shadow') return 6
  if (style === 'polaroid') return 4
  if (style === 'film') return 3
  return 0
}
