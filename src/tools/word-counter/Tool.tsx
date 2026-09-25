import { useState } from 'react'
import Roll from '../../motion/Roll'
import { useSettled } from '../../motion/useSettled'
import { countText } from './count'

export default function WordCounter() {
  const [text, setText] = useState('')
  const s = countText(text)
  const settled = useSettled(s.words, 600)
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
          <div key={label === 'Words' ? `w${settled}` : label} className={`stat ${label === 'Words' && settled ? 'settle' : ''}`}><b><Roll>{value}</Roll></b><span className="muted">{label}</span></div>
        ))}
      </div>
    </div>
  )
}
