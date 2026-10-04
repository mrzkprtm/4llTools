import { describe, expect, it } from 'vitest'
import { PAGE_H, PAGE_W, addressLines, contrastText, headerLayout } from './letterhead'

describe('letterhead maker', () => {
  it('puts the content column inside the margins', () => {
    const l = headerLayout(PAGE_W, PAGE_H, 64)
    expect(l.x).toBe(64)
    expect(l.width).toBe(PAGE_W - 128)
    expect(headerLayout(800, 600, 1000).x).toBe(300)
    expect(headerLayout(800, 600, Number.NaN).x).toBe(0)
  })

  it('scales the type to the page height', () => {
    const l = headerLayout(PAGE_W, PAGE_H, 64)
    expect(l.nameSize).toBe(31)
    expect(l.taglineSize).toBe(15)
    expect(l.addressSize).toBe(13)
    expect(l.bodySize).toBe(13)
    expect(l.lineHeight).toBe(19)
    expect(headerLayout(794, 300, 40).nameSize).toBe(16)
    expect(headerLayout(794, 4000, 40).nameSize).toBe(48)
  })

  it('stacks name, tagline, rule and body in order', () => {
    const l = headerLayout(PAGE_W, PAGE_H, 64)
    expect(l.nameY).toBeGreaterThan(l.x)
    expect(l.taglineY).toBeGreaterThan(l.nameY)
    expect(l.ruleY).toBeGreaterThan(l.taglineY)
    expect(l.bodyTop).toBe(l.ruleY + l.ruleGap)
    expect(l.addressY).toBe(l.nameY)
  })

  it('pushes the rule down when the address block is long', () => {
    const short = headerLayout(PAGE_W, PAGE_H, 64, 1)
    const long = headerLayout(PAGE_W, PAGE_H, 64, 6)
    expect(long.ruleY).toBeGreaterThan(short.ruleY)
    expect(long.bodyTop).toBeGreaterThan(short.bodyTop)
    expect(headerLayout(PAGE_W, PAGE_H, 64, 0).ruleY).toBe(short.ruleY)
  })

  it('splits the address into trimmed non-empty lines', () => {
    expect(addressLines('12 Bridge Street\nLondon EC1 1AA\n\nhello@example.com')).toEqual(['12 Bridge Street', 'London EC1 1AA', 'hello@example.com'])
    expect(addressLines('  one  \r\n two ')).toEqual(['one', 'two'])
    expect(addressLines('')).toEqual([])
  })

  it('picks readable text for any background', () => {
    expect(contrastText('#ffffff')).toBe('#111111')
    expect(contrastText('#fff')).toBe('#111111')
    expect(contrastText('#000000')).toBe('#ffffff')
    expect(contrastText('#1d4ed8')).toBe('#ffffff')
    expect(contrastText('#f59e0b')).toBe('#111111')
    expect(contrastText('not a colour')).toBe('#111111')
  })
})
