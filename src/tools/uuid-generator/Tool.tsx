import { useState, useEffect } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface UUID {
  id: string
  version: number
  timestamp?: number
}

export default function UUIDGenerator() {
  const [count, setCount] = useState(10)
  const [version, setVersion] = useState<'v1' | 'v4' | 'v7'>('v4')
  const [format, setFormat] = useState<'standard' | 'compact' | 'urn' | 'braced'>('standard')
  const [uppercase, setUppercase] = useState(false)
  const [separator, setSeparator] = useState('-')
  const [uuids, setUuids] = useState<UUID[]>([])

  useEffect(() => {
    generate()
  }, [count, version])

  const generate = () => {
    const newUuids: UUID[] = []
    for (let i = 0; i < count; i++) {
      newUuids.push(generateUUID(version))
    }
    setUuids(newUuids)
  }

  const generateUUID = (ver: 'v1' | 'v4' | 'v7'): UUID => {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)

    if (ver === 'v4') {
      bytes[6] = (bytes[6] & 0x0f) | 0x40
      bytes[8] = (bytes[8] & 0x3f) | 0x80
    } else if (ver === 'v1') {
      const now = Date.now()
      const timeLow = now & 0xffffffff
      const timeMid = (now >> 32) & 0xffff
      const timeHi = (now >> 48) & 0x0fff | 0x1000
      bytes[0] = (timeLow >>> 24) & 0xff
      bytes[1] = (timeLow >>> 16) & 0xff
      bytes[2] = (timeLow >>> 8) & 0xff
      bytes[3] = timeLow & 0xff
      bytes[4] = (timeMid >>> 8) & 0xff
      bytes[5] = timeMid & 0xff
      bytes[6] = (timeHi >>> 8) & 0xff
      bytes[7] = timeHi & 0xff
      bytes[8] = (bytes[8] & 0x3f) | 0x80
    } else if (ver === 'v7') {
      const now = Date.now()
      let timeMs = BigInt(now)
      const timeBytes = new Uint8Array(6)
      for (let i = 5; i >= 0; i--) {
        timeBytes[i] = Number(timeMs & 0xffn)
        timeMs >>= 8n
      }
      bytes.set(timeBytes, 0)
      bytes[6] = (bytes[6] & 0x0f) | 0x70
      bytes[8] = (bytes[8] & 0x3f) | 0x80
    }

    let uuid = ''
    for (let i = 0; i < 16; i++) {
      if (i === 4 || i === 6 || i === 8 || i === 10) {
        uuid += separator
      }
      uuid += bytes[i].toString(16).padStart(2, '0')
    }

    if (uppercase) uuid = uuid.toUpperCase()

    let formatted = uuid
    if (format === 'compact') formatted = uuid.replace(/-/g, '')
    else if (format === 'urn') formatted = 'urn:uuid:' + uuid
    else if (format === 'braced') formatted = '{' + uuid + '}'

    return { id: formatted, version: ver === 'v1' ? 1 : ver === 'v4' ? 4 : 7, timestamp: ver === 'v1' || ver === 'v7' ? Date.now() : undefined }
  }

  const copyAll = () => {
    navigator.clipboard.writeText(uuids.map(u => u.id).join('\n'))
  }

  const download = () => {
    const blob = new Blob([uuids.map(u => u.id).join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `uuids-${version}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const validate = (uuid: string) => {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return regex.test(uuid)
  }

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>UUID Generator</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <span>Version</span>
          <select value={version} onChange={e => setVersion(e.target.value as any)}>
            <option value="v1">v1 (Time-based)</option>
            <option value="v4">v4 (Random)</option>
            <option value="v7">v7 (Unix TS + Random)</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
          <span>Count</span>
          <input type="number" min={1} max={10000} value={count} onChange={e => setCount(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Format</span>
          <select value={format} onChange={e => setFormat(e.target.value as any)}>
            <option value="standard">Standard (xxxx-xxxx-xxxx-xxxx)</option>
            <option value="compact">Compact (xxxxxxxxxxxxxxxx)</option>
            <option value="urn">URN (urn:uuid:...)</option>
            <option value="braced">Braced {"{...}"}</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
          <span>Separator</span>
          <input type="text" value={separator} onChange={e => setSeparator(e.target.value)} style={{ width: 60 }} />
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-end', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={uppercase} onChange={e => setUppercase(e.target.checked)} />
          <span>Uppercase</span>
        </label>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn" onClick={generate}>Generate</button>
        <button className="btn" onClick={copyAll}>Copy All</button>
        <button className="btn" onClick={download}>Download</button>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b><Roll value={uuids.length} /></b><span className="muted">Generated</span></div>
        <div className="stat"><b>{version.toUpperCase()}</b><span className="muted">Version</span></div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {uuids.map((uuid, i) => (
          <div key={uuid.id} className="pop-row" style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12,
            background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
            animationDelay: `${i * 30}ms`,
          }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '0.9rem', wordBreak: 'break-all', flex: 1 }}>
              {uuid.id}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <span className="muted" style={{ fontSize: '0.75rem' }}>{uuid.version === 1 ? 'v1' : uuid.version === 4 ? 'v4' : 'v7'}</span>
              <span className="muted" style={{ fontSize: '0.75rem' }}>{uuid.timestamp ? new Date(uuid.timestamp).toLocaleString() : 'N/A'}</span>
              <button className="btn" onClick={() => navigator.clipboard.writeText(uuid.id)} style={{ padding: '4px 8px', fontSize: '0.7rem' }}>Copy</button>
              <button className="btn" onClick={() => { const valid = validate(uuid.id); alert(valid ? 'Valid UUID' : 'Invalid UUID') }} style={{ padding: '4px 8px', fontSize: '0.7rem' }}>Validate</button>
            </div>
          </div>
        ))}
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: 16 }}>
        <h4 style={{ margin: '0 0 12px' }}>Validate UUID</h4>
        <div className="row" style={{ gap: 8 }}>
          <input type="text" placeholder="Paste UUID to validate" style={{ flex: 1 }} onKeyDown={e => { if (e.key === 'Enter') { const valid = validate(e.currentTarget.value); alert(valid ? 'Valid UUID ✓' : 'Invalid UUID ✗') } }} />
          <button className="btn" onClick={() => { const input = document.querySelector('input[type="text"]') as HTMLInputElement; const valid = validate(input.value); alert(valid ? 'Valid UUID ✓' : 'Invalid UUID ✗') }}>Validate</button>
        </div>
        <div className="muted" style={{ marginTop: 8, fontSize: '0.85rem' }}>
          Validates standard UUID format (xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx) where M is version (1-5) and N is variant (8,9,a,b).
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Generate UUIDs v1 (time-based), v4 (random), v7 (Unix timestamp + random). v7 is sortable by time. Copy, download, or validate UUIDs.
      </p>
    </div>
  )
}