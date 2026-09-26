import { describe, expect, it } from 'vitest'
import { factKey, makeQuiz, scoreAnswer, EMPTY_SCORE } from './multiplication-practice/logic'
import { add, compare, div, format, gcd, lcm, mul, parseFraction, simplify, sub, toMixed } from './fraction-visualizer/logic'
import { dragMinute, timeToWords } from './learn-clock/logic'
import { newCard, parseCardsCSV, schedule, toCSV } from './flashcards/logic'
import { ELEMENTS } from './periodic-table/elements'
import { position, scaleColor, STOPS } from './periodic-table/logic'
import { GLYPHS, SETS } from './handwriting-tracing/glyphs'
import { pathLength, samplePath, traceScore } from './handwriting-tracing/logic'

/** Deterministic generator in [0, 1) for tests. */
const seeded = (seed = 7) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32)

describe('multiplication practice', () => {
  it('asks every fact once before repeating and never twice in a row', () => {
    const quiz = makeQuiz([3, 4], 30, seeded(3), false)
    expect(quiz).toHaveLength(30)
    const first = new Set(quiz.slice(0, 24).map(factKey))
    expect(first.size).toBe(24)
    for (let i = 1; i < quiz.length; i++) expect(factKey(quiz[i])).not.toBe(factKey(quiz[i - 1]))
    expect(quiz.every((f) => f.a === 3 || f.a === 4)).toBe(true)
  })

  it('scores streaks and flags milestones', () => {
    let s = { ...EMPTY_SCORE }
    const gains: number[] = []
    let milestones = 0
    for (let i = 0; i < 5; i++) {
      const r = scoreAnswer(s, true)
      gains.push(r.gained)
      if (r.milestone) milestones++
      s = r
    }
    expect(gains).toEqual([10, 12, 14, 16, 18])
    expect(milestones).toBe(1)
    const miss = scoreAnswer(s, false)
    expect(miss.streak).toBe(0)
    expect(miss.best).toBe(5)
    expect(miss.score).toBe(70)
  })
})

describe('fraction visualizer', () => {
  it('does arithmetic in lowest terms', () => {
    expect(gcd(12, 18)).toBe(6)
    expect(lcm(4, 6)).toBe(12)
    expect(add({ n: 1, d: 2 }, { n: 1, d: 3 })).toEqual({ n: 5, d: 6 })
    expect(sub({ n: 1, d: 4 }, { n: 1, d: 2 })).toEqual({ n: -1, d: 4 })
    expect(mul({ n: 2, d: 3 }, { n: 3, d: 4 })).toEqual({ n: 1, d: 2 })
    expect(div({ n: 1, d: 2 }, { n: 1, d: 4 })).toEqual({ n: 2, d: 1 })
    expect(simplify({ n: 6, d: -8 })).toEqual({ n: -3, d: 4 })
    expect(compare({ n: 2, d: 3 }, { n: 3, d: 5 })).toBe(1)
    expect(compare({ n: 2, d: 4 }, { n: 1, d: 2 })).toBe(0)
  })

  it('converts mixed numbers both ways', () => {
    expect(parseFraction('1 1/2')).toEqual({ n: 3, d: 2 })
    expect(parseFraction('-2 1/3')).toEqual({ n: -7, d: 3 })
    expect(parseFraction('0.75')).toEqual({ n: 3, d: 4 })
    expect(parseFraction('3/0')).toBeNull()
    expect(toMixed({ n: 11, d: 4 })).toEqual({ negative: false, whole: 2, n: 3, d: 4 })
    expect(format({ n: 10, d: 4 })).toBe('2 1/2')
    expect(format({ n: 10, d: 4 }, false)).toBe('5/2')
  })
})

describe('learn clock', () => {
  it('says the time in English', () => {
    expect(timeToWords(15, 15, 'en')).toBe('quarter past three')
    expect(timeToWords(3, 0, 'en')).toBe("three o'clock")
    expect(timeToWords(3, 35, 'en')).toBe('twenty-five to four')
    expect(timeToWords(11, 58, 'en')).toBe('two minutes to twelve')
    expect(timeToWords(0, 30, 'en')).toBe('half past twelve')
  })

  it('uses the Indonesian setengah rule (half to the next hour)', () => {
    expect(timeToWords(3, 30, 'id')).toBe('jam setengah empat')
    expect(timeToWords(12, 30, 'id')).toBe('jam setengah satu')
    expect(timeToWords(3, 15, 'id')).toBe('jam tiga lewat seperempat')
    expect(timeToWords(3, 45, 'id')).toBe('jam empat kurang seperempat')
    expect(timeToWords(9, 13, 'id')).toBe('jam sembilan lewat tiga belas menit')
    expect(timeToWords(9, 35, 'id')).toBe('jam sepuluh kurang dua puluh lima menit')
  })

  it('moves the hour when the minute hand crosses twelve', () => {
    expect(dragMinute(3 * 60 + 55, 6)).toBe(4 * 60 + 1)
    expect(dragMinute(4 * 60 + 2, 354)).toBe(3 * 60 + 59)
  })
})

describe('flashcards', () => {
  it('moves cards through the Leitner boxes', () => {
    const DAY = 86_400_000
    const now = 1_000_000
    let c = newCard('water', 'air')
    c = schedule(c, 'good', now)
    expect(c.box).toBe(2)
    expect(c.due).toBe(now + DAY)
    c = schedule(c, 'easy', now)
    expect(c.box).toBe(4)
    expect(c.due).toBe(now + 7 * DAY)
    c = schedule(c, 'hard', now)
    expect(c.box).toBe(4)
    expect(c.due).toBe(now + 3.5 * DAY)
    c = schedule(schedule(c, 'easy', now), 'easy', now)
    expect(c.box).toBe(5)
    c = schedule(c, 'again', now)
    expect(c.box).toBe(1)
    expect(c.lapses).toBe(1)
    expect(c.reviews).toBe(6)
  })

  it('parses and writes CSV with quotes and a header', () => {
    const text = 'front,back\nhello,halo\n"thank you, friend","terima kasih, teman"\n"say ""hi""",sapa\n\n'
    const pairs = parseCardsCSV(text)
    expect(pairs).toEqual([['hello', 'halo'], ['thank you, friend', 'terima kasih, teman'], ['say "hi"', 'sapa']])
    const back = parseCardsCSV(toCSV(pairs.map(([front, back]) => ({ front, back }))))
    expect(back).toEqual(pairs)
    expect(parseCardsCSV('a;b\nc;d')).toEqual([['a', 'b'], ['c', 'd']])
  })
})

describe('periodic table', () => {
  const at = (sym: string) => position(ELEMENTS.find((e) => e.symbol === sym)!)
  it('has all 118 elements in the standard layout', () => {
    expect(ELEMENTS).toHaveLength(118)
    expect(ELEMENTS[117].symbol).toBe('Og')
    expect(at('H')).toEqual({ col: 1, row: 1 })
    expect(at('He')).toEqual({ col: 18, row: 1 })
    expect(at('B')).toEqual({ col: 13, row: 2 })
    expect(at('Fe')).toEqual({ col: 8, row: 4 })
    expect(at('Hf')).toEqual({ col: 4, row: 6 })
    expect(at('La')).toEqual({ col: 3, row: 9 })
    expect(at('Lu')).toEqual({ col: 17, row: 9 })
    expect(at('U')).toEqual({ col: 6, row: 10 })
    expect(at('Og')).toEqual({ col: 18, row: 7 })
    const cells = new Set(ELEMENTS.map((e) => { const p = position(e); return `${p.col},${p.row}` }))
    expect(cells.size).toBe(118)
  })

  it('maps values onto the heatmap scale', () => {
    expect(scaleColor(0)).toBe('rgb(44, 123, 182)')
    expect(scaleColor(1)).toBe(scaleColor(5))
    expect(scaleColor(1)).toBe(`rgb(${[1, 3, 5].map((i) => parseInt(STOPS[STOPS.length - 1].slice(i, i + 2), 16)).join(', ')})`)
  })
})

describe('handwriting tracing', () => {
  it('samples a path at even spacing', () => {
    const pts = samplePath([[0, 0], [10, 0], [10, 5]], 2)
    expect(pts[0]).toEqual([0, 0])
    expect(pts[pts.length - 1]).toEqual([10, 5])
    expect(pts).toHaveLength(9)
    for (let i = 1; i < pts.length - 1; i++) expect(pathLength([pts[i - 1], pts[i]])).toBeCloseTo(2, 6)
  })

  it('scores coverage of the guide', () => {
    const guide = GLYPHS.L
    expect(traceScore(guide, guide).score).toBe(100)
    expect(traceScore(guide, []).score).toBe(0)
    const half = traceScore(guide, [[[12, 10], [12, 80]]])
    expect(half.coverage).toBeGreaterThan(0.5)
    expect(half.coverage).toBeLessThan(0.75)
    expect(half.precision).toBe(1)
    expect(traceScore(guide, [[[50, 10], [50, 40]]]).score).toBeLessThan(10)
  })

  it('defines every letter and digit', () => {
    for (const c of SETS.upper + SETS.lower + SETS.digits) {
      expect(GLYPHS[c]?.length, c).toBeGreaterThan(0)
      for (const s of GLYPHS[c]) for (const [x, y] of s) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(60)
        expect(y).toBeGreaterThanOrEqual(8)
        expect(y).toBeLessThanOrEqual(100)
      }
    }
  })
})
