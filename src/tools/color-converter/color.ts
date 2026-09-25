export type RGB = { r: number; g: number; b: number }
export type HSL = { h: number; s: number; l: number }

export function hexToRgb(hex: string): RGB | null {
  let h = hex.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(h)) h = [...h].map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) return null
  const n = parseInt(h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function rgbToHex({ r, g, b }: RGB): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: Math.round(h * 60), s: Math.round(s * 100), l: Math.round(l * 100) }
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) }
}

/** Parses #hex, rgb(r, g, b) or hsl(h, s%, l%). */
export function parseColor(input: string): RGB | null {
  const t = input.trim().toLowerCase()
  const rgb = t.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/)
  if (rgb) {
    const [r, g, b] = rgb.slice(1, 4).map(Number)
    return r <= 255 && g <= 255 && b <= 255 ? { r, g, b } : null
  }
  const hsl = t.match(/^hsla?\(\s*(\d{1,3}(?:\.\d+)?)[\s,]+(\d{1,3}(?:\.\d+)?)%[\s,]+(\d{1,3}(?:\.\d+)?)%/)
  if (hsl) return hslToRgb({ h: Number(hsl[1]) % 360, s: Math.min(100, Number(hsl[2])), l: Math.min(100, Number(hsl[3])) })
  return hexToRgb(t)
}

/** WCAG contrast ratio between two colors. */
export function contrast(a: RGB, b: RGB): number {
  const lum = ({ r, g, b }: RGB) => {
    const [R, G, B] = [r, g, b].map((v) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * R + 0.7152 * G + 0.0722 * B
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
