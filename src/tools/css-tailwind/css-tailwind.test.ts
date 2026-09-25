import { describe, expect, it } from 'vitest'
import { classToDecls, cssToTailwind, declsToClasses, spaceMath, tailwindToCss } from './convert'

const conv = (css: string, v: 3 | 4 = 3) => cssToTailwind(css, v)

describe('CSS → Tailwind', () => {
  it('maps common declarations to scale utilities', () => {
    const [r] = conv(`.card { display: flex; flex-direction: column; align-items: center; justify-content: space-between;
      gap: 1rem; padding: 8px 16px; margin: 0 auto; border-radius: 8px; font-size: 14px; font-weight: 600;
      color: #3b82f6; background: #fff; z-index: 10; opacity: .5; cursor: pointer; overflow: hidden; }`)
    expect(r.selector).toBe('.card')
    expect(r.classes).toEqual([
      'flex', 'flex-col', 'items-center', 'justify-between', 'gap-4', 'py-2', 'px-4', 'my-0', 'mx-auto', 'rounded-lg',
      'text-sm', 'font-semibold', 'text-blue-500', 'bg-white', 'z-10', 'opacity-50', 'cursor-pointer', 'overflow-hidden',
    ])
    expect(r.unconverted).toEqual([])
  })

  it('uses arbitrary values off the scale and differs by version', () => {
    expect(declsToClasses([{ prop: 'padding', value: '13px' }], 3).classes).toEqual(['p-[13px]'])
    expect(declsToClasses([{ prop: 'padding', value: '13px' }], 4).classes).toEqual(['p-3.25'])
    expect(declsToClasses([{ prop: 'width', value: 'calc(100% - 2rem)' }], 3).classes).toEqual(['w-[calc(100%_-_2rem)]'])
    expect(declsToClasses([{ prop: 'background-color', value: '#123456' }], 3).classes).toEqual(['bg-[#123456]'])
    expect(declsToClasses([{ prop: 'border-radius', value: '2px' }], 3).classes).toEqual(['rounded-sm'])
    expect(declsToClasses([{ prop: 'border-radius', value: '2px' }], 4).classes).toEqual(['rounded-xs'])
    expect(declsToClasses([{ prop: 'margin-top', value: '-8px' }], 3).classes).toEqual(['-mt-2'])
  })

  it('splits border shorthands, keeps !important and lists what it cannot convert', () => {
    const r = declsToClasses(
      [{ prop: 'border', value: '1px solid #e5e7eb' }, { prop: 'color', value: 'red', important: true }, { prop: 'transform', value: 'rotate(3deg)' }],
      3,
    )
    expect(r.classes).toEqual(['border', 'border-solid', 'border-gray-200', '!text-[red]'])
    expect(r.unconverted.map((d) => d.prop)).toEqual(['transform'])
  })

  it('turns pseudo-classes and media queries into variants', () => {
    const [r] = conv('.btn:hover { background-color: #2563eb } @media (min-width: 768px) { .btn { display: none } }')
    expect(r.selector).toBe('.btn')
    expect(r.classes).toEqual(['hover:bg-blue-600', 'md:hidden'])
  })

  it('accepts bare declarations', () => {
    expect(conv('position: absolute; top: 0; left: 0; width: 100%')[0].classes).toEqual(['absolute', 'top-0', 'left-0', 'w-full'])
  })
})

describe('Tailwind → CSS', () => {
  it('reverses utilities including arbitrary and negative values', () => {
    expect(classToDecls('px-4', 3)).toEqual([{ prop: 'padding-left', value: '1rem', important: false }, { prop: 'padding-right', value: '1rem', important: false }])
    expect(classToDecls('-mt-2', 3)?.[0].value).toBe('-0.5rem')
    expect(classToDecls('w-[calc(100%_-_2rem)]', 3)?.[0].value).toBe('calc(100% - 2rem)')
    expect(classToDecls('bg-red-500/50', 3)?.[0].value).toBe('rgb(239 68 68 / 0.5)')
    expect(classToDecls('border-2', 3)?.[0]).toMatchObject({ prop: 'border-width', value: '2px' })
    expect(classToDecls('text-[#abc]', 3)?.[0]).toMatchObject({ prop: 'color', value: '#abc' })
    expect(classToDecls('text-[13px]', 3)?.[0]).toMatchObject({ prop: 'font-size', value: '13px' })
    expect(classToDecls('not-a-class', 3)).toBeNull()
  })

  it('adds the spaces calc() needs without touching var() names', () => {
    expect(classToDecls('w-[calc(100%-2rem)]', 4)?.[0].value).toBe('calc(100% - 2rem)')
    expect(spaceMath('calc(var(--gap-2)+4px)')).toBe('calc(var(--gap-2) + 4px)')
  })

  it('groups variants into pseudo selectors and media queries', () => {
    const r = tailwindToCss('flex p-2 hover:bg-blue-600 md:p-4 group-hover:underline nonsense', '.x', 3)
    expect(r.css).toContain('.x {\n  display: flex;\n  padding: 0.5rem;\n}')
    expect(r.css).toContain('.x:hover {\n  background-color: #2563eb;\n}')
    expect(r.css).toContain('@media (min-width: 768px) {\n  .x {\n    padding: 1rem;\n  }\n}')
    expect(r.unknown).toEqual(['group-hover:underline', 'nonsense'])
    expect(r.unsupportedVariants).toEqual(['group-hover:'])
  })

  it('round-trips the scale', () => {
    for (const cls of ['p-4', 'mx-auto', 'rounded-lg', 'text-xl', 'leading-6', 'shadow-md', 'z-50', 'opacity-75', 'w-1/2', 'max-w-md', 'gap-x-3', 'inset-0']) {
      const decls = classToDecls(cls, 3)!
      const back = declsToClasses(decls.filter((d) => d.prop !== 'line-height' || cls.startsWith('leading')), 3).classes
      expect(back, cls).toContain(cls)
    }
  })
})
