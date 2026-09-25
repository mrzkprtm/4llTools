import { useState } from 'react'
import { afterDiscount, percentChange, percentOf, whatPercent } from './percent'

const fmt = (n: number) => (Number.isFinite(n) ? Number(n.toFixed(4)).toLocaleString() : '—')

function Num({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return <input type="number" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} style={{ width: 120 }} />
}

export default function PercentageCalculator() {
  const [a1, setA1] = useState('20')
  const [a2, setA2] = useState('150')
  const [b1, setB1] = useState('30')
  const [b2, setB2] = useState('120')
  const [c1, setC1] = useState('100')
  const [c2, setC2] = useState('125')
  const [d1, setD1] = useState('250000')
  const [d2, setD2] = useState('15')
  const n = Number

  return (
    <div>
      <div className="row">What is <Num value={a1} onChange={setA1} label="Percent" />% of <Num value={a2} onChange={setA2} label="Number" />? <b>= {fmt(percentOf(n(a1), n(a2)))}</b></div>
      <div className="row"><Num value={b1} onChange={setB1} label="Part" /> is what % of <Num value={b2} onChange={setB2} label="Whole" />? <b>= {fmt(whatPercent(n(b1), n(b2)))}%</b></div>
      <div className="row">From <Num value={c1} onChange={setC1} label="From" /> to <Num value={c2} onChange={setC2} label="To" /> is a change of <b>{(() => { const v = percentChange(n(c1), n(c2)); return (v > 0 ? '+' : '') + fmt(v) })()}%</b></div>
      <div className="row">Price <Num value={d1} onChange={setD1} label="Price" /> with a <Num value={d2} onChange={setD2} label="Discount" />% discount: <b>{fmt(afterDiscount(n(d1), n(d2)))}</b> <span className="muted">(you save {fmt(n(d1) - afterDiscount(n(d1), n(d2)))})</span></div>
    </div>
  )
}
