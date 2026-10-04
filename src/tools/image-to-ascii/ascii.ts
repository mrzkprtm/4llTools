/** Ramps ordered from the lightest glyph (top of the ramp) to the densest. */
export const CHAR_SETS: Record<string, string> = {
  classic: ' .:-=+*#%@',
  blocks: ' ░▒▓█',
  simple: ' .*#',
  dots: ' ⠁⠃⠇⠧⠷⠿',
}

/** Rec. 709 relative luminance, rounded to 0…255. */
export function luminance(r: number, g: number, b: number): number {
  return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)
}

/**
 * Rows needed so the characters look proportional: a monospace cell is about
 * twice as tall as it is wide.
 */
export function charRows(srcW: number, srcH: number, width: number): number {
  if (!(srcW > 0) || !(srcH > 0) || !(width > 0)) return 1
  return Math.max(1, Math.round((srcH / srcW) * width * 0.5))
}

const glyphAt = (ramp: string, lum: number): string => {
  const last = ramp.length - 1
  const index = Math.min(last, Math.max(0, last - Math.round((lum / 255) * last)))
  return ramp[index]
}

/** One string per row: light pixels get the sparse end of the ramp, dark ones the dense end. */
export function toAscii(pixels: ArrayLike<number>, width: number, height: number, chars: string): string[] {
  const ramp = chars.length > 0 ? chars : ' '
  const rows: string[] = []
  for (let y = 0; y < height; y++) {
    let row = ''
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      row += glyphAt(ramp, luminance(pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0))
    }
    rows.push(row)
  }
  return rows
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' }
const escape = (s: string) => s.replace(/[&<>]/g, (c) => ESCAPES[c])

/** The same rows, but every glyph wrapped in a span carrying its pixel color. */
export function toAsciiHtml(pixels: ArrayLike<number>, width: number, height: number, chars: string): string {
  const ramp = chars.length > 0 ? chars : ' '
  const rows: string[] = []
  for (let y = 0; y < height; y++) {
    let row = ''
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const r = pixels[i] ?? 0
      const g = pixels[i + 1] ?? 0
      const b = pixels[i + 2] ?? 0
      row += `<span style="color:rgb(${r} ${g} ${b})">${escape(glyphAt(ramp, luminance(r, g, b)))}</span>`
    }
    rows.push(row)
  }
  return rows.join('\n')
}
