/** Pure page-layout math for Images to PDF. PDF units are points (1/72 inch); origin is bottom-left. */

export type PageSize = 'a4' | 'letter' | 'legal' | 'fit'
export type Orientation = 'auto' | 'portrait' | 'landscape'
export type Fit = 'contain' | 'cover'

export const PAGE_SIZES: Record<Exclude<PageSize, 'fit'>, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
}

/** Image pixels are treated as CSS pixels (96 per inch) for "fit to image" pages. */
export const PX_TO_PT = 72 / 96

export function pageSize(imgW: number, imgH: number, size: PageSize, orientation: Orientation, margin: number): [number, number] {
  if (size === 'fit') return [imgW * PX_TO_PT + 2 * margin, imgH * PX_TO_PT + 2 * margin]
  const [a, b] = PAGE_SIZES[size]
  const landscape = orientation === 'landscape' || (orientation === 'auto' && imgW > imgH)
  return landscape ? [b, a] : [a, b]
}

export interface Placement {
  x: number
  y: number
  w: number
  h: number
  /** Source crop in image pixels (cover mode). */
  crop: { sx: number; sy: number; sw: number; sh: number }
}

export function placeImage(imgW: number, imgH: number, pageW: number, pageH: number, margin: number, fit: Fit): Placement {
  const m = Math.max(0, Math.min(margin, pageW / 2 - 1, pageH / 2 - 1))
  const boxW = pageW - 2 * m
  const boxH = pageH - 2 * m
  const full = { sx: 0, sy: 0, sw: imgW, sh: imgH }
  if (fit === 'cover') {
    const s = Math.max(boxW / imgW, boxH / imgH)
    const sw = boxW / s
    const sh = boxH / s
    return { x: m, y: m, w: boxW, h: boxH, crop: { sx: (imgW - sw) / 2, sy: (imgH - sh) / 2, sw, sh } }
  }
  const s = Math.min(boxW / imgW, boxH / imgH)
  const w = imgW * s
  const h = imgH * s
  return { x: (pageW - w) / 2, y: (pageH - h) / 2, w, h, crop: full }
}

/**
 * Pixel size to encode a (cropped) image at so it has `dpi` dots per inch in
 * its box on the page; never upscales. dpi 0 keeps the original pixels.
 */
export function targetPixels(cropW: number, cropH: number, boxWpt: number, boxHpt: number, dpi: number): { w: number; h: number } {
  if (!dpi) return { w: Math.round(cropW), h: Math.round(cropH) }
  const s = Math.min(1, Math.max((boxWpt / 72) * dpi / cropW, (boxHpt / 72) * dpi / cropH))
  return { w: Math.max(1, Math.round(cropW * s)), h: Math.max(1, Math.round(cropH * s)) }
}

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(2)} MB`)

export function pdfFileName(name: string): string {
  const clean = name.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\.pdf$/i, '')
  return `${clean || 'images'}.pdf`
}
