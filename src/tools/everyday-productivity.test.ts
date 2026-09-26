import { describe, expect, it } from 'vitest'
import * as habit from './habit-tracker/logic'
import * as kanban from './kanban-board/logic'
import * as countdown from './event-countdown/logic'
import * as planner from './day-planner/logic'
import * as meeting from './meeting-cost/logic'
import * as workdays from './working-days/logic'
import { HOLIDAYS } from './working-days/holidays'
import * as matrix from './eisenhower-matrix/logic'
import * as decision from './decision-matrix/logic'
import * as world from './world-clock-map/logic'
import { LAND } from './world-clock-map/land'

describe('habit tracker', () => {
  it('counts the current streak, keeping it alive before today is checked', () => {
    const done = ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-05', '2026-03-06']
    expect(habit.currentStreak(done, '2026-03-06')).toBe(2)
    expect(habit.currentStreak(done, '2026-03-07')).toBe(2)
    expect(habit.currentStreak(done, '2026-03-08')).toBe(0)
    // Across a month boundary.
    expect(habit.currentStreak(['2026-02-27', '2026-02-28', '2026-03-01'], '2026-03-01')).toBe(3)
  })

  it('finds the best streak and completion rate', () => {
    const done = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-03', '2026-01-10', '2026-01-11']
    expect(habit.bestStreak(done)).toBe(3)
    expect(habit.bestStreak([])).toBe(0)
    expect(habit.completionRate(['2026-01-10', '2026-01-11'], '2026-01-11', 4)).toBe(0.5)
  })

  it('builds Monday-first heatmap weeks ending today', () => {
    const w = habit.heatmapWeeks('2026-09-26', 2) // a Saturday
    expect(w).toHaveLength(2)
    expect(w[1][0]).toBe('2026-09-21')
    expect(w[1][5]).toBe('2026-09-26')
    expect(w[1][6]).toBeNull()
    expect(w[0][0]).toBe('2026-09-14')
  })
})

describe('kanban board', () => {
  const board = (): kanban.Board => ({
    columns: [
      { id: 'a', title: 'To do', wip: 0, cards: [{ id: '1', title: 'one', label: 0 }, { id: '2', title: 'two', label: 0 }, { id: '3', title: 'three', label: 0 }] },
      { id: 'b', title: 'Doing', wip: 1, cards: [{ id: '4', title: 'four', label: 0 }] },
    ],
  })

  it('moves a card between columns at an index without mutating the input', () => {
    const b = board()
    const m = kanban.moveCard(b, '2', 'b', 0)
    expect(m.columns[0].cards.map((c) => c.id)).toEqual(['1', '3'])
    expect(m.columns[1].cards.map((c) => c.id)).toEqual(['2', '4'])
    expect(b.columns[0].cards).toHaveLength(3)
    expect(kanban.overLimit(m.columns[1])).toBe(true)
  })

  it('reorders within a column and clamps the index', () => {
    expect(kanban.moveCard(board(), '1', 'a', 2).columns[0].cards.map((c) => c.id)).toEqual(['2', '3', '1'])
    expect(kanban.moveCard(board(), '3', 'a', -5).columns[0].cards.map((c) => c.id)).toEqual(['3', '1', '2'])
    expect(kanban.moveCard(board(), 'nope', 'a', 0)).toEqual(board())
  })

  it('round-trips an export and rejects junk', () => {
    expect(kanban.parseBoard(JSON.stringify(board()))).toEqual(board())
    expect(kanban.parseBoard('{"hello":1}')).toBeNull()
    expect(kanban.parseBoard('not json')).toBeNull()
  })
})

describe('event countdown', () => {
  it('breaks a duration into days, hours, minutes and seconds', () => {
    const ms = ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000
    expect(countdown.breakdown(ms)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5, done: false })
    expect(countdown.breakdown(400).seconds).toBe(1)
    expect(countdown.breakdown(-10).done).toBe(true)
  })

  it('round-trips the share hash and rejects bad dates', () => {
    const e = { name: 'Lebaran & mudik', at: '2027-03-10T00:00', created: 1_700_000_000_000 }
    expect(countdown.decodeHash(countdown.encodeHash(e))).toEqual(e)
    expect(countdown.decodeHash('#n=x&t=tomorrow')).toBeNull()
    expect(countdown.progress(0, 100, 25)).toBe(0.25)
  })

  it('finds the next birthday and Idul Fitri', () => {
    const now = new Date(2026, 8, 26, 10)
    expect(countdown.nextAnnual(9, 26, now).getFullYear()).toBe(2026)
    expect(countdown.nextAnnual(9, 25, now).getFullYear()).toBe(2027)
    expect(countdown.nextIdulFitri(now)).toBe('2027-03-10')
  })
})

describe('day planner', () => {
  const blk = (id: string, s: number, e: number): planner.Block => ({ id, start: s, end: e, title: id, color: '#000' })

  it('snaps drags to 15 minutes and keeps blocks inside the day', () => {
    expect(planner.snap(607)).toBe(600)
    expect(planner.snap(608)).toBe(615)
    expect(planner.spanFromDrag(9 * 60 + 5, 10 * 60 + 20)).toEqual({ start: 540, end: 615 })
    expect(planner.spanFromDrag(600, 560)).toEqual({ start: 555, end: 615 })
    expect(planner.moveBlock(blk('a', 1380, 1440), 120)).toMatchObject({ start: 1380, end: 1440 })
    expect(planner.resizeBlock(blk('a', 600, 660), 590).end).toBe(615)
  })

  it('detects overlaps, lanes and planned time', () => {
    const bs = [blk('a', 540, 600), blk('b', 570, 630), blk('c', 600, 660), blk('d', 700, 720)]
    expect([...planner.overlapping(bs)].sort()).toEqual(['a', 'b', 'c'])
    expect(planner.overlaps(bs[0], bs[2])).toBe(false)
    expect(planner.plannedMinutes(bs)).toBe(140)
    const l = planner.lanes(bs)
    expect(l.get('a')).toEqual({ lane: 0, of: 2 })
    expect(l.get('c')).toEqual({ lane: 0, of: 2 })
    expect(l.get('d')).toEqual({ lane: 0, of: 1 })
    expect(planner.freeSlot(bs, 30, 540)).toBe(660)
  })
})

describe('meeting cost', () => {
  it('turns a monthly salary into a cost per second', () => {
    // Rp 17,300,000 / 173 h = Rp 100,000 an hour.
    expect(meeting.perSecondFromMonthly(17_300_000) * 3600).toBeCloseTo(100_000, 6)
    expect(meeting.perSecondFromMonthly(17_300_000, 0)).toBe(0)
  })

  it('sums every attendee in monthly and hourly mode', () => {
    const g: meeting.Group[] = [
      { id: 'a', role: 'Eng', count: 2, pay: 17_300_000 },
      { id: 'b', role: 'PM', count: 1, pay: 34_600_000 },
    ]
    expect(meeting.costPerSecond(g, 'monthly') * 3600).toBeCloseTo(400_000, 4)
    expect(meeting.costPerSecond([{ id: 'x', role: 'C', count: 3, pay: 36 }], 'hourly')).toBeCloseTo(0.03, 9)
    expect(meeting.comparisons(50_000, 'IDR')[0].n).toBe(2)
  })

  it('picks a round coin value that keeps the pile within capacity', () => {
    expect(meeting.coinValue(40_000, 0, 100)).toBe(5000)
    expect(meeting.coinValue(40_000, 1_000_000, 100)).toBe(10_000)
  })
})

describe('working days', () => {
  const o = (week: 5 | 6 = 5, cuti = true) => ({ week, off: workdays.offMap(HOLIDAYS, cuti) })

  it('counts weekdays and skips holidays and cuti bersama', () => {
    // March 2026: 22 weekdays; Nyepi, Idul Fitri and cuti bersama take out 18–20, 23, 24.
    const t = workdays.countWorkingDays('2026-03-01', '2026-03-31', o())
    expect(t.calendar).toBe(31)
    expect(t.working).toBe(17)
    expect(workdays.countWorkingDays('2026-03-01', '2026-03-31', o(5, false)).working).toBe(21)
    expect(workdays.countWorkingDays('2026-03-31', '2026-03-01', o()).working).toBe(17)
    // A plain week, Mon–Sat, excluding both ends.
    expect(workdays.countWorkingDays('2026-09-06', '2026-09-13', o(6), false, false).working).toBe(6)
  })

  it('adds working days forwards and backwards', () => {
    expect(workdays.addWorkingDays('2026-09-25', 1, o())).toBe('2026-09-28') // Fri -> Mon
    expect(workdays.addWorkingDays('2026-03-17', 1, o())).toBe('2026-03-25') // over Nyepi and Lebaran
    expect(workdays.addWorkingDays('2026-09-28', -1, o())).toBe('2026-09-25')
    expect(workdays.addWorkingDays('2026-09-26', 0, o())).toBe('2026-09-28')
  })

  it('keeps holiday data sorted and unique per kind', () => {
    const dates = HOLIDAYS.map((h) => h.date)
    expect([...dates].sort()).toEqual(dates)
    expect(new Set(dates).size).toBe(dates.length)
  })
})

describe('eisenhower matrix', () => {
  it('maps urgent/important flags to quadrants and back', () => {
    expect(matrix.quadrantOf(true, true)).toBe('do')
    expect(matrix.quadrantOf(false, true)).toBe('schedule')
    expect(matrix.quadrantOf(true, false)).toBe('delegate')
    expect(matrix.quadrantOf(false, false)).toBe('delete')
    for (const q of ['do', 'schedule', 'delegate', 'delete'] as const) {
      const f = matrix.flagsOf(q)!
      expect(matrix.quadrantOf(f.urgent, f.important)).toBe(q)
    }
  })

  it('moves and reorders tasks within the flat list', () => {
    const tasks: matrix.Task[] = [
      { id: 'a', text: 'a', q: 'inbox', done: false },
      { id: 'b', text: 'b', q: 'do', done: false },
      { id: 'c', text: 'c', q: 'do', done: true },
      { id: 'd', text: 'd', q: 'schedule', done: false },
    ]
    const m = matrix.moveTask(tasks, 'a', 'do', 1)
    expect(m.filter((t) => t.q === 'do').map((t) => t.id)).toEqual(['b', 'a', 'c'])
    const r = matrix.moveTask(tasks, 'c', 'do', 0)
    expect(r.filter((t) => t.q === 'do').map((t) => t.id)).toEqual(['c', 'b'])
    expect(matrix.moveTask(tasks, 'd', 'do', 99).filter((t) => t.q === 'do').map((t) => t.id)).toEqual(['b', 'c', 'd'])
    expect(matrix.counts(m).do).toEqual({ open: 2, done: 1 })
  })
})

describe('decision matrix', () => {
  const options = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }]
  const criteria = [{ id: 'price', name: 'Price', weight: 3 }, { id: 'speed', name: 'Speed', weight: 1 }]

  it('normalizes weights to shares', () => {
    expect(decision.normalizeWeights(criteria)).toEqual([0.75, 0.25])
    expect(decision.normalizeWeights([{ id: 'x', name: 'x', weight: 0 }, { id: 'y', name: 'y', weight: 0 }])).toEqual([0.5, 0.5])
  })

  it('ranks by weighted score with shared ranks for ties', () => {
    const scores = { 'a:price': 2, 'a:speed': 5, 'b:price': 5, 'b:speed': 1, 'c:price': 5, 'c:speed': 1 }
    const r = decision.rank(options, criteria, scores)
    expect(r.map((x) => x.id)).toEqual(['b', 'c', 'a'])
    expect(r[0].score).toBeCloseTo(4, 9)
    expect(r[2].score).toBeCloseTo(2.75, 9)
    expect(r.map((x) => x.rank)).toEqual([1, 1, 3])
    expect(r[0].pct).toBeCloseTo(0.8, 9)
  })
})

describe('world clock map', () => {
  it('puts the sun over the right place at equinox and solstice', () => {
    const eq = world.subsolarPoint(new Date(Date.UTC(2026, 2, 20, 12, 0)))
    expect(Math.abs(eq.lat)).toBeLessThan(0.5)
    expect(Math.abs(eq.lon)).toBeLessThan(3) // noon UTC is near Greenwich, give or take the equation of time
    const sol = world.subsolarPoint(new Date(Date.UTC(2026, 5, 21, 0, 0)))
    expect(sol.lat).toBeGreaterThan(23.3)
    expect(Math.abs(Math.abs(sol.lon) - 180)).toBeLessThan(3)
  })

  it('knows day from night', () => {
    const noonJakarta = new Date(Date.UTC(2026, 8, 26, 5, 0)) // 12:00 WIB
    expect(world.isDaylight(-6.2, 106.85, noonJakarta)).toBe(true)
    expect(world.isDaylight(40.71, -74.01, noonJakarta)).toBe(false) // 01:00 in New York
    // Midnight sun at the North Pole in June, polar night in December.
    expect(world.isDaylight(89, 0, new Date(Date.UTC(2026, 5, 21, 0)))).toBe(true)
    expect(world.isDaylight(89, 0, new Date(Date.UTC(2026, 11, 21, 12)))).toBe(false)
  })

  it('decodes the bundled land data and reads time-zone offsets', () => {
    const rings = world.decodeLand(LAND)
    expect(rings.length).toBeGreaterThan(50)
    for (const [lon, lat] of rings.flat()) {
      expect(Math.abs(lon)).toBeLessThanOrEqual(180)
      expect(Math.abs(lat)).toBeLessThanOrEqual(90)
    }
    expect(LAND.length).toBeLessThan(30_000)
    expect(world.tzOffset('Asia/Jayapura', new Date(Date.UTC(2026, 0, 1)))).toBe(540)
    expect(world.offsetLabel(-210)).toBe('UTC−3:30')
  })
})
