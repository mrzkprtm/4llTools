import { useState } from 'react'
import Icon from '../../components/Icon'
import { Choice, Hint } from '../../sim/controls'
import { SETS } from './glyphs'
import Tracer from './Tracer'
import Worksheet from './Worksheet'
import './tool.css'

type SetName = keyof typeof SETS

export default function HandwritingTracing() {
  const [tab, setTab] = useState<'trace' | 'sheet'>('trace')
  const [set, setSet] = useState<SetName>('upper')
  const [ch, setCh] = useState('A')
  const chars = SETS[set]
  const i = chars.indexOf(ch)
  const go = (d: number) => setCh(chars[(i + d + chars.length) % chars.length])

  return (
    <div className="hw">
      <div className="hw-noprint">
        <Choice value={tab} onChange={setTab} options={[['trace', 'Trace'], ['sheet', 'Worksheet']]} />
      </div>
      {tab === 'trace' ? (
        <div className="settle-in hw-noprint">
          <div className="row hw-sets">
            <Choice
              value={set}
              onChange={(s) => {
                setSet(s)
                setCh(SETS[s][0])
              }}
              options={[['upper', 'A–Z'], ['lower', 'a–z'], ['digits', '0–9']]}
            />
          </div>
          <div className="hw-picker" role="group" aria-label="Pick a character">
            {[...chars].map((c) => (
              <button key={c} type="button" className={`hw-key ${c === ch ? 'on' : ''}`} aria-pressed={c === ch} onClick={() => setCh(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="row hw-nav">
            <button type="button" className="btn btn-icon" onClick={() => go(-1)} aria-label="Previous character"><Icon name="chevron-left" size={18} /></button>
            <b className="hw-current" key={ch}>{ch}</b>
            <button type="button" className="btn btn-icon" onClick={() => go(1)} aria-label="Next character"><Icon name="chevron-right" size={18} /></button>
          </div>
          <Tracer ch={ch} />
        </div>
      ) : (
        <div className="settle-in">
          <Worksheet />
        </div>
      )}
      <div className="hw-noprint">
        <Hint>Watch the numbered strokes draw themselves, then trace over the gray letter with your finger or mouse; you get a score once you have drawn every stroke. The Worksheet tab prints dotted rows to trace on paper.</Hint>
      </div>
    </div>
  )
}
