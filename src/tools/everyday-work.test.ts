import { describe, expect, it } from 'vitest'
import { clock, phaseAt, sectionAt } from './speaker-timer/logic'
import { computeTotals, formatMoney, wrapText } from './invoice-generator/logic'
import { addDays, daysBetween, findCycle, schedule, wouldCycle, type Task } from './gantt-chart/logic'
import { layout, parseIndented, splitNameTitle, wouldCycle as orgCycle } from './org-chart/logic'
import { boundsAll, hitTest, pick, smoothStroke, type El, type Pt } from './whiteboard/logic'
import { freshShuffle, planTurns, shuffle, turnAt } from './standup-timer/logic'
import { overtimeBasis, overtimePay, weekPay, weightedHours } from './overtime-pay/logic'
import { freelanceRate } from './freelance-rate/logic'

describe('speaker-timer', () => {
  const cfg = { total: 600, yellow: 300, red: 60 }
  it('turns yellow, red, then overtime at the thresholds', () => {
    expect(phaseAt(0, cfg)).toBe('green')
    expect(phaseAt(299, cfg)).toBe('green')
    expect(phaseAt(300, cfg)).toBe('yellow')
    expect(phaseAt(540, cfg)).toBe('red')
    expect(phaseAt(600, cfg)).toBe('red')
    expect(phaseAt(601, cfg)).toBe('over')
    expect(clock(600 - 642)).toBe('+0:42')
    expect(clock(3725)).toBe('1:02:05')
  })
  it('finds the current agenda section', () => {
    const s = [{ name: 'Intro', minutes: 2 }, { name: 'Demo', minutes: 5 }]
    expect(sectionAt(0, s)).toBe(0)
    expect(sectionAt(119, s)).toBe(0)
    expect(sectionAt(120, s)).toBe(1)
    expect(sectionAt(420, s)).toBe(-1)
  })
})

describe('invoice-generator', () => {
  it('formats Rupiah with dots and other currencies with their separators', () => {
    expect(formatMoney(1234567, 'IDR')).toBe('Rp 1.234.567')
    expect(formatMoney(1234.5, 'USD')).toBe('$1,234.50')
    expect(formatMoney(-12, 'EUR')).toBe('-€ 12,00')
  })
  it('applies discount then PPN with currency rounding', () => {
    const items = [
      { id: 1, desc: 'A', qty: 3, price: 333333 },
      { id: 2, desc: 'B', qty: 1, price: 1 },
    ]
    const t = computeTotals(items, 'pct', 5, 11, 'IDR')
    expect(t.subtotal).toBe(1000000)
    expect(t.discount).toBe(50000)
    expect(t.tax).toBe(104500)
    expect(t.total).toBe(1054500)
    const u = computeTotals([{ id: 1, desc: '', qty: 1, price: 10.05 }], 'fixed', 0, 10, 'USD')
    expect(u.tax).toBe(1.01)
    expect(u.total).toBe(11.06)
  })
  it('wraps long text within a width, breaking long words', () => {
    const lines = wrapText('hello wide world\nsupercalifragilistic', 10, (s) => s.length)
    expect(lines).toEqual(['hello wide', 'world', 'supercalif', 'ragilistic'])
  })
})

describe('gantt-chart', () => {
  const mk = (id: number, start: number, duration: number, deps: number[] = []): Task => ({ id, name: `T${id}`, start, duration, progress: 0, color: '#000', deps })
  it('pushes dependents after their predecessors finish, through chains', () => {
    const out = schedule([mk(1, 3, 4), mk(2, 0, 2, [1]), mk(3, 10, 1, [2]), mk(4, 1, 1, [1, 2])])
    expect(out.map((t) => t.start)).toEqual([3, 7, 10, 9])
  })
  it('detects cycles and refuses links that would create one', () => {
    expect(findCycle([mk(1, 0, 1), mk(2, 0, 1, [1])])).toBeNull()
    const cyc = findCycle([mk(1, 0, 1, [3]), mk(2, 0, 1, [1]), mk(3, 0, 1, [2])])
    expect(cyc?.sort()).toEqual([1, 2, 3])
    const tasks = [mk(1, 0, 1), mk(2, 0, 1, [1]), mk(3, 0, 1, [2])]
    expect(wouldCycle(tasks, 1, 3)).toBe(true)
    expect(wouldCycle(tasks, 3, 1)).toBe(false)
  })
  it('counts calendar days across months', () => {
    expect(daysBetween('2026-01-30', '2026-03-01')).toBe(30)
    expect(addDays('2026-02-27', 3)).toBe('2026-03-02')
  })
})

describe('org-chart', () => {
  const text = 'Sari - CEO\n  Budi - CTO\n    Adi (Dev)\n    Dewi, Dev\n  Maya - COO\nSolo'
  it('parses an indented list into managers and titles', () => {
    const ps = parseIndented(text)
    expect(ps.map((p) => [p.name, p.title, p.manager])).toEqual([
      ['Sari', 'CEO', null], ['Budi', 'CTO', 1], ['Adi', 'Dev', 2], ['Dewi', 'Dev', 2], ['Maya', 'COO', 1], ['Solo', '', null],
    ])
    expect(splitNameTitle('Jean-Luc Picard - Captain')).toEqual(['Jean-Luc Picard', 'Captain'])
  })
  it('centers managers over their reports and hides collapsed subtrees', () => {
    const ps = parseIndented(text)
    const l = layout(ps)
    const x = (id: number) => l.nodes.find((n) => n.id === id)!.x
    expect([x(3), x(4), x(5), x(6)]).toEqual([0, 1, 2, 3])
    expect(x(2)).toBe(0.5)
    expect(x(1)).toBe(1.25)
    expect(l.depth).toBe(3)
    const c = layout(ps, new Set([2]))
    expect(c.nodes.map((n) => n.id).sort()).toEqual([1, 2, 5, 6])
    expect(c.nodes.find((n) => n.id === 2)!.reports).toBe(2)
  })
  it('rejects a manager change that would create a loop', () => {
    const ps = parseIndented(text)
    expect(orgCycle(ps, 1, 3)).toBe(true)
    expect(orgCycle(ps, 2, 2)).toBe(true)
    expect(orgCycle(ps, 3, 5)).toBe(false)
  })
})

describe('whiteboard', () => {
  it('smooths jitter while keeping stroke endpoints', () => {
    const raw: Pt[] = Array.from({ length: 41 }, (_, i) => [i * 5, i % 2 ? 4 : -4])
    const out = smoothStroke(raw, 1, 0.5)
    expect(out[0]).toEqual([0, -4])
    expect(out[out.length - 1]).toEqual(raw[raw.length - 1])
    const wiggle = (ps: Pt[]) => ps.slice(1, -1).reduce((m, p) => Math.max(m, Math.abs(p[1])), 0)
    expect(wiggle(out.slice(5))).toBeLessThan(wiggle(raw))
    expect(smoothStroke([[0, 0], [0.2, 0.1], [0.3, 0], [10, 0]], 1.5)).toHaveLength(2)
  })
  it('hit-tests outlines, strokes and notes', () => {
    const rect: El = { id: 1, type: 'rect', x1: 0, y1: 0, x2: 100, y2: 50, color: '#000', width: 2 }
    expect(hitTest(rect, 100, 25, 4)).toBe(true)
    expect(hitTest(rect, 50, 25, 4)).toBe(false)
    const ell: El = { id: 2, type: 'ellipse', x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 2 }
    expect(hitTest(ell, 100, 50, 4)).toBe(true)
    expect(hitTest(ell, 50, 50, 4)).toBe(false)
    const pen: El = { id: 3, type: 'pen', pts: [[0, 0], [100, 100]], color: '#000', width: 4 }
    expect(hitTest(pen, 52, 48, 2)).toBe(true)
    expect(hitTest(pen, 80, 20, 2)).toBe(false)
    const note: El = { id: 4, type: 'note', x: 40, y: 10, w: 50, h: 50, text: '', color: '#ff0' }
    expect(pick([rect, pen, note], 50, 30)?.id).toBe(4)
    expect(boundsAll([rect, note])).toEqual({ x: -1, y: -1, w: 102, h: 61 })
  })
})

describe('standup-timer', () => {
  it('shuffles repeatably with a seed and keeps everyone', () => {
    const team = ['Ayu', 'Bima', 'Citra', 'Dimas', 'Eka']
    const a = shuffle(team, 42)
    expect(shuffle(team, 42)).toEqual(a)
    expect([...a].sort()).toEqual([...team].sort())
    expect(freshShuffle(team, 7)).not.toEqual(team)
    expect(freshShuffle(['a', 'b'], 1)).toEqual(['b', 'a'])
  })
  it('schedules turns with extensions and finds the current speaker', () => {
    const turns = planTurns(['A', 'B', 'C'], 60, [0, 30])
    expect(turns.map((t) => [t.start, t.end])).toEqual([[0, 60], [60, 150], [150, 210]])
    expect(turnAt(turns, 59)).toBe(0)
    expect(turnAt(turns, 149)).toBe(1)
    expect(turnAt(turns, 210)).toBe(-1)
  })
})

describe('overtime-pay', () => {
  it('pays workday overtime at 1.5x for the first hour and 2x after', () => {
    // Rp 3.460.000 / 173 = Rp 20.000 an hour; 3 h = 1.5 + 2 + 2 = 5.5 hours' wage.
    expect(weightedHours(3, 'work', 5)).toBe(5.5)
    expect(overtimePay(3_460_000, 3, 'work', 5)).toBe(110_000)
    expect(overtimePay(3_460_000, 0.5, 'work', 5)).toBe(15_000)
  })
  it('uses the rest-day bands for 5- and 6-day weeks', () => {
    expect(weightedHours(10, 'rest', 5)).toBe(8 * 2 + 3 + 4)
    expect(weightedHours(9, 'rest', 6)).toBe(7 * 2 + 3 + 4)
    expect(weightedHours(7, 'short', 6)).toBe(5 * 2 + 3 + 4)
    expect(overtimePay(3_460_000, 8, 'rest', 5)).toBe(320_000)
  })
  it('applies the 75% basis rule and flags weekly limits', () => {
    expect(overtimeBasis(3_000_000, 2_000_000)).toBe(3_750_000)
    expect(overtimeBasis(4_000_000, 1_000_000)).toBe(4_000_000)
    const w = weekPay(3_460_000, [4, 4, 4, 4, 4].map((hours) => ({ day: 'work' as const, hours })), 5)
    expect(w.pay).toBe(5 * 7.5 * 20_000)
    expect(w.warnings.some((x) => x.includes('18 h'))).toBe(true)
  })
})

describe('freelance-rate', () => {
  const base = { takeHome: 60_000, costs: 10_000, taxPct: 15, savingsPct: 5, vacationWeeks: 4, holidays: 10, sickDays: 5, daysPerWeek: 5, hoursPerDay: 8, billablePct: 50 }
  it('grosses up take-home for tax and savings, then divides by billable hours', () => {
    const r = freelanceRate(base)
    expect(r.profit).toBeCloseTo(75_000)
    expect(r.revenue).toBeCloseTo(85_000)
    expect(r.workDays).toBe(48 * 5 - 15)
    expect(r.billableHours).toBe(225 * 8 * 0.5)
    expect(r.hourly).toBeCloseTo(85_000 / 900)
    expect(r.daily).toBeCloseTo((85_000 / 900) * 8)
    const p = r.perHour
    expect(p.takeHome + p.tax + p.savings + p.costs).toBeCloseTo(r.hourly)
  })
  it('flags impossible inputs', () => {
    expect(freelanceRate({ ...base, taxPct: 60, savingsPct: 40 }).ok).toBe(false)
    expect(freelanceRate({ ...base, billablePct: 0 }).ok).toBe(false)
  })
})
