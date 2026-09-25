import semver from 'semver'

export type ReleaseKind = 'major' | 'minor' | 'patch' | 'premajor' | 'preminor' | 'prepatch' | 'prerelease'

export const RELEASES: { kind: ReleaseKind; when: string }[] = [
  { kind: 'major', when: 'Breaking change: you removed or changed something users rely on.' },
  { kind: 'minor', when: 'New feature that stays backwards compatible.' },
  { kind: 'patch', when: 'Bug fix only, no new features.' },
  { kind: 'premajor', when: 'First test build of the next major (e.g. 3.0.0-beta.0).' },
  { kind: 'preminor', when: 'First test build of the next minor.' },
  { kind: 'prepatch', when: 'First test build of the next patch.' },
  { kind: 'prerelease', when: 'Next test build: bumps the pre-release number, or starts one on the next patch.' },
]

export type Parsed = {
  version: string
  major: number
  minor: number
  patch: number
  prerelease: (string | number)[]
  build: string[]
}

export function parseVersion(input: string): Parsed | null {
  const v = semver.parse(input.trim(), { loose: true })
  if (!v) return null
  return { version: v.version, major: v.major, minor: v.minor, patch: v.patch, prerelease: [...v.prerelease], build: [...v.build] }
}

export function nextVersions(input: string, preid: string): { kind: ReleaseKind; when: string; next: string | null }[] {
  const id = preid.trim() || undefined
  return RELEASES.map((r) => ({ ...r, next: semver.inc(input.trim(), r.kind, { loose: true }, id) }))
}

export type Comparison = { order: -1 | 0 | 1; symbol: '<' | '=' | '>'; newer: string | null; diff: string | null }

export function compareVersions(a: string, b: string): Comparison | null {
  const va = semver.parse(a.trim(), { loose: true })
  const vb = semver.parse(b.trim(), { loose: true })
  if (!va || !vb) return null
  const order = semver.compare(va, vb)
  return {
    order,
    symbol: order < 0 ? '<' : order > 0 ? '>' : '=',
    newer: order === 0 ? null : order > 0 ? va.version : vb.version,
    diff: semver.diff(va, vb),
  }
}

export type RangeCheck =
  | { ok: true; normalized: string; results: { version: string; valid: boolean; satisfies: boolean }[]; max: string | null; min: string | null }
  | { ok: false; error: string }

export function checkRange(range: string, versions: string[], includePrerelease = false): RangeCheck {
  const r = semver.validRange(range.trim(), { loose: true, includePrerelease })
  if (r === null) return { ok: false, error: `"${range}" is not a valid range.` }
  const opts = { loose: true, includePrerelease }
  const results = versions.map((raw) => {
    const v = semver.valid(raw.trim(), { loose: true })
    return { version: raw.trim(), valid: !!v, satisfies: !!v && semver.satisfies(v, r, opts) }
  })
  const valid = results.filter((x) => x.valid).map((x) => x.version)
  return { ok: true, normalized: r || '*', results, max: semver.maxSatisfying(valid, r, opts), min: semver.minSatisfying(valid, r, opts) }
}

/** Plain-English explanation of common range shorthands. */
export function explainRange(range: string): string[] {
  const out: string[] = []
  for (const part of range.trim().split(/\s*\|\|\s*/)) {
    const m = part.match(/^([\^~])\s*v?(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?/)
    if (m) {
      const [, op, maj] = m
      const min = m[3] && !/[x*]/.test(m[3]) ? m[3] : undefined
      if (op === '^') {
        if (maj !== '0') out.push(`^ allows anything that doesn't change the left-most non-zero part: ${maj}.x.x, so >=${part.slice(1).trim()} and <${Number(maj) + 1}.0.0.`)
        else if (min && min !== '0') out.push(`^ on 0.${min}.x is stricter: 0.x versions treat the minor as breaking, so only 0.${min}.x patches are allowed.`)
        else out.push('^ on 0.0.x only allows that exact patch, since every 0.0.x release may break.')
      } else {
        out.push(min !== undefined ? `~ allows patch updates only: ${maj}.${min}.x.` : `~${maj} without a minor allows any ${maj}.x.x version.`)
      }
    } else if (/^\d+\.(x|\*)/i.test(part) || /^\d+$/.test(part)) {
      out.push(`${part} is a wildcard: any version matching the fixed numbers.`)
    } else if (/\s-\s/.test(part)) {
      out.push(`${part} is a hyphen range: inclusive on both ends.`)
    }
  }
  return out
}

export type SortResult = { sorted: string[]; invalid: string[] }

export function sortVersions(list: string, desc = false): SortResult {
  const items = list.split(/[\s,]+/).filter(Boolean)
  const valid: string[] = []
  const invalid: string[] = []
  for (const it of items) (semver.valid(it, { loose: true }) ? valid : invalid).push(it)
  const sorted = [...valid].sort((a, b) => semver.compare(a, b, { loose: true }))
  return { sorted: desc ? sorted.reverse() : sorted, invalid }
}
