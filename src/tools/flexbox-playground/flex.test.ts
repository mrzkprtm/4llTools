import { describe, expect, it } from 'vitest'
import { FLEX_DEFAULTS, MAX_ITEMS, MIN_ITEMS, OPTIONS, addItem, flexCss, removeItem } from './flex'

describe('flexbox playground', () => {
  it('ships sensible defaults and options', () => {
    expect(FLEX_DEFAULTS).toEqual({ direction: 'row', wrap: 'wrap', justify: 'flex-start', alignItems: 'stretch', alignContent: 'stretch', gap: 12, items: 6 })
    expect(OPTIONS.direction).toEqual(['row', 'row-reverse', 'column', 'column-reverse'])
    expect(OPTIONS.justify).toHaveLength(6)
    expect(OPTIONS.justify).toContain('space-evenly')
    expect(OPTIONS.alignItems).toContain('baseline')
  })

  it('serialises the container', () => {
    const css = flexCss(FLEX_DEFAULTS)
    expect(css.startsWith('display: flex;')).toBe(true)
    expect(css).toContain('flex-direction: row;')
    expect(css).toContain('justify-content: flex-start;')
    expect(css).toContain('align-items: stretch;')
    expect(css.endsWith('gap: 12px;')).toBe(true)
  })

  it('only emits align-content when wrapping', () => {
    expect(flexCss(FLEX_DEFAULTS)).toContain('align-content: stretch;')
    expect(flexCss({ ...FLEX_DEFAULTS, wrap: 'nowrap' })).not.toContain('align-content')
  })

  it('clamps the gap', () => {
    expect(flexCss({ ...FLEX_DEFAULTS, gap: 999 })).toContain('gap: 120px;')
    expect(flexCss({ ...FLEX_DEFAULTS, gap: -4 })).toContain('gap: 0px;')
  })

  it('adds and removes items within bounds', () => {
    expect(addItem(FLEX_DEFAULTS).items).toBe(7)
    expect(removeItem(FLEX_DEFAULTS).items).toBe(5)
    expect(addItem({ ...FLEX_DEFAULTS, items: MAX_ITEMS }).items).toBe(MAX_ITEMS)
    expect(removeItem({ ...FLEX_DEFAULTS, items: MIN_ITEMS }).items).toBe(MIN_ITEMS)
    expect(FLEX_DEFAULTS.items).toBe(6)
  })
})
