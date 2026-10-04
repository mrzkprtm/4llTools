import { describe, expect, it } from 'vitest'
import { FRAME_STYLES, cornerRadius, frameLayout, type FrameStyle } from './frame'

const ids = FRAME_STYLES.map((s) => s.id)

describe('FRAME_STYLES', () => {
  it('lists the five styles once each', () => {
    expect(ids).toEqual(['border', 'polaroid', 'rounded', 'shadow', 'film'])
    expect(new Set(ids).size).toBe(5)
    for (const style of FRAME_STYLES) expect(style.label.length).toBeGreaterThan(2)
  })
})

describe('frameLayout', () => {
  it('adds the border on every side of a plain frame', () => {
    expect(frameLayout(1000, 800, 'border', 40, 0)).toEqual({
      canvasW: 1080,
      canvasH: 880,
      imageX: 40,
      imageY: 40,
      imageW: 1000,
      imageH: 800,
      captionY: 840,
    })
  })

  it('reserves a band at the bottom for the caption', () => {
    const layout = frameLayout(1000, 800, 'polaroid', 40, 120)
    expect(layout.canvasW).toBe(1080)
    expect(layout.canvasH).toBe(880 + 120)
    expect(layout.imageY).toBe(40)
    expect(layout.captionY).toBe(900)
    expect(layout.captionY).toBeLessThan(layout.canvasH)
  })

  it('leaves blur room for the shadow and a gutter for the film strip', () => {
    const border = frameLayout(600, 400, 'border', 20, 0)
    const shadow = frameLayout(600, 400, 'shadow', 20, 0)
    const film = frameLayout(600, 400, 'film', 20, 0)
    expect(shadow.canvasW).toBe(border.canvasW + 40)
    expect(film.canvasW).toBe(border.canvasW + 24)
    expect(shadow.imageX).toBe(40)
    expect(film.imageX).toBe(32)
  })

  it('keeps a zero border tight around the photo', () => {
    expect(frameLayout(300, 200, 'border', 0, 0)).toEqual({
      canvasW: 300,
      canvasH: 200,
      imageX: 0,
      imageY: 0,
      imageW: 300,
      imageH: 200,
      captionY: 200,
    })
  })

  it('clamps negative and nonsense values into a usable canvas', () => {
    const layout = frameLayout(0, Number.NaN, 'shadow', -10, Number.NaN)
    expect(layout.canvasW).toBe(41)
    expect(layout.canvasH).toBe(41)
    expect(layout.imageW).toBe(1)
    expect(layout.imageH).toBe(1)
    expect(frameLayout(100, 100, 'border', Number.NaN, -50).canvasH).toBe(100)
  })
})

describe('cornerRadius', () => {
  it('scales the rounded style with the photo width', () => {
    expect(cornerRadius('rounded', 100)).toBe(8)
    expect(cornerRadius('rounded', 400)).toBe(20)
    expect(cornerRadius('rounded', 4000)).toBe(32)
  })

  it('gives the other styles a small fixed radius', () => {
    expect(cornerRadius('border' as FrameStyle, 500)).toBe(0)
    expect(cornerRadius('polaroid', 500)).toBe(4)
    expect(cornerRadius('film', 500)).toBe(3)
    expect(cornerRadius('shadow', 500)).toBe(6)
  })

  it('never returns a negative radius', () => {
    expect(cornerRadius('rounded', -20)).toBe(8)
    expect(cornerRadius('rounded', Number.NaN)).toBe(8)
  })
})
