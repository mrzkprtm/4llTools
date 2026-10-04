import { describe, expect, it } from 'vitest'
import { FIELDS, PLACEHOLDERS, TEMPLATES, composeLetter, emptyFields, fileNameFor, fillTemplate, findTemplate, paragraphs, sampleFields } from './letter'

describe('cover letter builder', () => {
  it('ships three templates with unique ids', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(['classic', 'concise', 'enthusiastic'])
    expect(new Set(TEMPLATES.map((t) => t.name)).size).toBe(3)
    for (const t of TEMPLATES) {
      expect(t.body).toContain('{company}')
      expect(t.body).toContain('{role}')
      expect(t.body).toContain('{yourName}')
    }
  })

  it('has a form field for every placeholder', () => {
    const keys = FIELDS.map((f) => f.key)
    expect(keys).toHaveLength(11)
    for (const p of PLACEHOLDERS) expect(keys).toContain(p)
  })

  it('fills placeholders and clears the ones with no value', () => {
    expect(fillTemplate('Dear {name}, welcome to {company}.', { name: 'Ada', company: 'AE' })).toBe('Dear Ada, welcome to AE.')
    expect(fillTemplate('{a} {a} {b}', { a: 'x', b: '' })).toBe('x x ')
    expect(fillTemplate('Hi { unknown }!', {})).toBe('Hi !')
    expect(fillTemplate('no placeholders', { a: 'b' })).toBe('no placeholders')
  })

  it('splits text into paragraphs and unwraps soft line breaks', () => {
    expect(paragraphs('one\ntwo\n\nthree\n\n\n four ')).toEqual(['one two', 'three', 'four'])
    expect(paragraphs('')).toEqual([])
    expect(paragraphs('a\r\n\r\nb')).toEqual(['a', 'b'])
  })

  it('falls back to the first template for an unknown id', () => {
    expect(findTemplate('nope').id).toBe('classic')
    expect(findTemplate('concise').name).toBe('Concise')
  })

  it('composes the whole letter with the date line first', () => {
    const letter = composeLetter(sampleFields, 'classic')
    expect(letter.startsWith('5 January 2026\n\nDear Ms Bennett,')).toBe(true)
    expect(letter).toContain('the Senior Backend Engineer position at Analytical Engines')
    expect(letter).toContain('Ada Lovelace')
    expect(letter.endsWith('\n')).toBe(true)
    expect(letter).not.toMatch(/\n{3,}/)
  })

  it('leaves out the date line when there is no date', () => {
    const letter = composeLetter({ ...sampleFields, date: '' }, 'concise')
    expect(letter.startsWith('Hello Ms Bennett,')).toBe(true)
    expect(letter).toContain('Senior Backend Engineer role at Analytical Engines')
  })

  it('leaves only the template skeleton when the fields are empty', () => {
    expect(composeLetter(emptyFields, 'enthusiastic')).toContain('caught my eye immediately')
    expect(composeLetter(emptyFields, 'enthusiastic')).not.toContain('{')
  })

  it('names the downloaded file after the person and company', () => {
    expect(fileNameFor(sampleFields)).toBe('Ada-Lovelace-Analytical-Engines-cover-letter.txt')
    expect(fileNameFor(emptyFields)).toBe('cover-letter.txt')
  })
})
