/** Each unit maps to a factor that converts it to the group's base unit. */
export const LINEAR_GROUPS: Record<string, Record<string, number>> = {
  Length: { Millimeter: 0.001, Centimeter: 0.01, Meter: 1, Kilometer: 1000, Inch: 0.0254, Foot: 0.3048, Yard: 0.9144, Mile: 1609.344 },
  Weight: { Milligram: 0.001, Gram: 1, Kilogram: 1000, Ton: 1_000_000, Ounce: 28.349523125, Pound: 453.59237 },
  Area: { 'Square meter': 1, Hectare: 10_000, 'Square kilometer': 1_000_000, 'Square foot': 0.09290304, Acre: 4046.8564224 },
  Volume: { Milliliter: 0.001, Liter: 1, 'Cubic meter': 1000, 'US gallon': 3.785411784, 'US cup': 0.2365882365 },
  Speed: { 'm/s': 1, 'km/h': 1 / 3.6, mph: 0.44704, Knot: 0.514444 },
  'Data size': { Byte: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3 },
  Time: { Second: 1, Minute: 60, Hour: 3600, Day: 86400, Week: 604800 },
}

export const TEMPERATURE_UNITS = ['Celsius', 'Fahrenheit', 'Kelvin'] as const
export const GROUPS = [...Object.keys(LINEAR_GROUPS), 'Temperature']

export function unitsOf(group: string): string[] {
  return group === 'Temperature' ? [...TEMPERATURE_UNITS] : Object.keys(LINEAR_GROUPS[group] ?? {})
}

function toCelsius(v: number, from: string): number {
  if (from === 'Fahrenheit') return ((v - 32) * 5) / 9
  if (from === 'Kelvin') return v - 273.15
  return v
}

function fromCelsius(c: number, to: string): number {
  if (to === 'Fahrenheit') return (c * 9) / 5 + 32
  if (to === 'Kelvin') return c + 273.15
  return c
}

export function convert(value: number, group: string, from: string, to: string): number {
  if (group === 'Temperature') return fromCelsius(toCelsius(value, from), to)
  const units = LINEAR_GROUPS[group]
  return (value * units[from]) / units[to]
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return Number(n.toPrecision(10)).toLocaleString(undefined, { maximumFractionDigits: 10 })
}
