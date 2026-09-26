/** Metric tire size math (e.g. 185/65R15). Pure and tested. */

export interface Tire {
  /** Section width, mm. */
  width: number
  /** Sidewall height as % of width. */
  aspect: number
  /** Rim diameter, inches. */
  rim: number
}

/** Parses "185/65R15", "185/65 R15", "P205/55ZR16" or "185-65-15". Returns null when it can't. */
export function parseTire(s: string): Tire | null {
  const m = s.trim().toUpperCase().match(/^P?\s*(\d{2,3})\s*[/\-\s]\s*(\d{2})\s*[-\s]?(?:Z?R|D|B)?\s*[-\s]?(\d{2}(?:\.\d)?)\b/)
  if (!m) return null
  const t = { width: Number(m[1]), aspect: Number(m[2]), rim: Number(m[3]) }
  return t.width >= 80 && t.width <= 400 && t.aspect >= 20 && t.aspect <= 100 && t.rim >= 8 && t.rim <= 26 ? t : null
}

export const tireLabel = (t: Tire) => `${t.width}/${t.aspect}R${t.rim}`

export interface TireStats {
  /** Sidewall height, mm. */
  sidewall: number
  /** Rim diameter, mm. */
  rimMm: number
  /** Overall diameter, mm. */
  diameter: number
  /** Rolling circumference, mm. */
  circumference: number
  revsPerKm: number
}

export function tireStats(t: Tire): TireStats {
  const sidewall = (t.width * t.aspect) / 100
  const rimMm = t.rim * 25.4
  const diameter = rimMm + 2 * sidewall
  const circumference = Math.PI * diameter
  return { sidewall, rimMm, diameter, circumference, revsPerKm: 1e6 / circumference }
}

/** Diameter change from `a` to `b`, percent. */
export function diffPercent(a: Tire, b: Tire): number {
  const da = tireStats(a).diameter
  return ((tireStats(b).diameter - da) / da) * 100
}

/** Actual speed when the speedometer (calibrated for `a`) shows `shown` with tire `b` fitted. */
export function actualSpeed(a: Tire, b: Tire, shown: number): number {
  return (shown * tireStats(b).diameter) / tireStats(a).diameter
}

export const WIDTHS = Array.from({ length: 27 }, (_, i) => 135 + i * 10)
export const ASPECTS = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85]
export const RIMS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]
