export interface FilterPreset {
  id: string
  label: string
  /** A CSS `filter:` value at full strength. */
  css: string
}

export const FILTERS: FilterPreset[] = [
  { id: 'grayscale', label: 'Grayscale', css: 'grayscale(1)' },
  { id: 'sepia', label: 'Sepia', css: 'sepia(1)' },
  { id: 'warm', label: 'Warm', css: 'sepia(0.4) saturate(1.3) brightness(1.05)' },
  { id: 'cool', label: 'Cool', css: 'hue-rotate(-12deg) saturate(1.15) brightness(1.02)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(0.55) contrast(0.85) brightness(1.08) saturate(0.8)' },
  { id: 'dramatic', label: 'Dramatic', css: 'contrast(1.5) saturate(1.1) brightness(0.95)' },
  { id: 'fade', label: 'Fade', css: 'contrast(0.82) brightness(1.12) saturate(0.75)' },
]

/** Functions that mean "no change" at 1, so intensity blends between 1 and the preset. */
const NEUTRAL_ONE = new Set(['brightness', 'contrast', 'saturate'])

export function clampIntensity(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

const round3 = (n: number) => String(Math.round(n * 1000) / 1000)

/**
 * The `filter:` string for a preset at 0…1 strength. 0 removes the filter
 * entirely ("none"); an unknown id does the same.
 */
export function filterCss(id: string, intensity: number): string {
  const preset = FILTERS.find((f) => f.id === id)
  const amount = clampIntensity(intensity)
  if (!preset || amount === 0) return 'none'
  return preset.css.replace(/([a-z-]+)\((-?[\d.]+)(deg)?\)/g, (_all, name: string, value: string, unit?: string) => {
    const v = Number(value)
    if (!Number.isFinite(v)) return `${name}(${value}${unit ?? ''})`
    const scaled = NEUTRAL_ONE.has(name) ? 1 + (v - 1) * amount : v * amount
    return `${name}(${round3(scaled)}${unit ?? ''})`
  })
}
