/** Trip fuel math. Pure and tested. */

export type ConsumptionUnit = 'kmpl' | 'l100'

export interface FuelPreset {
  id: string
  name: string
  /** Rupiah per liter. Pertamina prices change often, so these are only starting points. */
  price: number
}

/** Approximate Pertamina pump prices in Java (Rp/liter). Edit the price field for today's price. */
export const FUEL_PRESETS: readonly FuelPreset[] = [
  { id: 'pertalite', name: 'Pertalite', price: 10000 },
  { id: 'pertamax', name: 'Pertamax', price: 12500 },
  { id: 'pertamax-turbo', name: 'Pertamax Turbo', price: 13700 },
  { id: 'solar', name: 'Solar (Biosolar)', price: 6800 },
  { id: 'dexlite', name: 'Dexlite', price: 13300 },
]

/** Converts a consumption figure to km per liter. */
export function toKmPerLiter(value: number, unit: ConsumptionUnit): number {
  if (!(value > 0)) return NaN
  return unit === 'kmpl' ? value : 100 / value
}

export interface TripInput {
  distanceKm: number
  consumption: number
  unit: ConsumptionUnit
  /** Price per liter. */
  price: number
  roundTrip: boolean
  passengers: number
  /** Tolls, parking and other extras for the whole trip (already covering both ways). */
  extras: number
  /** Tank size in liters, used for the refuel count. */
  tank?: number
}

export interface TripResult {
  km: number
  liters: number
  fuelCost: number
  total: number
  perPerson: number
  perKm: number
  /** Stops needed to refuel along the way if you start with a full tank. */
  refuels: number
}

export function tripCost(t: TripInput): TripResult {
  const kmpl = toKmPerLiter(t.consumption, t.unit)
  const km = Math.max(0, t.distanceKm) * (t.roundTrip ? 2 : 1)
  const liters = kmpl > 0 ? km / kmpl : 0
  const fuelCost = liters * Math.max(0, t.price)
  const total = fuelCost + Math.max(0, t.extras)
  const people = Math.max(1, Math.round(t.passengers))
  const tank = t.tank && t.tank > 0 ? t.tank : 0
  return {
    km,
    liters,
    fuelCost,
    total,
    perPerson: total / people,
    perKm: km > 0 ? total / km : 0,
    refuels: tank ? Math.max(0, Math.ceil(liters / tank) - 1) : 0,
  }
}

export function rupiah(n: number): string {
  return 'Rp' + Math.round(n).toLocaleString('id-ID')
}
