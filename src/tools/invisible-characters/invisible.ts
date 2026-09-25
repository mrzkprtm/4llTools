/** Detects and cleans invisible, look-alike and unusual characters. */

export type ClassId = 'zero-width' | 'space' | 'soft-hyphen' | 'bidi' | 'tag' | 'control' | 'quote' | 'dash' | 'ellipsis' | 'separator'

export interface CharClass {
  id: ClassId
  label: string
  fix: string
  /** Shown with a warning colour because it can hide or disguise content. */
  risky: boolean
}

export const CLASSES: CharClass[] = [
  { id: 'zero-width', label: 'Zero-width characters', fix: 'Remove (keeps joiners inside emoji)', risky: true },
  { id: 'bidi', label: 'Bidirectional controls (Trojan Source)', fix: 'Remove', risky: true },
  { id: 'tag', label: 'Unicode tag characters (hidden text)', fix: 'Remove (keeps them in flag emoji)', risky: true },
  { id: 'control', label: 'Control characters', fix: 'Remove', risky: true },
  { id: 'space', label: 'Non-standard spaces (NBSP, thin, ideographic…)', fix: 'Replace with a normal space', risky: false },
  { id: 'soft-hyphen', label: 'Soft hyphens', fix: 'Remove', risky: false },
  { id: 'separator', label: 'Unicode line/paragraph separators', fix: 'Replace with a line break', risky: false },
  { id: 'quote', label: 'Smart quotes and primes', fix: 'Replace with straight quotes \' "', risky: false },
  { id: 'dash', label: 'Dashes and minus signs', fix: 'Replace with a hyphen -', risky: false },
  { id: 'ellipsis', label: 'Ellipsis character …', fix: 'Replace with three dots ...', risky: false },
]

const NAMES: Record<number, [string, string]> = {
  0x200b: ['ZWSP', 'Zero width space'],
  0x200c: ['ZWNJ', 'Zero width non-joiner'],
  0x200d: ['ZWJ', 'Zero width joiner'],
  0x2060: ['WJ', 'Word joiner'],
  0xfeff: ['BOM', 'Zero width no-break space / byte order mark'],
  0x180e: ['MVS', 'Mongolian vowel separator'],
  0x2061: ['FA', 'Function application'],
  0x2062: ['IT', 'Invisible times'],
  0x2063: ['IS', 'Invisible separator'],
  0x2064: ['IP', 'Invisible plus'],
  0x034f: ['CGJ', 'Combining grapheme joiner'],
  0x115f: ['HF', 'Hangul choseong filler'],
  0x1160: ['HF', 'Hangul jungseong filler'],
  0x3164: ['HF', 'Hangul filler'],
  0x00a0: ['NBSP', 'No-break space'],
  0x202f: ['NNBSP', 'Narrow no-break space'],
  0x2000: ['NQSP', 'En quad'],
  0x2001: ['MQSP', 'Em quad'],
  0x2002: ['ENSP', 'En space'],
  0x2003: ['EMSP', 'Em space'],
  0x2004: ['3/MSP', 'Three-per-em space'],
  0x2005: ['4/MSP', 'Four-per-em space'],
  0x2006: ['6/MSP', 'Six-per-em space'],
  0x2007: ['FSP', 'Figure space'],
  0x2008: ['PSP', 'Punctuation space'],
  0x2009: ['THSP', 'Thin space'],
  0x200a: ['HSP', 'Hair space'],
  0x205f: ['MMSP', 'Medium mathematical space'],
  0x3000: ['IDSP', 'Ideographic space'],
  0x1680: ['OSM', 'Ogham space mark'],
  0x00ad: ['SHY', 'Soft hyphen'],
  0x202a: ['LRE', 'Left-to-right embedding'],
  0x202b: ['RLE', 'Right-to-left embedding'],
  0x202c: ['PDF', 'Pop directional formatting'],
  0x202d: ['LRO', 'Left-to-right override'],
  0x202e: ['RLO', 'Right-to-left override'],
  0x2066: ['LRI', 'Left-to-right isolate'],
  0x2067: ['RLI', 'Right-to-left isolate'],
  0x2068: ['FSI', 'First strong isolate'],
  0x2069: ['PDI', 'Pop directional isolate'],
  0x200e: ['LRM', 'Left-to-right mark'],
  0x200f: ['RLM', 'Right-to-left mark'],
  0x061c: ['ALM', 'Arabic letter mark'],
  0x2028: ['LSEP', 'Line separator'],
  0x2029: ['PSEP', 'Paragraph separator'],
  0x2018: ['‘', 'Left single quotation mark'],
  0x2019: ['’', 'Right single quotation mark / apostrophe'],
  0x201a: ['‚', 'Single low-9 quotation mark'],
  0x201b: ['‛', 'Single high-reversed-9 quotation mark'],
  0x2032: ['′', 'Prime'],
  0x201c: ['“', 'Left double quotation mark'],
  0x201d: ['”', 'Right double quotation mark'],
  0x201e: ['„', 'Double low-9 quotation mark'],
  0x201f: ['‟', 'Double high-reversed-9 quotation mark'],
  0x2033: ['″', 'Double prime'],
  0x2010: ['‐', 'Hyphen'],
  0x2011: ['‑', 'Non-breaking hyphen'],
  0x2012: ['‒', 'Figure dash'],
  0x2013: ['–', 'En dash'],
  0x2014: ['—', 'Em dash'],
  0x2015: ['―', 'Horizontal bar'],
  0x2212: ['−', 'Minus sign'],
  0x2026: ['…', 'Horizontal ellipsis'],
}

const SINGLE_QUOTES = new Set([0x2018, 0x2019, 0x201a, 0x201b, 0x2032])
const DOUBLE_QUOTES = new Set([0x201c, 0x201d, 0x201e, 0x201f, 0x2033])

export function classify(cp: number): ClassId | null {
  if ([0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x180e, 0x2061, 0x2062, 0x2063, 0x2064, 0x034f, 0x115f, 0x1160, 0x3164].includes(cp)) return 'zero-width'
  if (cp === 0x00a0 || cp === 0x202f || (cp >= 0x2000 && cp <= 0x200a) || cp === 0x205f || cp === 0x3000 || cp === 0x1680) return 'space'
  if (cp === 0x00ad) return 'soft-hyphen'
  if ((cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069) || cp === 0x200e || cp === 0x200f || cp === 0x061c) return 'bidi'
  if (cp >= 0xe0000 && cp <= 0xe007f) return 'tag'
  if (cp === 0x2028 || cp === 0x2029) return 'separator'
  if ((cp < 0x20 && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d) || (cp >= 0x7f && cp <= 0x9f) || cp === 0xfffc) return 'control'
  if (SINGLE_QUOTES.has(cp) || DOUBLE_QUOTES.has(cp)) return 'quote'
  if ((cp >= 0x2010 && cp <= 0x2015) || cp === 0x2212) return 'dash'
  if (cp === 0x2026) return 'ellipsis'
  return null
}

export function describe(cp: number): { short: string; name: string; code: string } {
  const code = 'U+' + cp.toString(16).toUpperCase().padStart(4, '0')
  const known = NAMES[cp]
  if (known) return { short: known[0], name: known[1], code }
  if (cp >= 0xe0000 && cp <= 0xe007f) {
    const ascii = cp - 0xe0000
    return { short: ascii >= 0x20 && ascii < 0x7f ? `TAG ${String.fromCharCode(ascii)}` : 'TAG', name: 'Tag character', code }
  }
  if (cp < 0x20) return { short: ['NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL', 'BS', 'HT', 'LF', 'VT', 'FF', 'CR', 'SO', 'SI', 'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB', 'CAN', 'EM', 'SUB', 'ESC', 'FS', 'GS', 'RS', 'US'][cp], name: 'Control character', code }
  if (cp === 0x7f) return { short: 'DEL', name: 'Delete', code }
  if (cp === 0xfffc) return { short: 'OBJ', name: 'Object replacement character', code }
  return { short: code, name: 'Control character', code }
}

export interface Finding {
  index: number
  /** Length in UTF-16 units (2 for tag characters). */
  length: number
  cp: number
  cls: ClassId
}

const PICTO = /\p{Extended_Pictographic}/u
// Before a joiner: an emoji, a skin-tone modifier or the emoji variation selector (❤️‍🔥, 👩🏽‍💻).
const EMOJI_BEFORE_ZWJ = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\uFE0F]/u
const isFlagTagContext = (text: string, index: number) => {
  // Subdivision flags: 🏴 followed by tag letters and ending with U+E007F.
  let i = index
  while (i > 0) {
    const prev = text.codePointAt(i - 2)
    if (prev !== undefined && prev >= 0xe0000 && prev <= 0xe007f) i -= 2
    else break
  }
  return text.codePointAt(i - 2) === 0x1f3f4
}

/** True when a character is part of a legitimate emoji sequence and should be kept. */
export function isEmojiPart(text: string, f: Finding): boolean {
  if (f.cp === 0x200d) {
    const lo = text.charCodeAt(f.index - 1)
    const before = lo >= 0xdc00 && lo <= 0xdfff ? text.slice(f.index - 2, f.index) : text.slice(f.index - 1, f.index)
    const after = String.fromCodePoint(text.codePointAt(f.index + 1) ?? 0x20)
    return EMOJI_BEFORE_ZWJ.test(before) && PICTO.test(after)
  }
  if (f.cls === 'tag') return isFlagTagContext(text, f.index)
  return false
}

export function scan(text: string): Finding[] {
  const out: Finding[] = []
  for (let i = 0; i < text.length; ) {
    const cp = text.codePointAt(i)!
    const len = cp > 0xffff ? 2 : 1
    const cls = classify(cp)
    if (cls) out.push({ index: i, length: len, cp, cls })
    i += len
  }
  return out
}

export function countByClass(text: string, findings: readonly Finding[]): Record<ClassId, number> {
  const counts = Object.fromEntries(CLASSES.map((c) => [c.id, 0])) as Record<ClassId, number>
  for (const f of findings) if (!isEmojiPart(text, f)) counts[f.cls]++
  return counts
}

function replacement(f: Finding): string {
  switch (f.cls) {
    case 'space':
      return ' '
    case 'separator':
      return '\n'
    case 'quote':
      return SINGLE_QUOTES.has(f.cp) ? "'" : '"'
    case 'dash':
      return '-'
    case 'ellipsis':
      return '...'
    default:
      return ''
  }
}

/** Cleans the selected classes. Emoji joiners and flag tags are kept so emoji don't break. */
export function clean(text: string, fix: ReadonlySet<ClassId>): string {
  let out = ''
  let pos = 0
  for (const f of scan(text)) {
    if (!fix.has(f.cls) || isEmojiPart(text, f)) continue
    out += text.slice(pos, f.index) + replacement(f)
    pos = f.index + f.length
  }
  return out + text.slice(pos)
}

/** Decodes hidden ASCII carried in tag characters ("ASCII smuggling"), ignoring flag emoji. */
export function hiddenTagText(text: string): string {
  let out = ''
  for (const f of scan(text)) {
    if (f.cls !== 'tag' || isEmojiPart(text, f)) continue
    const a = f.cp - 0xe0000
    if (a >= 0x20 && a < 0x7f) out += String.fromCharCode(a)
  }
  return out
}
