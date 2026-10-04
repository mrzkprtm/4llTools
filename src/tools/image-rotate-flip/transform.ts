export type Turns = 0 | 1 | 2 | 3

/** Quarter turns folded into 0…3, so -1 becomes 3 and 7 becomes 3. */
export function normalizeTurns(n: number): Turns {
  const t = Math.round(n)
  if (!Number.isFinite(t)) return 0
  return (((t % 4) + 4) % 4) as Turns
}

const dim = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)

/** Canvas size after rotating: odd quarter turns swap width and height. */
export function rotatedSize(w: number, h: number, turns: number): { w: number; h: number } {
  const t = normalizeTurns(turns)
  return t % 2 === 0 ? { w: dim(w), h: dim(h) } : { w: dim(h), h: dim(w) }
}

/** Canvas scale factors for the two flips. */
export function flipScale(flipH: boolean, flipV: boolean): { sx: number; sy: number } {
  return { sx: flipH ? -1 : 1, sy: flipV ? -1 : 1 }
}

/** A short sentence for the status line, e.g. "Rotated 90° clockwise". */
export function describe(turns: number, flipH: boolean, flipV: boolean): string {
  const t = normalizeTurns(turns)
  const parts: string[] = []
  if (t === 1) parts.push('Rotated 90° clockwise')
  else if (t === 2) parts.push('Rotated 180°')
  else if (t === 3) parts.push('Rotated 90° counter-clockwise')
  if (flipH && flipV) parts.push('flipped horizontally and vertically')
  else if (flipH) parts.push('flipped horizontally')
  else if (flipV) parts.push('flipped vertically')
  if (parts.length === 0) return 'Original orientation'
  const text = parts.join(', ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
