/** Text and vertical layout for the Certificate Maker. Pure functions only (canvas units = pixels). */

export type TemplateId = 'award' | 'completion'

export interface CertificateTemplate {
  id: TemplateId
  name: string
  heading: string
  /** Line above the recipient name. */
  lead: string
  /** Line below the recipient name; {course} is replaced. */
  body: string
  signLabel: string
}

export const TEMPLATES: CertificateTemplate[] = [
  {
    id: 'award',
    name: 'Award',
    heading: 'Certificate of Achievement',
    lead: 'This award is presented to',
    body: 'in recognition of outstanding work on {course}.',
    signLabel: 'Awarded by',
  },
  {
    id: 'completion',
    name: 'Completion',
    heading: 'Certificate of Completion',
    lead: 'This is to certify that',
    body: 'has successfully completed the {course} course.',
    signLabel: 'Course instructor',
  },
]

export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "5 January 2026" in US English: "January 5, 2026". Invalid dates become "". */
export function formatDate(d: Date): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return ''
  return `${MONTHS_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export interface FieldSlot {
  /** Vertical centre of the field, measured from the top of the page. */
  y: number
  /** Suggested font size in pixels. */
  size: number
}

/** Fraction of the page height the stack of fields spans. */
export const BAND = { top: 0.34, bottom: 0.84 }

/** Evenly spaced vertical slots between the heading band and the signature line. */
export function layoutFields(w: number, h: number, count: number): FieldSlot[] {
  const n = Math.floor(count)
  if (!Number.isFinite(n) || n < 1) return []
  const width = Number.isFinite(w) ? Math.max(1, w) : 1
  const height = Number.isFinite(h) ? Math.max(1, h) : 1
  const base = Math.max(8, Math.round(Math.min(height * 0.03, width * 0.024)))
  if (n === 1) return [{ y: height * 0.5, size: base }]
  const top = height * BAND.top
  const step = (height * (BAND.bottom - BAND.top)) / (n - 1)
  return Array.from({ length: n }, (_, i) => ({ y: top + i * step, size: i === 2 ? Math.round(base * 2.2) : base }))
}

/** Inset of the decorative border from the page edge. */
export function borderInset(w: number, h: number): number {
  const width = Number.isFinite(w) ? Math.max(1, w) : 1
  const height = Number.isFinite(h) ? Math.max(1, h) : 1
  return Math.max(1, Math.round(Math.min(width, height) * 0.035))
}

/** The template's body line with the course name filled in. */
export function describe(template: CertificateTemplate, course: string): string {
  const name = String(course ?? '').trim()
  return template.body
    .replace(/\{\s*course\s*\}/g, name)
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** File name for the exported PNG. */
export function fileNameFor(recipient: string): string {
  const slug = String(recipient ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug || 'certificate'}-certificate.png`
}

/** Default signatory line when the form is untouched. */
export const today = () => formatDate(new Date())
