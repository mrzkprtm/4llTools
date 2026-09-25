/** A Unix permission mode, 0 to 0o7777 (special bits + owner/group/others). */
export type Mode = number

export const WHO = ['owner', 'group', 'others'] as const
export const PERMS = ['read', 'write', 'execute'] as const
export const SPECIAL = ['setuid', 'setgid', 'sticky'] as const

/** Bit for a who × perm cell. */
export function bit(who: number, perm: number): number {
  return 1 << ((2 - who) * 3 + (2 - perm))
}

export const SPECIAL_BITS = { setuid: 0o4000, setgid: 0o2000, sticky: 0o1000 } as const

/** "755" or "4755"; the leading special digit only appears when it is non-zero (or `four` is set). */
export function toOctal(mode: Mode, four = false): string {
  const s = (mode & 0o7777).toString(8)
  return four || mode > 0o777 ? s.padStart(4, '0') : s.padStart(3, '0')
}

export function parseOctal(input: string): Mode | null {
  const s = input.trim()
  if (!/^[0-7]{3,4}$/.test(s)) return null
  return parseInt(s, 8)
}

/** Nine-character symbolic form like rwsr-xr-t, using s/S/t/T for special bits. */
export function toSymbolic(mode: Mode): string {
  let out = ''
  for (let w = 0; w < 3; w++) {
    out += mode & bit(w, 0) ? 'r' : '-'
    out += mode & bit(w, 1) ? 'w' : '-'
    const x = mode & bit(w, 2)
    const special = w === 0 ? mode & 0o4000 : w === 1 ? mode & 0o2000 : mode & 0o1000
    const letter = w === 2 ? 't' : 's'
    out += special ? (x ? letter : letter.toUpperCase()) : x ? 'x' : '-'
  }
  return out
}

/**
 * Parses rwxr-xr-x, or ls -l style with a leading file-type character
 * (-rwxr-xr-x, drwxrwxrwt) and an optional trailing ACL/xattr marker (+ . @).
 */
export function parseSymbolic(input: string): Mode | null {
  let s = input.trim()
  if (s.length === 11 && /[+.@]$/.test(s)) s = s.slice(0, 10)
  if (s.length === 10) {
    if (!/^[-dlcbps]/.test(s)) return null
    s = s.slice(1)
  }
  if (s.length !== 9) return null
  let mode = 0
  for (let w = 0; w < 3; w++) {
    const [r, wr, x] = s.slice(w * 3, w * 3 + 3)
    if (r === 'r') mode |= bit(w, 0)
    else if (r !== '-') return null
    if (wr === 'w') mode |= bit(w, 1)
    else if (wr !== '-') return null
    const letter = w === 2 ? 't' : 's'
    const special = w === 0 ? 0o4000 : w === 1 ? 0o2000 : 0o1000
    if (x === 'x') mode |= bit(w, 2)
    else if (x === letter) mode |= bit(w, 2) | special
    else if (x === letter.toUpperCase()) mode |= special
    else if (x !== '-') return null
  }
  return mode
}

/** `u=rwx,g=rx,o=rx`, with s/t for special bits (u=rwxs, g=rxs, o=rxt). */
export function toChmodSymbolic(mode: Mode): string {
  const parts = ['u', 'g', 'o'].map((who, w) => {
    let p = ''
    if (mode & bit(w, 0)) p += 'r'
    if (mode & bit(w, 1)) p += 'w'
    if (mode & bit(w, 2)) p += 'x'
    if (w === 0 && mode & 0o4000) p += 's'
    if (w === 1 && mode & 0o2000) p += 's'
    if (w === 2 && mode & 0o1000) p += 't'
    return `${who}=${p}`
  })
  return parts.join(',')
}

export function explain(mode: Mode): string[] {
  const notes: string[] = []
  const names = ['Owner', 'Group', 'Others']
  for (let w = 0; w < 3; w++) {
    const can = PERMS.filter((_, p) => mode & bit(w, p))
    notes.push(`${names[w]} can ${can.length ? can.join(', ') : 'do nothing'}.`)
  }
  if (mode & 0o4000) notes.push('setuid: an executable runs with the file owner’s privileges.')
  if (mode & 0o2000) notes.push('setgid: runs with the group’s privileges; on a directory, new files inherit its group.')
  if (mode & 0o1000) notes.push('sticky: in a shared directory, only a file’s owner can delete or rename it (like /tmp).')
  return notes
}

export function warnings(mode: Mode): string[] {
  const w: string[] = []
  if (mode & 0o002) w.push('Anyone on the system can modify this file (world-writable). Avoid this unless it is a sticky shared directory.')
  if (mode & 0o4000 && !(mode & 0o100)) w.push('setuid is set but the owner cannot execute (shown as S), so it has no effect.')
  if (mode & 0o2000 && !(mode & 0o010)) w.push('setgid is set without group execute (shown as S); on a file this usually means mandatory locking, not privileges.')
  if (mode & 0o1000 && !(mode & 0o001)) w.push('sticky is set without others execute (shown as T).')
  return w
}

export const PRESETS: { mode: string; label: string; warn?: boolean }[] = [
  { mode: '644', label: 'Regular file (rw-r--r--)' },
  { mode: '755', label: 'Script / directory (rwxr-xr-x)' },
  { mode: '600', label: 'Private file, e.g. SSH key' },
  { mode: '700', label: 'Private directory / script' },
  { mode: '640', label: 'Owner rw, group read' },
  { mode: '775', label: 'Shared group directory' },
  { mode: '777', label: 'Everyone everything (unsafe)', warn: true },
  { mode: '1777', label: 'Shared temp dir like /tmp' },
  { mode: '2755', label: 'setgid directory' },
  { mode: '4755', label: 'setuid binary like passwd' },
]
