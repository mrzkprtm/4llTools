import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import SettleOutput from '../../motion/SettleOutput'
import { decodeBase64, encodeBase64 } from './codec'

export default function Base64Tool() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [input, setInput] = useState('')

  let output = ''
  let error = ''
  try {
    output = mode === 'encode' ? encodeBase64(input) : decodeBase64(input)
  } catch {
    error = 'That is not valid Base64 text.'
  }

  const bytes = (s: string) => new TextEncoder().encode(s).length

  return (
    <div>
      <PillRow>
        <button type="button" className={`btn ${mode === 'encode' ? 'primary' : ''}`} onClick={() => setMode('encode')}>Encode</button>
        <button type="button" className={`btn ${mode === 'decode' ? 'primary' : ''}`} onClick={() => setMode('decode')}>Decode</button>
        <button type="button" className="btn" onClick={() => { if (!error) { setInput(output); setMode(mode === 'encode' ? 'decode' : 'encode') } }} disabled={!!error || !output}>Swap ⇅</button>
      </PillRow>
      <label htmlFor="b64-in">{mode === 'encode' ? 'Text' : 'Base64'}</label>
      <textarea id="b64-in" className={error && input ? 'shake-once' : undefined} value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
      {error && input && <p className="error">{error}</p>}
      <label htmlFor="b64-out">{mode === 'encode' ? 'Base64' : 'Text'}</label>
      <SettleOutput id="b64-out" value={output} />
      <div className="row">
        <CopyButton text={output} />
        {input && output && <span className="chip calm"><Roll>{bytes(input)}</Roll> B → <Roll>{bytes(output)}</Roll> B</span>}
      </div>
    </div>
  )
}
