import { describe, expect, it } from 'vitest'
import { clampRadius, radiusCss, tailwindClasses } from './radius'

describe('border radius', () => {
  it('clamps to a safe range and rounds', () => {
    expect(clampRadius(-5)).toBe(0)
    expect(clampRadius(1_000_000)).toBe(999)
    expect(clampRadius(12.34)).toBe(12.3)
    expect(clampRadius(NaN)).toBe(0)
  })

  it('collapses equal corners to the shortest shorthand', () => {
    expect(radiusCss({ tl: 12, tr: 12, br: 12, bl: 12, linked: false, unit: 'px' })).toBe('border-radius: 12px;')
    expect(radiusCss({ tl: 10, tr: 20, br: 10, bl: 20, linked: false, unit: 'px' })).toBe('border-radius: 10px 20px;')
    expect(radiusCss({ tl: 10, tr: 20, br: 20, bl: 5, linked: false, unit: 'px' })).toBe('border-radius: 10px 20px 5px;')
    expect(radiusCss({ tl: 1, tr: 2, br: 3, bl: 4, linked: false, unit: 'px' })).toBe('border-radius: 1px 2px 3px 4px;')
  })

  it('applies the top-left value to every corner when linked', () => {
    expect(radiusCss({ tl: 8, tr: 99, br: 99, bl: 99, linked: true, unit: 'px' })).toBe('border-radius: 8px;')
  })

  it('supports percent and elliptical radii', () => {
    expect(radiusCss({ tl: 50, tr: 50, br: 50, bl: 50, linked: false, unit: '%' })).toBe('border-radius: 50%;')
    expect(radiusCss({ tl: 10, tr: 10, br: 10, bl: 10, linked: false, unit: 'px', v: { tl: 20, tr: 20, br: 20, bl: 20 } })).toBe('border-radius: 10px / 20px;')
    expect(radiusCss({ tl: 10, tr: 0, br: 10, bl: 0, linked: false, unit: 'px', v: { tl: 0, tr: 20, br: 0, bl: 20 } })).toBe('border-radius: 10px 0px / 0px 20px;')
  })

  it('writes Tailwind classes', () => {
    expect(tailwindClasses({ tl: 12, tr: 12, br: 12, bl: 12 })).toBe('rounded-[12px]')
    expect(tailwindClasses({ tl: 8, tr: 4, br: 8, bl: 4 })).toBe('rounded-tl-[8px] rounded-tr-[4px] rounded-br-[8px] rounded-bl-[4px]')
    expect(tailwindClasses({ tl: 50, tr: 50, br: 50, bl: 50 }, '%')).toBe('rounded-[50%]')
  })
})
