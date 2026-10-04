import { describe as describeBlock, expect, it } from 'vitest'
import { MONTHS_LONG, TEMPLATES, borderInset, describe, fileNameFor, formatDate, layoutFields } from './certificate'

describeBlock('certificate maker', () => {
  it('formats a date in US English', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('January 5, 2026')
    expect(formatDate(new Date(2025, 11, 31))).toBe('December 31, 2025')
    expect(formatDate(new Date(Number.NaN))).toBe('')
    expect(MONTHS_LONG).toHaveLength(12)
  })

  it('returns no slots for no fields', () => {
    expect(layoutFields(1600, 1131, 0)).toEqual([])
    expect(layoutFields(1600, 1131, -3)).toEqual([])
  })

  it('centres a single field on the page', () => {
    const [slot] = layoutFields(1600, 1131, 1)
    expect(slot.y).toBeCloseTo(565.5, 4)
    expect(slot.size).toBe(Math.round(Math.min(1131 * 0.03, 1600 * 0.024)))
  })

  it('spreads five fields down the page and enlarges the name slot', () => {
    const slots = layoutFields(1600, 1131, 5)
    expect(slots).toHaveLength(5)
    expect(slots[0].y).toBeCloseTo(1131 * 0.34, 4)
    expect(slots[4].y).toBeCloseTo(1131 * 0.84, 4)
    for (let i = 1; i < slots.length; i++) expect(slots[i].y).toBeGreaterThan(slots[i - 1].y)
    expect(slots[2].size).toBeGreaterThan(slots[0].size)
    expect(slots[0].size).toBe(slots[4].size)
  })

  it('keeps the border inset proportional to the page', () => {
    expect(borderInset(1600, 1131)).toBe(Math.round(1131 * 0.035))
    expect(borderInset(800, 600)).toBe(21)
    expect(borderInset(1, 1)).toBeGreaterThan(0)
  })

  it('offers an award and a completion template', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(['award', 'completion'])
    for (const t of TEMPLATES) {
      expect(t.heading.length).toBeGreaterThan(0)
      expect(t.body).toContain('{course}')
    }
  })

  it('fills the course name into the body line', () => {
    expect(describe(TEMPLATES[1], 'Rust 101')).toBe('has successfully completed the Rust 101 course.')
    expect(describe(TEMPLATES[0], '  ')).toBe('in recognition of outstanding work on .')
  })

  it('names the PNG after the recipient', () => {
    expect(fileNameFor('Ada Lovelace')).toBe('ada-lovelace-certificate.png')
    expect(fileNameFor('  ')).toBe('certificate-certificate.png')
    expect(fileNameFor('José Ünsal')).toBe('jos-nsal-certificate.png')
  })
})
