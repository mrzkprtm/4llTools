import { useState } from 'react'
import { countText } from './count'

export default function WordCounter() {
  const [text, setText] = useState('')
  const s = countText(text)
  const items: [string, number | string][] = [
    ['Words', s.words],
    ['Characters', s.characters],
    ['Without spaces', s.charactersNoSpaces],
    ['Sentences', s.sentences],
    ['Paragraphs', s.paragraphs],
    ['Reading time', `${s.readingMinutes} min`],
  ]

  return (
    <div>
      <label htmlFor="wc-in">Your text</label>
      <textarea id="wc-in" value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 220, fontFamily: 'inherit' }} placeholder="Paste or type here…" />
      <div className="stats">
        {items.map(([label, value]) => (
          <div key={label} className="stat"><b>{value}</b><span className="muted">{label}</span></div>
        ))}
      </div>
    </div>
  )
}
