import {
  BREAKPOINTS, CURSORS, FONT_SIZE, FONT_WEIGHT, FRACTIONS, LEADING, MAX_WIDTH, PALETTE, RADIUS, SHADOW, SPACING_KEYS,
  SPECIAL_COLORS, STATIC, TRACKING, VALUE_ALIASES, type TwVersion,
} from './tables'

export type { TwVersion } from './tables'

export interface Decl {
  prop: string
  value: string
  important?: boolean
}

/* ---------- value helpers ---------- */

const norm = (v: string) => v.trim().toLowerCase().replace(/\s*([,/()])\s*/g, '$1').replace(/\s+/g, ' ')

/** Length in px for px/rem/em(=rem)/0 values, else null. */
export function toPx(v: string): number | null {
  const m = /^(-?\d*\.?\d+)(px|rem)?$/.exec(v.trim().toLowerCase())
  if (!m) return null
  const n = Number(m[1])
  if (!m[2]) return n === 0 ? 0 : null
  return m[2] === 'px' ? n : n * 16
}

const sameValue = (a: string, b: string) => {
  const pa = toPx(a)
  const pb = toPx(b)
  if (pa !== null && pb !== null) return Math.abs(pa - pb) < 1e-6
  return norm(a) === norm(b)
}

/** Wraps a raw CSS value as an arbitrary Tailwind value: `13px` → `[13px]`. */
export const arbitrary = (v: string) => `[${v.trim().replace(/\s*,\s*/g, ',').replace(/\s+/g, '_')}]`
const unArbitrary = (key: string) => spaceMath(key.slice(1, -1).replace(/(?<!\\)_/g, ' ').replace(/\\_/g, '_'))

/** Adds the spaces CSS requires around + and - inside calc() (like Tailwind does): calc(100%-2rem) → calc(100% - 2rem). */
export function spaceMath(value: string): string {
  if (!/(calc|min|max|clamp)\(/.test(value)) return value
  let out = ''
  let varDepth = 0
  let depth = 0
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]
    if (ch === '(') {
      depth++
      if (/var$/.test(value.slice(0, i)) && varDepth === 0) varDepth = depth
    } else if (ch === ')') {
      if (varDepth === depth) varDepth = 0
      depth--
    }
    const prev = value[i - 1] ?? ''
    const next = value[i + 1] ?? ''
    if (varDepth === 0 && depth > 0 && (ch === '+' || ch === '-') && /[\d%a-z)]/i.test(prev) && /[\d(.]/.test(next)) {
      out += ` ${ch} `
      continue
    }
    out += ch
  }
  return out
}

const remOf = (units: number) => (units === 0 ? '0px' : `${+(units * 0.25).toFixed(4)}rem`)

function spacingKeyFor(value: string, v: TwVersion): string | null {
  const px = toPx(value)
  if (px === null || px < 0) return null
  if (px === 0) return '0'
  if (px === 1) return 'px'
  const units = px / 4
  if (v === 3) {
    const k = String(units)
    return SPACING_KEYS.includes(k) ? k : null
  }
  return Number.isInteger(units * 4) ? String(units) : null
}

function spacingValueFor(key: string, v: TwVersion): string | null {
  if (key === 'px') return '1px'
  if (!/^\d+(\.\d+)?$/.test(key)) return null
  if (v === 3 && !SPACING_KEYS.includes(key)) return null
  if (v === 4 && !Number.isInteger(Number(key) * 4)) return null
  return remOf(Number(key))
}

const isColorLike = (v: string) =>
  /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(|color-mix\()/i.test(v.trim()) || /^[a-z]+$/i.test(v.trim()) && CSS_COLOR_NAMES.has(v.trim().toLowerCase())
const CSS_COLOR_NAMES = new Set(['red', 'blue', 'green', 'white', 'black', 'gray', 'grey', 'orange', 'purple', 'yellow', 'pink', 'brown', 'navy', 'teal', 'silver', 'gold', 'maroon', 'olive', 'lime', 'aqua', 'fuchsia', 'transparent', 'currentcolor', 'crimson', 'tomato', 'coral', 'salmon', 'indigo', 'violet', 'cyan', 'magenta', 'beige', 'ivory', 'khaki', 'lavender', 'turquoise', 'tan', 'plum', 'orchid', 'rebeccapurple'])
const isLengthLike = (v: string) => /^(-?\d*\.?\d+([a-z%]+)?|(calc|min|max|clamp|var)\(.*\))$/i.test(v.trim())

function expandHex(h: string): string {
  const x = h.toLowerCase()
  if (/^#[0-9a-f]{3}$/.test(x)) return `#${x[1]}${x[1]}${x[2]}${x[2]}${x[3]}${x[3]}`
  if (/^#[0-9a-f]{4}$/.test(x)) return `#${x[1]}${x[1]}${x[2]}${x[2]}${x[3]}${x[3]}${x[4]}${x[4]}`
  return x
}

function colorKeyFor(value: string): string {
  const v = value.trim()
  const lower = v.toLowerCase()
  for (const [k, css] of SPECIAL_COLORS) if (lower === css.toLowerCase() || expandHex(lower) === expandHex(css)) return k
  if (/^#[0-9a-f]{3,8}$/i.test(v)) {
    const hex = expandHex(v)
    for (const [k, h] of PALETTE) if (h === hex) return k
  }
  return arbitrary(v)
}

function colorValueFor(key: string): string | null {
  const [base, alpha] = splitAlpha(key)
  let c: string | null = null
  if (base.startsWith('[') && base.endsWith(']')) {
    const inner = unArbitrary(base)
    c = inner.startsWith('color:') ? inner.slice(6) : isColorLike(inner) || inner.startsWith('var(') ? inner : null
  } else {
    c = SPECIAL_COLORS.find(([k]) => k === base)?.[1] ?? PALETTE.get(base) ?? null
  }
  if (!c) return null
  if (alpha === undefined) return c
  const a = alpha.startsWith('[') ? unArbitrary(alpha) : `${Number(alpha) / 100}`
  if (/^#[0-9a-f]{6}$/i.test(expandHex(c))) {
    const h = expandHex(c)
    return `rgb(${parseInt(h.slice(1, 3), 16)} ${parseInt(h.slice(3, 5), 16)} ${parseInt(h.slice(5, 7), 16)} / ${a})`
  }
  return `color-mix(in srgb, ${c} ${Number(a) * 100}%, transparent)`
}

/** "red-500/50" → ["red-500", "50"]; slashes inside brackets are left alone. */
function splitAlpha(key: string): [string, string | undefined] {
  let depth = 0
  for (let i = key.length - 1; i >= 0; i--) {
    const ch = key[i]
    if (ch === ']') depth++
    else if (ch === '[') depth--
    else if (ch === '/' && depth === 0) return [key.slice(0, i), key.slice(i + 1)]
  }
  return [key, undefined]
}

/* ---------- utility definitions ---------- */

type ArbKind = 'length' | 'color' | 'any'

interface Utility {
  prefix: string
  props: string[]
  /** Scale for this version: [key, css value]. `DEFAULT` means the bare prefix. */
  scale?: (v: TwVersion) => [string, string][]
  spacing?: boolean
  negative?: boolean
  color?: boolean
  /** Integer utilities like z-10, order-3 (any integer in v4). */
  integer?: { v3: number[] }
  arb: ArbKind
  /** Extra forward conversion, e.g. grid-template-columns: repeat(3, minmax(0, 1fr)) → "3". */
  custom?: (value: string, v: TwVersion) => string | null
  customReverse?: (key: string, v: TwVersion) => string | null
}

const SIZE_EXTRAS = (axis: 'w' | 'h'): [string, string][] => [
  ['auto', 'auto'], ...FRACTIONS, ['screen', axis === 'w' ? '100vw' : '100vh'],
  ...((axis === 'w' ? [['svw', '100svw'], ['dvw', '100dvw']] : [['svh', '100svh'], ['dvh', '100dvh'], ['lvh', '100lvh']]) as [string, string][]),
  ['min', 'min-content'], ['max', 'max-content'], ['fit', 'fit-content'],
]
const INSET_EXTRAS: [string, string][] = [['auto', 'auto'], ...FRACTIONS]

const sides = (base: string, prop: string, withNeg: boolean, extras: [string, string][] = []): Utility[] => {
  const mk = (prefix: string, props: string[]): Utility => ({
    prefix, props, spacing: true, negative: withNeg, arb: 'length', scale: () => extras,
  })
  const P = (s: string) => `${prop}-${s}`
  return [
    mk(base, [prop]),
    mk(`${base}x`, [P('left'), P('right')]),
    mk(`${base}y`, [P('top'), P('bottom')]),
    mk(`${base}t`, [P('top')]),
    mk(`${base}r`, [P('right')]),
    mk(`${base}b`, [P('bottom')]),
    mk(`${base}l`, [P('left')]),
    mk(`${base}s`, [P('inline-start')]),
    mk(`${base}e`, [P('inline-end')]),
  ]
}

const gridCols = (kind: 'columns' | 'rows') => ({
  custom: (value: string, v: TwVersion) => {
    const m = /^repeat\((\d+),minmax\(0,1fr\)\)$/.exec(norm(value))
    if (!m) return null
    const n = Number(m[1])
    return v === 4 || n <= 12 ? String(n) : null
  },
  customReverse: (key: string) => (/^\d+$/.test(key) ? `repeat(${key}, minmax(0, 1fr))` : null),
  props: [`grid-template-${kind}`],
})

const span = (prop: string) => ({
  custom: (value: string) => {
    const m = /^span (\d+)\/span \1$/.exec(norm(value)) ?? /^span (\d+)$/.exec(norm(value))
    return m ? m[1] : null
  },
  customReverse: (key: string) => (/^\d+$/.test(key) ? `span ${key} / span ${key}` : null),
  props: [prop],
})

const UTILITIES: Utility[] = [
  ...sides('p', 'padding', false),
  ...sides('m', 'margin', true, [['auto', 'auto']]),
  { prefix: 'gap', props: ['gap'], spacing: true, arb: 'length' },
  { prefix: 'gap-x', props: ['column-gap'], spacing: true, arb: 'length' },
  { prefix: 'gap-y', props: ['row-gap'], spacing: true, arb: 'length' },
  { prefix: 'inset', props: ['inset'], spacing: true, negative: true, arb: 'length', scale: () => INSET_EXTRAS },
  { prefix: 'inset-x', props: ['left', 'right'], spacing: true, negative: true, arb: 'length', scale: () => INSET_EXTRAS },
  { prefix: 'inset-y', props: ['top', 'bottom'], spacing: true, negative: true, arb: 'length', scale: () => INSET_EXTRAS },
  ...(['top', 'right', 'bottom', 'left'] as const).map((p): Utility => ({ prefix: p, props: [p], spacing: true, negative: true, arb: 'length', scale: () => INSET_EXTRAS })),
  { prefix: 'w', props: ['width'], spacing: true, arb: 'length', scale: () => SIZE_EXTRAS('w') },
  { prefix: 'h', props: ['height'], spacing: true, arb: 'length', scale: () => SIZE_EXTRAS('h') },
  { prefix: 'size', props: ['width', 'height'], spacing: true, arb: 'length', scale: () => [['auto', 'auto'], ...FRACTIONS, ['min', 'min-content'], ['max', 'max-content'], ['fit', 'fit-content']] },
  { prefix: 'min-w', props: ['min-width'], spacing: true, arb: 'length', scale: () => [['full', '100%'], ['min', 'min-content'], ['max', 'max-content'], ['fit', 'fit-content'], ['screen', '100vw']] },
  { prefix: 'min-h', props: ['min-height'], spacing: true, arb: 'length', scale: () => [['full', '100%'], ['screen', '100vh'], ['svh', '100svh'], ['dvh', '100dvh'], ['min', 'min-content'], ['max', 'max-content'], ['fit', 'fit-content']] },
  { prefix: 'max-w', props: ['max-width'], arb: 'length', scale: () => MAX_WIDTH },
  { prefix: 'max-h', props: ['max-height'], spacing: true, arb: 'length', scale: () => [['none', 'none'], ['full', '100%'], ['screen', '100vh'], ['svh', '100svh'], ['dvh', '100dvh'], ['min', 'min-content'], ['max', 'max-content'], ['fit', 'fit-content']] },
  { prefix: 'basis', props: ['flex-basis'], spacing: true, arb: 'length', scale: () => [['auto', 'auto'], ...FRACTIONS] },
  { prefix: 'grow', props: ['flex-grow'], arb: 'any', integer: { v3: [] } },
  { prefix: 'shrink', props: ['flex-shrink'], arb: 'any', integer: { v3: [] } },
  { prefix: 'order', props: ['order'], negative: true, arb: 'any', integer: { v3: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }, scale: () => [['first', '-9999'], ['last', '9999'], ['none', '0']] },
  { prefix: 'grid-cols', arb: 'any', ...gridCols('columns') },
  { prefix: 'grid-rows', arb: 'any', ...gridCols('rows') },
  { prefix: 'col-span', arb: 'any', ...span('grid-column') },
  { prefix: 'row-span', arb: 'any', ...span('grid-row') },
  { prefix: 'col-start', props: ['grid-column-start'], arb: 'any', integer: { v3: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] }, scale: () => [['auto', 'auto']] },
  { prefix: 'col-end', props: ['grid-column-end'], arb: 'any', integer: { v3: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] }, scale: () => [['auto', 'auto']] },
  { prefix: 'row-start', props: ['grid-row-start'], arb: 'any', integer: { v3: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] }, scale: () => [['auto', 'auto']] },
  { prefix: 'row-end', props: ['grid-row-end'], arb: 'any', integer: { v3: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] }, scale: () => [['auto', 'auto']] },
  // typography
  { prefix: 'text', props: ['font-size'], arb: 'length', scale: () => FONT_SIZE.map(([k, s]) => [k, s]) },
  { prefix: 'font', props: ['font-weight'], arb: 'any', scale: () => FONT_WEIGHT, custom: (v) => (v === 'bold' ? 'bold' : v === 'normal' ? 'normal' : null) },
  { prefix: 'leading', props: ['line-height'], arb: 'any', scale: () => LEADING },
  { prefix: 'tracking', props: ['letter-spacing'], arb: 'length', scale: () => TRACKING },
  { prefix: 'indent', props: ['text-indent'], spacing: true, negative: true, arb: 'length' },
  { prefix: 'underline-offset', props: ['text-underline-offset'], arb: 'length', scale: () => [['auto', 'auto'], ['0', '0px'], ['1', '1px'], ['2', '2px'], ['4', '4px'], ['8', '8px']] },
  { prefix: 'line-clamp', props: ['-webkit-line-clamp'], arb: 'any', integer: { v3: [1, 2, 3, 4, 5, 6] }, scale: () => [['none', 'none']] },
  // colours
  { prefix: 'text', props: ['color'], color: true, arb: 'color' },
  { prefix: 'bg', props: ['background-color'], color: true, arb: 'color' },
  { prefix: 'border', props: ['border-color'], color: true, arb: 'color' },
  { prefix: 'border-x', props: ['border-left-color', 'border-right-color'], color: true, arb: 'color' },
  { prefix: 'border-y', props: ['border-top-color', 'border-bottom-color'], color: true, arb: 'color' },
  { prefix: 'border-t', props: ['border-top-color'], color: true, arb: 'color' },
  { prefix: 'border-r', props: ['border-right-color'], color: true, arb: 'color' },
  { prefix: 'border-b', props: ['border-bottom-color'], color: true, arb: 'color' },
  { prefix: 'border-l', props: ['border-left-color'], color: true, arb: 'color' },
  { prefix: 'decoration', props: ['text-decoration-color'], color: true, arb: 'color' },
  { prefix: 'outline', props: ['outline-color'], color: true, arb: 'color' },
  { prefix: 'accent', props: ['accent-color'], color: true, arb: 'color' },
  { prefix: 'caret', props: ['caret-color'], color: true, arb: 'color' },
  { prefix: 'fill', props: ['fill'], color: true, arb: 'color' },
  { prefix: 'stroke', props: ['stroke'], color: true, arb: 'color' },
  // borders
  ...([['border', ['border-width']], ['border-x', ['border-left-width', 'border-right-width']], ['border-y', ['border-top-width', 'border-bottom-width']],
    ['border-t', ['border-top-width']], ['border-r', ['border-right-width']], ['border-b', ['border-bottom-width']], ['border-l', ['border-left-width']]] as [string, string[]][])
    .map(([prefix, props]): Utility => ({ prefix, props, arb: 'length', scale: () => [['DEFAULT', '1px'], ['0', '0px'], ['2', '2px'], ['4', '4px'], ['8', '8px']] })),
  ...([['rounded', ['border-radius']], ['rounded-t', ['border-top-left-radius', 'border-top-right-radius']], ['rounded-r', ['border-top-right-radius', 'border-bottom-right-radius']],
    ['rounded-b', ['border-bottom-right-radius', 'border-bottom-left-radius']], ['rounded-l', ['border-top-left-radius', 'border-bottom-left-radius']],
    ['rounded-tl', ['border-top-left-radius']], ['rounded-tr', ['border-top-right-radius']], ['rounded-br', ['border-bottom-right-radius']], ['rounded-bl', ['border-bottom-left-radius']]] as [string, string[]][])
    .map(([prefix, props]): Utility => ({ prefix, props, arb: 'length', scale: (v) => RADIUS[v] })),
  { prefix: 'outline', props: ['outline-width'], arb: 'length', scale: () => [['0', '0px'], ['1', '1px'], ['2', '2px'], ['4', '4px'], ['8', '8px']] },
  { prefix: 'outline-offset', props: ['outline-offset'], arb: 'length', scale: () => [['0', '0px'], ['1', '1px'], ['2', '2px'], ['4', '4px'], ['8', '8px']] },
  // effects
  { prefix: 'opacity', props: ['opacity'], arb: 'any', custom: (value, v) => {
    const n = value.trim().endsWith('%') ? Number(value.trim().slice(0, -1)) : Number(value) * 100
    if (!Number.isFinite(n)) return null
    const r = Math.round(n * 1000) / 1000
    if (!Number.isInteger(r) || r < 0 || r > 100) return null
    return v === 4 || r % 5 === 0 ? String(r) : null
  }, customReverse: (key, v) => (/^\d+$/.test(key) && Number(key) <= 100 && (v === 4 || Number(key) % 5 === 0) ? String(Number(key) / 100) : null) },
  { prefix: 'shadow', props: ['box-shadow'], arb: 'any', scale: (v) => SHADOW[v] },
  { prefix: 'z', props: ['z-index'], negative: true, arb: 'any', integer: { v3: [0, 10, 20, 30, 40, 50] }, scale: () => [['auto', 'auto']] },
  { prefix: 'cursor', props: ['cursor'], arb: 'any', scale: () => CURSORS.map((c) => [c, c]) },
  { prefix: 'duration', props: ['transition-duration'], arb: 'any', custom: (value, v) => {
    const m = /^(\d*\.?\d+)(ms|s)$/.exec(value.trim())
    if (!m) return null
    const ms = m[2] === 's' ? Number(m[1]) * 1000 : Number(m[1])
    return v === 4 ? (Number.isInteger(ms) ? String(ms) : null) : [0, 75, 100, 150, 200, 300, 500, 700, 1000].includes(ms) ? String(ms) : null
  }, customReverse: (key) => (/^\d+$/.test(key) ? `${key}ms` : null) },
  { prefix: 'delay', props: ['transition-delay'], arb: 'any', custom: (value) => { const m = /^(\d+)ms$/.exec(value.trim()); return m ? m[1] : null }, customReverse: (key) => (/^\d+$/.test(key) ? `${key}ms` : null) },
  { prefix: 'aspect', props: ['aspect-ratio'], arb: 'any' },
  { prefix: 'content', props: ['content'], arb: 'any', scale: () => [['none', 'none']] },
  { prefix: 'transition', props: ['transition-property'], arb: 'any', scale: () => [['all', 'all'], ['colors', 'color, background-color, border-color, text-decoration-color, fill, stroke'], ['opacity', 'opacity'], ['shadow', 'box-shadow'], ['transform', 'transform']] },
  { prefix: 'font', props: ['font-family'], arb: 'any' },
  { prefix: 'bg', props: ['background-image'], arb: 'any', custom: (value) => (/^(url|linear-gradient|radial-gradient|conic-gradient)\(/.test(value.trim()) ? arbitrary(value) : null) },
]

/* ---------- CSS → Tailwind ---------- */

function keyForUtility(u: Utility, value: string, v: TwVersion): string | null {
  const val = value.trim()
  if (u.custom) {
    const k = u.custom(val, v)
    if (k) return k
  }
  for (const [k, css] of u.scale?.(v) ?? []) if (sameValue(css, val)) return k
  if (u.color) return colorKeyFor(val)
  if (u.spacing) {
    const k = spacingKeyFor(val, v)
    if (k) return k
  }
  if (u.integer && /^-?\d+$/.test(val)) {
    const n = Math.abs(Number(val))
    if (v === 4 || u.integer.v3.includes(n) || u.integer.v3.length === 0) return String(n) + (Number(val) < 0 ? '\u0000neg' : '')
  }
  return null
}

function classFor(u: Utility, value: string, v: TwVersion): string {
  let key = keyForUtility(u, value, v)
  let neg = ''
  if (key?.endsWith('\u0000neg')) {
    key = key.slice(0, -4)
    neg = '-'
  }
  if (!key && u.negative && value.trim().startsWith('-')) {
    const pos = keyForUtility(u, value.trim().slice(1), v)
    if (pos && !pos.startsWith('[')) {
      key = pos
      neg = '-'
    }
  }
  if (!key) key = arbitrary(value)
  if (key === 'DEFAULT') return `${neg}${u.prefix}`
  return `${neg}${u.prefix}-${key}`
}

const FORWARD_INDEX = new Map<string, Utility>()
for (const u of UTILITIES) {
  if (u.props.length === 1 && !FORWARD_INDEX.has(u.props[0])) FORWARD_INDEX.set(u.props[0], u)
}

/** Splits a value on top-level whitespace, respecting parentheses. */
export function splitTop(value: string, sep: RegExp = /\s/): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of value.trim()) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (depth === 0 && sep.test(ch)) {
      if (cur) out.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur) out.push(cur)
  return out
}

function boxSides(value: string): [string, string, string, string] | null {
  const p = splitTop(value)
  if (p.length < 1 || p.length > 4) return null
  const [t, r = t, b = t, l = r] = p
  return [t, r, b, l]
}

/** Expands shorthands we know about into longhands. Returns null when we should not touch it. */
function expand(d: Decl): Decl[] {
  const { prop, value } = d
  const imp = d.important
  const D = (p: string, v: string): Decl => ({ prop: p, value: v, important: imp })
  if (prop === 'padding' || prop === 'margin' || prop === 'inset') {
    const s = boxSides(value)
    if (!s) return [d]
    const [t, r, b, l] = s
    const pre = prop === 'inset' ? '' : `${prop}-`
    if (sameValue(t, r) && sameValue(t, b) && sameValue(t, l)) return [d]
    const out: Decl[] = []
    if (sameValue(t, b)) out.push(D(`${prop}-block`, t))
    else out.push(D(`${pre}top`, t), D(`${pre}bottom`, b))
    if (sameValue(l, r)) out.push(D(`${prop}-inline`, l))
    else out.push(D(`${pre}left`, l), D(`${pre}right`, r))
    return out
  }
  if (prop === 'gap') {
    const p = splitTop(value)
    if (p.length === 2) return sameValue(p[0], p[1]) ? [D('gap', p[0])] : [D('row-gap', p[0]), D('column-gap', p[1])]
  }
  if (prop === 'overflow') {
    const p = splitTop(value)
    if (p.length === 2) return [D('overflow-x', p[0]), D('overflow-y', p[1])]
  }
  if (prop === 'border-radius') {
    const p = splitTop(value)
    if (p.length > 1 && !value.includes('/')) {
      const [tl, tr = tl, br = tl, bl = tr] = p
      return [D('border-top-left-radius', tl), D('border-top-right-radius', tr), D('border-bottom-right-radius', br), D('border-bottom-left-radius', bl)]
    }
  }
  const borderSide = /^border(-(top|right|bottom|left))?$/.exec(prop)
  if (borderSide && !VALUE_ALIASES[`${prop}:${norm(value)}`]) {
    const side = borderSide[2] ? `-${borderSide[2]}` : ''
    const out: Decl[] = []
    for (const tok of splitTop(value)) {
      if (/^(none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset)$/i.test(tok)) out.push(D(side ? `border${side}-style` : 'border-style', tok))
      else if (/^(thin|medium|thick)$/i.test(tok) || isLengthLike(tok)) out.push(D(`border${side}-width`, tok))
      else out.push(D(`border${side}-color`, tok))
    }
    return out
  }
  if (prop === 'background' && (isColorLike(value) || /^var\(/.test(value.trim()))) return [D('background-color', value)]
  if (prop === 'flex' && !VALUE_ALIASES[`flex:${norm(value)}`] && norm(value) !== '1 1 0%' && norm(value) !== 'none') {
    const p = splitTop(value)
    if (p.length === 3) return [D('flex-grow', p[0]), D('flex-shrink', p[1]), D('flex-basis', p[2])]
  }
  return [d]
}

// Logical shorthands produced by expand(): map to the x/y utilities.
const AXIS: Record<string, string> = {
  'padding-inline': 'px', 'padding-block': 'py', 'margin-inline': 'mx', 'margin-block': 'my', 'inset-inline': 'inset-x', 'inset-block': 'inset-y',
}

const STATIC_FORWARD = new Map<string, string>()
for (const [cls, css] of STATIC) if (!css.includes(';')) STATIC_FORWARD.set(norm(css.replace(':', ': ')).replace(': ', ':'), cls)

function staticKey(prop: string, value: string) {
  return `${prop}:${norm(value)}`
}

export interface ForwardResult {
  classes: string[]
  unconverted: Decl[]
}

/** Converts declarations (already stripped of !important flag into `important`) to classes. */
export function declsToClasses(decls: Decl[], v: TwVersion): ForwardResult {
  const classes: string[] = []
  const unconverted: Decl[] = []
  const bang = (c: string, imp?: boolean) => (!imp ? c : v === 4 ? `${c}!` : `!${c}`)
  for (const original of decls) {
    const prop = original.prop.trim().toLowerCase()
    const value = original.value.trim()
    const alias = VALUE_ALIASES[`${prop}:${norm(value).replace(/\s*\/\s*/g, '/')}`] ?? VALUE_ALIASES[`${prop}:${norm(value)}`]
    if (alias) {
      if (v === 4 && alias.startsWith('outline: 2px')) {
        classes.push(bang('outline-hidden', original.important))
        continue
      }
      const cls = STATIC_FORWARD.get(norm(alias).replace(': ', ':')) ?? (alias.includes(';') ? STATIC.find(([, css]) => css === alias)?.[0] : undefined)
      if (cls) {
        classes.push(bang(cls, original.important))
        continue
      }
      const [ap, av] = alias.split(/:\s*/)
      const u = FORWARD_INDEX.get(ap)
      if (u) {
        classes.push(bang(classFor(u, av, v), original.important))
        continue
      }
    }
    for (const d of expand({ prop, value, important: original.important })) {
      const st = STATIC_FORWARD.get(staticKey(d.prop, d.value))
      if (st) {
        classes.push(bang(v === 4 && st === 'outline-none' ? 'outline-hidden' : st, d.important))
        continue
      }
      if (d.prop === 'outline-style' && norm(d.value) === 'none') {
        classes.push(bang(v === 4 ? 'outline-none' : 'outline-[none]', d.important))
        continue
      }
      const axis = AXIS[d.prop]
      if (axis) {
        const u = UTILITIES.find((x) => x.prefix === axis)!
        classes.push(bang(classFor(u, d.value, v), d.important))
        continue
      }
      const u = FORWARD_INDEX.get(d.prop) ?? UTILITIES.find((x) => x.props.includes(d.prop) && x.props.length === 1)
      if (u) {
        // Guard: font-size arbitrary must look like a length, colours like colours.
        const cls = classFor(u, d.value, v)
        if (u.prefix === 'text' && u.props[0] === 'font-size' && cls.startsWith('text-[') && !isLengthLike(d.value)) {
          classes.push(bang(`text-[length:${arbitrary(d.value).slice(1)}`, d.important))
        } else if (u.props[0] === 'font-family') {
          classes.push(bang(`font-[${v === 4 ? 'family-name:' : ''}${arbitrary(d.value).slice(1)}`, d.important))
        } else classes.push(bang(cls, d.important))
        continue
      }
      if (d.prop === 'cursor') {
        classes.push(bang(`cursor-${arbitrary(d.value)}`, d.important))
        continue
      }
      unconverted.push(d)
    }
  }
  return { classes: mergeAxes(classes), unconverted }
}

/** pl-4 pr-4 → px-4, pt-2 pb-2 → py-2, w-8 h-8 → size-8 is left alone for clarity. */
function mergeAxes(classes: string[]): string[] {
  const out = [...classes]
  const pairs: [string, string, string][] = [
    ['pl', 'pr', 'px'], ['pt', 'pb', 'py'], ['ml', 'mr', 'mx'], ['mt', 'mb', 'my'], ['left', 'right', 'inset-x'], ['top', 'bottom', 'inset-y'],
  ]
  for (const [a, b, c] of pairs) {
    for (const cls of [...out]) {
      const m = new RegExp(`^(!?)(-?)${a}-(.+?)(!?)$`).exec(cls)
      if (!m) continue
      const partner = `${m[1]}${m[2]}${b}-${m[3]}${m[4]}`
      const j = out.indexOf(partner)
      if (j < 0) continue
      out.splice(j, 1)
      out[out.indexOf(cls)] = `${m[1]}${m[2]}${c}-${m[3]}${m[4]}`
    }
  }
  // px-4 py-4 → p-4
  for (const [x, y, all] of [['px', 'py', 'p'], ['mx', 'my', 'm'], ['inset-x', 'inset-y', 'inset']]) {
    for (const cls of [...out]) {
      const m = new RegExp(`^(!?)(-?)${x}-(.+?)(!?)$`).exec(cls)
      if (!m) continue
      const partner = `${m[1]}${m[2]}${y}-${m[3]}${m[4]}`
      const j = out.indexOf(partner)
      if (j < 0) continue
      out.splice(j, 1)
      out[out.indexOf(cls)] = `${m[1]}${m[2]}${all}-${m[3]}${m[4]}`
    }
  }
  return [...new Set(out)]
}

/* ---------- CSS parsing ---------- */

export interface CssRule {
  selector: string
  /** Tailwind variant prefix derived from @media or pseudo-classes, e.g. "md:hover:". */
  variant: string
  decls: Decl[]
  note?: string
}

const PSEUDO_VARIANTS: [RegExp, string][] = [
  [/::?before$/, 'before'], [/::?after$/, 'after'], [/::placeholder$/, 'placeholder'], [/::selection$/, 'selection'],
  [/:hover$/, 'hover'], [/:focus-visible$/, 'focus-visible'], [/:focus-within$/, 'focus-within'], [/:focus$/, 'focus'], [/:active$/, 'active'],
  [/:visited$/, 'visited'], [/:disabled$/, 'disabled'], [/:checked$/, 'checked'], [/:first-child$/, 'first'], [/:last-child$/, 'last'],
  [/:nth-child\(odd\)$/, 'odd'], [/:nth-child\(even\)$/, 'even'], [/:required$/, 'required'], [/:invalid$/, 'invalid'],
]

function parseDecls(body: string): Decl[] {
  const out: Decl[] = []
  for (const part of splitTop(body, /;/)) {
    const i = part.indexOf(':')
    if (i < 0) continue
    const prop = part.slice(0, i).trim()
    let value = part.slice(i + 1).trim()
    if (!prop || !value) continue
    let important = false
    if (/!\s*important$/i.test(value)) {
      important = true
      value = value.replace(/!\s*important$/i, '').trim()
    }
    out.push({ prop, value, important })
  }
  return out
}

function mediaVariant(query: string): { variant: string; note?: string } {
  const q = norm(query).replace(/\s*([:<>=]+)\s*/g, '$1')
  const min = /\(min-width:(\d+)px\)/.exec(q) ?? /\(width>=(\d+)px\)/.exec(q)
  if (q.includes('prefers-color-scheme:dark')) return { variant: 'dark:' }
  if (q.includes('prefers-reduced-motion:reduce')) return { variant: 'motion-reduce:' }
  if (q === 'print') return { variant: 'print:' }
  if (min && !q.includes('max-width')) {
    const bp = BREAKPOINTS.find(([, px]) => px === Number(min[1]))
    return bp ? { variant: `${bp[0]}:` } : { variant: `min-[${min[1]}px]:` }
  }
  const max = /\(max-width:(\d+(\.\d+)?)px\)/.exec(q)
  if (max && !q.includes('min-width')) return { variant: `max-[${max[1]}px]:` }
  const arb = query.trim().replace(/\s*:\s*/g, ':').replace(/\s+/g, '_')
  return { variant: `[@media_${arb}]:`, note: `@media ${query.trim()} became an arbitrary variant` }
}

export function parseCss(input: string): CssRule[] {
  const src = input.replace(/\/\*[\s\S]*?\*\//g, '')
  if (!src.includes('{')) return [{ selector: '', variant: '', decls: parseDecls(src) }]
  const rules: CssRule[] = []
  const walk = (text: string, variant: string, note?: string) => {
    let i = 0
    while (i < text.length) {
      const open = text.indexOf('{', i)
      if (open < 0) break
      const prelude = text.slice(i, open).trim().replace(/^[;}\s]+/, '')
      // find matching brace
      let depth = 1
      let j = open + 1
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++
        else if (text[j] === '}') depth--
        j++
      }
      const body = text.slice(open + 1, j - 1)
      if (prelude.startsWith('@media')) {
        const mv = mediaVariant(prelude.slice(6))
        walk(body, variant + mv.variant, mv.note ?? note)
      } else if (prelude.startsWith('@')) {
        rules.push({ selector: prelude, variant, decls: [], note: `${prelude.split(/\s/)[0]} blocks are not converted` })
      } else {
        for (const sel of splitTop(prelude, /,/)) {
          let base = sel.trim()
          let pv = ''
          for (let guard = 0; guard < 3; guard++) {
            const hit = PSEUDO_VARIANTS.find(([re]) => re.test(base))
            if (!hit) break
            base = base.replace(hit[0], '')
            pv = `${hit[1]}:${pv}`
          }
          rules.push({ selector: base || sel.trim(), variant: variant + pv, decls: parseDecls(body), note })
        }
      }
      i = j
    }
  }
  walk(src, '')
  return rules
}

export interface SelectorResult {
  selector: string
  classes: string[]
  unconverted: { variant: string; decl: Decl }[]
  notes: string[]
}

export function cssToTailwind(input: string, v: TwVersion): SelectorResult[] {
  const bySelector = new Map<string, SelectorResult>()
  for (const rule of parseCss(input)) {
    const key = rule.selector
    let entry = bySelector.get(key)
    if (!entry) {
      entry = { selector: key, classes: [], unconverted: [], notes: [] }
      bySelector.set(key, entry)
    }
    if (rule.note && !entry.notes.includes(rule.note)) entry.notes.push(rule.note)
    const r = declsToClasses(rule.decls, v)
    entry.classes.push(...r.classes.map((c) => rule.variant + c))
    entry.unconverted.push(...r.unconverted.map((decl) => ({ variant: rule.variant, decl })))
  }
  for (const e of bySelector.values()) e.classes = [...new Set(e.classes)]
  return [...bySelector.values()]
}

/* ---------- Tailwind → CSS ---------- */

const STATIC_REVERSE = new Map(STATIC.map(([cls, css]) => [cls, css]))

function parseDeclString(css: string): Decl[] {
  return css.split(';').map((s) => {
    const i = s.indexOf(':')
    return { prop: s.slice(0, i).trim(), value: s.slice(i + 1).trim() }
  })
}

function negate(value: string): string {
  if (/^-?\d*\.?\d+[a-z%]*$/i.test(value)) return value.startsWith('-') ? value.slice(1) : value === '0px' || value === '0' ? value : `-${value}`
  return `calc(${value} * -1)`
}

function resolveKey(u: Utility, key: string, v: TwVersion): string | null {
  if (key === '') {
    return u.scale?.(v).find(([k]) => k === 'DEFAULT')?.[1] ?? null
  }
  if (key.startsWith('[') && key.endsWith(']')) {
    const inner = unArbitrary(key)
    if (u.color) return colorValueFor(key)
    if (u.arb === 'length') {
      if (inner.startsWith('length:')) return inner.slice(7)
      return isLengthLike(inner) || /^(auto|none)$/.test(inner) ? inner : null
    }
    if (u.props[0] === 'font-family') return inner.replace(/^family-name:/, '')
    if (u.props[0] === 'font-weight' && !/^\d+$/.test(inner) && !inner.startsWith('var(')) return null
    return inner
  }
  if (u.color) return colorValueFor(key)
  if (u.customReverse) {
    const r = u.customReverse(key, v)
    if (r) return r
  }
  const s = u.scale?.(v).find(([k]) => k === key)
  if (s) return s[1]
  if (u.spacing) {
    const sp = spacingValueFor(key, v)
    if (sp) return sp
  }
  if (u.integer && /^\d+$/.test(key)) {
    const n = Number(key)
    if (v === 4 || u.integer.v3.length === 0 || u.integer.v3.includes(n)) return key
  }
  return null
}

const SORTED_UTILS = [...UTILITIES].sort((a, b) => b.prefix.length - a.prefix.length)

export function classToDecls(cls: string, v: TwVersion): Decl[] | null {
  let c = cls
  let important = false
  if (c.startsWith('!')) {
    important = true
    c = c.slice(1)
  } else if (c.endsWith('!')) {
    important = true
    c = c.slice(0, -1)
  }
  const withImp = (ds: Decl[]) => ds.map((d) => ({ ...d, important }))
  if (v === 4 && c === 'outline-hidden') return withImp(parseDeclString(STATIC_REVERSE.get('outline-none')!))
  if (v === 4 && c === 'outline-none') return withImp([{ prop: 'outline-style', value: 'none' }])
  const st = STATIC_REVERSE.get(c)
  if (st) return withImp(parseDeclString(st))
  let neg = false
  if (c.startsWith('-')) {
    neg = true
    c = c.slice(1)
  }
  if (c.startsWith('cursor-[')) return withImp([{ prop: 'cursor', value: unArbitrary(c.slice(7)) }])
  if (c.startsWith('[') && c.endsWith(']') && c.includes(':')) {
    const inner = unArbitrary(c)
    const i = inner.indexOf(':')
    return withImp([{ prop: inner.slice(0, i), value: inner.slice(i + 1) }])
  }
  for (const u of SORTED_UTILS) {
    let key: string
    if (c === u.prefix) key = ''
    else if (c.startsWith(`${u.prefix}-`)) key = c.slice(u.prefix.length + 1)
    else continue
    if (neg && !u.negative) continue
    const val = resolveKey(u, key, v)
    if (val === null) continue
    const value = neg ? negate(val) : val
    const decls = u.props.map((prop) => ({ prop, value }))
    if (u.props[0] === 'font-size' && !key.startsWith('[')) {
      const lh = FONT_SIZE.find(([k]) => k === key)?.[2]
      if (lh) decls.push({ prop: 'line-height', value: lh })
    }
    if (u.props[0] === '-webkit-line-clamp' && key !== 'none') {
      return withImp([{ prop: 'overflow', value: 'hidden' }, { prop: 'display', value: '-webkit-box' }, { prop: '-webkit-box-orient', value: 'vertical' }, ...decls])
    }
    return withImp(decls)
  }
  return null
}

/** Splits "md:hover:bg-[url(a:b)]" into variants and the utility, ignoring colons inside brackets. */
export function splitVariants(cls: string): { variants: string[]; utility: string } {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of cls) {
    if (ch === '[' || ch === '(') depth++
    if (ch === ']' || ch === ')') depth--
    if (ch === ':' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  return { variants: parts, utility: cur }
}

const PSEUDO_CSS: Record<string, string> = {
  hover: ':hover', focus: ':focus', 'focus-visible': ':focus-visible', 'focus-within': ':focus-within', active: ':active', visited: ':visited',
  disabled: ':disabled', checked: ':checked', required: ':required', invalid: ':invalid', first: ':first-child', last: ':last-child',
  odd: ':nth-child(odd)', even: ':nth-child(even)', before: '::before', after: '::after', placeholder: '::placeholder', selection: '::selection',
}

function variantToWrapper(variant: string): { pseudo?: string; media?: string } | null {
  if (PSEUDO_CSS[variant]) return { pseudo: PSEUDO_CSS[variant] }
  const bp = BREAKPOINTS.find(([k]) => k === variant)
  if (bp) return { media: `(min-width: ${bp[1]}px)` }
  const maxBp = /^max-(sm|md|lg|xl|2xl)$/.exec(variant)
  if (maxBp) return { media: `not all and (min-width: ${BREAKPOINTS.find(([k]) => k === maxBp[1])![1]}px)` }
  const arbMin = /^min-\[(.+)\]$/.exec(variant)
  if (arbMin) return { media: `(min-width: ${arbMin[1]})` }
  const arbMax = /^max-\[(.+)\]$/.exec(variant)
  if (arbMax) return { media: `(max-width: ${arbMax[1]})` }
  if (variant === 'dark') return { media: '(prefers-color-scheme: dark)' }
  if (variant === 'motion-reduce') return { media: '(prefers-reduced-motion: reduce)' }
  if (variant === 'motion-safe') return { media: '(prefers-reduced-motion: no-preference)' }
  if (variant === 'print') return { media: 'print' }
  return null
}

export interface ReverseResult {
  css: string
  unknown: string[]
  unsupportedVariants: string[]
}

export function tailwindToCss(classList: string, selector: string, v: TwVersion): ReverseResult {
  const groups = new Map<string, { media: string[]; pseudo: string; decls: Decl[] }>()
  const unknown: string[] = []
  const unsupportedVariants: string[] = []
  const tokens = classList.replace(/\bclass(Name)?\s*=\s*["'`{]?/g, ' ').replace(/["'`{}]/g, ' ').split(/\s+/).filter(Boolean)
  for (const tok of [...new Set(tokens)]) {
    const { variants, utility } = splitVariants(tok)
    const decls = classToDecls(utility, v)
    if (!decls) {
      unknown.push(tok)
      continue
    }
    const media: string[] = []
    let pseudo = ''
    let ok = true
    for (const vr of variants) {
      const w = variantToWrapper(vr)
      if (!w) {
        ok = false
        if (!unsupportedVariants.includes(`${vr}:`)) unsupportedVariants.push(`${vr}:`)
        break
      }
      if (w.media) media.push(w.media)
      if (w.pseudo) pseudo += w.pseudo
    }
    if (!ok) {
      unknown.push(tok)
      continue
    }
    const key = `${media.join(' and ')}|${pseudo}`
    const g = groups.get(key) ?? { media, pseudo, decls: [] }
    g.decls.push(...decls)
    groups.set(key, g)
  }
  const blocks: string[] = []
  const sorted = [...groups.values()].sort((a, b) => a.media.length - b.media.length || mediaWidth(a.media) - mediaWidth(b.media))
  for (const g of sorted) {
    const body = g.decls.map((d) => `${d.prop}: ${d.value}${d.important ? ' !important' : ''};`)
    const sel = `${selector}${g.pseudo}`
    if (g.media.length) {
      blocks.push(`@media ${g.media.join(' and ')} {\n  ${sel} {\n${body.map((l) => `    ${l}`).join('\n')}\n  }\n}`)
    } else {
      blocks.push(`${sel} {\n${body.map((l) => `  ${l}`).join('\n')}\n}`)
    }
  }
  return { css: blocks.join('\n\n'), unknown, unsupportedVariants }
}

function mediaWidth(m: string[]): number {
  const n = /min-width: (\d+)/.exec(m.join(' '))
  return n ? Number(n[1]) : 0
}
