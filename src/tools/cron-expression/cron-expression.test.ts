import { describe, expect, it } from 'vitest'
import { compressList, generate, nextRuns, parseCron, type ParsedCron } from './cron'

function parse(expr: string): ParsedCron {
  const r = parseCron(expr)
  if (!r.ok) throw new Error(r.error)
  return r.cron
}

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`

describe('cron parsing', () => {
  it('expands lists, ranges, steps and names', () => {
    const c = parse('*/15 9-17/4 1,15 JAN-MAR mon-fri')
    expect([...c.minute]).toEqual([0, 15, 30, 45])
    expect([...c.hour]).toEqual([9, 13, 17])
    expect([...c.dayOfMonth]).toEqual([1, 15])
    expect([...c.month]).toEqual([1, 2, 3])
    expect([...c.dayOfWeek]).toEqual([1, 2, 3, 4, 5])
  })

  it('treats 7 as Sunday and "start/step" as running to the end', () => {
    expect([...parse('0 0 * * 7').dayOfWeek]).toEqual([0])
    expect([...parse('5/20 * * * *').minute]).toEqual([5, 25, 45])
  })

  it('expands macros and accepts a seconds field', () => {
    expect(parse('@daily').expression).toBe('0 0 * * *')
    const c = parse('*/30 * * * * *')
    expect(c.hasSeconds).toBe(true)
    expect([...c.second]).toEqual([0, 30])
  })

  it('points at the bad field', () => {
    const r = parseCron('0 25 * * *')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.field).toBe('hour')
      expect(r.error).toMatch(/out of range/)
    }
    expect(parseCron('* * *').ok).toBe(false)
    const back = parseCron('0 0 * * FRI-MON')
    expect(!back.ok && back.field).toBe('dayOfWeek')
    expect(parseCron('@reboot').ok).toBe(false)
  })
})

describe('next runs', () => {
  const from = new Date(2026, 0, 1, 10, 7, 30) // Thu 1 Jan 2026 10:07:30 local

  it('finds the next matching minutes', () => {
    expect(nextRuns(parse('*/15 * * * *'), from, 3).map(fmt)).toEqual([
      '2026-01-01 10:15:00',
      '2026-01-01 10:30:00',
      '2026-01-01 10:45:00',
    ])
  })

  it('uses OR when both day fields are restricted (Vixie cron)', () => {
    // 13th of the month OR any Friday
    const runs = nextRuns(parse('0 0 13 * 5'), from, 4).map(fmt)
    expect(runs).toEqual(['2026-01-02 00:00:00', '2026-01-09 00:00:00', '2026-01-13 00:00:00', '2026-01-16 00:00:00'])
  })

  it('uses AND when one day field is a wildcard', () => {
    expect(nextRuns(parse('30 8 * * MON'), from, 2).map(fmt)).toEqual(['2026-01-05 08:30:00', '2026-01-12 08:30:00'])
  })

  it('handles leap days and impossible dates', () => {
    expect(nextRuns(parse('0 12 29 2 *'), from, 1).map(fmt)).toEqual(['2028-02-29 12:00:00'])
    expect(nextRuns(parse('0 0 31 2 *'), from, 1)).toEqual([])
  })

  it('handles seconds', () => {
    expect(nextRuns(parse('*/20 * * * * *'), from, 2).map(fmt)).toEqual(['2026-01-01 10:07:40', '2026-01-01 10:08:00'])
  })
})

describe('generator', () => {
  it('writes expressions from simple choices', () => {
    const base = { everyMinutes: 10, minute: 5, hour: 14, weekdays: [1, 2, 3, 5], dayOfMonth: 1, month: 6 }
    expect(generate({ ...base, mode: 'minutes' })).toBe('*/10 * * * *')
    expect(generate({ ...base, mode: 'daily' })).toBe('5 14 * * *')
    expect(generate({ ...base, mode: 'weekly' })).toBe('5 14 * * 1-3,5')
    expect(generate({ ...base, mode: 'yearly' })).toBe('5 14 1 6 *')
    expect(compressList([0, 6])).toBe('0,6')
  })
})
