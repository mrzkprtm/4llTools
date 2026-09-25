import { describe, expect, it } from 'vitest'
import {
  compressIPv6, containsIPv4, containsIPv6, expandIPv6, formatIPv4, ipv4Info, ipv6Info, maskToPrefix, parseIPv4, parseIPv4Cidr,
  parseIPv6, parseIPv6Cidr, prefixForSubnets, prefixToMask, splitIPv4, toBinary,
} from './subnet'

const v4 = (s: string) => {
  const r = parseIPv4Cidr(s)
  if ('error' in r) throw new Error(r.error)
  return ipv4Info(r.ip, r.prefix)
}

describe('ipv4', () => {
  it('parses and formats addresses', () => {
    expect(parseIPv4('192.168.1.10')).toBe(0xc0a8010a)
    expect(formatIPv4(parseIPv4('255.255.255.255')!)).toBe('255.255.255.255')
    expect(parseIPv4('256.1.1.1')).toBeNull()
    expect(parseIPv4('1.2.3')).toBeNull()
    expect(parseIPv4('1.2.3.x')).toBeNull()
  })

  it('computes a /24', () => {
    const i = v4('192.168.1.10/24')
    expect(formatIPv4(i.network)).toBe('192.168.1.0')
    expect(formatIPv4(i.broadcast)).toBe('192.168.1.255')
    expect(formatIPv4(i.firstHost)).toBe('192.168.1.1')
    expect(formatIPv4(i.lastHost)).toBe('192.168.1.254')
    expect(formatIPv4(i.mask)).toBe('255.255.255.0')
    expect(formatIPv4(i.wildcard)).toBe('0.0.0.255')
    expect(i.usable).toBe(254)
    expect(i.ipClass).toBe('C')
    expect(i.type).toMatch(/Private/)
  })

  it('accepts a dotted mask', () => {
    expect(v4('10.1.2.3 255.255.0.0').prefix).toBe(16)
    expect(v4('10.1.2.3/255.255.255.192').prefix).toBe(26)
    expect(parseIPv4Cidr('10.1.2.3/255.0.255.0')).toHaveProperty('error')
    expect(parseIPv4Cidr('10.1.2.3/33')).toHaveProperty('error')
  })

  it('handles /31, /32 and /0', () => {
    const p31 = v4('10.0.0.1/31')
    expect(p31.usable).toBe(2)
    expect(formatIPv4(p31.firstHost)).toBe('10.0.0.0')
    expect(formatIPv4(p31.lastHost)).toBe('10.0.0.1')
    const p32 = v4('8.8.8.8')
    expect(p32.prefix).toBe(32)
    expect(p32.usable).toBe(1)
    expect(p32.type).toBe('Public')
    const p0 = v4('1.2.3.4/0')
    expect(p0.total).toBe(2 ** 32)
    expect(formatIPv4(p0.broadcast)).toBe('255.255.255.255')
  })

  it('converts masks', () => {
    for (let p = 0; p <= 32; p++) expect(maskToPrefix(prefixToMask(p))).toBe(p)
    expect(toBinary(prefixToMask(20))).toBe('11111111.11111111.11110000.00000000')
  })

  it('classifies special ranges', () => {
    expect(v4('127.0.0.1').type).toBe('Loopback')
    expect(v4('100.64.1.1').type).toMatch(/NAT/)
    expect(v4('172.31.255.255').type).toMatch(/Private/)
    expect(v4('172.32.0.1').type).toBe('Public')
    expect(v4('224.0.0.1').ipClass).toMatch(/D/)
  })

  it('splits and checks membership', () => {
    const i = v4('192.168.0.0/24')
    const { count, subnets } = splitIPv4(i.network, i.prefix, 26)
    expect(count).toBe(4)
    expect(subnets.map((s) => formatIPv4(s.network))).toEqual(['192.168.0.0', '192.168.0.64', '192.168.0.128', '192.168.0.192'])
    expect(splitIPv4(0, 8, 30, 10).subnets).toHaveLength(10)
    expect(prefixForSubnets(24, 5)).toBe(27)
    expect(containsIPv4(i, parseIPv4('192.168.0.200')!)).toBe(true)
    expect(containsIPv4(i, parseIPv4('192.168.1.1')!)).toBe(false)
  })
})

describe('ipv6', () => {
  it('parses, expands and compresses', () => {
    const n = parseIPv6('2001:db8::1')!
    expect(expandIPv6(n)).toBe('2001:0db8:0000:0000:0000:0000:0000:0001')
    expect(compressIPv6(n)).toBe('2001:db8::1')
    expect(compressIPv6(parseIPv6('2001:0db8:0:1:0:0:0:1')!)).toBe('2001:db8:0:1::1')
    expect(compressIPv6(parseIPv6('2001:db8:0:0:1:0:0:1')!)).toBe('2001:db8::1:0:0:1')
    expect(compressIPv6(0n)).toBe('::')
    expect(compressIPv6(parseIPv6('::ffff:192.168.1.1')!)).toBe('::ffff:c0a8:101')
    expect(parseIPv6('1::2::3')).toBeNull()
    expect(parseIPv6('12345::')).toBeNull()
    expect(parseIPv6('1:2:3:4:5:6:7:8:9')).toBeNull()
  })

  it('computes prefix ranges', () => {
    const r = parseIPv6Cidr('2001:db8:abcd:12::5/64')
    if ('error' in r) throw new Error(r.error)
    const i = ipv6Info(r.ip, r.prefix)
    expect(compressIPv6(i.network)).toBe('2001:db8:abcd:12::')
    expect(compressIPv6(i.last)).toBe('2001:db8:abcd:12:ffff:ffff:ffff:ffff')
    expect(i.count).toBe(2n ** 64n)
    expect(i.type).toBe('Documentation')
    expect(containsIPv6(i, parseIPv6('2001:db8:abcd:12:1::')!)).toBe(true)
    expect(containsIPv6(i, parseIPv6('2001:db8:abcd:13::')!)).toBe(false)
    expect(ipv6Info(parseIPv6('fe80::1')!, 128).type).toBe('Link-local')
    expect(parseIPv6Cidr('::1/129')).toHaveProperty('error')
  })
})
