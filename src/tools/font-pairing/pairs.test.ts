import { describe, expect, it } from 'vitest'
import { MOODS, PAIRS, cssFor, filterPairs, genericFor, stackFor } from './pairs'

describe('font pairings', () => {
  it('curates a healthy list of pairs with a valid mood', () => {
    expect(PAIRS.length).toBeGreaterThanOrEqual(15)
    for (const p of PAIRS) {
      expect(p.heading.length, p.note).toBeGreaterThan(0)
      expect(p.body.length, p.note).toBeGreaterThan(0)
      expect(MOODS, p.note).toContain(p.mood)
      expect(p.note.length, p.heading).toBeGreaterThan(0)
    }
    expect(MOODS).toHaveLength(6)
  })

  it('uses sensible generic fallbacks', () => {
    expect(genericFor('Playfair Display')).toBe('Georgia, serif')
    expect(genericFor('JetBrains Mono')).toBe('ui-monospace, monospace')
    expect(genericFor('Inter')).toBe('system-ui, -apple-system, sans-serif')
    expect(stackFor('Lora')).toBe("'Lora', Georgia, serif")
    expect(stackFor('Inter')).toBe("'Inter', system-ui, -apple-system, sans-serif")
  })

  it('filters by mood', () => {
    const minimal = filterPairs(PAIRS, 'Minimal', '')
    expect(minimal.length).toBeGreaterThan(0)
    expect(minimal.every((p) => p.mood === 'Minimal')).toBe(true)
    expect(filterPairs(PAIRS, 'All', '')).toHaveLength(PAIRS.length)
  })

  it('searches heading, body, note and mood', () => {
    const byHeading = filterPairs(PAIRS, 'All', 'playfair')
    expect(byHeading.length).toBeGreaterThan(0)
    expect(byHeading.every((p) => `${p.heading} ${p.body} ${p.note}`.toLowerCase().includes('playfair'))).toBe(true)
    expect(filterPairs(PAIRS, 'All', 'nothing-matches-this')).toEqual([])
  })

  it('combines mood and query', () => {
    expect(filterPairs(PAIRS, 'Playful', 'nunito').length).toBeGreaterThan(0)
    expect(filterPairs(PAIRS, 'Technical', 'playfair')).toEqual([])
  })

  it('emits CSS custom properties for a pair', () => {
    const pair = PAIRS[0]
    const css = cssFor(pair)
    expect(css).toContain('--font-heading:')
    expect(css).toContain('--font-body:')
    expect(css).toContain(pair.heading)
  })
})
