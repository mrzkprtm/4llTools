/** EV charging time with a simple taper model. Pure and tested. */

export interface EvPreset {
  id: string
  name: string
  /** Usable battery, kWh (approximate). */
  kwh: number
  /** Onboard AC charger limit, kW. */
  maxAc: number
  /** DC fast charge peak, kW (0 = no DC charging). */
  maxDc: number
}

export const EVS: readonly EvPreset[] = [
  { id: 'air-ev', name: 'Wuling Air ev Long Range', kwh: 26.7, maxAc: 6.6, maxDc: 0 },
  { id: 'binguo', name: 'Wuling BinguoEV', kwh: 37.9, maxAc: 6.6, maxDc: 30 },
  { id: 'dolphin', name: 'BYD Dolphin Premium', kwh: 60.5, maxAc: 7, maxDc: 88 },
  { id: 'ioniq5', name: 'Hyundai Ioniq 5 Long Range', kwh: 72.6, maxAc: 10.9, maxDc: 220 },
  { id: 'model3', name: 'Tesla Model 3 RWD', kwh: 57.5, maxAc: 11, maxDc: 170 },
]

export const SLOW_CHARGERS = [2.2, 7, 11, 22] as const
export const FAST_CHARGERS = [50, 100, 150] as const

/** Approximate tariffs, Rp per kWh. PLN household (above 2,200 VA) and SPKLU fast charging. */
export const PRICE_HOME = 1445
export const PRICE_SPKLU = 2467

/** Chargers of 22 kW and below are AC and limited by the car's onboard charger. */
export const isDc = (kw: number) => kw > 22

/** Taper starts here (%), and power falls linearly to `floor × peak` at 100%. */
export const TAPER_START = 80

/** Power (kW) the car accepts at a state of charge `soc` (0–100). */
export function powerAt(soc: number, chargerKw: number, ev: Pick<EvPreset, 'maxAc' | 'maxDc'>): number {
  const dc = isDc(chargerKw)
  const cap = dc ? (ev.maxDc > 0 ? ev.maxDc : ev.maxAc) : ev.maxAc
  const peak = Math.min(chargerKw, cap)
  if (soc <= TAPER_START) return peak
  // DC tapers hard near full; AC barely tapers because it is already slow.
  const floor = dc && ev.maxDc > 0 ? 0.15 : 0.6
  const f = (soc - TAPER_START) / (100 - TAPER_START)
  return peak * (1 - (1 - floor) * f)
}

export interface ChargeResult {
  /** Hours to go from `from` to `to`. */
  hours: number
  /** Energy stored in the battery, kWh. */
  stored: number
  /** Energy drawn from the grid including losses, kWh. */
  drawn: number
  cost: number
  /** Samples of [soc, kW, hoursElapsed] for charts and animation. */
  curve: [number, number, number][]
  /** True when the car cannot use DC and fell back to AC. */
  acFallback: boolean
}

export function chargeTime(capacityKwh: number, from: number, to: number, chargerKw: number, ev: Pick<EvPreset, 'maxAc' | 'maxDc'>, pricePerKwh: number): ChargeResult {
  const a = Math.max(0, Math.min(100, from))
  const b = Math.max(a, Math.min(100, to))
  const steps = Math.max(1, Math.round((b - a) * 4))
  const ds = (b - a) / steps
  let hours = 0
  const curve: [number, number, number][] = [[a, powerAt(a, chargerKw, ev), 0]]
  for (let i = 0; i < steps; i++) {
    const mid = a + (i + 0.5) * ds
    const p = powerAt(mid, chargerKw, ev)
    hours += p > 0 ? (capacityKwh * ds) / 100 / p : Infinity
    const s = a + (i + 1) * ds
    curve.push([s, powerAt(s, chargerKw, ev), hours])
  }
  const stored = (capacityKwh * (b - a)) / 100
  const efficiency = isDc(chargerKw) ? 0.93 : 0.88
  const drawn = stored / efficiency
  return { hours, stored, drawn, cost: drawn * pricePerKwh, curve, acFallback: isDc(chargerKw) && ev.maxDc <= 0 }
}

/** SoC reached after `h` hours along a curve from chargeTime. */
export function socAfter(curve: ChargeResult['curve'], h: number): number {
  if (h <= 0) return curve[0][0]
  for (let i = 1; i < curve.length; i++) {
    if (curve[i][2] >= h) {
      const [s0, , h0] = curve[i - 1]
      const [s1, , h1] = curve[i]
      return s0 + ((s1 - s0) * (h - h0)) / (h1 - h0 || 1)
    }
  }
  return curve[curve.length - 1][0]
}

export function hm(hours: number): string {
  if (!Number.isFinite(hours)) return '—'
  const m = Math.round(hours * 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}
