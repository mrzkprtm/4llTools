/**
 * Label and placement maths for the PDF Page Numbers tool.
 * PDF units are points (1/72 inch) and the origin is the bottom-left corner.
 */

export const FORMATS = ['1', '1 / N', 'Page 1 of N', '1/N'] as const

export type NumberFormat = (typeof FORMATS)[number]

export type PageNumberPosition = 'bottom-left' | 'bottom-center' | 'bottom-right' | 'top-left' | 'top-center' | 'top-right'

export interface Position {
  id: PageNumberPosition
  label: string
}

export const POSITIONS: Position[] = [
  { id: 'bottom-center', label: 'Bottom center' },
  { id: 'bottom-right', label: 'Bottom right' },
  { id: 'bottom-left', label: 'Bottom left' },
  { id: 'top-center', label: 'Top center' },
  { id: 'top-right', label: 'Top right' },
  { id: 'top-left', label: 'Top left' },
]

/** Gap between the number and the page edge, in points. */
export const DEFAULT_MARGIN = 28

const TEMPLATES: Record<string, (n: number, last: number) => string> = {
  '1': (n) => String(n),
  '1 / N': (n, last) => `${n} / ${last}`,
  'Page 1 of N': (n, last) => `Page ${n} of ${last}`,
  '1/N': (n, last) => `${n}/${last}`,
}

/**
 * Formats the label for a 1-based page. `start` is the number printed on the
 * first page, so a start of 10 labels page 1 as "10" and the last of 3 as "12".
 */
export function pageLabel(current: number, total: number, format: string, start = 1): string {
  const first = Number.isFinite(start) ? Math.max(1, Math.floor(start)) : 1
  const n = Math.max(1, Math.floor(Number.isFinite(current) ? current : 1)) - 1 + first
  const last = Math.max(1, Math.floor(Number.isFinite(total) ? total : 1)) - 1 + first
  const build = TEMPLATES[String(format).trim()]
  return build ? build(n, last) : String(n)
}

/**
 * Baseline origin of the number: inset `margin` from the page edges, with the
 * text box `textH` tall for the top row so it clears the margin.
 */
export function cornerPosition(
  pos: PageNumberPosition,
  pageW: number,
  pageH: number,
  margin: number,
  textW: number,
  textH = 0,
): { x: number; y: number } {
  const width = Number.isFinite(pageW) ? Math.max(0, pageW) : 0
  const height = Number.isFinite(pageH) ? Math.max(0, pageH) : 0
  const limit = Math.min(width, height) / 2
  const m = Math.min(Math.max(0, Number.isFinite(margin) ? margin : 0), limit)
  const w = Number.isFinite(textW) ? Math.max(0, textW) : 0
  const h = Number.isFinite(textH) ? Math.max(0, textH) : 0
  const x = pos.endsWith('left') ? m : pos.endsWith('right') ? width - m - w : (width - w) / 2
  const y = pos.startsWith('top') ? height - m - h : m
  return { x: Math.max(0, x), y: Math.max(0, y) }
}

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(2)} MB`)

/** Safe download name for the numbered PDF. */
export function fileNameFor(name: string): string {
  const base = name.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\.pdf$/i, '')
  return `${base || 'document'}-numbered.pdf`
}

/** Turns pdf-lib load errors into something a person can act on. */
export function pdfError(err: unknown, name: string): string {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err)
  if (/encrypt/i.test(msg)) return `“${name}” is password-protected or encrypted. Remove the protection first, then try again.`
  if (/No PDF header|Failed to parse|invalid|Expected/i.test(msg)) return `“${name}” does not look like a valid PDF file, or it is damaged.`
  return `Could not read “${name}”: ${err instanceof Error ? err.message : msg}`
}
