import { describe, expect, it } from 'vitest'
import { GRID, cellRect, emptyGrid, filledCount, moveSlot, postOrder, squareRect } from './grid'

describe('squareRect', () => {
  it('takes the full image when it is already square', () => {
    expect(squareRect(900, 900)).toEqual({ sx: 0, sy: 0, side: 900 })
  })

  it('centers a wide crop', () => {
    expect(squareRect(1600, 900)).toEqual({ sx: 350, sy: 0, side: 900 })
  })

  it('centers a tall crop', () => {
    expect(squareRect(900, 1600)).toEqual({ sx: 0, sy: 350, side: 900 })
  })
})

describe('cellRect', () => {
  it('tiles the square into GRID x GRID cells in row-major order', () => {
    const cells = Array.from({ length: GRID * GRID }, (_, i) => cellRect(900, 900, i))
    expect(cells[0]).toEqual({ sx: 0, sy: 0, side: 300 })
    expect(cells[1]).toEqual({ sx: 300, sy: 0, side: 300 })
    expect(cells[3]).toEqual({ sx: 0, sy: 300, side: 300 })
    expect(cells[8]).toEqual({ sx: 600, sy: 600, side: 300 })
  })
})

describe('moveSlot', () => {
  it('moves an item to a new position without mutating the input', () => {
    const slots = emptyGrid()
    const markers = slots.map((_, i) => ({ img: { tag: i } as unknown as HTMLImageElement }))
    const moved = moveSlot(markers, 0, 2)
    expect(moved.map((s) => (s.img as unknown as { tag: number }).tag)).toEqual([1, 2, 0, 3, 4, 5, 6, 7, 8])
    expect(markers.map((s) => (s.img as unknown as { tag: number }).tag)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('returns the same array for out-of-range or no-op moves', () => {
    const slots = emptyGrid()
    expect(moveSlot(slots, -1, 3)).toBe(slots)
    expect(moveSlot(slots, 0, 0)).toBe(slots)
    expect(moveSlot(slots, 0, 9)).toBe(slots)
  })
})

describe('filledCount and postOrder', () => {
  it('counts only slots holding an image', () => {
    const slots = emptyGrid()
    slots[0] = { img: {} as HTMLImageElement }
    slots[8] = { img: {} as HTMLImageElement }
    expect(filledCount(slots)).toBe(2)
    expect(filledCount(emptyGrid())).toBe(0)
  })

  it('reverses row-major so slot 8 posts first', () => {
    expect(postOrder()[0]).toBe(8)
    expect(postOrder()[8]).toBe(0)
    expect(postOrder()).toHaveLength(9)
  })
})
