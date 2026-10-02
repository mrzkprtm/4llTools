import { describe, expect, it } from 'vitest'
import { FORMATS, bulkLines, fileSafe, gtinCheckDigit, validate } from './barcode'

describe('gtin check digits', () => {
  it('computes known check digits', () => {
    expect(gtinCheckDigit('590123412345')).toBe(7) // EAN-13 5901234123457
    expect(gtinCheckDigit('400638133393')).toBe(1) // 4006381333931
    expect(gtinCheckDigit('9638507')).toBe(4) // EAN-8 96385074
    expect(gtinCheckDigit('03600029145')).toBe(2) // UPC-A 036000291452
    expect(gtinCheckDigit('1234567890123')).toBe(1) // ITF-14 12345678901231
  })
})

describe('validate', () => {
  it('auto-appends and verifies EAN/UPC check digits', () => {
    expect(validate('EAN13', '590123412345')).toMatchObject({ ok: true, value: '5901234123457' })
    expect(validate('EAN13', '5901234123457')).toEqual({ ok: true, value: '5901234123457' })
    const bad = validate('EAN13', '5901234123450')
    expect(bad.ok).toBe(false)
    expect(!bad.ok && bad.error).toContain('should be 7')
    expect(validate('UPC', '036000291452').ok).toBe(true)
    expect(validate('EAN8', '9638-507')).toMatchObject({ ok: true, value: '96385074' })
    expect(validate('ITF14', '1234567890123')).toMatchObject({ ok: true, value: '12345678901231' })
    expect(validate('EAN13', '12345').ok).toBe(false)
    expect(validate('UPC', '0360002914a').ok).toBe(false)
  })

  it('checks character sets for the other formats', () => {
    expect(validate('CODE128', 'Hello-123')).toEqual({ ok: true, value: 'Hello-123' })
    expect(validate('CODE128', 'café').ok).toBe(false)
    expect(validate('CODE39', 'abc-1')).toMatchObject({ ok: true, value: 'ABC-1', note: 'Converted to upper case.' })
    expect(validate('CODE39', 'A_B').ok).toBe(false)
    expect(validate('MSI', '12a').ok).toBe(false)
    expect(validate('pharmacode', '2').ok).toBe(false)
    expect(validate('pharmacode', '131070').ok).toBe(true)
    expect(validate('codabar', 'a40156b')).toEqual({ ok: true, value: 'A40156B' })
    expect(validate('codabar', '40156')).toEqual({ ok: true, value: '40156' })
    expect(validate('codabar', 'A401X6B').ok).toBe(false)
    expect(validate('CODE128', '   ').ok).toBe(false)
  })

  it('every format example validates', () => {
    for (const f of FORMATS) expect(validate(f.id, f.example).ok, f.id).toBe(true)
  })
})

describe('helpers', () => {
  it('splits bulk lines and makes safe filenames', () => {
    expect(bulkLines(' a \n\n b\r\nc ')).toEqual(['a', 'b', 'c'])
    expect(bulkLines('1\n2\n3', 2)).toEqual(['1', '2'])
    expect(fileSafe('A/B C')).toBe('A_B_C')
    expect(fileSafe('')).toBe('barcode')
  })
})
