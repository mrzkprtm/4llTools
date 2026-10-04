/** Templates and text assembly for the Cover Letter Builder. Pure functions only. */

export type TemplateId = 'classic' | 'concise' | 'enthusiastic'

export interface LetterTemplate {
  id: TemplateId
  name: string
  description: string
  /** Body text with {placeholders} that fillTemplate replaces. */
  body: string
}

export const TEMPLATES: LetterTemplate[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Formal and measured: one idea per paragraph.',
    body: [
      'Dear {hiringManager},',
      '',
      'I am writing to apply for the {role} position at {company}. {opening}',
      '',
      'In my current work I {achievement}. My strongest skills are {skills}, and I would put them to work on {company}’s next project.',
      '',
      'I would welcome the chance to talk about how I can help {company}. Thank you for your time and consideration.',
      '',
      'Sincerely,',
      '{yourName}',
      '{yourTitle}',
      '{yourEmail} · {yourPhone}',
    ].join('\n'),
  },
  {
    id: 'concise',
    name: 'Concise',
    description: 'Short and direct, three short paragraphs.',
    body: [
      'Hello {hiringManager},',
      '',
      'I would like to apply for the {role} role at {company}. {opening}',
      '',
      'Recent work: {achievement}. The skills I would bring on day one: {skills}.',
      '',
      'May we set up a short call this week? I am happy to walk through my work in detail.',
      '',
      'Best regards,',
      '{yourName}',
      '{yourEmail} · {yourPhone}',
    ].join('\n'),
  },
  {
    id: 'enthusiastic',
    name: 'Enthusiastic',
    description: 'Warm and energetic, good for a role you really want.',
    body: [
      'Dear {hiringManager},',
      '',
      'The {role} opening at {company} caught my eye immediately. {opening}',
      '',
      'I have {achievement}, and I bring {skills} with me. That mix is exactly why this role excites me.',
      '',
      'I would love to talk about what {company} is building and where I fit in. Thank you for reading.',
      '',
      'With enthusiasm,',
      '{yourName}',
      '{yourTitle}',
      '{yourEmail} · {yourPhone}',
    ].join('\n'),
  },
]

export type LetterFields = {
  yourName: string
  yourTitle: string
  yourEmail: string
  yourPhone: string
  date: string
  hiringManager: string
  company: string
  role: string
  opening: string
  achievement: string
  skills: string
}

export interface FieldSpec {
  key: keyof LetterFields
  label: string
  placeholder: string
}

export const FIELDS: FieldSpec[] = [
  { key: 'yourName', label: 'Your name', placeholder: 'Ada Lovelace' },
  { key: 'yourTitle', label: 'Your current role', placeholder: 'Software Engineer' },
  { key: 'yourEmail', label: 'Email', placeholder: 'ada@example.com' },
  { key: 'yourPhone', label: 'Phone', placeholder: '+44 20 7946 0958' },
  { key: 'date', label: 'Date line', placeholder: '5 January 2026' },
  { key: 'hiringManager', label: 'Greeting name', placeholder: 'Ms Bennett' },
  { key: 'company', label: 'Company', placeholder: 'Analytical Engines' },
  { key: 'role', label: 'Role you want', placeholder: 'Senior Backend Engineer' },
  { key: 'opening', label: 'Opening sentence', placeholder: 'I have followed your work on compilers for years.' },
  { key: 'achievement', label: 'One achievement', placeholder: 'cut build times by 40% for a team of nine' },
  { key: 'skills', label: 'Skills to highlight', placeholder: 'TypeScript, PostgreSQL and careful testing' },
]

export const emptyFields: LetterFields = {
  yourName: '',
  yourTitle: '',
  yourEmail: '',
  yourPhone: '',
  date: '',
  hiringManager: '',
  company: '',
  role: '',
  opening: '',
  achievement: '',
  skills: '',
}

/** Every placeholder the templates use, in first-seen order. */
export const PLACEHOLDERS: string[] = [...new Set(TEMPLATES.flatMap((t) => [...t.body.matchAll(/\{(\s*\w+\s*)\}/g)].map((m) => m[1].trim())))]

/** Replaces {placeholders} with the matching value; unknown or missing ones become empty. */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return String(template ?? '').replace(/\{\s*(\w+)\s*\}/g, (_, key: string) => {
    const value = vars?.[key]
    return typeof value === 'string' ? value.trim() : ''
  })
}

/** Splits text into paragraphs, keeping single line breaks inside a paragraph. */
export function paragraphs(text: string): string[] {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.split('\n').map((l) => l.trim()).filter(Boolean).join(' '))
    .filter(Boolean)
}

/** Looks a template up by id, falling back to the first template. */
export function findTemplate(id: string): LetterTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]
}

/** The full letter: the date line, then the filled body. */
export function composeLetter(fields: LetterFields, templateId: string): string {
  const body = fillTemplate(findTemplate(templateId).body, fields).replace(/\n{3,}/g, '\n\n').trim()
  const date = fields.date.trim()
  const head = [date].filter(Boolean).join('\n')
  return head ? `${head}\n\n${body}\n` : `${body}\n`
}

/** Safe file name for the downloaded letter. */
export function fileNameFor(fields: LetterFields): string {
  const parts = [fields.yourName, fields.company].map((p) => p.trim()).filter(Boolean)
  const base = parts.join('-').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-')
  return base ? `${base}-cover-letter.txt` : 'cover-letter.txt'
}

/** A filled-in example so the template can be seen working straight away. */
export const sampleFields: LetterFields = {
  yourName: 'Ada Lovelace',
  yourTitle: 'Software Engineer',
  yourEmail: 'ada@example.com',
  yourPhone: '+44 20 7946 0958',
  date: '5 January 2026',
  hiringManager: 'Ms Bennett',
  company: 'Analytical Engines',
  role: 'Senior Backend Engineer',
  opening: 'I have followed your work on fast runtimes for years.',
  achievement: 'cut build times by 40% for a team of nine engineers',
  skills: 'TypeScript, PostgreSQL and careful testing',
}
