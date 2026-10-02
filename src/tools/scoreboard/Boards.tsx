import { useEffect, useRef, useState, type ReactNode } from 'react'
import Icon from '../../components/Icon'
import { newMatch, point, RULES, serveCourt, situation, type MatchState, type Side, type Sport } from './rules'

export interface Team { name: string; color: string }

/** A number that flips like a split-flap display whenever it changes. */
export function FlipNum({ value, className = '' }: { value: number | string; className?: string }) {
  return (
    <span className={`sb-flip ${className}`} aria-live="polite">
      <span key={String(value)} className="sb-flip-in">{value}</span>
    </span>
  )
}

function useUndo<T>(initial: () => T) {
  const [stack, setStack] = useState<T[]>(() => [initial()])
  const cur = stack[stack.length - 1]
  return {
    cur,
    push: (next: T) => setStack((s) => [...s.slice(-199), next]),
    undo: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
    reset: (v: T) => setStack([v]),
    canUndo: stack.length > 1,
  }
}

function Zone({ team, onTap, children, flipped }: { team: Team; onTap: () => void; children: ReactNode; flipped?: boolean }) {
  return (
    <button type="button" className={`sb-zone ${flipped ? 'right' : ''}`} style={{ ['--team' as string]: team.color }} onClick={onTap}>
      {children}
    </button>
  )
}

export function RallyBoard({ sport, teams, swapped, setSwapped }: { sport: Sport; teams: [Team, Team]; swapped: boolean; setSwapped: (v: boolean) => void }) {
  const [best, setBest] = useState(RULES[sport].gamesToWin)
  const h = useUndo<MatchState>(() => newMatch(sport, 0, best))
  const m = h.cur
  const [toast, setToast] = useState('')
  useEffect(() => h.reset(newMatch(sport, 0, best)), [sport, best]) // eslint-disable-line react-hooks/exhaustive-deps
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  function tap(s: Side) {
    const next = point(m, s)
    h.push(next)
    if (next.changeEnds) {
      setSwapped(!swapped)
      setToast(next.winner === null && next.games.length > m.games.length ? 'Game! Change ends' : 'Change ends!')
      clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setToast(''), 2200)
    }
  }

  const order: Side[] = swapped ? [1, 0] : [0, 1]
  const sit = situation(m)
  return (
    <div>
      <div className="sb-board">
        {order.map((s, i) => (
          <Zone key={s} team={teams[s]} flipped={i === 1} onTap={() => tap(s)}>
            <span className="sb-name">{teams[s].name}</span>
            <span className="sb-games">{Array.from({ length: m.gamesToWin }, (_, g) => <i key={g} className={g < m.won[s] ? 'on' : ''} />)}</span>
            <FlipNum value={m.score[s]} className="sb-big" />
            <span className={`sb-serve ${m.server === s && m.winner === null ? 'on' : ''}`}>
              <Icon name="lightning-bolt" size={16} /> {sport === 'badminton' ? `Serve · ${serveCourt(m)} court` : 'Serve'}
            </span>
            {m.winner === s && <span className="sb-win">Winner!</span>}
          </Zone>
        ))}
        {toast && <div className="sb-toast">{toast}</div>}
      </div>
      <div className="sb-status">
        <b>{sit || `Game ${m.games.length + 1} · to ${m.won[0] === m.gamesToWin - 1 && m.won[1] === m.gamesToWin - 1 ? RULES[sport].decidingPoints : RULES[sport].points}`}</b>
        {m.games.length > 0 && <span className="muted">Games: {m.games.map((g) => `${g[0]}–${g[1]}`).join(', ')}</span>}
      </div>
      <div className="row sb-actions">
        <button type="button" className="btn btn-icon" onClick={h.undo} disabled={!h.canUndo}><Icon name="undo" size={18} />Undo</button>
        <button type="button" className="btn btn-icon" onClick={() => h.reset(newMatch(sport, (1 - m.firstServer) as Side, best))}><Icon name="reload" size={18} />New match</button>
        <button type="button" className="btn" onClick={() => h.push({ ...m, server: (1 - m.server) as Side, firstServer: m.score[0] + m.score[1] === 0 ? ((1 - m.server) as Side) : m.firstServer, changeEnds: false })}>Switch server</button>
        <select aria-label="Match length" value={best} onChange={(e) => setBest(Number(e.target.value))}>
          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>Best of {2 * n - 1}</option>)}
        </select>
      </div>
    </div>
  )
}

interface Goals { score: [number, number]; log: { side: Side; minute: number }[] }

export function GoalBoard({ futsal, teams, swapped }: { futsal: boolean; teams: [Team, Team]; swapped: boolean }) {
  const half = futsal ? 20 : 45
  const h = useUndo<Goals>(() => ({ score: [0, 0], log: [] }))
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [period, setPeriod] = useState(1)
  useEffect(() => {
    if (!running) return
    let last = Date.now()
    const id = setInterval(() => {
      const now = Date.now()
      setElapsed((e) => e + (now - last) / 1000)
      last = now
    }, 250)
    return () => clearInterval(id)
  }, [running])
  const shownMin = Math.floor(elapsed / 60)
  const clock = `${String(shownMin).padStart(2, '0')}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`
  const over = elapsed >= half * 60
  const order: Side[] = swapped ? [1, 0] : [0, 1]
  const goal = (s: Side) => {
    const score: [number, number] = [h.cur.score[0], h.cur.score[1]]
    score[s]++
    h.push({ score, log: [...h.cur.log, { side: s, minute: (period - 1) * half + shownMin + 1 }] })
  }
  return (
    <div>
      <div className={`sb-clock ${over ? 'over' : ''}`}>
        <span className="muted">{period === 1 ? '1st half' : period === 2 ? '2nd half' : `Extra ${period - 2}`}</span>
        <b>{clock}</b>
        <span className="muted">/ {half}:00</span>
      </div>
      <div className="sb-board">
        {order.map((s, i) => (
          <Zone key={s} team={teams[s]} flipped={i === 1} onTap={() => goal(s)}>
            <span className="sb-name">{teams[s].name}</span>
            <FlipNum value={h.cur.score[s]} className="sb-big" />
            <span className="sb-scorers">{h.cur.log.filter((g) => g.side === s).map((g) => `${g.minute}'`).join(' ')}</span>
          </Zone>
        ))}
      </div>
      <div className="row sb-actions">
        <button type="button" className="btn primary btn-icon" onClick={() => setRunning(!running)}><Icon name={running ? 'pause-circle' : 'play-circle'} size={18} />{running ? 'Pause' : 'Start clock'}</button>
        <button type="button" className="btn" onClick={() => { setRunning(false); setElapsed(0); setPeriod((p) => p + 1) }}>Next period</button>
        <button type="button" className="btn btn-icon" onClick={h.undo} disabled={!h.canUndo}><Icon name="undo" size={18} />Undo</button>
        <button type="button" className="btn btn-icon" onClick={() => { h.reset({ score: [0, 0], log: [] }); setRunning(false); setElapsed(0); setPeriod(1) }}><Icon name="reload" size={18} />Reset</button>
      </div>
    </div>
  )
}

export interface Player { id: number; name: string; color: string; score: number }

export function FreeBoard({ players, setPlayers }: { players: Player[]; setPlayers: (p: Player[]) => void }) {
  const h = useUndo<number[]>(() => players.map((p) => p.score))
  const add = (i: number, d: number) => {
    const scores = players.map((p, j) => (j === i ? p.score + d : p.score))
    h.push(scores)
    setPlayers(players.map((p, j) => ({ ...p, score: scores[j] })))
  }
  const undo = () => {
    h.undo()
  }
  // Apply undo to players when the stack moves back.
  useEffect(() => {
    if (h.cur.length === players.length && h.cur.some((s, i) => s !== players[i].score)) setPlayers(players.map((p, i) => ({ ...p, score: h.cur[i] })))
  }, [h.cur]) // eslint-disable-line react-hooks/exhaustive-deps
  const top = Math.max(...players.map((p) => p.score))
  return (
    <div>
      <div className="sb-free" style={{ ['--n' as string]: players.length }}>
        {players.map((p, i) => (
          <div key={p.id} className={`sb-player ${p.score === top && top !== 0 ? 'lead' : ''}`} style={{ ['--team' as string]: p.color }}>
            <button type="button" className="sb-ptap" onClick={() => add(i, 1)} aria-label={`${p.name} plus 1`}>
              <input className="sb-pname" value={p.name} aria-label="Player name" onClick={(e) => e.stopPropagation()} onChange={(e) => setPlayers(players.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <FlipNum value={p.score} className="sb-mid" />
            </button>
            <div className="sb-pbtns">
              <button type="button" onClick={() => add(i, -1)} aria-label={`${p.name} minus 1`}>−1</button>
              <button type="button" onClick={() => add(i, 5)} aria-label={`${p.name} plus 5`}>+5</button>
              <button type="button" onClick={() => add(i, 10)} aria-label={`${p.name} plus 10`}>+10</button>
            </div>
          </div>
        ))}
      </div>
      <div className="row sb-actions">
        <button type="button" className="btn btn-icon" onClick={undo} disabled={!h.canUndo}><Icon name="undo" size={18} />Undo</button>
        <button type="button" className="btn btn-icon" disabled={players.length >= 8} onClick={() => { const np = [...players, { id: Date.now(), name: `Player ${players.length + 1}`, color: COLORS[players.length % COLORS.length], score: 0 }]; setPlayers(np); h.reset(np.map((p) => p.score)) }}><Icon name="plus" size={18} />Player</button>
        <button type="button" className="btn btn-icon" disabled={players.length <= 2} onClick={() => { const np = players.slice(0, -1); setPlayers(np); h.reset(np.map((p) => p.score)) }}><Icon name="minus" size={18} />Player</button>
        <button type="button" className="btn btn-icon" onClick={() => { const np = players.map((p) => ({ ...p, score: 0 })); setPlayers(np); h.reset(np.map(() => 0)) }}><Icon name="reload" size={18} />Reset scores</button>
      </div>
    </div>
  )
}

export const COLORS = ['#e8590c', '#1c7ed6', '#2f9e44', '#ae3ec9', '#f59f00', '#0ca678', '#e03131', '#5c7cfa']
