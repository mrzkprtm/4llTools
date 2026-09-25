import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Roll from '../../motion/Roll'
import {
  compressIPv6, containsIPv4, containsIPv6, expandIPv6, formatIPv4, groupDigits, ipv4Info, ipv6Info, parseIPv4, parseIPv4Cidr,
  parseIPv6, parseIPv6Cidr, prefixForSubnets, prefixToMask, splitIPv4, toBinary,
} from './subnet'

const LIMIT = 256
const scroll = { overflowX: 'auto' as const }

function Row({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <tr>
      <th style={{ whiteSpace: 'nowrap' }}>{label}</th>
      <td style={{ fontFamily: mono ? 'var(--mono)' : undefined, wordBreak: 'break-all' }}>{value}</td>
    </tr>
  )
}

export default function SubnetCalculator() {
  const [input, setInput] = useState('192.168.1.10/24')
  const [check, setCheck] = useState('192.168.1.200')
  const [splitMode, setSplitMode] = useState<'prefix' | 'count'>('count')
  const [splitValue, setSplitValue] = useState('4')
  const [showTable, setShowTable] = useState(false)

  const isV6 = input.includes(':')
  const parsed4 = isV6 ? null : parseIPv4Cidr(input)
  const parsed6 = isV6 ? parseIPv6Cidr(input) : null
  const error = (parsed4 && 'error' in parsed4 && parsed4.error) || (parsed6 && 'error' in parsed6 && parsed6.error) || ''
  const info4 = parsed4 && !('error' in parsed4) ? ipv4Info(parsed4.ip, parsed4.prefix) : null
  const info6 = parsed6 && !('error' in parsed6) ? ipv6Info(parsed6.ip, parsed6.prefix) : null

  // membership check
  let checkResult: { ok: boolean; text: string } | null = null
  if (check.trim() && (info4 || info6)) {
    if (info4) {
      const ip = parseIPv4(check)
      checkResult = ip === null ? { ok: false, text: 'Not a valid IPv4 address.' } : containsIPv4(info4, ip) ? { ok: true, text: `${check.trim()} is inside ${formatIPv4(info4.network)}/${info4.prefix}.` } : { ok: false, text: `${check.trim()} is outside ${formatIPv4(info4.network)}/${info4.prefix}.` }
    } else if (info6) {
      const ip = parseIPv6(check)
      checkResult = ip === null ? { ok: false, text: 'Not a valid IPv6 address.' } : containsIPv6(info6, ip) ? { ok: true, text: `Inside ${compressIPv6(info6.network)}/${info6.prefix}.` } : { ok: false, text: `Outside ${compressIPv6(info6.network)}/${info6.prefix}.` }
    }
  }

  // split
  let split: ReturnType<typeof splitIPv4> | null = null
  let splitError = ''
  let newPrefix: number | null = null
  if (info4) {
    const n = Number(splitValue)
    if (!/^\d+$/.test(splitValue.trim())) splitError = 'Enter a whole number.'
    else if (splitMode === 'count') {
      newPrefix = prefixForSubnets(info4.prefix, n)
      if (newPrefix === null) splitError = n < 1 ? 'Enter at least 1.' : `A /${info4.prefix} cannot be split into ${n} subnets.`
    } else {
      newPrefix = n
      if (n < info4.prefix || n > 32) splitError = `The new prefix must be between /${info4.prefix} and /32.`
    }
    if (!splitError && newPrefix !== null) split = splitIPv4(info4.network, info4.prefix, newPrefix, LIMIT)
  }

  const rows4 = info4
    ? ([
        ['Address', formatIPv4(info4.ip)],
        ['Network', `${formatIPv4(info4.network)}/${info4.prefix}`],
        ['Netmask', formatIPv4(info4.mask)],
        ['Wildcard', formatIPv4(info4.wildcard)],
        ['Broadcast', info4.prefix >= 31 ? 'None (/31 and /32 have no broadcast)' : formatIPv4(info4.broadcast)],
        ['First host', formatIPv4(info4.firstHost)],
        ['Last host', formatIPv4(info4.lastHost)],
        ['Host range', `${formatIPv4(info4.firstHost)} – ${formatIPv4(info4.lastHost)}`],
        ['Usable hosts', groupDigits(info4.usable)],
        ['Total addresses', groupDigits(info4.total)],
        ['Class', info4.ipClass],
        ['Type', info4.type],
        ['Hex', '0x' + info4.ip.toString(16).padStart(8, '0').toUpperCase()],
      ] as const)
    : []

  return (
    <div>
      <label htmlFor="sub-in">IP address with CIDR or mask (IPv4 or IPv6)</label>
      <input id="sub-in" type="text" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} placeholder="192.168.1.10/24, 10.0.0.1 255.255.0.0 or 2001:db8::1/64" style={{ fontFamily: 'var(--mono)' }} />
      <div className="row">
        {['192.168.1.10/24', '10.0.0.0/8', '172.16.5.4/255.255.240.0', '10.0.0.0/31', '2001:db8:abcd:12::1/64'].map((ex) => (
          <button key={ex} type="button" className="btn" style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem', padding: '5px 9px' }} onClick={() => setInput(ex)}>{ex}</button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}

      {info4 && (
        <>
          <div className="stats">
            <div className="stat"><b><Roll>{groupDigits(info4.usable)}</Roll></b>Usable hosts</div>
            <div className="stat"><b><Roll>{`/${info4.prefix}`}</Roll></b>{formatIPv4(info4.mask)}</div>
            <div className="stat"><b>{info4.ipClass.split(' ')[0]}</b>Class · {info4.type}</div>
          </div>
          <div style={{ ...scroll, marginTop: 14 }}>
            <table className="simple">
              <tbody>{rows4.map(([k, v]) => <Row key={k} label={k} value={v} />)}</tbody>
            </table>
          </div>
          <div className="row">
            <CopyButton label="Copy summary" text={rows4.map(([k, v]) => `${k}: ${v}`).join('\n')} />
          </div>

          <label>Binary</label>
          <div className="output" style={{ ...scroll, wordBreak: 'normal', whiteSpace: 'pre', lineHeight: 1.7 }}>
            {[['Address ', info4.ip], ['Netmask ', info4.mask], ['Network ', info4.network], ['Broadcast', info4.broadcast]].map(([k, v]) => {
              const bin = toBinary(v as number)
              // highlight the network part
              let seen = 0
              let cut = bin.length
              for (let i = 0; i < bin.length; i++) {
                if (bin[i] === '.') continue
                if (seen === info4.prefix) { cut = i; break }
                seen++
              }
              return (
                <div key={k as string}>
                  <span className="muted">{(k as string).padEnd(10)}</span>
                  {[...bin].map((ch, i) => (
                    <span key={`${i}:${ch}`} className="flip-in bin-bit" style={i < cut ? { color: 'var(--accent)', fontWeight: 600 } : undefined}>{ch}</span>
                  ))}
                </div>
              )
            })}
          </div>
          <div className="bar" style={{ marginTop: 10 }} role="img" aria-label={`${info4.prefix} network bits, ${32 - info4.prefix} host bits`}>
            <i style={{ transform: `scaleX(${info4.prefix / 32})` }} />
          </div>
          <p className="muted" style={{ fontSize: '0.85rem' }}>Highlighted bits are the network part; the rest identifies hosts.</p>
        </>
      )}

      {info6 && (
        <>
          <div className="stats">
            <div className="stat"><b><Roll>{`/${info6.prefix}`}</Roll></b>Prefix</div>
            <div className="stat"><b style={{ fontSize: '1.1rem', paddingTop: 6 }}>{info6.type}</b>Type</div>
          </div>
          <div style={{ ...scroll, marginTop: 14 }}>
            <table className="simple">
              <tbody>
                <Row label="Compressed" value={compressIPv6(info6.ip)} />
                <Row label="Expanded" value={expandIPv6(info6.ip)} />
                <Row label="Network" value={`${compressIPv6(info6.network)}/${info6.prefix}`} />
                <Row label="First address" value={expandIPv6(info6.network)} />
                <Row label="Last address" value={expandIPv6(info6.last)} />
                <Row label="Addresses" value={`${groupDigits(info6.count)} (2^${128 - info6.prefix})`} />
                {info6.prefix <= 64 && <Row label="/64 subnets" value={groupDigits(1n << BigInt(64 - info6.prefix))} />}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: '0.85rem' }}>IPv6 has no broadcast address; all addresses in the prefix are usable. Subnet splitting is available for IPv4.</p>
        </>
      )}

      {(info4 || info6) && (
        <>
          <label htmlFor="sub-check">Is this IP inside the range?</label>
          <input id="sub-check" type="text" value={check} onChange={(e) => setCheck(e.target.value)} spellCheck={false} style={{ fontFamily: 'var(--mono)' }} />
          {checkResult && <p className={checkResult.ok ? 'ok' : 'error'} style={{ margin: '6px 0 0' }}>{checkResult.ok ? '✓ ' : '✗ '}{checkResult.text}</p>}
        </>
      )}

      {info4 && (
        <>
          <label>Split into subnets</label>
          <div className="row" style={{ marginTop: 0 }}>
            <select value={splitMode} onChange={(e) => setSplitMode(e.target.value as 'prefix' | 'count')} style={{ width: 'auto' }} aria-label="Split by">
              <option value="count">Number of subnets</option>
              <option value="prefix">New prefix length</option>
            </select>
            <input type="number" min={splitMode === 'count' ? 1 : info4.prefix} max={splitMode === 'count' ? undefined : 32} value={splitValue} onChange={(e) => setSplitValue(e.target.value)} style={{ width: 110 }} aria-label="Split value" />
          </div>
          {splitError && <p className="error">{splitError}</p>}
          {split && newPrefix !== null && (
            <>
              <p className="muted" style={{ margin: '4px 0 8px' }}>
                {groupDigits(split.count)} subnet{split.count === 1 ? '' : 's'} of /{newPrefix} ({formatIPv4(prefixToMask(newPrefix))}), {groupDigits(ipv4Info(0, newPrefix).usable)} usable hosts each.
                {split.count > LIMIT && ` Showing the first ${LIMIT}.`}
              </p>
              <div style={{ ...scroll, maxHeight: 420, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                <table className="simple" style={{ minWidth: 520 }}>
                  <thead><tr><th>#</th><th>Network</th><th>Host range</th><th>Broadcast</th></tr></thead>
                  <tbody>
                    {split.subnets.map((s, i) => (
                      <tr key={s.network}>
                        <td>{i + 1}</td>
                        <td style={{ fontFamily: 'var(--mono)' }}>{formatIPv4(s.network)}/{s.prefix}</td>
                        <td style={{ fontFamily: 'var(--mono)' }}>{formatIPv4(s.firstHost)} – {formatIPv4(s.lastHost)}</td>
                        <td style={{ fontFamily: 'var(--mono)' }}>{s.prefix >= 31 ? '—' : formatIPv4(s.broadcast)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      <div className="row">
        <button type="button" className="btn" onClick={() => setShowTable(!showTable)}>{showTable ? 'Hide' : 'Show'} CIDR ↔ mask table</button>
      </div>
      {showTable && (
        <div style={{ ...scroll, maxHeight: 420, overflowY: 'auto' }}>
          <table className="simple" style={{ minWidth: 420 }}>
            <thead><tr><th>CIDR</th><th>Netmask</th><th>Wildcard</th><th>Addresses</th><th>Usable</th></tr></thead>
            <tbody>
              {Array.from({ length: 33 }, (_, p) => 32 - p).map((p) => {
                const i = ipv4Info(0, p)
                return (
                  <tr key={p} style={info4?.prefix === p ? { background: 'var(--accent-soft)' } : undefined}>
                    <td style={{ fontFamily: 'var(--mono)' }}>/{p}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{formatIPv4(i.mask)}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{formatIPv4(i.wildcard)}</td>
                    <td>{groupDigits(i.total)}</td>
                    <td>{groupDigits(i.usable)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
