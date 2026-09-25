import { useEffect, useMemo, useRef, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'
import { useFlip } from '../../motion/useFlip'
import { flipCoin, indexAtPointer, parseDice, parseItems, pickN, randomInt, rollDice, shuffle, spinEase, splitTeams, wheelTarget } from './random'
import './tool.css'

type Mode = 'wheel' | 'pick' | 'shuffle' | 'teams' | 'dice' | 'coin'
const MODES: [Mode, string][] = [['wheel', 'Wheel'], ['pick', 'Pick N'], ['shuffle', 'Shuffle'], ['teams', 'Teams'], ['dice', 'Dice'], ['coin', 'Coin']]
const SAMPLE = ['Ana', 'Budi', 'Citra', 'Dewi', 'Eko', 'Fajar', 'Gita', 'Hadi'].join('\n')
const CX = 150
const RAD = 140

const color = (i: number, n: number) => `hsl(${Math.round((i * 360) / n + 18) % 360} 78% ${i % 2 ? 72 : 64}%)`

function polar(deg: number, r = RAD) {
  const a = (deg * Math.PI) / 180
  return [CX + r * Math.sin(a), CX - r * Math.cos(a)]
}

function segPath(i: number, n: number) {
  if (n === 1) return `M ${CX} ${CX - RAD} A ${RAD} ${RAD} 0 1 1 ${CX - 0.01} ${CX - RAD} Z`
  const seg = 360 / n
  const [x1, y1] = polar(i * seg)
  const [x2, y2] = polar((i + 1) * seg)
  return `M ${CX} ${CX} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${RAD} ${RAD} 0 ${seg > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`
}

let audio: AudioContext | null = null
function click() {
  try {
    audio ??= new AudioContext()
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'square'
    osc.frequency.value = 1400
    osc.connect(gain).connect(audio.destination)
    const t = audio.currentTime
    gain.gain.setValueAtTime(0.06, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
    osc.start(t)
    osc.stop(t + 0.035)
  } catch {
    // Sound is optional.
  }
}

function Wheel({ items, onRemove }: { items: string[]; onRemove: (index: number) => void }) {
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<{ name: string; index: number; n: number } | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [ticks, setTicks] = useState(true)
  const [autoRemove, setAutoRemove] = useState(false)
  const rot = useRef(0)
  const group = useRef<SVGGElement>(null)
  const pointer = useRef<SVGPathElement>(null)
  const raf = useRef(0)
  const n = items.length
  const seg = 360 / Math.max(1, n)
  const fontSize = n > 40 ? 6 : n > 24 ? 8 : n > 12 ? 10 : 12
  const maxChars = n > 24 ? 12 : 16

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  function finish(index: number) {
    const name = items[index]
    setWinner({ name, index, n })
    setHistory((h) => [name, ...h].slice(0, 20))
    setSpinning(false)
    if (autoRemove) setTimeout(() => onRemove(index), 1400)
  }

  function spin() {
    if (spinning || n < 2) return
    const index = randomInt(n)
    const from = rot.current
    const to = wheelTarget(from, index, n, 5 + randomInt(3), randomInt(1000) / 1000)
    setWinner(null)
    if (reducedMotion()) {
      rot.current = to
      if (group.current) group.current.style.transform = `rotate(${to}deg)`
      return finish(index)
    }
    if (ticks) click() // unlock audio on the user's tap
    setSpinning(true)
    const duration = 4200 + randomInt(900)
    const start = performance.now()
    let lastSeg = Math.floor(from / seg)
    const frame = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const angle = from + (to - from) * spinEase(p)
      rot.current = angle
      if (group.current) group.current.style.transform = `rotate(${angle}deg)`
      const s = Math.floor(angle / seg)
      if (s !== lastSeg) {
        lastSeg = s
        if (ticks) click()
        const el = pointer.current
        if (el) { el.classList.remove('tick'); void el.getBBox(); el.classList.add('tick') }
      }
      if (p < 1) raf.current = requestAnimationFrame(frame)
      else {
        rot.current = to
        finish(indexAtPointer(to, n))
      }
    }
    raf.current = requestAnimationFrame(frame)
  }

  return (
    <div>
      <div className={`rw-wheel-wrap ${!spinning && !winner ? 'idle' : ''}`}>
        <svg className="rw-wheel" viewBox="0 -14 300 314" role="button" tabIndex={0} aria-label={n < 2 ? 'Add at least two entries to spin' : `Spin the wheel of ${n} entries`} aria-disabled={spinning || n < 2} onClick={spin} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); spin() } }}>
          <g>
            <g className="rw-rot">
              <g ref={group} style={{ transform: `rotate(${rot.current}deg)`, transformBox: 'view-box', transformOrigin: `${CX}px ${CX}px` }}>
                {items.map((item, i) => {
                  const mid = (i + 0.5) * seg
                  const label = item.length > maxChars ? `${item.slice(0, maxChars - 1)}…` : item
                  return (
                    <g key={`${i}-${item}`}>
                      <path className="rw-seg" d={segPath(i, n)} fill={color(i, n)} />
                      <text transform={`rotate(${mid - 90} ${CX} ${CX})`} x={CX + RAD - 10} y={CX + fontSize / 3} textAnchor="end" style={{ fontSize }}>{label}</text>
                    </g>
                  )
                })}
                {n === 0 && <circle cx={CX} cy={CX} r={RAD} fill="var(--sunken)" />}
              </g>
            </g>
            <circle className="rw-hub" cx={CX} cy={CX} r={26} />
            <text className="rw-hub-text" x={CX} y={CX + 4} textAnchor="middle">SPIN</text>
          </g>
          <path ref={pointer} className="rw-pointer" d="M 150 16 L 139 -10 L 161 -10 Z" />
        </svg>
      </div>
      <div className="rw-winner" aria-live="assertive">
        {winner && <span key={history.length} className="chip good" style={{ fontSize: '1.15rem' }}>🎉 {winner.name}</span>}
        {n < 2 && <p className="muted">Add at least two entries to spin.</p>}
      </div>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn primary" onClick={spin} disabled={spinning || n < 2}>{spinning ? 'Spinning…' : 'Spin'}</button>
        {winner && !spinning && !autoRemove && winner.n === n && items[winner.index] === winner.name && (
          <button type="button" className="btn" onClick={() => { onRemove(winner.index); setWinner(null) }}>Remove “{winner.name}”</button>
        )}
      </div>
      <div className="row" style={{ justifyContent: 'center', gap: 16 }}>
        <label style={{ display: 'flex', gap: 6, fontWeight: 500 }}><input type="checkbox" checked={ticks} onChange={(e) => setTicks(e.target.checked)} /> Tick sound</label>
        <label style={{ display: 'flex', gap: 6, fontWeight: 500 }}><input type="checkbox" checked={autoRemove} onChange={(e) => setAutoRemove(e.target.checked)} /> Remove winner after each spin</label>
      </div>
      {history.length > 0 && <p className="rw-history">History: {history.map((h, i) => <span key={history.length - i}>{i ? ', ' : ''}<b>{h}</b></span>)}</p>}
    </div>
  )
}

export default function RandomPicker() {
  const [mode, setMode] = useState<Mode>('wheel')
  const [text, setText] = useState(SAMPLE)
  const items = useMemo(() => parseItems(text), [text])
  const [count, setCount] = useState(3)
  const [picked, setPicked] = useState<string[]>([])
  const [pickRound, setPickRound] = useState(0)
  const [order, setOrder] = useState<{ item: string; key: number }[]>([])
  const [teamCount, setTeamCount] = useState(2)
  const [teams, setTeams] = useState<string[][]>([])
  const [teamRound, setTeamRound] = useState(0)
  const [dice, setDice] = useState('2d6')
  const [roll, setRoll] = useState<{ rolls: number[]; total: number } | null>(null)
  const [rollRound, setRollRound] = useState(0)
  const [coin, setCoin] = useState<'Heads' | 'Tails' | null>(null)
  const [tally, setTally] = useState({ Heads: 0, Tails: 0 })
  const [flipping, setFlipping] = useState(0)
  const shuffled = useRef<HTMLOListElement>(null)
  useFlip(shuffled, { max: 200 })
  const parsedDice = parseDice(dice)
  const listModes = mode !== 'dice' && mode !== 'coin'

  function removeAt(index: number) {
    const next = [...items]
    next.splice(index, 1)
    setText(next.join('\n'))
  }

  function doShuffle() {
    const base = order.length && order.length === items.length ? order : items.map((item, key) => ({ item, key }))
    setOrder(shuffle(base))
  }

  function doRoll(notation = dice) {
    const d = parseDice(notation)
    if (!d) return
    setDice(notation)
    setRoll(rollDice(d))
    setRollRound((r) => r + 1)
  }

  function doFlip() {
    const r = flipCoin()
    setCoin(r)
    setTally((t) => ({ ...t, [r]: t[r] + 1 }))
    setFlipping((f) => f + 1)
  }

  return (
    <div>
      <PillRow role="tablist" label="Mode">
        {MODES.map(([m, label]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} className={`btn ${mode === m ? 'primary' : ''}`} onClick={() => setMode(m)}>{label}</button>
        ))}
      </PillRow>

      {listModes && (
        <>
          <label htmlFor="rw-items">Entries, one per line <span className="muted" style={{ fontWeight: 400 }}>({items.length})</span></label>
          <textarea id="rw-items" value={text} onChange={(e) => { setText(e.target.value); setOrder([]) }} style={{ minHeight: 130, fontFamily: 'inherit', fontSize: '0.95rem' }} spellCheck={false} />
          <div className="row" style={{ marginTop: 6 }}>
            <button type="button" className="btn" onClick={() => setText(shuffle(items).join('\n'))} disabled={items.length < 2}>Shuffle entries</button>
            <button type="button" className="btn" onClick={() => setText([...items].sort((a, b) => a.localeCompare(b)).join('\n'))} disabled={items.length < 2}>Sort A–Z</button>
            <button type="button" className="btn" onClick={() => setText([...new Set(items)].join('\n'))} disabled={new Set(items).size === items.length}>Remove duplicates</button>
            <button type="button" className="btn" onClick={() => setText('')} disabled={!text}>Clear</button>
          </div>
        </>
      )}

      {mode === 'wheel' && <Wheel items={items} onRemove={removeAt} />}

      {mode === 'pick' && (
        <div>
          <div className="row">
            <label htmlFor="rw-n">How many</label>
            <input id="rw-n" type="number" min={1} max={Math.max(1, items.length)} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} style={{ width: 90 }} />
            <button type="button" className="btn primary" onClick={() => { setPicked(pickN(items, count)); setPickRound((r) => r + 1) }} disabled={!items.length}>Pick {Math.min(count, items.length)} at random</button>
          </div>
          {count > items.length && items.length > 0 && <p className="muted" style={{ fontSize: '0.85rem' }}>Only {items.length} entries, so all are picked in random order.</p>}
          {picked.length > 0 && (
            <>
              <div className="rw-chips" key={pickRound} aria-live="polite">
                {picked.map((p, i) => <span key={i} className="chip good" style={{ animationDelay: `${i * 90}ms` }}>{i + 1}. {p}</span>)}
              </div>
              <CopyButton text={picked.join('\n')} />
            </>
          )}
        </div>
      )}

      {mode === 'shuffle' && (
        <div>
          <div className="row">
            <button type="button" className="btn primary" onClick={doShuffle} disabled={items.length < 2}>Shuffle list</button>
            {order.length > 0 && <CopyButton text={order.map((o) => o.item).join('\n')} />}
          </div>
          {order.length > 0 && (
            <ol className="rw-list" ref={shuffled}>
              {order.map((o) => <li key={o.key} data-flip={String(o.key)}>{o.item}</li>)}
            </ol>
          )}
        </div>
      )}

      {mode === 'teams' && (
        <div>
          <div className="row">
            <label htmlFor="rw-teams">Number of teams</label>
            <input id="rw-teams" type="number" min={2} max={Math.max(2, items.length)} value={teamCount} onChange={(e) => setTeamCount(Math.max(2, Number(e.target.value) || 2))} style={{ width: 90 }} />
            <button type="button" className="btn primary" onClick={() => { setTeams(splitTeams(items, teamCount)); setTeamRound((r) => r + 1) }} disabled={items.length < 2}>Make teams</button>
            {teams.length > 0 && <CopyButton text={teams.map((t, i) => `Team ${i + 1}: ${t.join(', ')}`).join('\n')} />}
          </div>
          {items.length > 0 && <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>{items.length} people → about {Math.ceil(items.length / Math.min(teamCount, items.length))} per team.</p>}
          <div className="rw-teams" key={teamRound}>
            {teams.map((t, i) => (
              <div key={i} className="rw-team" style={{ animationDelay: `${i * 80}ms`, borderTop: `4px solid ${color(i, teams.length)}` }}>
                <h3>Team {i + 1} <span className="muted" style={{ fontWeight: 400 }}>({t.length})</span></h3>
                <ul>{t.map((m, j) => <li key={j}>{m}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === 'dice' && (
        <div>
          <label htmlFor="rw-dice">Dice (NdM+K, e.g. 2d6, d20, 3d8+2)</label>
          <div className="row" style={{ marginTop: 0 }}>
            <input id="rw-dice" type="text" value={dice} onChange={(e) => setDice(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') doRoll() }} style={{ maxWidth: 160, fontFamily: 'var(--mono)' }} spellCheck={false} />
            <button type="button" className="btn primary" onClick={() => doRoll()} disabled={!parsedDice}>Roll</button>
          </div>
          <div className="rw-quick">
            {['1d6', '2d6', '1d4', '1d8', '1d10', '1d12', '1d20', '1d100'].map((d) => <button key={d} type="button" className="btn" onClick={() => doRoll(d)}>{d}</button>)}
          </div>
          {!parsedDice && <p className="error">Use dice notation like 2d6 or 1d20+3 (1–100 dice, 2–1000 sides).</p>}
          {roll && (
            <div aria-live="polite">
              <div className="rw-dice" key={rollRound}>
                {roll.rolls.slice(0, 30).map((r, i) => <span key={i} className="rw-die" style={{ animationDelay: `${i * 50}ms` }}>{r}</span>)}
                {roll.rolls.length > 30 && <span className="muted">+{roll.rolls.length - 30} more</span>}
              </div>
              <div className="rw-total">Total <Roll>{roll.total}</Roll></div>
            </div>
          )}
        </div>
      )}

      {mode === 'coin' && (
        <div>
          <div className="rw-coin-stage">
            <div key={flipping} className={`rw-coin ${flipping ? 'flip' : ''}`} aria-live="polite">{coin ?? '?'}</div>
          </div>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn primary" onClick={doFlip}>Flip coin</button>
            <button type="button" className="btn" onClick={() => { setTally({ Heads: 0, Tails: 0 }); setCoin(null) }} disabled={!tally.Heads && !tally.Tails}>Reset tally</button>
          </div>
          <div className="stats">
            <div className="stat"><b><Roll>{tally.Heads}</Roll></b>Heads (Gambar)</div>
            <div className="stat"><b><Roll>{tally.Tails}</Roll></b>Tails (Angka)</div>
          </div>
        </div>
      )}

      <p className="muted">
        Every draw uses your browser&apos;s cryptographic random generator (crypto.getRandomValues) with no modulo bias, so each entry has exactly the same chance. Good for giveaways, arisan, class groups and picking who presents first. Nothing is sent anywhere.
      </p>
    </div>
  )
}
