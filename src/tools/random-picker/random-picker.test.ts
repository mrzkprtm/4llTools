import { describe, expect, it } from 'vitest'
import { flipCoin, indexAtPointer, parseDice, parseItems, pickN, randomInt, rollDice, shuffle, splitTeams, wheelTarget } from './random'

/** Deterministic 32-bit generator for tests. */
const seeded = (seed = 7) => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0)

describe('random picker', () => {
  it('parses one item per line and ignores blanks', () => {
    expect(parseItems(' Ana \n\nBudi\r\n  \nCitra')).toEqual(['Ana', 'Budi', 'Citra'])
  })

  it('draws in range without bias from rejected values', () => {
    const r = seeded()
    const counts = [0, 0, 0]
    for (let i = 0; i < 3000; i++) counts[randomInt(3, r)]++
    for (const c of counts) expect(c).toBeGreaterThan(850)
    // A value in the biased tail is rejected and the next one used.
    const vals = [0xffffffff, 5]
    expect(randomInt(10, () => vals.shift()!)).toBe(5)
  })

  it('shuffles and picks distinct items', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    expect([...shuffle(items, seeded())].sort()).toEqual(items)
    const two = pickN(items, 2, seeded(3))
    expect(two).toHaveLength(2)
    expect(new Set(two).size).toBe(2)
    expect(pickN(items, 9, seeded())).toHaveLength(5)
  })

  it('splits teams evenly', () => {
    const teams = splitTeams(['1', '2', '3', '4', '5', '6', '7'], 3, seeded())
    expect(teams.map((t) => t.length).sort()).toEqual([2, 2, 3])
    expect(teams.flat().sort()).toEqual(['1', '2', '3', '4', '5', '6', '7'])
    expect(splitTeams(['a', 'b'], 5, seeded())).toHaveLength(2)
  })

  it('parses and rolls dice notation', () => {
    expect(parseDice('3d6+2')).toEqual({ count: 3, sides: 6, modifier: 2 })
    expect(parseDice('d20')).toEqual({ count: 1, sides: 20, modifier: 0 })
    expect(parseDice('2d1')).toBeNull()
    const { rolls, total } = rollDice({ count: 4, sides: 6, modifier: -1 }, seeded())
    for (const x of rolls) expect(x).toBeGreaterThanOrEqual(1)
    for (const x of rolls) expect(x).toBeLessThanOrEqual(6)
    expect(total).toBe(rolls.reduce((a, b) => a + b) - 1)
    expect(['Heads', 'Tails']).toContain(flipCoin(seeded()))
  })

  it('lands the wheel on the chosen segment', () => {
    for (const n of [2, 3, 7, 12]) {
      let rot = 123
      for (let i = 0; i < n; i++) {
        for (const off of [0, 0.5, 0.999]) {
          const t = wheelTarget(rot, i, n, 5, off)
          expect(t).toBeGreaterThan(rot + 360)
          expect(indexAtPointer(t, n)).toBe(i)
        }
        rot = wheelTarget(rot, i, n)
      }
    }
  })
})
