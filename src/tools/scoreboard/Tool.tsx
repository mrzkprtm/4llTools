import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import { Hint, Select } from '../../sim/controls'
import { COLORS, FreeBoard, GoalBoard, RallyBoard, type Player, type Team } from './Boards'
import './tool.css'

const STORE = '4lltools:scoreboard'
type Mode = 'badminton' | 'tabletennis' | 'volleyball' | 'football' | 'futsal' | 'free'
const MODES: [Mode, string][] = [
  ['badminton', 'Badminton'],
  ['tabletennis', 'Table tennis'],
  ['volleyball', 'Volleyball'],
  ['futsal', 'Futsal'],
  ['football', 'Football'],
  ['free', 'Card & board games'],
]

type WakeLockLike = { release: () => Promise<void> }

export default function Scoreboard() {
  const [mode, setMode] = useState<Mode>('badminton')
  const [teams, setTeams] = useState<[Team, Team]>([{ name: 'Home', color: COLORS[0] }, { name: 'Away', color: COLORS[1] }])
  const [players, setPlayers] = useState<Player[]>(() => ['Ayu', 'Budi', 'Citra', 'Dimas'].map((name, i) => ({ id: i + 1, name, color: COLORS[i], score: 0 })))
  const [swapped, setSwapped] = useState(false)
  const [awake, setAwake] = useState(false)
  const [msg, setMsg] = useState('')
  const lock = useRef<WakeLockLike | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const ready = useRef(false)

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) ?? 'null')
      if (s) {
        if (MODES.some(([m]) => m === s.mode)) setMode(s.mode)
        if (Array.isArray(s.teams) && s.teams.length === 2) setTeams(s.teams)
        if (Array.isArray(s.players) && s.players.length >= 2 && s.players.length <= 8) setPlayers(s.players)
      }
    } catch {
      // Defaults.
    }
    ready.current = true
    return () => void lock.current?.release().catch(() => {})
  }, [])
  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(STORE, JSON.stringify({ mode, teams, players }))
    } catch {
      // Not saved.
    }
  }, [mode, teams, players])

  // Wake locks are dropped when the tab is hidden; take it again on return.
  useEffect(() => {
    if (!awake) return
    const again = () => { if (document.visibilityState === 'visible') void request() }
    document.addEventListener('visibilitychange', again)
    return () => document.removeEventListener('visibilitychange', again)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awake])

  async function request() {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockLike> } }).wakeLock
    if (!wl) {
      setMsg('This browser cannot keep the screen on. Raise your screen timeout in settings instead.')
      return false
    }
    try {
      lock.current = await wl.request('screen')
      return true
    } catch {
      setMsg('The screen could not be kept awake (battery saver may block it).')
      return false
    }
  }
  async function toggleAwake() {
    setMsg('')
    if (awake) {
      await lock.current?.release().catch(() => {})
      lock.current = null
      setAwake(false)
    } else if (await request()) setAwake(true)
  }
  async function fullscreen() {
    setMsg('')
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (box.current?.requestFullscreen) await box.current.requestFullscreen()
      else setMsg('Fullscreen is not available here. On iPhone, add the page to your home screen.')
    } catch {
      setMsg('Fullscreen was blocked by the browser.')
    }
  }

  const rally = mode === 'badminton' || mode === 'tabletennis' || mode === 'volleyball'
  return (
    <div className="sb" ref={box}>
      <div className="sb-top">
        <Select label="Game" value={mode} options={MODES} onChange={(m) => { setMode(m); setSwapped(false) }} />
        {mode !== 'free' && (
          <div className="sb-teams">
            {teams.map((t, i) => (
              <div key={i} className="sb-team">
                <input type="color" value={t.color} aria-label={`Team ${i + 1} color`} onChange={(e) => setTeams(teams.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)) as [Team, Team])} />
                <input value={t.name} aria-label={`Team ${i + 1} name`} onChange={(e) => setTeams(teams.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) as [Team, Team])} />
              </div>
            ))}
          </div>
        )}
      </div>

      {rally && <RallyBoard key={mode} sport={mode} teams={teams} swapped={swapped} setSwapped={setSwapped} />}
      {(mode === 'football' || mode === 'futsal') && <GoalBoard key={mode} futsal={mode === 'futsal'} teams={teams} swapped={swapped} />}
      {mode === 'free' && <FreeBoard players={players} setPlayers={setPlayers} />}

      <div className="row sb-tools">
        {mode !== 'free' && <button type="button" className="btn btn-icon" onClick={() => setSwapped(!swapped)}><Icon name="arrows-collapse-full" size={18} />Swap sides</button>}
        <button type="button" className={`btn btn-icon ${awake ? 'primary' : ''}`} onClick={toggleAwake} aria-pressed={awake}><Icon name="lightbulb-shine" size={18} />{awake ? 'Screen stays on' : 'Keep screen on'}</button>
        <button type="button" className="btn btn-icon" onClick={fullscreen}><Icon name="maximize" size={18} />Fullscreen</button>
      </div>
      {msg && <p className="muted sb-msg">{msg}</p>}
      <Hint>Tap a team's half to give it a point; the rules handle deuce, caps, serving and changing ends. Undo fixes a mis-tap, and names and colors are remembered on this device.</Hint>
    </div>
  )
}
