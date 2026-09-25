import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import { CASES } from './cases'

export default function CaseConverter() {
  const [text, setText] = useState('')
  return (
    <div>
      <label htmlFor="case-in">Your text</label>
      <textarea id="case-in" value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 110, fontFamily: 'inherit' }} placeholder="Type or paste text…" />
      {CASES.map((c) => {
        const out = c.convert(text)
        return (
          <div key={c.name}>
            <label>{c.name}</label>
            <div className="row" style={{ margin: 0, flexWrap: 'nowrap' }}>
              <div className="output" style={{ flex: 1, minHeight: 42 }}>{out}</div>
              <CopyButton text={out} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
