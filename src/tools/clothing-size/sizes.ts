/** Size charts (typical values; brands vary) and lookups. */

export type MeasureKey = 'chest' | 'waist' | 'hip' | 'foot' | 'height'

export interface SizeTable {
  id: string
  name: string
  /** Size systems shown as columns. */
  systems: { key: string; label: string }[]
  /** Measurements (cm) used by "find my size", with [min, max] per row. */
  measures: MeasureKey[]
  rows: { sizes: Record<string, string>; fit: Partial<Record<MeasureKey, [number, number]>> }[]
}

type Tuple = [string[], [number, number][]]

function table(id: string, name: string, systems: [string, string][], measures: MeasureKey[], data: Tuple[]): SizeTable {
  return {
    id,
    name,
    systems: systems.map(([key, label]) => ({ key, label })),
    measures,
    rows: data.map(([vals, ranges]) => ({
      sizes: Object.fromEntries(systems.map(([k], i) => [k, vals[i]])),
      fit: Object.fromEntries(measures.map((m, i) => [m, ranges[i]])),
    })),
  }
}

export const TABLES: SizeTable[] = [
  table('women-tops', "Women's tops & dresses", [['intl', 'Intl'], ['us', 'US'], ['uk', 'UK'], ['eu', 'EU'], ['jp', 'Japan'], ['id', 'Indonesia / Asia']], ['chest', 'waist', 'hip'], [
    [['XXS', '0', '4', '32', '5', 'S'], [[76, 80], [58, 62], [84, 88]]],
    [['XS', '2', '6', '34', '7', 'M'], [[80, 84], [62, 66], [88, 92]]],
    [['S', '4', '8', '36', '9', 'L'], [[84, 88], [66, 70], [92, 96]]],
    [['M', '6', '10', '38', '11', 'XL'], [[88, 92], [70, 74], [96, 100]]],
    [['L', '8', '12', '40', '13', 'XXL'], [[92, 96], [74, 78], [100, 104]]],
    [['XL', '10', '14', '42', '15', '3XL'], [[96, 100], [78, 82], [104, 108]]],
    [['XXL', '12', '16', '44', '17', '4XL'], [[100, 106], [82, 88], [108, 114]]],
    [['3XL', '14', '18', '46', '19', '5XL'], [[106, 112], [88, 94], [114, 120]]],
  ]),
  table('men-tops', "Men's shirts & tops", [['intl', 'Intl'], ['us', 'US / UK (chest in)'], ['eu', 'EU'], ['jp', 'Japan'], ['id', 'Indonesia / Asia']], ['chest', 'waist'], [
    [['XS', '34', '44', 'S', 'M'], [[86, 91], [71, 76]]],
    [['S', '36', '46', 'M', 'L'], [[91, 96], [76, 81]]],
    [['M', '38', '48', 'L', 'XL'], [[96, 101], [81, 86]]],
    [['L', '40', '50', 'XL', 'XXL'], [[101, 106], [86, 91]]],
    [['XL', '42', '52', 'XXL', '3XL'], [[106, 111], [91, 96]]],
    [['XXL', '44', '54', '3XL', '4XL'], [[111, 116], [96, 101]]],
    [['3XL', '46', '56', '4XL', '5XL'], [[116, 121], [101, 106]]],
  ]),
  table('pants', 'Pants & jeans (waist)', [['w', 'W (inches)'], ['intl', 'Intl'], ['eum', 'EU men'], ['usw', 'US women'], ['euw', 'EU women']], ['waist', 'hip'], [
    [['24', 'XXS', '–', '0', '32'], [[60, 62], [83, 86]]],
    [['25', 'XS', '–', '2', '34'], [[62, 65], [86, 89]]],
    [['26', 'XS', '–', '4', '36'], [[65, 67], [89, 91]]],
    [['27', 'S', '42', '6', '38'], [[67, 70], [91, 94]]],
    [['28', 'S', '44', '8', '40'], [[70, 72], [94, 96]]],
    [['29', 'M', '44', '10', '42'], [[72, 75], [96, 99]]],
    [['30', 'M', '46', '12', '44'], [[75, 77], [99, 101]]],
    [['31', 'M', '46', '14', '46'], [[77, 80], [101, 104]]],
    [['32', 'L', '48', '16', '48'], [[80, 83], [104, 106]]],
    [['33', 'L', '48', '18', '50'], [[83, 85], [106, 109]]],
    [['34', 'L', '50', '20', '52'], [[85, 88], [109, 112]]],
    [['36', 'XL', '52', '22', '54'], [[88, 93], [112, 117]]],
    [['38', 'XXL', '54', '24', '56'], [[93, 98], [117, 122]]],
    [['40', 'XXL', '56', '26', '58'], [[98, 103], [122, 127]]],
  ]),
  table('shoes-men', "Men's shoes", [['us', 'US'], ['uk', 'UK'], ['eu', 'EU / Indonesia'], ['cm', 'Japan (cm)']], ['foot'], [
    [['6', '5.5', '38.5', '24'], [[23.6, 24]]],
    [['6.5', '6', '39', '24.5'], [[24.1, 24.5]]],
    [['7', '6', '40', '25'], [[24.6, 25]]],
    [['7.5', '6.5', '40.5', '25.5'], [[25.1, 25.5]]],
    [['8', '7', '41', '26'], [[25.6, 26]]],
    [['8.5', '7.5', '42', '26.5'], [[26.1, 26.5]]],
    [['9', '8', '42.5', '27'], [[26.6, 27]]],
    [['9.5', '8.5', '43', '27.5'], [[27.1, 27.5]]],
    [['10', '9', '44', '28'], [[27.6, 28]]],
    [['10.5', '9.5', '44.5', '28.5'], [[28.1, 28.5]]],
    [['11', '10', '45', '29'], [[28.6, 29]]],
    [['12', '11', '46', '30'], [[29.1, 30]]],
    [['13', '12', '47.5', '31'], [[30.1, 31]]],
  ]),
  table('shoes-women', "Women's shoes", [['us', 'US'], ['uk', 'UK'], ['eu', 'EU / Indonesia'], ['cm', 'Japan (cm)']], ['foot'], [
    [['5', '2.5', '35.5', '22'], [[21.6, 22]]],
    [['5.5', '3', '36', '22.5'], [[22.1, 22.5]]],
    [['6', '3.5', '36.5', '23'], [[22.6, 23]]],
    [['6.5', '4', '37.5', '23.5'], [[23.1, 23.5]]],
    [['7', '4.5', '38', '24'], [[23.6, 24]]],
    [['7.5', '5', '38.5', '24.5'], [[24.1, 24.5]]],
    [['8', '5.5', '39', '25'], [[24.6, 25]]],
    [['8.5', '6', '40', '25.5'], [[25.1, 25.5]]],
    [['9', '6.5', '40.5', '26'], [[25.6, 26]]],
    [['9.5', '7', '41', '26.5'], [[26.1, 26.5]]],
    [['10', '7.5', '42', '27'], [[26.6, 27]]],
  ]),
  table('kids', "Kids' clothing", [['age', 'Age'], ['us', 'US'], ['uk', 'UK'], ['eu', 'EU (height cm)']], ['height'], [
    [['0–3 mo', '0–3M', '0–3M', '56–62'], [[50, 62]]],
    [['3–6 mo', '3–6M', '3–6M', '68'], [[62, 68]]],
    [['6–12 mo', '6–12M', '6–12M', '74–80'], [[68, 80]]],
    [['12–18 mo', '12–18M', '12–18M', '86'], [[80, 86]]],
    [['2 yrs', '2T', '2–3Y', '92'], [[86, 92]]],
    [['3 yrs', '3T', '3–4Y', '98'], [[92, 98]]],
    [['4 yrs', '4T', '4–5Y', '104'], [[98, 104]]],
    [['5 yrs', '5', '5–6Y', '110'], [[104, 110]]],
    [['6 yrs', '6', '6–7Y', '116'], [[110, 116]]],
    [['7 yrs', '7', '7–8Y', '122'], [[116, 122]]],
    [['8 yrs', '8', '8–9Y', '128'], [[122, 128]]],
    [['9–10 yrs', '10', '9–10Y', '134–140'], [[128, 140]]],
    [['11–12 yrs', '12', '11–12Y', '146–152'], [[140, 152]]],
    [['13–14 yrs', '14', '13–14Y', '158–164'], [[152, 164]]],
  ]),
]

export const MEASURE_LABEL: Record<MeasureKey, string> = { chest: 'Chest / bust', waist: 'Waist', hip: 'Hips', foot: 'Foot length', height: 'Height' }

/** Row index whose size in `system` equals `value`, or -1. */
export function lookup(t: SizeTable, system: string, value: string): number {
  return t.rows.findIndex((r) => r.sizes[system] === value)
}

/** Distinct values of one system in table order. */
export function valuesOf(t: SizeTable, system: string): string[] {
  return [...new Set(t.rows.map((r) => r.sizes[system]).filter((v) => v !== '–'))]
}

export interface Match {
  index: number
  /** True when every given measurement sits inside the row's range. */
  exact: boolean
  /** Per-measure best row, to show when measurements disagree. */
  per: Partial<Record<MeasureKey, number>>
}

function distance(v: number, [lo, hi]: [number, number]) {
  return v < lo ? lo - v : v > hi ? v - hi : 0
}

/** The best-fitting row for body measurements (cm). The largest per-measure size wins, since tight clothes fit worse than loose. */
export function matchMeasure(t: SizeTable, m: Partial<Record<MeasureKey, number>>): Match | null {
  const keys = t.measures.filter((k) => typeof m[k] === 'number' && m[k]! > 0)
  if (!keys.length) return null
  const per: Partial<Record<MeasureKey, number>> = {}
  for (const k of keys) {
    let best = 0
    let bestD = Infinity
    t.rows.forEach((r, i) => {
      const range = r.fit[k]
      if (!range) return
      const d = distance(m[k]!, range)
      // Ties (a value on the boundary of two rows) go to the larger size.
      if (d < bestD || (d === bestD && d === 0)) {
        best = i
        bestD = d
      }
    })
    per[k] = best
  }
  const index = Math.max(...keys.map((k) => per[k]!))
  const exact = keys.every((k) => distance(m[k]!, t.rows[index].fit[k]!) === 0)
  return { index, exact, per }
}
