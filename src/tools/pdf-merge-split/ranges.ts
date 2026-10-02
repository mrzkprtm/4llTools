/** Pure helpers for the PDF tool: page-range parsing and friendly errors. */

export type RangeResult = { ok: true; groups: number[][] } | { ok: false; error: string }

/**
 * Parses "1-3, 5, 7-9" into groups of 1-based page numbers.
 * Also accepts open ends ("7-" = 7 to last, "-3" = 1 to 3), "last"/"end",
 * reversed ranges ("9-7") and semicolons or spaces as separators.
 */
export function parseRanges(input: string, pageCount: number): RangeResult {
  const text = input.trim().toLowerCase()
  if (!text) return { ok: false, error: 'Enter pages like 1-3, 5, 7-9.' }
  if (pageCount < 1) return { ok: false, error: 'This PDF has no pages.' }
  const parts = text.replace(/\s*[-–]\s*/g, '-').split(/[\s,;]+/).filter(Boolean)
  const groups: number[][] = []
  const num = (s: string, fallback: number): number | null => {
    const t = s.trim()
    if (!t) return fallback
    if (t === 'last' || t === 'end') return pageCount
    return /^\d+$/.test(t) ? Number(t) : null
  }
  for (const part of parts) {
    const m = /^([^-]*)-([^-]*)$/.exec(part)
    let from: number | null
    let to: number | null
    if (m) {
      from = num(m[1], 1)
      to = num(m[2], pageCount)
    } else {
      from = to = num(part, NaN)
      if (from !== null && Number.isNaN(from)) from = to = null
    }
    if (from === null || to === null) return { ok: false, error: `“${part}” is not a page or range.` }
    for (const n of [from, to]) {
      if (n < 1 || n > pageCount) return { ok: false, error: `Page ${n} does not exist; this PDF has ${pageCount} page${pageCount === 1 ? '' : 's'}.` }
    }
    const step = from <= to ? 1 : -1
    const g: number[] = []
    for (let p = from; p !== to + step; p += step) g.push(p)
    groups.push(g)
  }
  return { ok: true, groups }
}

/** "1-3, 5" style label for a list of pages. */
export function describePages(pages: number[]): string {
  const out: string[] = []
  let i = 0
  while (i < pages.length) {
    let j = i
    while (j + 1 < pages.length && pages[j + 1] === pages[j] + 1) j++
    out.push(j > i ? `${pages[i]}-${pages[j]}` : String(pages[i]))
    i = j + 1
  }
  return out.join(', ')
}

/** Moves an item in a list (for reordering files). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = list.slice()
  const [it] = next.splice(from, 1)
  next.splice(to, 0, it)
  return next
}

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(2)} MB`)

export function pdfError(err: unknown, name: string): string {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err)
  if (/encrypt/i.test(msg)) return `“${name}” is password-protected or encrypted. Remove the protection first (for example, open it and “Print to PDF”), then try again.`
  if (/No PDF header|Failed to parse|invalid|Expected/i.test(msg)) return `“${name}” does not look like a valid PDF file, or it is damaged.`
  return `Could not read “${name}”: ${err instanceof Error ? err.message : msg}`
}

/** Normalizes a rotation to 0, 90, 180 or 270. */
export const normAngle = (deg: number) => (((Math.round(deg / 90) * 90) % 360) + 360) % 360

export function baseName(name: string): string {
  return name.replace(/\.pdf$/i, '') || 'document'
}
