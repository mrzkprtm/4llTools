import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'
import { Hint, Select, Slider, Toggle } from '../../sim/controls'
import { calcTip, CURRENCIES, format } from './tip'
import './tool.css'

const STORE = '4lltools:tip-calculator'
const QUICK = [0, 5, 10, 15, 18, 20]

export default function TipCalculator() {
  const [code, setCode] = useState('IDR')
  const [billText, setBillText] = useState('385000')
  const [tipPct, setTipPct] = useState(10)
  const [custom, setCustom] = useState(false)
  const [people, setPeople] = useState(3)
  const [roundUp, setRoundUp] = useState(true)
  const [service, setService] = useState(false)
  const [drop, setDrop] = useState(0)
  const ready = useRef(false)

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) ?? 'null')
      if (s) {
        if (CURRENCIES.some((c) => c.code === s.code)) setCode(s.code)
        if (typeof s.tipPct === 'number') { setTipPct(s.tipPct); setCustom(!QUICK.includes(s.tipPct)) }
        if (typeof s.roundUp === 'boolean') setRoundUp(s.roundUp)
      }
    } catch {
      // Defaults.
    }
    ready.current = true
  }, [])
  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(STORE, JSON.stringify({ code, tipPct, roundUp }))
    } catch {
      // Not saved.
    }
  }, [code, tipPct, roundUp])

  const cur = CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0]
  const bill = Number(billText) || 0
  const r = calcTip({ bill, tipPct, people, roundUp, step: cur.step, decimals: cur.decimals })
  const f = (v: number) => format(v, cur)

  // Coins fall whenever the tip changes.
  const lastTip = useRef(r.tipFinal)
  useEffect(() => {
    if (r.tipFinal !== lastTip.current && !reducedMotion()) setDrop((d) => d + 1)
    lastTip.current = r.tipFinal
  }, [r.tipFinal])
  const coins = Math.min(12, Math.round(r.effectivePct / 2.5))

  function key(k: string) {
    setBillText((t) => {
      if (k === 'back') return t.slice(0, -1)
      if (k === 'clear') return ''
      if (k === '.') return cur.decimals && !t.includes('.') ? (t || '0') + '.' : t
      const next = (t === '0' ? '' : t) + k
      const [, dec] = next.split('.')
      if (dec && dec.length > cur.decimals) return t
      return next.replace(/^0+(?=\d)/, '').length > 12 ? t : next
    })
  }
  function pickCurrency(c: string) {
    const nc = CURRENCIES.find((x) => x.code === c) ?? CURRENCIES[0]
    setCode(c)
    setBillText(nc.code === 'IDR' ? '385000' : nc.code === 'JPY' ? '8400' : nc.code === 'THB' ? '1850' : '86.50')
  }
  function toggleService(v: boolean) {
    setService(v)
    if (v) { setTipPct(0); setCustom(false) } else if (tipPct === 0) setTipPct(10)
  }

  const shown = billText === '' ? '0' : Number(billText).toLocaleString(cur.locale, { maximumFractionDigits: cur.decimals })

  return (
    <div className="tc">
      <div className="tc-grid">
        <div className="tc-left">
          <Select label="Currency" value={code} options={CURRENCIES.map((c) => [c.code, c.code] as const)} onChange={pickCurrency} />
          <label className="sim-label" htmlFor="tc-bill">Bill amount</label>
          <input id="tc-bill" className="tc-bill" inputMode="decimal" value={billText} onChange={(e) => { const v = e.target.value.replace(/[^\d.]/g, ''); if (!v || /^\d*\.?\d*$/.test(v)) setBillText(v) }} aria-describedby="tc-bill-show" />
          <p id="tc-bill-show" className="muted tc-small">{cur.code} {billText.endsWith('.') ? shown + '.' : shown}</p>
          <div className="tc-keys" aria-label="Keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', cur.decimals ? '.' : '000', '0', 'back'].map((k) => (
              <button key={k} type="button" onClick={() => key(k)} aria-label={k === 'back' ? 'Delete digit' : k}>
                {k === 'back' ? <Icon name="arrow-left" size={20} /> : k}
              </button>
            ))}
          </div>
          <button type="button" className="btn tc-clear" onClick={() => key('clear')}>Clear</button>
        </div>

        <div className="tc-right">
          <span className="sim-label">Tip</span>
          <div className="tc-quick">
            {QUICK.map((q) => (
              <button key={q} type="button" className={`btn ${!custom && tipPct === q ? 'primary' : ''}`} onClick={() => { setTipPct(q); setCustom(false) }}>{q}%</button>
            ))}
            <button type="button" className={`btn ${custom ? 'primary' : ''}`} onClick={() => setCustom(true)}>Custom</button>
          </div>
          {custom && <Slider label="Custom tip" value={tipPct} min={0} max={40} step={0.5} unit="%" onChange={setTipPct} />}

          <span className="sim-label">People</span>
          <div className="tc-people">
            <button type="button" className="btn" onClick={() => setPeople(Math.max(1, people - 1))} aria-label="Fewer people" disabled={people <= 1}><Icon name="minus" size={20} /></button>
            <b><Roll>{String(people)}</Roll></b>
            <button type="button" className="btn" onClick={() => setPeople(Math.min(50, people + 1))} aria-label="More people"><Icon name="plus" size={20} /></button>
            <span className="tc-heads" aria-hidden="true">{Array.from({ length: Math.min(people, 10) }, (_, i) => <i key={i} style={{ animationDelay: `${i * 30}ms` }} />)}{people > 10 && <small>+{people - 10}</small>}</span>
          </div>
          <Toggle label={`Round up each share (to ${f(cur.step)})`} checked={roundUp} onChange={setRoundUp} />
          <Toggle label="Service charge already on the bill" checked={service} onChange={toggleService} />
          {service && <p className="muted tc-small">Many Indonesian restaurants add 5–10% service plus tax. With service included, an extra tip is optional.</p>}
        </div>
      </div>

      <div className="tc-out">
        <div className="tc-jar" aria-hidden="true">
          {Array.from({ length: coins }, (_, i) => (
            <span key={`${drop}-${i}`} className="tc-coin" style={{ left: `${12 + ((i * 37) % 70)}%`, bottom: `${6 + Math.floor(i / 4) * 12}%`, animationDelay: `${i * 70}ms` }} />
          ))}
        </div>
        <div className="tc-per">
          <span className="muted">Each person pays</span>
          <b><Roll>{f(r.perPersonFinal)}</Roll></b>
          {roundUp && r.perPersonFinal !== r.perPerson && <span className="muted tc-small">exact share {f(r.perPerson)}</span>}
        </div>
      </div>
      <div className="stats">
        <div className="stat"><b><Roll>{f(r.tipFinal)}</Roll></b>Tip ({r.effectivePct.toFixed(1)}%)</div>
        <div className="stat"><b><Roll>{f(r.totalFinal)}</Roll></b>Total with tip</div>
        <div className="stat"><b><Roll>{f(people ? r.tipFinal / people : 0)}</Roll></b>Tip per person</div>
      </div>
      <Hint>Type the bill or use the keypad, pick a tip and the number of people. Rounding up gives everyone an easy amount to pay; the extra goes to the tip.</Hint>
    </div>
  )
}
