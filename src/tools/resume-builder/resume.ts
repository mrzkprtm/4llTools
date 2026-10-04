/** Data model and text formatting for the Resume Builder. Pure functions only. */

export interface Contact {
  name: string
  title: string
  email: string
  phone: string
  location: string
  website: string
}

/** One dated entry: a job or a qualification. */
export interface Entry {
  id: string
  /** Job title or degree. */
  title: string
  /** Company or school. */
  org: string
  /** "2020-03", "2020" or free text. */
  start: string
  /** Empty means the entry is ongoing when `start` is filled. */
  end: string
  details: string
}

export interface ResumeData {
  contact: Contact
  summary: string
  experience: Entry[]
  education: Entry[]
  skills: string
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const emptyContact: Contact = { name: '', title: '', email: '', phone: '', location: '', website: '' }

export const emptyResume: ResumeData = { contact: emptyContact, summary: '', experience: [], education: [], skills: '' }

const PRESENT = /^(present|current|now|ongoing)$/i

/** "2020-03" → "Mar 2020"; "present" → "Present"; anything else is kept as typed. */
function oneDate(value: string): string {
  const text = String(value ?? '').trim()
  if (!text) return ''
  if (PRESENT.test(text)) return 'Present'
  const ym = /^(\d{4})[-/](\d{1,2})$/.exec(text)
  if (ym) {
    const month = Number(ym[2])
    return month >= 1 && month <= 12 ? `${MONTHS[month - 1]} ${ym[1]}` : ym[1]
  }
  return text
}

/** Human date range such as "Mar 2020 – Present"; empty when both ends are empty. */
export function formatDateRange(start: string, end: string): string {
  const from = oneDate(start)
  const to = oneDate(end)
  if (!from) return to
  if (!to) return from
  return `${from} – ${to}`
}

/** Email, phone, location and website, joined with a middle dot. */
export function contactLine(data: ResumeData): string {
  const c = data.contact
  return [c.email, c.phone, c.location, c.website].map((v) => String(v ?? '').trim()).filter(Boolean).join(' · ')
}

/** Moves one entry up (-1) or down (1) in a section. Unknown ids change nothing. */
export function reorderSection<T extends { id: string }>(list: T[], id: string, dir: -1 | 1): T[] {
  const from = list.findIndex((it) => it.id === id)
  if (from < 0) return list
  const to = from + dir
  if (to < 0 || to >= list.length) return list
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** Skills typed as a list, with duplicates and blanks removed. */
export function splitSkills(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of String(text ?? '').split(/[,;\n\r]+/)) {
    const skill = part.trim()
    if (!skill) continue
    const key = skill.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(skill)
  }
  return out
}

function entryLines(entry: Entry): string[] {
  const heading = [entry.title.trim(), entry.org.trim()].filter(Boolean).join(' — ')
  const range = formatDateRange(entry.start, entry.end)
  const first = [heading, range && (heading ? `(${range})` : range)].filter(Boolean).join(' ')
  const details = entry.details.split('\n').map((d) => d.trim()).filter(Boolean).map((d) => `  • ${d}`)
  return [first, ...details].filter(Boolean)
}

function sectionEntries(entries: Entry[]): string[][] {
  return entries.filter((e) => e.title.trim() || e.org.trim() || e.details.trim()).map(entryLines)
}

/** The whole resume as plain text, ready to save as a .txt file. */
export function toPlainText(data: ResumeData): string {
  const c = data.contact
  const blocks: string[] = []
  const header = [c.name.trim().toUpperCase(), c.title.trim(), contactLine(data)].filter(Boolean)
  if (header.length) blocks.push(header.join('\n'))
  if (data.summary.trim()) blocks.push(`SUMMARY\n${data.summary.trim()}`)
  const jobs = sectionEntries(data.experience)
  if (jobs.length) blocks.push(['EXPERIENCE', ...jobs.map((lines) => lines.join('\n'))].join('\n\n'))
  const school = sectionEntries(data.education)
  if (school.length) blocks.push(['EDUCATION', ...school.map((lines) => lines.join('\n'))].join('\n\n'))
  const skills = splitSkills(data.skills)
  if (skills.length) blocks.push(`SKILLS\n${skills.join(', ')}`)
  if (!blocks.length) return ''
  return `${blocks.join('\n\n')}\n`
}

/** Keeps the part of a data object a file name can use. */
export function fileNameFor(data: ResumeData): string {
  const name = data.contact.name.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-')
  return name ? `${name}-resume.txt` : 'resume.txt'
}

export const sampleResume: ResumeData = {
  contact: {
    name: 'Ada Lovelace',
    title: 'Software Engineer',
    email: 'ada@example.com',
    phone: '+44 20 7946 0958',
    location: 'London, UK',
    website: 'ada.example.com',
  },
  summary: 'Backend engineer who likes small tools, clear interfaces and careful tests.',
  experience: [
    { id: 'e1', title: 'Senior Engineer', org: 'Analytical Engines', start: '2021-04', end: 'present', details: 'Led the runtime team.\nCut build times by 40%.' },
    { id: 'e2', title: 'Engineer', org: 'Difference Works', start: '2018-01', end: '2021-03', details: 'Shipped the first public API.' },
  ],
  education: [{ id: 'd1', title: 'BSc Computer Science', org: 'University of London', start: '2014', end: '2017', details: '' }],
  skills: 'TypeScript, Node.js, PostgreSQL, testing',
}
