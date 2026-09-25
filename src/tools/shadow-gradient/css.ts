export type ShadowLayer = { x: number; y: number; blur: number; spread: number; color: string; opacity: number; inset: boolean }
export type GradientType = 'linear' | 'radial' | 'conic'
export type ColorStop = { color: string; position: number }
export type Gradient = { type: GradientType; angle: number; shape: 'circle' | 'ellipse'; stops: ColorStop[] }

/** Parses #rgb or #rrggbb into channels, or null. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(h)) h = [...h].map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) return null
  const n = parseInt(h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const trim = (n: number, d = 2) => String(Math.round(n * 10 ** d) / 10 ** d)

/** #rrggbb + opacity (0–1) → `rgba(r, g, b, a)`, or the plain hex when fully opaque. */
export function toRgba(hex: string, opacity: number): string {
  const c = hexToRgb(hex)
  if (!c) return hex
  const a = clamp01(opacity)
  if (a === 1) return '#' + hex.trim().replace(/^#/, '').toLowerCase()
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${trim(a)})`
}

/** #rrggbb + opacity (0–1) → 8-digit hex `#rrggbbaa`. */
export function toHex8(hex: string, opacity: number): string {
  const c = hexToRgb(hex)
  if (!c) return hex
  const a = Math.round(clamp01(opacity) * 255)
  return '#' + [c.r, c.g, c.b, a].map((v) => v.toString(16).padStart(2, '0')).join('')
}

const px = (n: number) => (n === 0 ? '0' : `${trim(n)}px`)

export function shadowLayerCss(l: ShadowLayer): string {
  return [l.inset ? 'inset' : '', px(l.x), px(l.y), px(l.blur), px(l.spread), toRgba(l.color, l.opacity)].filter(Boolean).join(' ')
}

export function boxShadowCss(layers: ShadowLayer[]): string {
  return layers.length ? layers.map(shadowLayerCss).join(', ') : 'none'
}

export function gradientCss(g: Gradient): string {
  const stops = [...g.stops]
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color.toLowerCase()} ${trim(s.position)}%`)
    .join(', ')
  if (g.type === 'linear') return `linear-gradient(${trim(g.angle)}deg, ${stops})`
  if (g.type === 'radial') return `radial-gradient(${g.shape}, ${stops})`
  return `conic-gradient(from ${trim(g.angle)}deg, ${stops})`
}

/**
 * Turns a CSS value into a Tailwind arbitrary value: spaces become underscores,
 * and spaces after commas are dropped. E.g. shadow-[0_4px_6px_rgba(0,0,0,0.1)].
 */
export function tailwindArbitrary(prefix: string, value: string): string {
  return `${prefix}-[${value.replace(/,\s+/g, ',').replace(/\s+/g, '_')}]`
}
