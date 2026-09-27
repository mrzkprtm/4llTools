import { useState, useEffect } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

export default function Base64Encoder() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [inputType, setInputType] = useState<'text' | 'file'>('text')
  const [file, setFile] = useState<File | null>(null)
  const [urlSafe, setUrlSafe] = useState(false)

  useEffect(() => {
    if (inputType === 'file' && file) {
      const reader = new FileReader()
      reader.onload = e => {
        const arrayBuffer = e.target?.result as ArrayBuffer
        const bytes = new Uint8Array(arrayBuffer)
        if (mode === 'encode') {
          let binary = ''
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i])
          }
          let b64 = btoa(binary)
          if (urlSafe) {
            b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
          }
          setOutput(b64)
        } else {
          try {
            let b64 = input
            if (urlSafe) {
              b64 = b64.replace(/-/g, '+').replace(/_/g, '/')
              while (b64.length % 4) b64 += '='
            }
            const binary = atob(b64)
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i)
            }
            setOutput(new TextDecoder().decode(bytes))
          } catch (e) {
            setOutput('Error: Invalid Base64')
          }
        }
      }
      reader.readAsArrayBuffer(file)
    } else if (inputType === 'text') {
      if (mode === 'encode') {
        try {
          let b64 = btoa(unescape(encodeURIComponent(input)))
          if (urlSafe) {
            b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
          }
          setOutput(b64)
        } catch {
          setOutput('Error: Invalid input')
        }
      } else {
        try {
          let b64 = input
          if (urlSafe) {
            b64 = b64.replace(/-/g, '+').replace(/_/g, '/')
            while (b64.length % 4) b64 += '='
          }
          const decoded = decodeURIComponent(escape(atob(b64)))
          setOutput(decoded)
        } catch {
          setOutput('Error: Invalid Base64')
        }
      }
    }
  }, [input, file, mode, urlSafe, inputType])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setFile(file)
  }

  const swap = () => {
    setMode(m => m === 'encode' ? 'decode' : 'encode')
    const temp = input
    setInput(output)
    setOutput(temp)
  }

  const copyOutput = () => {
    navigator.clipboard.writeText(output)
  }

  const download = () => {
    const blob = new Blob([output], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `base64-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Base64 Encoder/Decoder</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>Mode</span>
          <div className="row" style={{ gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="radio" name="mode" value="encode" checked={mode === 'encode'} onChange={() => setMode('encode')} />
              <span>Encode</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="radio" name="mode" value="decode" checked={mode === 'decode'} onChange={() => setMode('decode')} />
              <span>Decode</span>
            </label>
          </div>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
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
        <label style={{ display: 'flex', alignItems: 'flex-end', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={urlSafe} onChange={e => setUrlSafe(e.target.checked)} />
          <span>URL-Safe (no padding, -/_)</span>
        </label>
      </div>

      <div style={{ marginBottom: 16 }}>
        {inputType === 'text' ? (
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={mode === 'encode' ? 'Enter text to encode...' : 'Paste Base64 to decode...'}
            rows={6}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: 8, fontFamily: 'var(--mono)', fontSize: '0.9rem', resize: 'vertical' }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input type="file" onChange={handleFileChange} style={{ display: 'none' }} id="b64FileInput" />
            <label htmlFor="b64FileInput" className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {file ? `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)` : 'Choose File'}
            </label>
            {file && <span className="muted" style={{ fontSize: '0.85rem' }}>{file.name} • ${(file.size / 1024).toFixed(1)} KB</span>}
          </div>
        )}
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn" onClick={swap} style={{ background: 'var(--accent)' }}>
          {mode === 'encode' ? '↔ Swap to Decode' : '↔ Swap to Encode'}
        </button>
        <button className="btn" onClick={copyOutput}>Copy Output</button>
        <button className="btn" onClick={download}>Download</button>
        <button className="btn" onClick={() => { setInput(''); setOutput(''); setFile(null) }}>Clear</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>Output</span>
          <textarea
            value={output}
            readOnly
            rows={6}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: 8, fontFamily: 'var(--mono)', fontSize: '0.9rem', resize: 'vertical' }}
          />
        </label>
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <h4 style={{ margin: '0 0 12px' }}>Info</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: '0.85rem' }}>
          <div><span className="muted">Input Length:</span> <b>{input.length}</b></div>
          <div><span className="muted">Output Length:</span> <b>{output.length}</b></div>
          <div><span className="muted">URL-Safe:</span> <b>{urlSafe ? 'Yes' : 'No'}</b></div>
          <div><span className="muted">Mode:</span> <b>{mode === 'encode' ? 'Encode' : 'Decode'}</b></div>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Encode text/files to Base64 or decode Base64 back to text. UTF-8 support. URL-safe variant replaces +/ with -/_ and removes padding.
      </p>
    </div>
  )
}