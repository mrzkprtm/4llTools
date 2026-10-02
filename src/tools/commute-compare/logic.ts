/** Commute cost, time and CO₂ per month for different modes. Pure and tested. */

export type ModeId = 'car' | 'motorbike' | 'krl' | 'bus' | 'ojol' | 'bicycle' | 'walk'

export interface ModeParams {
  id: ModeId
  name: string
  icon: string
  /** Rupiah per km (fuel + wear, or fare per km beyond the base distance). */
  perKm: number
  /** Rupiah per one-way trip (base fare, feeder ojek). */
  perTrip: number
  /** Km included in the per-trip fare before `perKm` applies (for KRL). */
  freeKm: number
  /** Rupiah per commuting day (parking). */
  perDay: number
  /** Door-to-door average speed, km/h, while moving. */
  speed: number
  /** Minutes per one-way trip spent walking to stops, waiting or parking. */
  wait: number
  /** Grams CO₂ per passenger-km. */
  co2: number
}

/** Rough Jakarta-area defaults (2025 prices). Edit them to match your commute. */
export const DEFAULT_MODES: readonly ModeParams[] = [
  { id: 'car', name: 'Car', icon: '🚗', perKm: 1200, perTrip: 0, freeKm: 0, perDay: 10000, speed: 22, wait: 8, co2: 170 },
  { id: 'motorbike', name: 'Motorbike', icon: '🛵', perKm: 350, perTrip: 0, freeKm: 0, perDay: 4000, speed: 30, wait: 4, co2: 70 },
  { id: 'krl', name: 'KRL / train', icon: '🚆', perKm: 100, perTrip: 3000, freeKm: 25, perDay: 0, speed: 35, wait: 25, co2: 35 },
  { id: 'bus', name: 'TransJakarta', icon: '🚌', perKm: 0, perTrip: 3500, freeKm: 0, perDay: 0, speed: 18, wait: 15, co2: 60 },
  { id: 'ojol', name: 'Ride-hailing (ojol)', icon: '🏍️', perKm: 2500, perTrip: 2000, freeKm: 0, perDay: 0, speed: 28, wait: 6, co2: 90 },
  { id: 'bicycle', name: 'Bicycle', icon: '🚲', perKm: 60, perTrip: 0, freeKm: 0, perDay: 0, speed: 14, wait: 3, co2: 0 },
  { id: 'walk', name: 'Walking', icon: '🚶', perKm: 0, perTrip: 0, freeKm: 0, perDay: 0, speed: 5, wait: 0, co2: 0 },
]

export interface ModeResult {
  id: ModeId
  /** One-way trip cost, Rp. */
  tripCost: number
  /** One-way trip time, minutes. */
  tripMin: number
  monthlyCost: number
  /** Hours per month spent commuting. */
  monthlyHours: number
  monthlyCo2Kg: number
}

export function tripCost(m: ModeParams, km: number): number {
  return m.perTrip + m.perKm * Math.max(0, km - m.freeKm)
}

export function monthly(m: ModeParams, km: number, days: number): ModeResult {
  const trips = 2 * Math.max(0, days)
  const d = Math.max(0, km)
  const cost = tripCost(m, d)
  const tripMin = (m.speed > 0 ? (d / m.speed) * 60 : Infinity) + m.wait
  return {
    id: m.id,
    tripCost: cost,
    tripMin,
    monthlyCost: trips * cost + Math.max(0, days) * m.perDay,
    monthlyHours: (trips * tripMin) / 60,
    monthlyCo2Kg: (trips * d * m.co2) / 1000,
  }
}

export type Metric = 'cost' | 'time' | 'co2'

export function metricOf(r: ModeResult, metric: Metric): number {
  return metric === 'cost' ? r.monthlyCost : metric === 'time' ? r.monthlyHours : r.monthlyCo2Kg
}

/** Results sorted by a metric, best (lowest) first. */
export function ranked(results: ModeResult[], metric: Metric): ModeResult[] {
  return [...results].sort((a, b) => metricOf(a, metric) - metricOf(b, metric))
}
