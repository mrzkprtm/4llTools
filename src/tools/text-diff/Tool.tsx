import { useState } from 'react'
import Roll from '../../motion/Roll'
import { useSettled } from '../../motion/useSettled'
import { diffLines } from './diff'

// Caps lines(original) × lines(changed) so the comparison table stays around 16 MB.
const MAX_CELLS = 4_000_000

export default function TextDiff() {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const tooBig = a.split('\n').length * b.split('\n').length > MAX_CELLS
  const ops = a || b ? (tooBig ? [] : diffLines(a, b)) : []
  const added = ops.filter((o) => o.type === 'add').length
  const removed = ops.filter((o) => o.type === 'del').length
  const settled = useSettled(`${a}\u0000${b}`, 250)

  return (
    <div>
      <div className="two-col">
        <div>
          <label htmlFor="diff-a">Original</label>
          <textarea id="diff-a" value={a} onChange={(e) => setA(e.target.value)} spellCheck={false} />
        </div>
        <div>
          <label htmlFor="diff-b">Changed</label>
          <textarea id="diff-b" value={b} onChange={(e) => setB(e.target.value)} spellCheck={false} />
        </div>
      </div>
      {tooBig && <p className="error">These texts are too long to compare here.</p>}
      {ops.length > 0 && (
        <>
          <p>
            <span className="chip good calm">+<Roll>{added}</Roll> added</span> <span className="chip bad calm">−<Roll>{removed}</Roll> removed</span>
            {added + removed === 0 && <span className="muted"> · The texts are identical.</span>}
          </p>
          <div key={settled} className="output diff-out" style={{ padding: '6px 0' }}>
            {ops.map((o, i) => (
              <div key={i} className={`diff-line ${o.type === 'add' ? 'diff-add' : o.type === 'del' ? 'diff-del' : ''}`} style={o.type === 'same' ? undefined : { animationDelay: `${Math.min(i, 40) * 10}ms` }}>
                {o.type === 'add' ? '+ ' : o.type === 'del' ? '− ' : '  '}
                {o.text || ' '}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
