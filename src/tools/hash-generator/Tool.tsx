import { useEffect, useState } from 'react'
import Busy from '../../components/Busy'
import CopyButton from '../../components/CopyButton'
import { Scramble } from '../../motion/useScramble'
import { ALGORITHMS, hashBytes, type Algorithm } from './hash'

type Source = { kind: 'text'; text: string } | { kind: 'file'; name: string; data: ArrayBuffer }

export default function HashGenerator() {
  const [source, setSource] = useState<Source>({ kind: 'text', text: '' })
  const [hashes, setHashes] = useState<Partial<Record<Algorithm, string>>>({})
  const [upper, setUpper] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const data = source.kind === 'text' ? new TextEncoder().encode(source.text) : source.data
    // Only big inputs take long enough for a "hashing" line to be worth showing.
    const slow = data.byteLength > 1_000_000
    setBusy(slow)
    Promise.all(ALGORITHMS.map((a) => hashBytes(a, data))).then((values) => {
      if (cancelled) return
      setHashes(Object.fromEntries(ALGORITHMS.map((a, i) => [a, values[i]])))
      setBusy(false)
    })
    return () => {
      cancelled = true
    }
  }, [source])

  return (
    <div>
      <label htmlFor="hash-in">Text</label>
      <textarea
        id="hash-in"
        value={source.kind === 'text' ? source.text : ''}
        placeholder={source.kind === 'file' ? `Hashing file: ${source.name}` : 'Type or paste text…'}
        onChange={(e) => setSource({ kind: 'text', text: e.target.value })}
        style={{ minHeight: 110 }}
      />
      <label htmlFor="hash-file">Or hash a file</label>
      <input
        id="hash-file"
        type="file"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (file) setSource({ kind: 'file', name: file.name, data: await file.arrayBuffer() })
          e.target.value = ''
        }}
      />
      <label style={{ fontWeight: 400 }}>
        <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} /> Uppercase
      </label>
      {busy && <Busy label="Hashing file…" />}
      {ALGORITHMS.map((a) => {
        const h = upper ? (hashes[a] ?? '').toUpperCase() : (hashes[a] ?? '')
        return (
          <div key={a}>
            <label>{a}</label>
            <div className="row" style={{ margin: 0, flexWrap: 'nowrap' }}>
              <div className="output" style={{ flex: 1, fontSize: '0.85rem' }}><Scramble text={h} limit={128} duration={220} pool="0123456789abcdef" /></div>
              <CopyButton text={h} />
            </div>
          </div>
        )
      })}
      <p className="muted">MD5 is not included because browsers don't provide it and it is no longer safe.</p>
    </div>
  )
}
