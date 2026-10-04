import { describe, expect, it } from 'vitest'
import { exampleItems, formatClock, moveItem, parseClock, schedule, timeSlots, toMarkdown, totalLabel, totalMinutes } from './agenda'

describe('meeting agenda', () => {
  it('adds up the planned minutes', () => {
    expect(totalMinutes([])).toBe(0)
    expect(totalMinutes([{ minutes: 5 }, { minutes: 10 }])).toBe(15)
    expect(totalMinutes([{ minutes: -5 }, { minutes: 2.4 }])).toBe(2)
    expect(totalMinutes([{ minutes: Number.NaN }, { minutes: 7 }])).toBe(7)
  })

  it('assigns a start and end time to every item', () => {
    const slots = timeSlots(540, [{ minutes: 5 }, { minutes: 30 }, { minutes: 0 }])
    expect(slots).toEqual([
      { start: 540, end: 545 },
      { start: 545, end: 575 },
      { start: 575, end: 575 },
    ])
    expect(timeSlots(Number.NaN, [{ minutes: 5 }])).toEqual([{ start: 0, end: 5 }])
  })

  it('formats times on a 12-hour clock and wraps past midnight', () => {
    expect(formatClock(0)).toBe('12:00 AM')
    expect(formatClock(90)).toBe('1:30 AM')
    expect(formatClock(570)).toBe('9:30 AM')
    expect(formatClock(720)).toBe('12:00 PM')
    expect(formatClock(810)).toBe('1:30 PM')
    expect(formatClock(1439)).toBe('11:59 PM')
    expect(formatClock(1445)).toBe('12:05 AM')
    expect(formatClock(-30)).toBe('11:30 PM')
  })

  it('reads times typed by hand', () => {
    expect(parseClock('09:30')).toBe(570)
    expect(parseClock('9:05')).toBe(545)
    expect(parseClock('13:05')).toBe(785)
    expect(parseClock('9:30 pm')).toBe(1290)
    expect(parseClock('12:00 am')).toBe(0)
    expect(parseClock('24:00')).toBeNull()
    expect(parseClock('09:75')).toBeNull()
    expect(parseClock('')).toBeNull()
  })

  it('labels the total length in hours and minutes', () => {
    expect(totalLabel(45)).toBe('45 min')
    expect(totalLabel(60)).toBe('1 h')
    expect(totalLabel(75)).toBe('1 h 15 min')
    expect(totalLabel(0)).toBe('0 min')
  })

  it('moves items without losing any', () => {
    const list = ['a', 'b', 'c']
    expect(moveItem(list, 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveItem(list, 0, 1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(list, 0, -1)).toBe(list)
    expect(moveItem(list, 5, 0)).toBe(list)
    expect(moveItem(list, 1, 1)).toBe(list)
  })

  it('writes the agenda as Markdown', () => {
    const items = schedule(exampleItems.slice(0, 2), 540)
    expect(toMarkdown(items, 'Weekly team meeting')).toBe(
      [
        '# Weekly team meeting',
        '',
        '- **9:00 AM – 9:05 AM** Welcome and context (5 min) — Ana',
        '- **9:05 AM – 9:15 AM** Progress since last week (10 min) — Budi',
        '',
        '_Total: 15 minutes_',
        '',
      ].join('\n'),
    )
  })

  it('still writes a usable Markdown block with no items', () => {
    expect(toMarkdown([], '')).toBe('# Meeting agenda\n\n_Total: 0 minutes_\n')
    expect(toMarkdown(schedule([{ id: 'x', title: '', minutes: 5, owner: '' }], 600))).toContain('- **10:00 AM – 10:05 AM** Untitled item (5 min)\n')
  })
})
