/** Cron parsing, validation and next-run computation (Vixie cron semantics). */

export type FieldName = 'second' | 'minute' | 'hour' | 'dayOfMonth' | 'month' | 'dayOfWeek'

export interface FieldSpec {
  name: FieldName
  label: string
  min: number
  max: number
  names?: string[]
}

export const FIELD_SPECS: Record<FieldName, FieldSpec> = {
  second: { name: 'second', label: 'Second', min: 0, max: 59 },
  minute: { name: 'minute', label: 'Minute', min: 0, max: 59 },
  hour: { name: 'hour', label: 'Hour', min: 0, max: 23 },
  dayOfMonth: { name: 'dayOfMonth', label: 'Day of month', min: 1, max: 31 },
  month: {
    name: 'month',
    label: 'Month',
    min: 1,
    max: 12,
    names: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
  },
  // 7 is accepted as Sunday and folded to 0.
  dayOfWeek: { name: 'dayOfWeek', label: 'Day of week', min: 0, max: 7, names: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] },
}

export const MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
}

export interface ParsedField {
  name: FieldName
  source: string
  values: number[]
  /** True when the field was `*` or `?` (no restriction). */
  wildcard: boolean
}

export interface ParsedCron {
  /** The 5- or 6-field expression the macro expanded to (or the input itself). */
  expression: string
  hasSeconds: boolean
  fields: ParsedField[]
  second: Set<number>
  minute: Set<number>
  hour: Set<number>
  dayOfMonth: Set<number>
  month: Set<number>
  dayOfWeek: Set<number>
  domWildcard: boolean
  dowWildcard: boolean
}

export type ParseResult = { ok: true; cron: ParsedCron } | { ok: false; error: string; field?: FieldName; reboot?: boolean }

class FieldError extends Error {}

function parseValue(token: string, spec: FieldSpec): number {
  const upper = token.toUpperCase()
  if (spec.names) {
    const i = spec.names.indexOf(upper)
    if (i >= 0) return spec.name === 'month' ? i + 1 : i
  }
  if (!/^\d+$/.test(token)) throw new FieldError(`"${token}" is not a number${spec.names ? ' or a valid name' : ''}`)
  const n = Number(token)
  if (n < spec.min || n > spec.max) throw new FieldError(`${n} is out of range (${spec.min}–${spec.max})`)
  return n
}

export function parseField(source: string, spec: FieldSpec): ParsedField {
  if (source === '') throw new FieldError('is empty')
  const values = new Set<number>()
  const wildcard = source === '*' || source === '?'
  if (source === '?' && spec.name !== 'dayOfMonth' && spec.name !== 'dayOfWeek') {
    throw new FieldError('"?" is only allowed in the day fields')
  }
  for (const part of source.split(',')) {
    if (part === '') throw new FieldError('has an empty list item')
    const [rangePart, stepPart, extra] = part.split('/')
    if (extra !== undefined) throw new FieldError(`"${part}" has more than one "/"`)
    let step = 1
    if (stepPart !== undefined) {
      if (!/^\d+$/.test(stepPart) || Number(stepPart) < 1) throw new FieldError(`step "${stepPart}" must be a positive number`)
      step = Number(stepPart)
    }
    let lo: number
    let hi: number
    if (rangePart === '*' || rangePart === '?') {
      lo = spec.min
      hi = spec.name === 'dayOfWeek' ? 6 : spec.max
    } else if (rangePart.includes('-')) {
      const bits = rangePart.split('-')
      if (bits.length !== 2 || !bits[0] || !bits[1]) throw new FieldError(`"${rangePart}" is not a valid range`)
      lo = parseValue(bits[0], spec)
      hi = parseValue(bits[1], spec)
      if (lo > hi) throw new FieldError(`range ${rangePart} goes backwards`)
    } else {
      lo = parseValue(rangePart, spec)
      // "5/15" means "from 5 to the end, every 15".
      hi = stepPart !== undefined ? (spec.name === 'dayOfWeek' ? 6 : spec.max) : lo
    }
    for (let v = lo; v <= hi; v += step) values.add(spec.name === 'dayOfWeek' && v === 7 ? 0 : v)
  }
  return { name: spec.name, source, values: [...values].sort((a, b) => a - b), wildcard }
}

export function parseCron(input: string): ParseResult {
  let expression = input.trim().replace(/\s+/g, ' ')
  if (!expression) return { ok: false, error: 'Enter a cron expression.' }
  if (expression.startsWith('@')) {
    const macro = expression.toLowerCase()
    if (macro === '@reboot') return { ok: false, reboot: true, error: '@reboot runs once when the cron daemon starts, so it has no schedule.' }
    if (!MACROS[macro]) return { ok: false, error: `Unknown macro "${expression}". Use @yearly, @monthly, @weekly, @daily, @hourly or @reboot.` }
    expression = MACROS[macro]
  }
  const parts = expression.split(' ')
  if (parts.length !== 5 && parts.length !== 6) {
    return { ok: false, error: `Expected 5 fields (minute hour day month weekday) or 6 with seconds first, but got ${parts.length}.` }
  }
  const hasSeconds = parts.length === 6
  const names: FieldName[] = hasSeconds
    ? ['second', 'minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek']
    : ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek']
  const fields: ParsedField[] = []
  for (let i = 0; i < names.length; i++) {
    const spec = FIELD_SPECS[names[i]]
    try {
      fields.push(parseField(parts[i], spec))
    } catch (err) {
      if (err instanceof FieldError) return { ok: false, field: spec.name, error: `${spec.label} field "${parts[i]}": ${err.message}.` }
      throw err
    }
  }
  const get = (n: FieldName) => fields.find((f) => f.name === n)
  const sec = get('second')
  const dom = get('dayOfMonth')!
  const dow = get('dayOfWeek')!
  return {
    ok: true,
    cron: {
      expression,
      hasSeconds,
      fields,
      second: new Set(sec ? sec.values : [0]),
      minute: new Set(get('minute')!.values),
      hour: new Set(get('hour')!.values),
      dayOfMonth: new Set(dom.values),
      month: new Set(get('month')!.values),
      dayOfWeek: new Set(dow.values),
      // Vixie cron treats a field that *starts with* "*" as unrestricted for the OR rule.
      domWildcard: dom.source.startsWith('*') || dom.source === '?',
      dowWildcard: dow.source.startsWith('*') || dow.source === '?',
    },
  }
}

export function dayMatches(cron: ParsedCron, d: Date): boolean {
  const domOk = cron.dayOfMonth.has(d.getDate())
  const dowOk = cron.dayOfWeek.has(d.getDay())
  if (cron.domWildcard || cron.dowWildcard) return domOk && dowOk
  return domOk || dowOk
}

/** The next `count` times (local time) after `from` that match the expression. */
export function nextRuns(cron: ParsedCron, from: Date, count: number): Date[] {
  const out: Date[] = []
  const d = new Date(from.getTime())
  d.setMilliseconds(0)
  if (cron.hasSeconds) d.setSeconds(d.getSeconds() + 1)
  else {
    d.setSeconds(0)
    d.setMinutes(d.getMinutes() + 1)
  }
  const limit = from.getFullYear() + 9 // covers leap-day-only schedules
  let guard = 0
  while (out.length < count && d.getFullYear() <= limit && guard++ < 500000) {
    if (!cron.month.has(d.getMonth() + 1)) {
      d.setMonth(d.getMonth() + 1, 1)
      d.setHours(0, 0, 0)
      continue
    }
    if (!dayMatches(cron, d)) {
      d.setDate(d.getDate() + 1)
      d.setHours(0, 0, 0)
      continue
    }
    if (!cron.hour.has(d.getHours())) {
      const h = d.getHours()
      d.setHours(h + 1, 0, 0)
      // DST: if adding an hour did not move forward (fall-back), step by real time.
      if (d.getHours() === h) d.setTime(d.getTime() + 3600_000)
      continue
    }
    if (!cron.minute.has(d.getMinutes())) {
      d.setMinutes(d.getMinutes() + 1, 0)
      continue
    }
    if (!cron.second.has(d.getSeconds())) {
      d.setSeconds(d.getSeconds() + 1)
      continue
    }
    out.push(new Date(d.getTime()))
    if (cron.hasSeconds) d.setSeconds(d.getSeconds() + 1)
    else d.setMinutes(d.getMinutes() + 1, 0)
  }
  return out
}

/* ---------- Generator ---------- */

export type GenMode = 'minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface GenOptions {
  mode: GenMode
  everyMinutes: number
  minute: number
  hour: number
  weekdays: number[]
  dayOfMonth: number
  month: number
}

export function generate(o: GenOptions): string {
  switch (o.mode) {
    case 'minutes':
      return o.everyMinutes <= 1 ? '* * * * *' : `*/${o.everyMinutes} * * * *`
    case 'hourly':
      return `${o.minute} * * * *`
    case 'daily':
      return `${o.minute} ${o.hour} * * *`
    case 'weekly':
      return `${o.minute} ${o.hour} * * ${compressList(o.weekdays.length ? o.weekdays : [1])}`
    case 'monthly':
      return `${o.minute} ${o.hour} ${o.dayOfMonth} * *`
    case 'yearly':
      return `${o.minute} ${o.hour} ${o.dayOfMonth} ${o.month} *`
  }
}

/** Turns [1,2,3,5] into "1-3,5". */
export function compressList(values: number[]): string {
  const v = [...new Set(values)].sort((a, b) => a - b)
  const parts: string[] = []
  for (let i = 0; i < v.length; i++) {
    let j = i
    while (j + 1 < v.length && v[j + 1] === v[j] + 1) j++
    parts.push(j - i >= 2 ? `${v[i]}-${v[j]}` : j > i ? `${v[i]},${v[j]}` : `${v[i]}`)
    i = j
  }
  return parts.join(',')
}

export const PRESETS: { label: string; expr: string }[] = [
  { label: 'Every minute', expr: '* * * * *' },
  { label: 'Every 5 minutes', expr: '*/5 * * * *' },
  { label: 'Every 15 minutes', expr: '*/15 * * * *' },
  { label: 'Every hour', expr: '0 * * * *' },
  { label: 'Every 6 hours', expr: '0 */6 * * *' },
  { label: 'Daily at midnight', expr: '0 0 * * *' },
  { label: 'Daily at 02:30', expr: '30 2 * * *' },
  { label: 'Weekdays at 09:00', expr: '0 9 * * 1-5' },
  { label: 'Weekends at 10:00', expr: '0 10 * * 6,0' },
  { label: 'Every Monday 08:00', expr: '0 8 * * MON' },
  { label: 'First of the month', expr: '0 0 1 * *' },
  { label: 'Quarterly', expr: '0 0 1 1,4,7,10 *' },
  { label: 'Every year (Jan 1)', expr: '@yearly' },
  { label: 'Every 30 seconds', expr: '*/30 * * * * *' },
]
