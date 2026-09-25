import { describe, expect, it } from 'vitest'
import { boxShadowCss, gradientCss, tailwindArbitrary, toHex8, toRgba } from './css'

describe('shadow & gradient css', () => {
  it('converts colors with alpha', () => {
    expect(toRgba('#000000', 0.25)).toBe('rgba(0, 0, 0, 0.25)')
    expect(toRgba('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)')
    expect(toRgba('#4F46E5', 1)).toBe('#4f46e5')
    expect(toHex8('#4f46e5', 0.5)).toBe('#4f46e580')
    expect(toHex8('#000', 0)).toBe('#00000000')
    expect(toHex8('#000', 1)).toBe('#000000ff')
  })

  it('builds box-shadow strings', () => {
    expect(
      boxShadowCss([
        { x: 0, y: 4, blur: 6, spread: -1, color: '#000000', opacity: 0.1, inset: false },
        { x: 2, y: 2, blur: 0, spread: 0, color: '#ff0000', opacity: 1, inset: true },
      ]),
    ).toBe('0 4px 6px -1px rgba(0, 0, 0, 0.1), inset 2px 2px 0 0 #ff0000')
    expect(boxShadowCss([])).toBe('none')
  })

  it('builds gradients with sorted stops', () => {
    const stops = [
      { color: '#EC4899', position: 100 },
      { color: '#6366f1', position: 0 },
    ]
    expect(gradientCss({ type: 'linear', angle: 135, shape: 'circle', stops })).toBe('linear-gradient(135deg, #6366f1 0%, #ec4899 100%)')
    expect(gradientCss({ type: 'radial', angle: 0, shape: 'circle', stops })).toBe('radial-gradient(circle, #6366f1 0%, #ec4899 100%)')
    expect(gradientCss({ type: 'conic', angle: 90, shape: 'circle', stops })).toBe('conic-gradient(from 90deg, #6366f1 0%, #ec4899 100%)')
  })

  it('makes tailwind arbitrary values', () => {
    expect(tailwindArbitrary('shadow', '0 4px 6px -1px rgba(0, 0, 0, 0.1)')).toBe('shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]')
    expect(tailwindArbitrary('bg', 'linear-gradient(90deg, #fff 0%, #000 100%)')).toBe('bg-[linear-gradient(90deg,#fff_0%,#000_100%)]')
  })
})
