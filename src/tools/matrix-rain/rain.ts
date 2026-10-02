/** Glyph sets and falling-column state for digital rain. */

export type GlyphSet = 'katakana' | 'latin' | 'digits' | 'binary' | 'custom'

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i))

/** Half-width katakana (as in the film) plus digits. */
const KATAKANA = [...range(0xff66, 0xff9d), ...range(0x30, 0x39)]

/**
 * The characters to rain. Custom strings are split into code points; spaces, control characters
 * and emoji are dropped and duplicates removed. Falls back to binary when nothing usable is left.
 */
export function parseGlyphs(set: GlyphSet, custom = ''): string[] {
  if (set === 'katakana') return KATAKANA
  if (set === 'latin') return range(0x41, 0x5a)
  if (set === 'digits') return range(0x30, 0x39)
  if (set === 'binary') return ['0', '1']
  const out: string[] = []
  for (const ch of Array.from(custom)) {
    if (/\s|\p{Cc}|\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\p{M}|\u200d|[\u{e0020}-\u{e007f}]/u.test(ch)) continue
    if (!out.includes(ch)) out.push(ch)
  }
  return out.length ? out : ['0', '1']
}

export interface Column {
  /** Head position in rows (fractional). */
  y: number
  /** Rows per second. */
  speed: number
  /** Trail length in rows. */
  len: number
  /** Seconds to wait before the next drop starts. */
  wait: number
  glyphs: string[]
  /** Characters of a word being spelled down this column, starting at msgRow. */
  msg: string[] | null
  msgRow: number
}

const pick = (glyphs: string[], random: () => number) => glyphs[Math.floor(random() * glyphs.length)]

export function makeColumn(rows: number, glyphs: string[], random: () => number): Column {
  const c: Column = { y: 0, speed: 0, len: 0, wait: 0, glyphs: Array.from({ length: rows }, () => pick(glyphs, random)), msg: null, msgRow: 0 }
  restart(c, rows, random, 1)
  // Start partway down so the screen is full straight away.
  c.y = random() * (rows + c.len)
  c.wait = 0
  return c
}

/** Sends a fresh drop down the column after a pause that is longer when the density is low. */
export function restart(c: Column, rows: number, random: () => number, density: number) {
  c.y = -random() * 4
  c.speed = 8 + random() * 16
  c.len = Math.round(6 + random() * rows * 0.7)
  c.wait = (random() * 2.5 * (1 - density)) / Math.max(0.05, density)
  c.msg = null
}

/**
 * Advances a column by dt seconds (speed already scaled). Returns true when the drop left the
 * bottom of the screen and a new one was queued.
 */
export function stepColumn(c: Column, dt: number, rows: number, random: () => number, density: number): boolean {
  if (c.wait > 0) {
    c.wait -= dt
    return false
  }
  c.y += c.speed * dt
  if (c.y - c.len > rows) {
    restart(c, rows, random, density)
    return true
  }
  return false
}

/** Starts spelling `word` in the column: slower and long enough to show the whole word. */
export function spell(c: Column, word: string, rows: number) {
  const chars = Array.from(word)
  c.msg = chars
  c.msgRow = Math.max(0, Math.floor((rows - chars.length) * 0.3))
  c.y = -1
  c.wait = 0
  c.speed = 7
  c.len = chars.length + 12
  chars.forEach((ch, i) => {
    if (c.msgRow + i < c.glyphs.length) c.glyphs[c.msgRow + i] = ch
  })
}

/** Randomly swaps `count` glyphs (never those of a word being spelled). */
export function mutate(cols: Column[], count: number, glyphs: string[], random: () => number) {
  for (let k = 0; k < count; k++) {
    const c = cols[Math.floor(random() * cols.length)]
    if (!c) return
    const r = Math.floor(random() * c.glyphs.length)
    if (c.msg && r >= c.msgRow && r < c.msgRow + c.msg.length) continue
    c.glyphs[r] = pick(glyphs, random)
  }
}
