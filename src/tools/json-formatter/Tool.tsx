import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Check from '../../motion/Check'
import SettleOutput from '../../motion/SettleOutput'
import { formatJson } from './format'

export default function JsonFormatter() {
  const [input, setInput] = useState('')
  const [indent, setIndent] = useState<number | 'min'>(2)
  const result = formatJson(input, indent)

  return (
    <div>
      <label htmlFor="json-in">JSON</label>
      <textarea id="json-in" value={input} onChange={(e) => setInput(e.target.value)} placeholder='{"hello": "world"}' spellCheck={false} />
      <div className="row">
        <select aria-label="Indentation" value={String(indent)} onChange={(e) => setIndent(e.target.value === 'min' ? 'min' : Number(e.target.value))} style={{ width: 'auto' }}>
          <option value="2">2 spaces</option>
          <option value="4">4 spaces</option>
          <option value="min">Minify</option>
        </select>
        {input.trim() && (result.ok ? <span className="chip good"><Check size={14} /> Valid JSON</span> : <span key={result.error} className="error">{result.error}</span>)}
      </div>
      <label htmlFor="json-out">Result</label>
      <SettleOutput id="json-out" value={result.ok ? result.text : ''} motion="order" delay={260} />
      <div className="row">
        <CopyButton text={result.ok ? result.text : ''} />
      </div>
    </div>
  )
}
