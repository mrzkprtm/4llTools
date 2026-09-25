import { describe, expect, it } from 'vitest'
import { parseOctal, parseSymbolic, toChmodSymbolic, toOctal, toSymbolic, warnings } from './chmod'

describe('chmod', () => {
  it('converts octal to symbolic', () => {
    expect(toSymbolic(0o755)).toBe('rwxr-xr-x')
    expect(toSymbolic(0o644)).toBe('rw-r--r--')
    expect(toSymbolic(0o1777)).toBe('rwxrwxrwt')
    expect(toSymbolic(0o4755)).toBe('rwsr-xr-x')
    expect(toSymbolic(0o2644)).toBe('rw-r-Sr--')
    expect(toSymbolic(0o1776)).toBe('rwxrwxrwT')
  })

  it('parses symbolic and ls -l forms', () => {
    expect(parseSymbolic('rwxr-xr-x')).toBe(0o755)
    expect(parseSymbolic('-rw-r--r--')).toBe(0o644)
    expect(parseSymbolic('drwxrwxrwt')).toBe(0o1777)
    expect(parseSymbolic('-rwsr-xr-x.')).toBe(0o4755)
    expect(parseSymbolic('rwSr-xr-x')).toBe(0o4655)
    expect(parseSymbolic('rwxrwxrwz')).toBeNull()
    expect(parseSymbolic('rwx')).toBeNull()
  })

  it('round-trips every mode', () => {
    for (let m = 0; m <= 0o7777; m++) {
      expect(parseSymbolic(toSymbolic(m))).toBe(m)
      expect(parseOctal(toOctal(m))).toBe(m)
    }
  })

  it('parses octal strictly', () => {
    expect(parseOctal('644')).toBe(0o644)
    expect(parseOctal('2755')).toBe(0o2755)
    expect(parseOctal('0644')).toBe(0o644)
    expect(parseOctal('78')).toBeNull()
    expect(parseOctal('888')).toBeNull()
    expect(toOctal(0o644)).toBe('644')
    expect(toOctal(0o2755)).toBe('2755')
  })

  it('builds symbolic chmod arguments', () => {
    expect(toChmodSymbolic(0o755)).toBe('u=rwx,g=rx,o=rx')
    expect(toChmodSymbolic(0o600)).toBe('u=rw,g=,o=')
    expect(toChmodSymbolic(0o1777)).toBe('u=rwx,g=rwx,o=rwxt')
    expect(toChmodSymbolic(0o6755)).toBe('u=rwxs,g=rxs,o=rx')
  })

  it('warns about world-writable modes', () => {
    expect(warnings(0o777).length).toBeGreaterThan(0)
    expect(warnings(0o644)).toEqual([])
  })
})
