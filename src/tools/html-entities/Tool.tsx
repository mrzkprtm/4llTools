import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import { escapeHtml, unescapeHtml } from './entities'

export default function HtmlEntities() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [input, setInput] = useState('')
  const [nonAscii, setNonAscii] = useState(false)
  const output = mode === 'encode' ? escapeHtml(input, nonAscii) : unescapeHtml(input)

  return (
    <div>
      <div className="row">
        <button type="button" className={`btn ${mode === 'encode' ? 'primary' : ''}`} onClick={() => setMode('encode')}>Encode</button>
        <button type="button" className={`btn ${mode === 'decode' ? 'primary' : ''}`} onClick={() => setMode('decode')}>Decode</button>
        {mode === 'encode' && (
          <label style={{ fontWeight: 400, margin: 0 }}>
            <input type="checkbox" checked={nonAscii} onChange={(e) => setNonAscii(e.target.checked)} /> Also encode non-ASCII characters
          </label>
        )}
      </div>
      <label htmlFor="he-in">Input</label>
      <textarea id="he-in" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} style={{ minHeight: 120 }} placeholder={mode === 'encode' ? '<p>Tom & Jerry</p>' : '&lt;p&gt;Tom &amp; Jerry&lt;/p&gt;'} />
      <label htmlFor="he-out">Result</label>
      <textarea id="he-out" readOnly value={output} spellCheck={false} style={{ minHeight: 120 }} />
      <div className="row"><CopyButton text={output} /></div>
    </div>
  )
}
