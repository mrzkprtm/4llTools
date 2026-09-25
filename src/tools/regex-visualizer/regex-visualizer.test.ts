import { describe, expect, it } from 'vitest'
import { describeQuantifier, explain, findMatches, layoutDiagram, parseRegex, type Diagram, type Explanation } from './diagram'

function diagram(pattern: string, flags = '') {
  const p = parseRegex(pattern, flags)
  if (!p.ok) throw new Error(p.error)
  return { d: layoutDiagram(p.pattern, p.flags), ex: explain(p.pattern, p.flags) }
}
const boxes = (d: Diagram) => d.prims.filter((p) => p.kind === 'box' && p.style !== 'terminal') as Extract<Diagram['prims'][number], { kind: 'box' }>[]
const flat = (ex: Explanation[]): string[] => ex.flatMap((e) => [e.text, ...flat(e.children)])

describe('regex visualizer', () => {
  it('reports parser errors', () => {
    const p = parseRegex('(abc', '')
    expect(p.ok).toBe(false)
    expect(!p.ok && p.error).toMatch(/Unterminated group/)
    expect(parseRegex('a', 'gq').ok).toBe(false)
  })

  it('lays out alternation as parallel branches', () => {
    const { d } = diagram('cat|dog|bird')
    const bs = boxes(d)
    expect(bs.map((b) => b.label)).toEqual(['"cat"', '"dog"', '"bird"'])
    expect(new Set(bs.map((b) => b.y)).size).toBe(3)
    expect(d.prims.filter((p) => p.kind === 'path' && p.role === 'branch')).toHaveLength(3)
  })

  it('produces positive sizes that contain every box', () => {
    const { d } = diagram('^(?<user>[\\w.+-]+)@((?:[a-z0-9-]+\\.)+[a-z]{2,})$', 'i')
    expect(d.width).toBeGreaterThan(0)
    expect(d.height).toBeGreaterThan(0)
    for (const p of d.prims) {
      if (p.kind === 'box' || p.kind === 'frame') {
        expect(p.w).toBeGreaterThan(0)
        expect(p.x).toBeGreaterThanOrEqual(0)
        expect(p.y).toBeGreaterThanOrEqual(0)
        expect(p.x + p.w).toBeLessThanOrEqual(d.width)
        expect(p.y + p.h).toBeLessThanOrEqual(d.height)
      }
    }
    const frames = d.prims.filter((p) => p.kind === 'frame').map((p) => (p as { label: string }).label)
    expect(frames).toEqual(['group #1 ‹user›', 'group #2', 'non-capturing'])
  })

  it('draws loops and skips for quantifiers', () => {
    const { d } = diagram('a+b?c{0,3}?')
    expect(d.prims.filter((p) => p.kind === 'path' && p.role === 'loop')).toHaveLength(2)
    expect(d.prims.filter((p) => p.kind === 'path' && p.role === 'skip')).toHaveLength(2)
    const labels = d.prims.filter((p) => p.kind === 'text').map((p) => (p as { text: string }).text)
    expect(labels).toEqual(['1+ times', 'optional', '0–3 times, lazy'])
  })

  it('describes quantifiers', () => {
    expect(describeQuantifier(0, Infinity, true)).toBe('0+ times')
    expect(describeQuantifier(3, 3, true)).toBe('exactly 3 times')
    expect(describeQuantifier(2, Infinity, false)).toBe('2+ times, lazy')
  })

  it('explains in plain English', () => {
    const { ex } = diagram('^\\d{3}-[^a-z_](?=x)|\\bfoo\\1?$', 'm')
    const all = flat(ex)
    expect(ex[0].text).toBe('Either of 2 alternatives:')
    expect(all).toContain('Start of line')
    expect(all).toContain('A digit')
    expect(all).toContain('Not: a-z, "_"')
    expect(all).toContain('Check (without consuming) it is followed by:')
    expect(all).toContain('Word boundary')
    expect(all).toContain('Literal text "foo"')
  })

  it('finds matches', () => {
    expect(findMatches('\\d+', 'g', 'a1 b22 c333').map((m) => m.text)).toEqual(['1', '22', '333'])
    expect(findMatches('\\d+', '', 'a1 b22')).toHaveLength(1)
  })
})
