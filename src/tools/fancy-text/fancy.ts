/** Unicode "fancy text" styles: plain letters mapped to look-alike Unicode characters. */

export interface FancyStyle {
  id: string
  name: string
  group: 'Bold & italic' | 'Script & gothic' | 'Enclosed' | 'Lines & effects' | 'Other'
  convert: (text: string) => string
}

const cp = (n: number) => String.fromCodePoint(n)

/** Maps A–Z, a–z and optionally 0–9 to a block of mathematical alphanumerics, with per-letter exceptions. */
function alpha(upper: number, lower: number, digit?: number, holes: Record<string, number> = {}) {
  return (text: string) =>
    Array.from(text, (ch) => {
      if (holes[ch] !== undefined) return cp(holes[ch])
      const c = ch.codePointAt(0)!
      if (c >= 65 && c <= 90) return cp(upper + c - 65)
      if (c >= 97 && c <= 122) return cp(lower + c - 97)
      if (digit !== undefined && c >= 48 && c <= 57) return cp(digit + c - 48)
      return ch
    }).join('')
}

function table(map: Record<string, string>, { reverse = false, fold = false } = {}) {
  return (text: string) => {
    const chars = Array.from(text, (ch) => map[ch] ?? (fold ? map[ch.toLowerCase()] ?? map[ch.toUpperCase()] : undefined) ?? ch)
    return (reverse ? chars.reverse() : chars).join('')
  }
}

function combining(mark: string) {
  return (text: string) => Array.from(text, (ch) => (ch === '\n' ? ch : ch + mark)).join('')
}

const SCRIPT_HOLES = { B: 0x212c, E: 0x2130, F: 0x2131, H: 0x210b, I: 0x2110, L: 0x2112, M: 0x2133, R: 0x211b, e: 0x212f, g: 0x210a, o: 0x2134 }
const FRAKTUR_HOLES = { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 }
const DOUBLE_HOLES = { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 }

function circled(text: string): string {
  return Array.from(text, (ch) => {
    const c = ch.codePointAt(0)!
    if (c >= 65 && c <= 90) return cp(0x24b6 + c - 65)
    if (c >= 97 && c <= 122) return cp(0x24d0 + c - 97)
    if (c === 48) return '⓪'
    if (c >= 49 && c <= 57) return cp(0x2460 + c - 49)
    return ch
  }).join('')
}

function negCircled(text: string): string {
  return Array.from(text, (ch) => {
    const c = ch.toUpperCase().codePointAt(0)!
    if (c >= 65 && c <= 90) return cp(0x1f150 + c - 65)
    if (c === 48) return '⓿'
    if (c >= 49 && c <= 57) return cp(0x2776 + c - 49)
    return ch
  }).join('')
}

function squared(start: number) {
  return (text: string) =>
    Array.from(text, (ch) => {
      const c = ch.toUpperCase().codePointAt(0)!
      return c >= 65 && c <= 90 ? cp(start + c - 65) : ch
    }).join('')
}

function fullWidth(text: string): string {
  return Array.from(text, (ch) => {
    const c = ch.codePointAt(0)!
    if (c === 32) return '　'
    if (c >= 0x21 && c <= 0x7e) return cp(c + 0xfee0)
    return ch
  }).join('')
}

const SMALL_CAPS: Record<string, string> = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ',
  n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
}

const UPSIDE_DOWN: Record<string, string> = {
  a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ', k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o',
  p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z',
  A: '∀', B: 'ꓭ', C: 'Ɔ', D: 'ꓷ', E: 'Ǝ', F: 'Ⅎ', G: '⅁', H: 'H', I: 'I', J: 'ſ', K: 'ꓘ', L: '˥', M: 'W', N: 'N', O: 'O',
  P: 'Ԁ', Q: 'Ό', R: 'ꓤ', S: 'S', T: '⊥', U: '∩', V: 'Λ', W: 'M', X: 'X', Y: '⅄', Z: 'Z',
  '1': 'Ɩ', '2': 'ᘔ', '3': 'Ɛ', '4': 'ㄣ', '5': 'ϛ', '6': '9', '7': 'ㄥ', '8': '8', '9': '6', '0': '0',
  '.': '˙', ',': "'", "'": ',', '"': '„', '?': '¿', '!': '¡', '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{',
  '<': '>', '>': '<', '_': '‾', '&': '⅋', ';': '؛',
}

export const STYLES: FancyStyle[] = [
  { id: 'bold', name: 'Bold', group: 'Bold & italic', convert: alpha(0x1d400, 0x1d41a, 0x1d7ce) },
  { id: 'italic', name: 'Italic', group: 'Bold & italic', convert: alpha(0x1d434, 0x1d44e, undefined, { h: 0x210e }) },
  { id: 'bold-italic', name: 'Bold italic', group: 'Bold & italic', convert: alpha(0x1d468, 0x1d482) },
  { id: 'sans', name: 'Sans', group: 'Bold & italic', convert: alpha(0x1d5a0, 0x1d5ba, 0x1d7e2) },
  { id: 'sans-bold', name: 'Sans bold', group: 'Bold & italic', convert: alpha(0x1d5d4, 0x1d5ee, 0x1d7ec) },
  { id: 'sans-italic', name: 'Sans italic', group: 'Bold & italic', convert: alpha(0x1d608, 0x1d622) },
  { id: 'sans-bold-italic', name: 'Sans bold italic', group: 'Bold & italic', convert: alpha(0x1d63c, 0x1d656) },
  { id: 'mono', name: 'Monospace', group: 'Bold & italic', convert: alpha(0x1d670, 0x1d68a, 0x1d7f6) },
  { id: 'script', name: 'Script', group: 'Script & gothic', convert: alpha(0x1d49c, 0x1d4b6, undefined, SCRIPT_HOLES) },
  { id: 'bold-script', name: 'Bold script', group: 'Script & gothic', convert: alpha(0x1d4d0, 0x1d4ea) },
  { id: 'fraktur', name: 'Fraktur (gothic)', group: 'Script & gothic', convert: alpha(0x1d504, 0x1d51e, undefined, FRAKTUR_HOLES) },
  { id: 'bold-fraktur', name: 'Bold fraktur', group: 'Script & gothic', convert: alpha(0x1d56c, 0x1d586) },
  { id: 'double', name: 'Double-struck', group: 'Script & gothic', convert: alpha(0x1d538, 0x1d552, 0x1d7d8, DOUBLE_HOLES) },
  { id: 'circled', name: 'Bubble', group: 'Enclosed', convert: circled },
  { id: 'neg-circled', name: 'Black bubble', group: 'Enclosed', convert: negCircled },
  { id: 'squared', name: 'Squared', group: 'Enclosed', convert: squared(0x1f130) },
  { id: 'neg-squared', name: 'Black squared', group: 'Enclosed', convert: squared(0x1f170) },
  { id: 'strike', name: 'Strikethrough', group: 'Lines & effects', convert: combining('̶') },
  { id: 'underline', name: 'Underline', group: 'Lines & effects', convert: combining('̲') },
  { id: 'double-underline', name: 'Double underline', group: 'Lines & effects', convert: combining('̳') },
  { id: 'slash', name: 'Slashed', group: 'Lines & effects', convert: combining('̸') },
  { id: 'small-caps', name: 'Small caps', group: 'Other', convert: table(SMALL_CAPS, { fold: true }) },
  { id: 'upside-down', name: 'Upside down', group: 'Other', convert: table(UPSIDE_DOWN, { reverse: true }) },
  { id: 'full-width', name: 'Full-width (vaporwave)', group: 'Other', convert: fullWidth },
  { id: 'spaced', name: 'S p a c e d', group: 'Other', convert: (t) => Array.from(t).join(' ') },
]

export const GROUPS = ['All', ...new Set(STYLES.map((s) => s.group))] as const

/** Length as most social apps count it (UTF-16 code units), and as users see it (code points). */
export function lengths(text: string): { units: number; chars: number } {
  return { units: text.length, chars: [...text].length }
}
