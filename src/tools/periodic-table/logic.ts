import type { Category, Element, State } from './elements'

/** Grid cell (1-based column 1–18, row 1–10) for an element. Rows 9 and 10 hold the lanthanides and actinides. */
export function position(el: Pick<Element, 'z' | 'group' | 'period'>): { col: number; row: number } {
  if (el.group !== null) return { col: el.group, row: el.period }
  const first = el.period === 6 ? 57 : 89
  return { col: 3 + (el.z - first), row: el.period === 6 ? 9 : 10 }
}

export type HeatMode = 'category' | 'en' | 'radius' | 'melt' | 'state'

/** Cool-to-warm stops for numeric heatmaps. */
export const STOPS = ['#2c7bb6', '#6fb2d2', '#b8e0c8', '#fee08b', '#fc8d59', '#d7301f']

function hexToRgb(h: string) {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Color for t in [0, 1] along STOPS (clamped). */
export function scaleColor(t: number): string {
  const x = Math.min(1, Math.max(0, t)) * (STOPS.length - 1)
  const i = Math.min(STOPS.length - 2, Math.floor(x))
  const f = x - i
  const a = hexToRgb(STOPS[i])
  const b = hexToRgb(STOPS[i + 1])
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

export const CATEGORY_COLORS: Record<Category, string> = {
  alkali: '#f76707',
  alkaline: '#fab005',
  transition: '#e599a1',
  'post-transition': '#74c0fc',
  metalloid: '#63e6be',
  nonmetal: '#8ce99a',
  halogen: '#ffd43b',
  noble: '#b197fc',
  lanthanide: '#f783ac',
  actinide: '#da77f2',
  unknown: '#adb5bd',
}

export const CATEGORY_NAMES: Record<Category, string> = {
  alkali: 'Alkali metal',
  alkaline: 'Alkaline earth metal',
  transition: 'Transition metal',
  'post-transition': 'Post-transition metal',
  metalloid: 'Metalloid',
  nonmetal: 'Reactive nonmetal',
  halogen: 'Halogen',
  noble: 'Noble gas',
  lanthanide: 'Lanthanide',
  actinide: 'Actinide',
  unknown: 'Unknown properties',
}

export const STATE_COLORS: Record<State, string> = { solid: '#a5a09a', liquid: '#339af0', gas: '#ff922b', unknown: '#dee2e6' }

export const numericValue = (el: Element, mode: HeatMode): number | null => (mode === 'en' ? el.en : mode === 'radius' ? el.radius : mode === 'melt' ? el.melt : null)

/** Min and max of a numeric property over the elements that have it. */
export function range(elements: readonly Element[], mode: HeatMode): [number, number] {
  const vals = elements.map((e) => numericValue(e, mode)).filter((v): v is number => v !== null)
  return vals.length ? [Math.min(...vals), Math.max(...vals)] : [0, 1]
}

/** Fill color for an element in a heatmap mode; null when the value is unknown. */
export function heatColor(el: Element, mode: HeatMode, [lo, hi]: [number, number]): string | null {
  if (mode === 'category') return CATEGORY_COLORS[el.category]
  if (mode === 'state') return el.state === 'unknown' ? null : STATE_COLORS[el.state]
  const v = numericValue(el, mode)
  return v === null ? null : scaleColor(hi > lo ? (v - lo) / (hi - lo) : 0)
}

/** Elements whose name, symbol or number match the query (symbol matches rank first). */
export function search(elements: readonly Element[], q: string): Element[] {
  const s = q.trim().toLowerCase()
  if (!s) return []
  if (/^\d+$/.test(s)) return elements.filter((e) => e.z === Number(s))
  const exact = elements.filter((e) => e.symbol.toLowerCase() === s)
  const rest = elements.filter((e) => e.symbol.toLowerCase() !== s && (e.name.toLowerCase().includes(s) || e.symbol.toLowerCase().startsWith(s)))
  return [...exact, ...rest]
}
