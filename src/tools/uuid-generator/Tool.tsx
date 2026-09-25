import { useCallback, useEffect, useState } from 'react'
import CopyButton from '../../components/CopyButton'

export default function UuidGenerator() {
  const [count, setCount] = useState(5)
  const [upper, setUpper] = useState(false)
  const [hyphens, setHyphens] = useState(true)
  const [ids, setIds] = useState<string[]>([])

  const generate = useCallback(() => {
    setIds(
      Array.from({ length: count }, () => {
        let id: string = crypto.randomUUID()
        if (!hyphens) id = id.replace(/-/g, '')
        return upper ? id.toUpperCase() : id
      }),
    )
  }, [count, upper, hyphens])
  useEffect(generate, [generate])

  const text = ids.join('\n')
  return (
    <div>
      <div className="row">
        <label style={{ margin: 0 }} htmlFor="uuid-count">How many</label>
        <input id="uuid-count" type="number" min={1} max={1000} value={count} onChange={(e) => setCount(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))} style={{ width: 100 }} />
        <label style={{ fontWeight: 400, margin: 0 }}><input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} /> Uppercase</label>
        <label style={{ fontWeight: 400, margin: 0 }}><input type="checkbox" checked={hyphens} onChange={(e) => setHyphens(e.target.checked)} /> Hyphens</label>
      </div>
      <textarea readOnly value={text} style={{ minHeight: 200 }} aria-label="UUIDs" />
      <div className="row">
        <button type="button" className="btn primary" onClick={generate}>Generate new</button>
        <CopyButton text={text} label="Copy all" />
      </div>
    </div>
  )
}
