import { describe, expect, it } from 'vitest'
import { DEFAULT_GRID, gridCss, parseAreas, trackList } from './grid'

describe('css grid generator', () => {
  it('starts from a named layout', () => {
    expect(DEFAULT_GRID.columns).toBe(3)
    expect(DEFAULT_GRID.rows).toBe(3)
    expect(DEFAULT_GRID.gap).toBe(12)
    expect(DEFAULT_GRID.areas.split('\n')).toHaveLength(3)
  })

  it('builds track lists', () => {
    expect(trackList(3, '1fr', 0)).toBe('repeat(3, 1fr)')
    expect(trackList(2, '80px', 10)).toBe('repeat(2, 80px)')
    expect(trackList(4, '1fr', 12)).toBe('repeat(4, minmax(12px, 1fr))')
    expect(trackList(0, '', 0)).toBe('repeat(1, 1fr)')
    expect(trackList(99, '1fr', 0)).toBe('repeat(24, 1fr)')
  })

  it('parses a plain area map', () => {
    const map = parseAreas('header header\nmain aside')
    expect(map.columns).toBe(2)
    expect(map.rows).toEqual([['header', 'header'], ['main', 'aside']])
    expect(map.names).toEqual(['header', 'main', 'aside'])
    expect(map.template).toBe('"header header" "main aside"')
  })

  it('pads ragged rows and handles empty input', () => {
    const map = parseAreas('a b c\nd')
    expect(map.rows[1]).toEqual(['d', '.', '.'])
    expect(map.columns).toBe(3)
    expect(parseAreas('')).toEqual({ rows: [], columns: 0, names: [], template: '' })
  })

  it('writes the container and area rules', () => {
    const css = gridCss(DEFAULT_GRID)
    expect(css).toContain('display: grid;')
    expect(css).toContain('grid-template-columns: repeat(3, minmax(12px, 1fr));')
    expect(css).toContain('grid-template-areas: "header header header" "aside main main" "footer footer footer";')
    expect(css).toContain('.header { grid-area: header; }')
    expect(css).toContain('.footer { grid-area: footer; }')
  })

  it('falls back to the column and row counts without areas', () => {
    const css = gridCss({ ...DEFAULT_GRID, areas: '', columns: 2, rows: 4 })
    expect(css).toContain('grid-template-columns: repeat(2, minmax(12px, 1fr));')
    expect(css).toContain('grid-template-rows: repeat(4, minmax(12px, 1fr));')
    expect(css).not.toContain('grid-template-areas')
  })
})
