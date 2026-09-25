import { describe, expect, it } from 'vitest'
import { dayHours, formatOffset, fromInputValue, hourKind, offsetMinutes, overlap, toInputValue, wallTime, zonedToUtc } from './tz'

const jan = Date.UTC(2025, 0, 15, 12)
const jul = Date.UTC(2025, 6, 15, 12)

describe('time zones', () => {
  it('reads offsets, including DST and half hours', () => {
    expect(offsetMinutes('Asia/Jakarta', jan)).toBe(420)
    expect(offsetMinutes('Asia/Jayapura', jan)).toBe(540)
    expect(offsetMinutes('America/New_York', jan)).toBe(-300)
    expect(offsetMinutes('America/New_York', jul)).toBe(-240)
    expect(offsetMinutes('Asia/Kolkata', jan)).toBe(330)
    expect(offsetMinutes('UTC', jul)).toBe(0)
  })

  it('converts a wall time in one zone to an instant', () => {
    expect(new Date(zonedToUtc('Asia/Jakarta', { year: 2025, month: 3, day: 1, hour: 9, minute: 0 })).toISOString()).toBe('2025-03-01T02:00:00.000Z')
    // The day US clocks spring forward, noon is already EDT.
    expect(new Date(zonedToUtc('America/New_York', { year: 2024, month: 3, day: 10, hour: 12, minute: 0 })).toISOString()).toBe('2024-03-10T16:00:00.000Z')
    const ms = zonedToUtc('Europe/London', { year: 2025, month: 7, day: 1, hour: 18, minute: 30 })
    expect(wallTime('Asia/Makassar', ms)).toMatchObject({ day: 2, hour: 1, minute: 30 })
  })

  it('formats offsets', () => {
    expect(formatOffset(420)).toBe('UTC+07:00')
    expect(formatOffset(-210)).toBe('UTC-03:30')
  })

  it('finds overlapping work hours', () => {
    const hours = dayHours('Asia/Jakarta', Date.UTC(2025, 0, 15, 5))
    expect(hours).toHaveLength(24)
    expect(wallTime('Asia/Jakarta', hours[9]).hour).toBe(9)
    // Jakarta 14:00–16:59 is London 07:00–09:59, so only Jakarta 16:00 (London 09:00) overlaps.
    expect(overlap(['Asia/Jakarta', 'Europe/London'], hours)).toEqual([16])
    expect(hourKind(8)).toBe('edge')
    expect(hourKind(3)).toBe('night')
  })

  it('round-trips the datetime-local value', () => {
    const w = fromInputValue('2025-12-31T23:05')!
    expect(toInputValue({ ...w, second: 0 })).toBe('2025-12-31T23:05')
    expect(fromInputValue('nope')).toBeNull()
  })
})
