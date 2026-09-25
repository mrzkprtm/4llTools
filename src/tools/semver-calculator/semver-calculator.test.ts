import { describe, expect, it } from 'vitest'
import { checkRange, compareVersions, explainRange, nextVersions, parseVersion, sortVersions } from './semver-logic'

describe('semver calculator', () => {
  it('parses versions', () => {
    expect(parseVersion('v1.2.3-beta.1+build.5')).toEqual({ version: '1.2.3-beta.1', major: 1, minor: 2, patch: 3, prerelease: ['beta', 1], build: ['build', '5'] })
    expect(parseVersion('1.2')).toBeNull()
  })

  it('computes next versions with a preid', () => {
    const next = Object.fromEntries(nextVersions('1.2.3', 'rc').map((n) => [n.kind, n.next]))
    expect(next).toMatchObject({ major: '2.0.0', minor: '1.3.0', patch: '1.2.4', premajor: '2.0.0-rc.0', preminor: '1.3.0-rc.0', prepatch: '1.2.4-rc.0', prerelease: '1.2.4-rc.0' })
    const pre = Object.fromEntries(nextVersions('2.0.0-rc.1', 'rc').map((n) => [n.kind, n.next]))
    expect(pre.prerelease).toBe('2.0.0-rc.2')
    expect(pre.major).toBe('2.0.0')
  })

  it('compares versions', () => {
    expect(compareVersions('1.2.3', '1.10.0')).toMatchObject({ symbol: '<', newer: '1.10.0', diff: 'minor' })
    expect(compareVersions('2.0.0', '2.0.0-rc.1')).toMatchObject({ symbol: '>', newer: '2.0.0' })
    expect(compareVersions('1.0.0', '1.0.0')?.symbol).toBe('=')
    expect(compareVersions('nope', '1.0.0')).toBeNull()
  })

  it('checks ranges', () => {
    const r = checkRange('^1.2.3', ['1.2.2', '1.2.3', '1.9.0', '2.0.0', 'bad'])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.results.map((x) => x.satisfies)).toEqual([false, true, true, false, false])
    expect(r.max).toBe('1.9.0')
    expect(checkRange('>=1 <2', ['1.5.0']).ok).toBe(true)
    expect(checkRange('~1.2', ['1.2.9', '1.3.0']).ok && (checkRange('~1.2', ['1.2.9', '1.3.0']) as { results: { satisfies: boolean }[] }).results.map((x) => x.satisfies)).toEqual([true, false])
    expect(checkRange('>>>1', []).ok).toBe(false)
  })

  it('explains caret and tilde', () => {
    expect(explainRange('^1.2.3')[0]).toContain('<2.0.0')
    expect(explainRange('~1.2')[0]).toContain('1.2.x')
    expect(explainRange('^0.2.3')[0]).toContain('0.2.x')
  })

  it('sorts versions', () => {
    expect(sortVersions('1.10.0 1.2.0\n1.2.0-beta, 0.9.1 junk')).toEqual({ sorted: ['0.9.1', '1.2.0-beta', '1.2.0', '1.10.0'], invalid: ['junk'] })
    expect(sortVersions('1.0.0 2.0.0', true).sorted).toEqual(['2.0.0', '1.0.0'])
  })
})
