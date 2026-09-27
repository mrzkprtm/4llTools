import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const ALGORITHMS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const

export default function HashGenerator() {
  const [input, setInput] = useState('')
  const [inputType, setInputType] = useState<'text' | 'file'>('text')
  const [file, setFile] = useState<File | null>(null)
  const [selectedAlgos, setSelectedAlgos] = useState<typeof ALGORITHMS[number][]>(['MD5', 'SHA-256', 'SHA-512'])
  const [compareHash, setCompareHash] = useState('')
  const [hashResults, setHashResults] = useState<Record<string, string>>({})

  useEffect(() => {
    computeHashes()
  }, [input, file, selectedAlgos, inputType])

  const computeHashes = async () => {
    if (!input && !file) {
      setHashResults({})
      return
    }

    const results: Record<string, string> = {}
    let data: string | ArrayBuffer

    if (inputType === 'file' && file) {
      data = await file.arrayBuffer()
    } else {
      data = input
    }

    for (const algo of selectedAlgos) {
      try {
        const hash = await computeHash(data, algo)
        results[algo] = hash
      } catch (e) {
        results[algo] = 'Error'
      }
    }
    setHashResults(results)
  }

  const computeHash = async (data: string | ArrayBuffer, algorithm: typeof ALGORITHMS[number]): Promise<string> => {
    const encoder = new TextEncoder()
    const buffer = typeof data === 'string' ? encoder.encode(data) : new Uint8Array(data)
    const hashBuffer = await crypto.subtle.digest(algorithm, buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFile(file)
      setInputType('file')
    }
  }

  const copyHash = (algo: string) => {
    navigator.clipboard.writeText(hashResults[algo])
  }

  const compare = () => {
    if (!compareHash) return
    const matches = Object.entries(hashResults).filter(([_, hash]) => hash.toLowerCase() === compareHash.toLowerCase())
    if (matches.length > 0) {
      alert(`Match found: ${matches.map(([algo]) => algo).join(', ')}`)
    } else {
      alert('No match found')
    }
  }

  const download = () => {
    const lines = Object.entries(hashResults).map(([algo, hash]) => `${algo}: ${hash}`)
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hashes-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Hash Generator</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>Input Type</span>
          <div className="row" style={{ gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="radio" name="inputType" value="text" checked={inputType === 'text'} onChange={() => { setInputType('text'); setFile(null) }} />
              <span>Text</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="radio" name="inputType" value="file" checked={inputType === 'file'} onChange={() => setInputType('file')} />
              <span>File</span>
            </label>
          </div>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
          <span>Algorithms</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ALGORITHMS.map(algo => (
              <label key={algo} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', background: selectedAlgos.includes(algo) ? 'var(--accent)20' : 'var(--bg)' }}>
                <input type="checkbox" checked={selectedAlgos.includes(algo)} onChange={e => setSelectedAlgos(e.target.checked ? [...selectedAlgos, algo] : selectedAlgos.filter(a => a !== algo))} />
                <span style={{ fontSize: '0.85rem' }}>{algo}</span>
              </label>
            ))}
          </div>
        </label>
      </div>

      <div style={{ marginBottom: 16 }}>
        {inputType === 'text' ? (
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Enter text to hash..."
            rows={6}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: 8, fontFamily: 'var(--mono)', fontSize: '0.9rem', resize: 'vertical' }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input type="file" onChange={handleFileChange} style={{ display: 'none' }} id="fileInput" />
            <label htmlFor="fileInput" className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {file ? `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)` : 'Choose File'}
            </label>
            {file && <span className="muted" style={{ fontSize: '0.85rem' }}>{file.name} • ${(file.size / 1024).toFixed(1)} KB</span>}
          </div>
        )}
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => { if (inputType === 'file' && file) computeHashes() }}>Compute Hashes</button>
        <button className="btn" onClick={download}>Download Results</button>
        <button className="btn" onClick={() => { setInput(''); setFile(null); setHashResults({}) }}>Clear</button>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {selectedAlgos.map((algo, i) => {
          const hash = hashResults[algo]
          return hash ? (
            <div key={algo} className="pop-row" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12,
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 40}ms`,
            }}>
              <div className="row" style={{ gap: 12, alignItems: 'center', flex: 1 }}>
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{algo}</span>
                <span className="muted" style={{ fontSize: '0.75rem' }}>{hash.length} chars</span>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn" onClick={() => copyHash(algo)} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>Copy</button>
                <button className="btn" onClick={() => navigator.clipboard.writeText(`${algo}: ${hash}`)} style={{ padding: '4px 10px', fontSize: '0.7rem' }}>Copy with Label</button>
              </div>
            </div>
          ) : null
        })}
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: 16 }}>
        <h4 style={{ margin: '0 0 12px' }}>Compare / Verify Hash</h4>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input type="text" placeholder="Paste hash to compare/verify" value={compareHash} onChange={e => setCompareHash(e.target.value)} style={{ flex: 1, minWidth: 300 }} />
          <button className="btn" onClick={compare} disabled={!compareHash}>Compare</button>
        </div>
        {compareHash && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(hashResults).map(([algo, hash]) => (
              <span key={algo} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 4, background: hash.toLowerCase() === compareHash.toLowerCase() ? 'var(--ok)20' : 'var(--danger)20', color: hash.toLowerCase() === compareHash.toLowerCase() ? 'var(--ok)' : 'var(--danger)' }}>
                {algo}: {hash.toLowerCase() === compareHash.toLowerCase() ? '✓ MATCH' : '✗ No Match'}
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Generate MD5, SHA-1, SHA-256, SHA-384, SHA-512 hashes for text or files. Compare hashes to verify integrity. Works entirely in browser.
      </p>
    </div>
  )
}