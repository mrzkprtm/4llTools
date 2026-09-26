/** Trip emissions per leg. Pure and tested. */

export type LegMode =
  | 'flight-short-eco'
  | 'flight-short-biz'
  | 'flight-long-eco'
  | 'flight-long-biz'
  | 'car-petrol'
  | 'car-diesel'
  | 'car-ev'
  | 'train'
  | 'bus'
  | 'motorbike'
  | 'ferry'

export interface Factor {
  name: string
  /** kg CO₂e per km: per passenger, or per vehicle when `perVehicle` (then split between passengers). */
  kgPerKm: number
  perVehicle?: boolean
  color: string
  icon: string
}

/**
 * Approximate factors, rounded from the UK DEFRA/DESNZ greenhouse gas conversion
 * factors (flights include a radiative-forcing uplift, similar in size to ICAO-style
 * estimates plus non-CO₂ effects). The EV figure assumes Indonesia's coal-heavy grid
 * (about 0.8 kg CO₂/kWh at 0.15 kWh/km).
 */
export const FACTORS: Record<LegMode, Factor> = {
  'flight-short-eco': { name: 'Flight, short haul, economy', kgPerKm: 0.154, color: '#e8590c', icon: '✈️' },
  'flight-short-biz': { name: 'Flight, short haul, business', kgPerKm: 0.231, color: '#d9480f', icon: '✈️' },
  'flight-long-eco': { name: 'Flight, long haul, economy', kgPerKm: 0.148, color: '#f08c00', icon: '✈️' },
  'flight-long-biz': { name: 'Flight, long haul, business', kgPerKm: 0.429, color: '#e67700', icon: '✈️' },
  'car-petrol': { name: 'Car, petrol', kgPerKm: 0.17, perVehicle: true, color: '#1c7ed6', icon: '🚗' },
  'car-diesel': { name: 'Car, diesel', kgPerKm: 0.171, perVehicle: true, color: '#1864ab', icon: '🚙' },
  'car-ev': { name: 'Car, electric', kgPerKm: 0.12, perVehicle: true, color: '#0ca678', icon: '🔌' },
  train: { name: 'Train', kgPerKm: 0.035, color: '#2f9e44', icon: '🚆' },
  bus: { name: 'Bus / coach', kgPerKm: 0.1, color: '#5c7cfa', icon: '🚌' },
  motorbike: { name: 'Motorbike', kgPerKm: 0.114, perVehicle: true, color: '#ae3ec9', icon: '🛵' },
  ferry: { name: 'Ferry', kgPerKm: 0.113, color: '#1098ad', icon: '⛴️' },
}

/** CO₂ a growing tree takes up in a year, kg (a commonly quoted average). */
export const KG_PER_TREE_YEAR = 22

export interface Leg {
  id: string
  mode: LegMode
  km: number
  /** People sharing the vehicle (only matters for per-vehicle modes). */
  passengers: number
  /** Travelers this leg is counted for. */
  travelers?: number
  roundTrip?: boolean
}

/** kg CO₂e for one leg, for the traveler(s) counted. */
export function legKg(leg: Leg): number {
  const f = FACTORS[leg.mode]
  const km = Math.max(0, leg.km) * (leg.roundTrip ? 2 : 1)
  const who = Math.max(1, Math.round(leg.travelers ?? 1))
  if (f.perVehicle) {
    // The vehicle's emissions are shared by its occupants; `who` of them are ours.
    const pax = Math.max(1, Math.round(leg.passengers))
    return (f.kgPerKm * km * Math.min(who, pax)) / pax
  }
  return f.kgPerKm * km * who
}

export function totalKg(legs: Leg[]): number {
  return legs.reduce((s, l) => s + legKg(l), 0)
}

/** Trees needed for a year to absorb `kg`. */
export function treesFor(kg: number): number {
  return kg > 0 ? Math.ceil(kg / KG_PER_TREE_YEAR) : 0
}

/** Picks the short or long haul factor from the distance (3,700 km, as DEFRA does). */
export function flightMode(km: number, business: boolean): LegMode {
  const long = km > 3700
  return `flight-${long ? 'long' : 'short'}-${business ? 'biz' : 'eco'}` as LegMode
}
