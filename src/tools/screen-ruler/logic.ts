/** Screen measuring math: CSS px ↔ mm calibration and protractor angles. */

/** ISO/IEC 7810 ID-1 (credit card) size in millimeters. */
export const CARD = { w: 85.6, h: 53.98 } as const
export const MM_PER_IN = 25.4

/**
 * First guess of CSS pixels per millimeter before calibration. Desktop browsers
 * aim for 96 CSS px per inch; phones and tablets usually show more.
 */
export function guessPxPerMm(dpr: number, coarse: boolean): number {
  const ppi = !coarse ? 96 : dpr >= 3 ? 150 : dpr >= 2 ? 132 : 110
  return ppi / MM_PER_IN
}

/** Calibration from the on-screen card width (CSS px) that matches a real card. */
export const calibrate = (cardWidthPx: number) => cardWidthPx / CARD.w

export const pxToMm = (px: number, pxPerMm: number) => px / pxPerMm
export const mmToPx = (mm: number, pxPerMm: number) => mm * pxPerMm
export const mmToIn = (mm: number) => mm / MM_PER_IN

export interface Pt {
  x: number
  y: number
}

export const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y)

/**
 * Angle at vertex `v` between arms to `a` and `b`, in degrees (0–180), plus the
 * start angle and signed sweep (radians, screen coordinates) for drawing its arc.
 */
export function angleAt(v: Pt, a: Pt, b: Pt): { deg: number; start: number; sweep: number } {
  const t1 = Math.atan2(a.y - v.y, a.x - v.x)
  const t2 = Math.atan2(b.y - v.y, b.x - v.x)
  let sweep = t2 - t1
  while (sweep > Math.PI) sweep -= 2 * Math.PI
  while (sweep < -Math.PI) sweep += 2 * Math.PI
  return { deg: (Math.abs(sweep) * 180) / Math.PI, start: t1, sweep }
}

/** SVG path for an arc of radius r around v from `start` through `sweep` radians. */
export function arcPath(v: Pt, r: number, start: number, sweep: number): string {
  const x1 = v.x + r * Math.cos(start)
  const y1 = v.y + r * Math.sin(start)
  const x2 = v.x + r * Math.cos(start + sweep)
  const y2 = v.y + r * Math.sin(start + sweep)
  return `M${v.x} ${v.y} L${x1} ${y1} A${r} ${r} 0 0 ${sweep > 0 ? 1 : 0} ${x2} ${y2} Z`
}

/** Formats a length in mm as "12.3 cm · 4.84 in". */
export function formatLength(mm: number): string {
  return `${(mm / 10).toFixed(mm < 100 ? 2 : 1)} cm · ${mmToIn(mm).toFixed(2)} in`
}
