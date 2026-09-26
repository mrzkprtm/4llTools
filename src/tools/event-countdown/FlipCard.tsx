import { useEffect, useState } from 'react'

/** A split-flap card that flips from the old value to the new one. */
export default function FlipCard({ value, label }: { value: string; label: string }) {
  const [pair, setPair] = useState({ cur: value, prev: value, n: 0 })

  useEffect(() => {
    setPair((p) => (p.cur === value ? p : { cur: value, prev: p.cur, n: p.n + 1 }))
  }, [value])

  const flipping = pair.prev !== pair.cur
  return (
    <div className="ec-unit">
      <div className="ec-card" aria-hidden="true">
        <div className="ec-half ec-top">
          <span>{pair.cur}</span>
        </div>
        <div className="ec-half ec-bottom">
          <span>{flipping ? pair.prev : pair.cur}</span>
        </div>
        {flipping && (
          <>
            <div key={`t${pair.n}`} className="ec-half ec-top ec-flap-top">
              <span>{pair.prev}</span>
            </div>
            <div key={`b${pair.n}`} className="ec-half ec-bottom ec-flap-bottom">
              <span>{pair.cur}</span>
            </div>
          </>
        )}
      </div>
      <span className="ec-label">{label}</span>
    </div>
  )
}
