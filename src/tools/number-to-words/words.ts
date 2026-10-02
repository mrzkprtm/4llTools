/** Numbers to English words and Indonesian "terbilang", exact for big numbers via BigInt/strings. */

export interface ParsedNumber {
  negative: boolean
  /** Integer digits without leading zeros ("0" for zero). */
  int: string
  /** Fraction digits as typed, without trailing zeros. */
  frac: string
}

export type DecimalSep = 'auto' | '.' | ','

export const MAX_DIGITS = 18 // up to 999 quadrillion / 999 kuadriliun

export function parseNumber(input: string, sep: DecimalSep = 'auto'): { ok: true; value: ParsedNumber } | { ok: false; error: string } {
  let s = input.trim().replace(/^(rp\.?|idr|usd|us\$|\$)\s*/i, '').replace(/\s*(rupiah|idr|usd|dollars?)$/i, '')
  s = s.replace(/[\s_'’]/g, '')
  if (!s) return { ok: false, error: 'Type a number.' }
  let negative = false
  if (/^[-−+]/.test(s)) {
    negative = s[0] !== '+'
    s = s.slice(1)
  }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return { ok: false, error: 'Use digits with optional . or , separators, e.g. 1,250,000.50 or 1.250.000,50.' }
  let decimal: '.' | ',' | null = null
  if (sep !== 'auto') decimal = s.includes(sep) ? sep : null
  else {
    const dots = (s.match(/\./g) ?? []).length
    const commas = (s.match(/,/g) ?? []).length
    if (dots && commas) decimal = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ','
    else if (dots + commas === 1) {
      const mark = dots ? '.' : ','
      const [a, b] = s.split(mark)
      // "1,250" or "12.500" read as thousands; "0.125", "1.5", "3,14" as decimals.
      decimal = b.length === 3 && a.length >= 1 && a.length <= 3 && !/^0+$/.test(a) ? null : mark
    }
  }
  const thousands = decimal === '.' ? ',' : decimal === ',' ? '.' : null
  let intPart = s
  let frac = ''
  if (decimal) {
    const parts = s.split(decimal)
    if (parts.length > 2) return { ok: false, error: `More than one decimal separator "${decimal}".` }
    ;[intPart, frac] = parts
  }
  const groupSep = thousands ?? (s.includes(',') ? ',' : '.')
  if (intPart.includes(groupSep)) {
    const groups = intPart.split(groupSep)
    if (groups.slice(1).some((g) => g.length !== 3) || groups[0].length === 0 || groups[0].length > 3) return { ok: false, error: 'Thousands separators must split the number into groups of three digits.' }
    intPart = groups.join('')
  }
  if (/[.,]/.test(intPart) || /[.,]/.test(frac)) return { ok: false, error: 'Could not tell the decimal separator apart from the thousands separator. Pick one below.' }
  const int = intPart.replace(/^0+(?=\d)/, '') || '0'
  frac = frac.replace(/0+$/, '')
  if (int.length > MAX_DIGITS) return { ok: false, error: `Too big: up to ${MAX_DIGITS} digits before the decimal point (999 quadrillion).` }
  if (frac.length > 20) return { ok: false, error: 'Up to 20 digits after the decimal point.' }
  if (int === '0' && !frac) negative = false
  return { ok: true, value: { negative, int, frac } }
}

/** Rounds to two decimals (half up), carrying into the integer part. */
export function toCents(n: ParsedNumber): { int: string; cents: number } {
  const f = (n.frac + '000').slice(0, 3)
  let cents = Number(f.slice(0, 2))
  let int = BigInt(n.int)
  if (Number(f[2]) >= 5) cents++
  if (cents === 100) {
    cents = 0
    int++
  }
  return { int: int.toString(), cents }
}

function groupsOf(int: string): number[] {
  const out: number[] = []
  for (let end = int.length; end > 0; end -= 3) out.unshift(Number(int.slice(Math.max(0, end - 3), end)))
  return out
}

// ---------------------------------------------------------------- English

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const EN_SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion']

function en999(n: number, useAnd: boolean): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  const parts: string[] = []
  if (h) parts.push(`${ONES[h]} hundred`)
  if (r) {
    if (h && useAnd) parts.push('and')
    parts.push(r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? `-${ONES[r % 10]}` : ''))
  }
  return parts.join(' ')
}

export function englishInt(int: string, useAnd = false): string {
  if (/^0*$/.test(int)) return 'zero'
  const groups = groupsOf(int)
  const words: string[] = []
  groups.forEach((g, i) => {
    if (!g) return
    const scale = EN_SCALES[groups.length - 1 - i]
    // British "one thousand and five": "and" before a last group under 100.
    if (useAnd && i === groups.length - 1 && g < 100 && words.length) words.push('and')
    words.push(en999(g, useAnd) + (scale ? ` ${scale}` : ''))
  })
  return words.join(' ')
}

const DIGIT_EN = ONES.slice(0, 10)

export function ordinalize(words: string): string {
  const m = /([a-z]+)$/.exec(words)!
  const last = m[1]
  const irregular: Record<string, string> = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' }
  const ord = irregular[last] ?? (last.endsWith('y') ? last.slice(0, -1) + 'ieth' : last + 'th')
  return words.slice(0, m.index) + ord
}

export type EnglishStyle = 'cardinal' | 'ordinal' | 'currency' | 'check'

export interface EnglishOptions {
  style: EnglishStyle
  /** British "one hundred and five". */
  useAnd?: boolean
  major?: [string, string]
  minor?: [string, string]
}

export function toEnglish(n: ParsedNumber, o: EnglishOptions): string {
  const sign = n.negative ? 'negative ' : ''
  const [maj1, majN] = o.major ?? ['dollar', 'dollars']
  const [min1, minN] = o.minor ?? ['cent', 'cents']
  switch (o.style) {
    case 'cardinal': {
      const base = englishInt(n.int, o.useAnd)
      const frac = n.frac ? ` point ${[...n.frac].map((d) => DIGIT_EN[Number(d)]).join(' ')}` : ''
      return sign + base + frac
    }
    case 'ordinal':
      if (n.frac) throw new Error('Ordinals need a whole number (like 21 → twenty-first).')
      return sign + ordinalize(englishInt(n.int, o.useAnd))
    case 'currency': {
      const { int, cents } = toCents(n)
      const main = `${englishInt(int, o.useAnd)} ${int === '1' ? maj1 : majN}`
      return sign + main + (cents ? ` and ${englishInt(String(cents))} ${cents === 1 ? min1 : minN}` : '')
    }
    case 'check': {
      const { int, cents } = toCents(n)
      const words = englishInt(int, o.useAnd)
      return `${sign}${words} and ${String(cents).padStart(2, '0')}/100 ${majN}`
    }
  }
}

// ---------------------------------------------------------------- Indonesian (terbilang)

const SATUAN = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan']
const ID_SCALES = ['', 'ribu', 'juta', 'miliar', 'triliun', 'kuadriliun']

function id999(n: number): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  const parts: string[] = []
  if (h === 1) parts.push('seratus')
  else if (h) parts.push(`${SATUAN[h]} ratus`)
  if (r === 10) parts.push('sepuluh')
  else if (r === 11) parts.push('sebelas')
  else if (r > 11 && r < 20) parts.push(`${SATUAN[r - 10]} belas`)
  else if (r >= 20) parts.push(`${SATUAN[Math.floor(r / 10)]} puluh` + (r % 10 ? ` ${SATUAN[r % 10]}` : ''))
  else if (r) parts.push(SATUAN[r])
  return parts.join(' ')
}

export function indonesianInt(int: string): string {
  if (/^0*$/.test(int)) return 'nol'
  const groups = groupsOf(int)
  const words: string[] = []
  groups.forEach((g, i) => {
    if (!g) return
    const scaleIdx = groups.length - 1 - i
    if (scaleIdx === 1 && g === 1) words.push('seribu')
    else words.push(id999(g) + (scaleIdx ? ` ${ID_SCALES[scaleIdx]}` : ''))
  })
  return words.join(' ')
}

export interface IndonesianOptions {
  /** Append "rupiah" (and "sen" for decimals). */
  rupiah: boolean
}

export function toIndonesian(n: ParsedNumber, o: IndonesianOptions): string {
  const sign = n.negative ? 'minus ' : ''
  if (o.rupiah) {
    const { int, cents } = toCents(n)
    return `${sign}${indonesianInt(int)} rupiah${cents ? ` ${indonesianInt(String(cents))} sen` : ''}`
  }
  const frac = n.frac ? ` koma ${[...n.frac].map((d) => SATUAN[Number(d)]).join(' ')}` : ''
  return sign + indonesianInt(n.int) + frac
}

// ---------------------------------------------------------------- casing

export type Casing = 'lower' | 'sentence' | 'title' | 'upper'

export function applyCase(s: string, c: Casing): string {
  if (c === 'upper') return s.toUpperCase()
  if (c === 'sentence') return s.charAt(0).toUpperCase() + s.slice(1)
  if (c === 'title') return s.replace(/(^|[\s-])([a-z])/g, (_, p: string, ch: string) => p + ch.toUpperCase())
  return s
}

/** "1234567.5" → "1,234,567.5" for showing how the input was read. */
export function formatParsed(n: ParsedNumber, locale: 'en' | 'id'): string {
  const [g, d] = locale === 'en' ? [',', '.'] : ['.', ',']
  const int = n.int.replace(/\B(?=(\d{3})+(?!\d))/g, g)
  return `${n.negative ? '−' : ''}${int}${n.frac ? d + n.frac : ''}`
}
