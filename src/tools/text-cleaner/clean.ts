export interface CleanOptions {
  trimLines: boolean
  removeEmptyLines: boolean
  singleSpaces: boolean
  smartQuotes: boolean
  dashes: boolean
  bullets: boolean
  removeEmojis: boolean
  removeNonAscii: boolean
  removeNumbers: boolean
  removePunctuation: boolean
  dedupeLines: boolean
  sortLines: boolean
  uppercase: boolean
  lowercase: boolean
}

export const DEFAULT_OPTIONS: CleanOptions = {
  trimLines: true,
  removeEmptyLines: true,
  singleSpaces: true,
  smartQuotes: true,
  dashes: true,
  bullets: false,
  removeEmojis: false,
  removeNonAscii: false,
  removeNumbers: false,
  removePunctuation: false,
  dedupeLines: false,
  sortLines: false,
  uppercase: false,
  lowercase: false,
}

export const PRESETS: { name: string; options: CleanOptions }[] = [
  {
    name: 'Tidy pasted text',
    options: { ...DEFAULT_OPTIONS },
  },
  {
    name: 'Dedupe a list',
    options: { ...DEFAULT_OPTIONS, dedupeLines: true, sortLines: true },
  },
  {
    name: 'Plain ASCII',
    options: { ...DEFAULT_OPTIONS, smartQuotes: false, dashes: false, removeEmojis: true, removeNonAscii: true },
  },
  {
    name: 'Letters only',
    options: {
      ...DEFAULT_OPTIONS,
      removeEmojis: true,
      removeNumbers: true,
      removePunctuation: true,
    },
  },
]

const EMOJI_RE = /[\p{Extended_Pictographic}\uFE0F\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}]/gu
const NON_ASCII_RE = /[^\x20-\x7E\n\t]/g

export function cleanText(input: string, opts: CleanOptions): string {
  let text = input.replace(/\r\n?/g, '\n')

  if (opts.removeEmojis) text = text.replace(EMOJI_RE, '')
  if (opts.smartQuotes) {
    text = text
      .replace(/[\u201C\u201D\u201E\u00AB\u00BB]/g, '"')
      .replace(/[\u2018\u2019\u201A]/g, "'")
      .replace(/[\u2032]/g, "'")
      .replace(/[\u2033]/g, '"')
  }
  if (opts.dashes) {
    text = text.replace(/[\u2013\u2014\u2015]/g, '-').replace(/\u2026/g, '...')
  }
  if (opts.removeNumbers) text = text.replace(/[0-9]/g, '')
  if (opts.removeNonAscii) text = text.replace(NON_ASCII_RE, '')
  if (opts.removePunctuation) text = text.replace(/[^\p{L}\p{N}\s]/gu, '')

  const lines = text.split('\n').map((line) => {
    let l = line
    if (opts.singleSpaces) l = l.replace(/[ \t]{2,}/g, ' ')
    if (opts.trimLines) l = l.trim()
    if (opts.bullets) l = l.replace(/^[-*•–—]+\s*/, '')
    return l
  })

  if (opts.removeEmptyLines) {
    const kept: string[] = []
    for (const l of lines) {
      if (l === '' && (kept.length === 0 || kept[kept.length - 1] === '')) continue
      kept.push(l)
    }
    while (kept.length && kept[kept.length - 1] === '') kept.pop()
    lines.length = 0
    lines.push(...kept)
  }

  if (opts.dedupeLines) {
    const seen = new Set<string>()
    const kept = lines.filter((l) => {
      if (l === '') return true
      if (seen.has(l)) return false
      seen.add(l)
      return true
    })
    lines.length = 0
    lines.push(...kept)
  }

  if (opts.sortLines && lines.length > 1) {
    const blanks = lines.filter((l) => l === '')
    const content = lines.filter((l) => l !== '').sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    const merged = blanks.length ? [...blanks, ...content] : content
    lines.length = 0
    lines.push(...merged)
  }

  let out = lines.join('\n')
  if (opts.uppercase) out = out.toUpperCase()
  if (opts.lowercase) out = out.toLowerCase()
  return out
}

export interface CleanStats {
  charsBefore: number
  charsAfter: number
  linesBefore: number
  linesAfter: number
  removedPct: number
}

export function cleanStats(input: string, output: string): CleanStats {
  const charsBefore = input.length
  const charsAfter = output.length
  const linesBefore = input === '' ? 0 : input.replace(/\r\n?/g, '\n').split('\n').length
  const linesAfter = output === '' ? 0 : output.split('\n').length
  const removedPct = charsBefore === 0 ? 0 : Math.max(0, Math.round(((charsBefore - charsAfter) / charsBefore) * 100))
  return { charsBefore, charsAfter, linesBefore, linesAfter, removedPct }
}
