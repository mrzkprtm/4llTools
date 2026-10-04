import { describe, expect, it } from 'vitest'
import { contactLine, emptyResume, fileNameFor, formatDateRange, reorderSection, sampleResume, splitSkills, toPlainText, type Entry, type ResumeData } from './resume'

const entry = (id: string, title = ''): Entry => ({ id, title, org: '', start: '', end: '', details: '' })

describe('resume builder', () => {
  it('formats date ranges', () => {
    expect(formatDateRange('2020-03', '2021-05')).toBe('Mar 2020 – May 2021')
    expect(formatDateRange('2022-07', 'current')).toBe('Jul 2022 – Present')
    expect(formatDateRange('2019', '')).toBe('2019')
    expect(formatDateRange('', '2020-01')).toBe('Jan 2020')
    expect(formatDateRange('', '')).toBe('')
    expect(formatDateRange('2021-13', '2021-02')).toBe('2021 – Feb 2021')
  })

  it('builds the contact line from the filled fields only', () => {
    expect(contactLine(sampleResume)).toBe('ada@example.com · +44 20 7946 0958 · London, UK · ada.example.com')
    expect(contactLine(emptyResume)).toBe('')
    expect(contactLine({ ...emptyResume, contact: { ...emptyResume.contact, email: ' a@b.c ' } })).toBe('a@b.c')
  })

  it('splits skills and drops duplicates', () => {
    expect(splitSkills('TypeScript, SQL; testing\nTypeScript')).toEqual(['TypeScript', 'SQL', 'testing'])
    expect(splitSkills('')).toEqual([])
  })

  it('moves entries up and down', () => {
    const list = [entry('a'), entry('b'), entry('c')]
    expect(reorderSection(list, 'c', -1).map((e) => e.id)).toEqual(['a', 'c', 'b'])
    expect(reorderSection(list, 'a', 1).map((e) => e.id)).toEqual(['b', 'a', 'c'])
    expect(reorderSection(list, 'a', -1)).toBe(list)
    expect(reorderSection(list, 'c', 1)).toBe(list)
    expect(reorderSection(list, 'zz', 1)).toBe(list)
    expect(list.map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('writes a plain text resume', () => {
    const text = toPlainText(sampleResume)
    expect(text).toContain('ADA LOVELACE')
    expect(text).toContain('ada@example.com · +44 20 7946 0958 · London, UK · ada.example.com')
    expect(text).toContain('SUMMARY')
    expect(text).toContain('EXPERIENCE')
    expect(text).toContain('Senior Engineer — Analytical Engines (Apr 2021 – Present)')
    expect(text).toContain('  • Cut build times by 40%.')
    expect(text).toContain('EDUCATION')
    expect(text).toContain('BSc Computer Science — University of London (2014 – 2017)')
    expect(text).toContain('SKILLS\nTypeScript, Node.js, PostgreSQL, testing')
    expect(text.endsWith('\n')).toBe(true)
  })

  it('writes nothing for an empty resume and skips blank entries', () => {
    expect(toPlainText(emptyResume)).toBe('')
    const data: ResumeData = { ...emptyResume, experience: [entry('x'), { ...entry('y'), details: 'Did a thing' }] }
    const text = toPlainText(data)
    expect(text).not.toContain('Senior')
    expect(text).toContain('  • Did a thing')
    expect(text).not.toMatch(/\n\n\n/)
  })

  it('names the text file after the candidate', () => {
    expect(fileNameFor(sampleResume)).toBe('Ada-Lovelace-resume.txt')
    expect(fileNameFor(emptyResume)).toBe('resume.txt')
  })
})
