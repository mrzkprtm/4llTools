// ---------- IPv4 ----------

export function parseIPv4(s: string): number | null {
  const parts = s.trim().split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null
    const v = Number(p)
    if (v > 255) return null
    n = n * 256 + v
  }
  return n >>> 0
}

export function formatIPv4(n: number): string {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
}

export function prefixToMask(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
}

/** Prefix length of a contiguous mask, or null when the mask has holes. */
export function maskToPrefix(mask: number): number | null {
  const inv = ~mask >>> 0
  if ((inv & (inv + 1)) !== 0) return null
  let p = 0
  while (p < 32 && mask & (0x80000000 >>> p)) p++
  return p
}

export function toBinary(n: number): string {
  return (n >>> 0).toString(2).padStart(32, '0').replace(/(.{8})(?!$)/g, '$1.')
}

export interface IPv4Info {
  ip: number
  prefix: number
  mask: number
  wildcard: number
  network: number
  broadcast: number
  firstHost: number
  lastHost: number
  /** Total addresses in the block. */
  total: number
  /** Addresses usable by hosts (RFC 3021: /31 has 2, /32 has 1). */
  usable: number
  ipClass: string
  type: string
}

/** Accepts 192.168.1.10/24, 192.168.1.10/255.255.255.0, "192.168.1.10 255.255.255.0" or a bare IP (/32). */
export function parseIPv4Cidr(input: string): { ip: number; prefix: number } | { error: string } {
  const s = input.trim()
  if (!s) return { error: 'Enter an IP address like 192.168.1.10/24.' }
  const m = s.match(/^([^\s/]+)(?:\s*\/\s*|\s+)?(\S+)?$/)
  if (!m) return { error: 'Use the form 192.168.1.10/24 or 192.168.1.10 255.255.255.0.' }
  const ip = parseIPv4(m[1])
  if (ip === null) return { error: `“${m[1]}” is not a valid IPv4 address.` }
  if (!m[2]) return { ip, prefix: 32 }
  const suffix = m[2]
  if (/^\d{1,2}$/.test(suffix)) {
    const prefix = Number(suffix)
    if (prefix > 32) return { error: 'The prefix length must be between 0 and 32.' }
    return { ip, prefix }
  }
  const mask = parseIPv4(suffix)
  if (mask === null) return { error: `“${suffix}” is not a prefix length or a subnet mask.` }
  const prefix = maskToPrefix(mask)
  if (prefix === null) return { error: `${suffix} is not a valid subnet mask (the 1 bits must be contiguous).` }
  return { ip, prefix }
}

export function ipClass(ip: number): string {
  const a = ip >>> 24
  if (a < 128) return 'A'
  if (a < 192) return 'B'
  if (a < 224) return 'C'
  if (a < 240) return 'D (multicast)'
  return 'E (reserved)'
}

const SPECIAL_V4: [string, string][] = [
  ['0.0.0.0/8', 'This network (unspecified)'],
  ['10.0.0.0/8', 'Private (RFC 1918)'],
  ['100.64.0.0/10', 'Carrier-grade NAT (RFC 6598)'],
  ['127.0.0.0/8', 'Loopback'],
  ['169.254.0.0/16', 'Link-local (APIPA)'],
  ['172.16.0.0/12', 'Private (RFC 1918)'],
  ['192.0.0.0/24', 'IETF protocol assignments'],
  ['192.0.2.0/24', 'Documentation (TEST-NET-1)'],
  ['192.88.99.0/24', '6to4 relay anycast (deprecated)'],
  ['192.168.0.0/16', 'Private (RFC 1918)'],
  ['198.18.0.0/15', 'Benchmarking (RFC 2544)'],
  ['198.51.100.0/24', 'Documentation (TEST-NET-2)'],
  ['203.0.113.0/24', 'Documentation (TEST-NET-3)'],
  ['224.0.0.0/4', 'Multicast'],
  ['255.255.255.255/32', 'Limited broadcast'],
  ['240.0.0.0/4', 'Reserved (future use)'],
]

export function ipType(ip: number): string {
  for (const [cidr, name] of SPECIAL_V4) {
    const [net, p] = cidr.split('/')
    const mask = prefixToMask(Number(p))
    if (((ip & mask) >>> 0) === parseIPv4(net)) return name
  }
  return 'Public'
}

export function ipv4Info(ip: number, prefix: number): IPv4Info {
  const mask = prefixToMask(prefix)
  const wildcard = ~mask >>> 0
  const network = (ip & mask) >>> 0
  const broadcast = (network | wildcard) >>> 0
  const total = 2 ** (32 - prefix)
  let firstHost = network + 1
  let lastHost = broadcast - 1
  let usable = total - 2
  if (prefix === 32) {
    firstHost = lastHost = network
    usable = 1
  } else if (prefix === 31) {
    firstHost = network
    lastHost = broadcast
    usable = 2
  }
  return { ip, prefix, mask, wildcard, network, broadcast, firstHost, lastHost, total, usable, ipClass: ipClass(ip), type: ipType(ip) }
}

export function containsIPv4(info: IPv4Info, ip: number): boolean {
  return ((ip & info.mask) >>> 0) === info.network
}

/** Splits a block into subnets of `newPrefix`, returning at most `limit` of them. */
export function splitIPv4(network: number, prefix: number, newPrefix: number, limit = 256): { count: number; subnets: IPv4Info[] } {
  if (newPrefix < prefix || newPrefix > 32) return { count: 0, subnets: [] }
  const count = 2 ** (newPrefix - prefix)
  const size = 2 ** (32 - newPrefix)
  const subnets: IPv4Info[] = []
  for (let i = 0; i < Math.min(count, limit); i++) subnets.push(ipv4Info((network + i * size) >>> 0, newPrefix))
  return { count, subnets }
}

/** Smallest prefix that yields at least `n` subnets from `prefix`. */
export function prefixForSubnets(prefix: number, n: number): number | null {
  if (n < 1) return null
  const bits = Math.ceil(Math.log2(n))
  return prefix + bits <= 32 ? prefix + bits : null
}

// ---------- IPv6 ----------

const MAX128 = (1n << 128n) - 1n

export function parseIPv6(input: string): bigint | null {
  let s = input.trim().toLowerCase()
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1)
  s = s.replace(/%.*$/, '') // zone id
  if (!s || !/^[0-9a-f:.]+$/.test(s)) return null
  // embedded IPv4 at the end
  const v4 = s.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/)
  if (v4) {
    const n = parseIPv4(v4[2])
    if (n === null) return null
    s = `${v4[1]}${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`
  }
  const halves = s.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  let groups: string[]
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length
    if (missing < 1) return null
    groups = [...head, ...Array(missing).fill('0'), ...tail]
  } else {
    groups = head
  }
  if (groups.length !== 8) return null
  let n = 0n
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null
    n = (n << 16n) | BigInt(parseInt(g, 16))
  }
  return n
}

function groupsOf(n: bigint): number[] {
  const out: number[] = []
  for (let i = 7; i >= 0; i--) out.push(Number((n >> BigInt(i * 16)) & 0xffffn))
  return out
}

export function expandIPv6(n: bigint): string {
  return groupsOf(n).map((g) => g.toString(16).padStart(4, '0')).join(':')
}

/** RFC 5952 canonical form: lowercase, longest run (≥2) of zero groups becomes ::. */
export function compressIPv6(n: bigint): string {
  const g = groupsOf(n)
  let bestStart = -1
  let bestLen = 0
  for (let i = 0; i < 8; ) {
    if (g[i] !== 0) { i++; continue }
    let j = i
    while (j < 8 && g[j] === 0) j++
    if (j - i > bestLen && j - i >= 2) { bestStart = i; bestLen = j - i }
    i = j
  }
  const hex = g.map((x) => x.toString(16))
  if (bestStart < 0) return hex.join(':')
  return `${hex.slice(0, bestStart).join(':')}::${hex.slice(bestStart + bestLen).join(':')}`
}

export interface IPv6Info {
  ip: bigint
  prefix: number
  network: bigint
  last: bigint
  count: bigint
  type: string
}

const SPECIAL_V6: [string, string][] = [
  ['::1/128', 'Loopback'],
  ['::/128', 'Unspecified'],
  ['::ffff:0:0/96', 'IPv4-mapped'],
  ['64:ff9b::/96', 'IPv4/IPv6 translation (NAT64)'],
  ['2001:db8::/32', 'Documentation'],
  ['2001::/32', 'Teredo'],
  ['2002::/16', '6to4'],
  ['fc00::/7', 'Unique local (private)'],
  ['fe80::/10', 'Link-local'],
  ['ff00::/8', 'Multicast'],
  ['2000::/3', 'Global unicast'],
]

function mask6(prefix: number): bigint {
  return prefix === 0 ? 0n : (MAX128 << BigInt(128 - prefix)) & MAX128
}

export function ipv6Type(ip: bigint): string {
  for (const [cidr, name] of SPECIAL_V6) {
    const [net, p] = cidr.split('/')
    if ((ip & mask6(Number(p))) === parseIPv6(net)) return name
  }
  return 'Reserved / unassigned'
}

export function parseIPv6Cidr(input: string): { ip: bigint; prefix: number } | { error: string } {
  const [addr, p, extra] = input.trim().split('/')
  if (extra !== undefined) return { error: 'Use the form 2001:db8::1/64.' }
  const ip = parseIPv6(addr)
  if (ip === null) return { error: `“${addr}” is not a valid IPv6 address.` }
  if (p === undefined || p.trim() === '') return { ip, prefix: 128 }
  if (!/^\d{1,3}$/.test(p.trim()) || Number(p) > 128) return { error: 'The IPv6 prefix length must be between 0 and 128.' }
  return { ip, prefix: Number(p) }
}

export function ipv6Info(ip: bigint, prefix: number): IPv6Info {
  const mask = mask6(prefix)
  const network = ip & mask
  const last = network | (~mask & MAX128)
  return { ip, prefix, network, last, count: 1n << BigInt(128 - prefix), type: ipv6Type(ip) }
}

export function containsIPv6(info: IPv6Info, ip: bigint): boolean {
  return (ip & mask6(info.prefix)) === info.network
}

/** 1234567 → "1,234,567" for bigints. */
export function groupDigits(n: bigint | number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
