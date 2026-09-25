export type Phase = 'focus' | 'short' | 'long'

export interface Settings {
  /** Minutes. */
  focus: number
  short: number
  long: number
  /** A long break after this many focus sessions. */
  longEvery: number
  autoStart: boolean
}

export interface TimerState {
  phase: Phase
  running: boolean
  /** Date.now() when the current phase ends, while running. */
  endsAt: number | null
  /** Milliseconds left, while paused. */
  left: number
  /** Focus sessions finished in this cycle run. */
  done: number
  /** Bumps each time a phase finishes on its own, so the UI can chime once. */
  finished: number
  lastFinished: Phase | null
  settings: Settings
}

export type Action =
  | { type: 'start'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'reset' }
  | { type: 'skip'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'phase'; phase: Phase }
  | { type: 'settings'; settings: Partial<Settings> }

export const DEFAULT_SETTINGS: Settings = { focus: 25, short: 5, long: 15, longEvery: 4, autoStart: false }

export const PHASE_LABEL: Record<Phase, string> = { focus: 'Focus', short: 'Short break', long: 'Long break' }

export function lengthOf(phase: Phase, s: Settings): number {
  return Math.max(1, s[phase]) * 60_000
}

export function initState(settings: Settings = DEFAULT_SETTINGS): TimerState {
  return { phase: 'focus', running: false, endsAt: null, left: lengthOf('focus', settings), done: 0, finished: 0, lastFinished: null, settings }
}

export function nextPhase(phase: Phase, done: number, longEvery: number): Phase {
  if (phase !== 'focus') return 'focus'
  return done > 0 && done % Math.max(1, longEvery) === 0 ? 'long' : 'short'
}

export function remaining(s: TimerState, now: number): number {
  return s.running && s.endsAt !== null ? Math.max(0, s.endsAt - now) : s.left
}

function advance(s: TimerState, now: number, natural: boolean): TimerState {
  const done = s.phase === 'focus' && natural ? s.done + 1 : s.done
  const phase = nextPhase(s.phase, s.phase === 'focus' ? s.done + 1 : done, s.settings.longEvery)
  const len = lengthOf(phase, s.settings)
  const run = natural ? s.settings.autoStart : s.running
  return {
    ...s,
    phase,
    done,
    running: run,
    endsAt: run ? now + len : null,
    left: len,
    finished: natural ? s.finished + 1 : s.finished,
    lastFinished: natural ? s.phase : s.lastFinished,
  }
}

export function reducer(s: TimerState, a: Action): TimerState {
  switch (a.type) {
    case 'start':
      return s.running ? s : { ...s, running: true, endsAt: a.now + s.left }
    case 'pause':
      return s.running ? { ...s, running: false, left: remaining(s, a.now), endsAt: null } : s
    case 'reset':
      return { ...s, running: false, endsAt: null, left: lengthOf(s.phase, s.settings) }
    case 'skip':
      return advance(s, a.now, false)
    case 'tick':
      return s.running && s.endsAt !== null && a.now >= s.endsAt ? advance(s, a.now, true) : s
    case 'phase':
      return { ...s, phase: a.phase, running: false, endsAt: null, left: lengthOf(a.phase, s.settings) }
    case 'settings': {
      const settings = { ...s.settings, ...a.settings }
      // Changing a length restarts the current phase only when it is idle and untouched.
      const idle = !s.running && s.left === lengthOf(s.phase, s.settings)
      return { ...s, settings, left: idle ? lengthOf(s.phase, settings) : s.left }
    }
  }
}

export function mmss(ms: number): string {
  const total = Math.ceil(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
