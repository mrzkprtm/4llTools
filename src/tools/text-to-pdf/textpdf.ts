/**
 * Page geometry and text flow for the Text to PDF tool.
 * PDF units are points (1/72 inch) and the origin is the bottom-left corner.
 */

export type PageSizeKey = 'a4' | 'letter' | 'legal'

export interface PaperSize {
  label: string
  /** Portrait width in points. */
  w: number
  /** Portrait height in points. */
  h: number
}

export const PAGE_SIZES: Record<PageSizeKey, PaperSize> = {
  a4: { label: 'A4 (210 × 297 mm)', w: 595.28, h: 841.89 },
  letter: { label: 'US Letter (8.5 × 11 in)', w: 612, h: 792 },
  legal: { label: 'US Legal (8.5 × 14 in)', w: 612, h: 1008 },
}

export const PAGE_KEYS: PageSizeKey[] = ['a4', 'letter', 'legal']

/** Leading as a multiple of the font size. */
export const LINE_HEIGHT = 1.35

/** Average Helvetica glyph width as a fraction of the font size. */
export const AVG_CHAR_W = 0.5

/** How many characters of `fontSize` Helvetica fit between the margins. */
export function charsPerLine(pageW: number, margin: number, fontSize: number): number {
  const usable = Math.max(0, pageW - 2 * Math.max(0, margin))
  const size = Math.max(1, fontSize)
  return Math.max(1, Math.floor(usable / (size * AVG_CHAR_W)))
}

/**
 * Breaks text into lines of at most `maxChars` characters. Words are kept
 * whole where possible, very long words are hard-broken, tabs become spaces
 * and blank lines are preserved.
 */
export function wrapText(text: string, maxChars: number): string[] {
  const limit = Math.max(1, Math.floor(maxChars))
  const out: string[] = []
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/\t/g, '    ').trimEnd()
    if (!line.trim()) {
      out.push('')
      continue
    }
    let current = ''
    for (const word of line.split(/\s+/)) {
      let rest = word
      while (rest.length > limit) {
        if (current) {
          out.push(current)
          current = ''
        }
        out.push(rest.slice(0, limit))
        rest = rest.slice(limit)
      }
      if (!rest) continue
      if (!current) current = rest
      else if (current.length + 1 + rest.length <= limit) current += ' ' + rest
      else {
        out.push(current)
        current = rest
      }
    }
    out.push(current)
  }
  return out
}

/** Splits lines into pages of `linesPerPage` lines. No lines means no pages. */
export function paginate(lines: string[], linesPerPage: number): string[][] {
  const per = Math.max(1, Math.floor(linesPerPage))
  const pages: string[][] = []
  for (let i = 0; i < lines.length; i += per) pages.push(lines.slice(i, i + per))
  return pages
}

/** Full lines that fit between the top and bottom margin. */
export function estimateLinesPerPage(pageH: number, margin: number, fontSize: number): number {
  const usable = pageH - 2 * Math.max(0, margin)
  return Math.max(1, Math.floor(usable / (Math.max(1, fontSize) * LINE_HEIGHT)))
}

/** Baseline y of every line on a page, top line first, counted from the bottom. */
export function lineBaselines(count: number, pageH: number, margin: number, fontSize: number): number[] {
  const top = pageH - Math.max(0, margin)
  const size = Math.max(1, fontSize)
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, i) => top - size * (i + 1) * 0.92)
}

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(2)} MB`)

/** Safe download name for the generated PDF. */
export function pdfFileName(name: string): string {
  const clean = name.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\.pdf$/i, '')
  return `${clean || 'text'}.pdf`
}
