export type GlassOptions = {
  /** Backdrop blur in px. */
  blur: number
  /** Tint opacity, 0–1. */
  opacity: number
  /** Backdrop saturation in % (100 = unchanged). */
  saturation: number
  /** Border width in px (0 = none). */
  borderWidth: number
  /** Border opacity, 0–1 (the border uses the tint color). */
  borderOpacity: number
  /** Corner radius in px. */
  radius: number
  /** Shadow strength, 0–1 (0 = no shadow). */
  shadow: number
  /** Tint color as #rrggbb. */
  tint: string
}

export const DEFAULT_GLASS: GlassOptions = { blur: 14, opacity: 0.18, saturation: 180, borderWidth: 1, borderOpacity: 0.35, radius: 20, shadow: 0.2, tint: '#ffffff' }

const trim = (n: number, d = 2) => String(Math.round(n * 10 ** d) / 10 ** d)

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(h)) h = [...h].map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) h = 'ffffff'
  const n = parseInt(h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function rgba(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${trim(Math.min(1, Math.max(0, a)))})`
}

export function backdropValue(o: GlassOptions): string {
  const parts = [`blur(${trim(o.blur)}px)`]
  if (o.saturation !== 100) parts.push(`saturate(${trim(o.saturation)}%)`)
  return parts.join(' ')
}

export function shadowValue(o: GlassOptions): string | null {
  if (o.shadow <= 0) return null
  return `0 8px 32px ${rgba('#000000', o.shadow)}`
}

/** Declarations (property, value) in output order; shared by the CSS text and the live preview. */
export function glassDeclarations(o: GlassOptions): [string, string][] {
  const d: [string, string][] = [
    ['background', rgba(o.tint, o.opacity)],
    ['backdrop-filter', backdropValue(o)],
    ['-webkit-backdrop-filter', backdropValue(o)],
  ]
  if (o.borderWidth > 0) d.push(['border', `${trim(o.borderWidth)}px solid ${rgba(o.tint, o.borderOpacity)}`])
  d.push(['border-radius', `${trim(o.radius)}px`])
  const sh = shadowValue(o)
  if (sh) d.push(['box-shadow', sh])
  return d
}

export function glassCss(o: GlassOptions, selector = '.glass'): string {
  return `${selector} {\n${glassDeclarations(o)
    .map(([p, v]) => `  ${p}: ${v};`)
    .join('\n')}\n}`
}

/** Inline style object for React (camelCase, WebkitBackdropFilter). */
export function glassStyle(o: GlassOptions): Record<string, string> {
  const style: Record<string, string> = {}
  for (const [p, v] of glassDeclarations(o)) {
    const key = p.startsWith('-webkit-') ? 'Webkit' + camel(p.slice(7)) : camel(p)
    style[key] = v
  }
  return style
}

const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

function colorToken(hex: string): string {
  const h = hex.toLowerCase()
  if (h === '#ffffff' || h === '#fff') return 'white'
  if (h === '#000000' || h === '#000') return 'black'
  return `[${h}]`
}

/** Tailwind opacity modifier: /20 for multiples of 5, else an arbitrary /[0.37]. */
function alpha(a: number): string {
  const pct = Math.round(a * 100)
  return pct % 5 === 0 ? `/${pct}` : `/[${trim(a)}]`
}

export function glassTailwind(o: GlassOptions): string {
  const c = colorToken(o.tint)
  const cls = [`bg-${c}${alpha(o.opacity)}`, `backdrop-blur-[${trim(o.blur)}px]`]
  if (o.saturation !== 100) cls.push(`backdrop-saturate-[${trim(o.saturation)}%]`)
  if (o.borderWidth > 0) cls.push(o.borderWidth === 1 ? 'border' : `border-[${trim(o.borderWidth)}px]`, `border-${c}${alpha(o.borderOpacity)}`)
  cls.push(`rounded-[${trim(o.radius)}px]`)
  const sh = shadowValue(o)
  if (sh) cls.push(`shadow-[${sh.replace(/,\s+/g, ',').replace(/\s+/g, '_')}]`)
  return cls.join(' ')
}
