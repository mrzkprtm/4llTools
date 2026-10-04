/** Pure field handling for the PDF Metadata Editor. No DOM, no pdf-lib. */

export interface MetaFields {
  title: string
  author: string
  subject: string
  keywords: string
}

export const emptyMeta: MetaFields = { title: '', author: '', subject: '', keywords: '' }

/** Longest value we store per field, in characters. */
export const FIELD_LIMITS: Record<keyof MetaFields, number> = {
  title: 200,
  author: 120,
  subject: 300,
  keywords: 400,
}

/** Trim, collapse runs of whitespace and cut to the field limit. */
function cleanValue(value: unknown, limit: number): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, limit)
}

/** Splits "seo, pdf; report" into keywords, dropping blanks and duplicates. */
export function splitKeywords(str: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of String(str ?? '').split(/[,;\n\r]+/)) {
    const word = part.trim()
    if (!word) continue
    const key = word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(word)
  }
  return out
}

/** Joins keywords back into the comma-separated form PDFs use. */
export function joinKeywords(list: string[]): string {
  return splitKeywords((list ?? []).join(',')).join(', ')
}

/** Normalises whatever is in the form into a storable metadata object. */
export function cleanMeta(raw: Partial<MetaFields> | null | undefined): MetaFields {
  const src = raw ?? {}
  return {
    title: cleanValue(src.title, FIELD_LIMITS.title),
    author: cleanValue(src.author, FIELD_LIMITS.author),
    subject: cleanValue(src.subject, FIELD_LIMITS.subject),
    keywords: joinKeywords(splitKeywords(src.keywords ?? '')).slice(0, FIELD_LIMITS.keywords),
  }
}

/** True when at least one field has something in it. */
export function hasMeta(meta: MetaFields): boolean {
  return Boolean(meta.title || meta.author || meta.subject || meta.keywords)
}

/** Short human summary of the stored metadata. */
export function describeMeta(meta: MetaFields): string {
  const parts: string[] = []
  if (meta.title) parts.push(`“${meta.title}”`)
  if (meta.author) parts.push(`by ${meta.author}`)
  if (meta.subject) parts.push(meta.subject)
  const words = splitKeywords(meta.keywords)
  if (words.length) parts.push(`${words.length} keyword${words.length === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(2)} MB`)

/** Safe download name for the exported PDF. */
export function fileNameFor(name: string): string {
  const base = name.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\.pdf$/i, '')
  return `${base || 'document'}-metadata.pdf`
}

/** Turns pdf-lib load errors into something a person can act on. */
export function pdfError(err: unknown, name: string): string {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err)
  if (/encrypt/i.test(msg)) return `“${name}” is password-protected or encrypted. Remove the protection first, then try again.`
  if (/No PDF header|Failed to parse|invalid|Expected/i.test(msg)) return `“${name}” does not look like a valid PDF file, or it is damaged.`
  return `Could not read “${name}”: ${err instanceof Error ? err.message : msg}`
}
