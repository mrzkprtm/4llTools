import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import SettleOutput from '../../motion/SettleOutput'

export default function UrlEncoder() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [input, setInput] = useState('')

  let output = ''
  let error = ''
  try {
    output = mode === 'encode' ? encodeURIComponent(input) : decodeURIComponent(input.replace(/\+/g, ' '))
  } catch {
    error = 'That text has a broken % sequence and cannot be decoded.'
  }

  return (
    <div>
      <PillRow>
        <button type="button" className={`btn ${mode === 'encode' ? 'primary' : ''}`} onClick={() => setMode('encode')}>Encode</button>
        <button type="button" className={`btn ${mode === 'decode' ? 'primary' : ''}`} onClick={() => setMode('decode')}>Decode</button>
      </PillRow>
      <label htmlFor="url-in">Input</label>
      <textarea id="url-in" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} style={{ minHeight: 100 }} />
      {error && <p className="error">{error}</p>}
      <label htmlFor="url-out">Result</label>
      <SettleOutput id="url-out" value={output} style={{ minHeight: 100 }} />
      <div className="row">
        <CopyButton text={output} />
        {input && !error && <span className="chip calm"><Roll>{((mode === 'encode' ? output : input).match(/%[0-9A-Fa-f]{2}/g) ?? []).length}</Roll> characters {mode === 'encode' ? 'encoded' : 'decoded'}</span>}
      </div>
    </div>
  )
}
