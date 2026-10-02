import { describe, expect, it } from 'vitest'
import { DEFAULT_GLASS, glassCss, glassStyle, glassTailwind, rgba } from './glass'

describe('glassmorphism css', () => {
  it('builds css with the webkit prefix', () => {
    expect(glassCss(DEFAULT_GLASS)).toBe(
      [
        '.glass {',
        '  background: rgba(255, 255, 255, 0.18);',
        '  backdrop-filter: blur(14px) saturate(180%);',
        '  -webkit-backdrop-filter: blur(14px) saturate(180%);',
        '  border: 1px solid rgba(255, 255, 255, 0.35);',
        '  border-radius: 20px;',
        '  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);',
        '}',
      ].join('\n'),
    )
  })

  it('drops saturate at 100%, the border at 0px and the shadow at 0', () => {
    const css = glassCss({ ...DEFAULT_GLASS, saturation: 100, borderWidth: 0, shadow: 0 })
    expect(css).toContain('backdrop-filter: blur(14px);')
    expect(css).not.toContain('border:')
    expect(css).not.toContain('box-shadow')
  })

  it('makes a react style object', () => {
    const s = glassStyle(DEFAULT_GLASS)
    expect(s.WebkitBackdropFilter).toBe('blur(14px) saturate(180%)')
    expect(s.backdropFilter).toBe('blur(14px) saturate(180%)')
    expect(s.borderRadius).toBe('20px')
  })

  it('builds tailwind classes', () => {
    expect(glassTailwind({ ...DEFAULT_GLASS, opacity: 0.2, borderOpacity: 0.3 })).toBe(
      'bg-white/20 backdrop-blur-[14px] backdrop-saturate-[180%] border border-white/30 rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.2)]',
    )
    const dark = glassTailwind({ ...DEFAULT_GLASS, tint: '#0F172A', opacity: 0.37, borderWidth: 2, shadow: 0, saturation: 100 })
    expect(dark).toBe('bg-[#0f172a]/[0.37] backdrop-blur-[14px] border-[2px] border-[#0f172a]/35 rounded-[20px]')
  })

  it('clamps alpha', () => {
    expect(rgba('#000', 2)).toBe('rgba(0, 0, 0, 1)')
  })
})
