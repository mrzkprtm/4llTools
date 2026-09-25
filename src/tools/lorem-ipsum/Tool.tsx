import { useMemo, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Roll from '../../motion/Roll'
import { lorem, type LoremUnit } from './lorem'

export default function LoremIpsum() {
  const [count, setCount] = useState(3)
  const [unit, setUnit] = useState<LoremUnit>('paragraphs')
  const [classic, setClassic] = useState(true)
  const [seed, setSeed] = useState(0)
  const text = useMemo(() => lorem(count, unit, classic), [count, unit, classic, seed])

  return (
    <div>
      <div className="row">
        <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} style={{ width: 100 }} aria-label="How many" />
        <select value={unit} onChange={(e) => setUnit(e.target.value as LoremUnit)} style={{ width: 'auto' }} aria-label="Unit">
          <option value="paragraphs">Paragraphs</option>
          <option value="sentences">Sentences</option>
          <option value="words">Words</option>
        </select>
        <label style={{ fontWeight: 400, margin: 0 }}>
          <input type="checkbox" checked={classic} onChange={(e) => setClassic(e.target.checked)} /> Start with “Lorem ipsum”
        </label>
      </div>
      <textarea key={`${seed}-${count}-${unit}-${classic}`} className="wipe-in" readOnly value={text} style={{ minHeight: 260, fontFamily: 'inherit' }} aria-label="Generated text" />
      <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.88rem' }}><Roll>{text.split(/\s+/).filter(Boolean).length}</Roll> words</p>
      <div className="row">
        <button type="button" className="btn primary" onClick={() => setSeed(seed + 1)}>Generate new</button>
        <CopyButton text={text} />
      </div>
    </div>
  )
}
