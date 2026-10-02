/** Tasbih counter: a sequence of dhikr, each with a target, that advances on its own. */

export interface Dhikr {
  label: string
  arabic?: string
  /** 0 means no target (a free tally). */
  target: number
}

export interface Preset {
  id: string
  name: string
  seq: Dhikr[]
}

export const PRESETS: Preset[] = [
  {
    id: 'after-salat',
    name: 'After salat (33·33·34)',
    seq: [
      { label: 'Subhanallah', arabic: 'سُبْحَانَ ٱللَّٰهِ', target: 33 },
      { label: 'Alhamdulillah', arabic: 'ٱلْحَمْدُ لِلَّٰهِ', target: 33 },
      { label: 'Allahu Akbar', arabic: 'ٱللَّٰهُ أَكْبَرُ', target: 34 },
    ],
  },
  { id: 'subhanallah', name: 'Subhanallah 33', seq: [{ label: 'Subhanallah', arabic: 'سُبْحَانَ ٱللَّٰهِ', target: 33 }] },
  { id: 'alhamdulillah', name: 'Alhamdulillah 33', seq: [{ label: 'Alhamdulillah', arabic: 'ٱلْحَمْدُ لِلَّٰهِ', target: 33 }] },
  { id: 'allahuakbar', name: 'Allahu Akbar 34', seq: [{ label: 'Allahu Akbar', arabic: 'ٱللَّٰهُ أَكْبَرُ', target: 34 }] },
  { id: 'tahlil', name: 'La ilaha illallah 100', seq: [{ label: 'La ilaha illallah', arabic: 'لَا إِلَٰهَ إِلَّا ٱللَّٰهُ', target: 100 }] },
  { id: 'istighfar', name: 'Istighfar 100', seq: [{ label: 'Astaghfirullah', arabic: 'أَسْتَغْفِرُ ٱللَّٰهَ', target: 100 }] },
  { id: 'free', name: 'Free tally (no target)', seq: [{ label: 'Count', target: 0 }] },
]

export interface CounterState {
  seq: Dhikr[]
  /** Which dhikr in the sequence is active. */
  index: number
  /** Count within the active dhikr. */
  count: number
  /** Every tap since the last reset. */
  total: number
  /** Full passes through the sequence. */
  rounds: number
  /** What the last tap did, for feedback (vibration, sound, animation). */
  event: 'none' | 'tap' | 'target' | 'round'
  /** Previous states for undo (most recent last). */
  past: Omit<CounterState, 'past'>[]
}

export type Action = { type: 'tap' } | { type: 'undo' } | { type: 'reset' } | { type: 'load'; seq: Dhikr[] } | { type: 'restore'; state: Partial<CounterState> }

const UNDO_LIMIT = 300

export function initCounter(seq: Dhikr[]): CounterState {
  return { seq, index: 0, count: 0, total: 0, rounds: 0, event: 'none', past: [] }
}

function snapshot(s: CounterState): Omit<CounterState, 'past'> {
  const { past: _past, ...rest } = s
  void _past
  return rest
}

export function counterReducer(s: CounterState, a: Action): CounterState {
  switch (a.type) {
    case 'tap': {
      const past = [...s.past, snapshot(s)].slice(-UNDO_LIMIT)
      const cur = s.seq[s.index]
      const count = s.count + 1
      const total = s.total + 1
      if (!cur || cur.target <= 0 || count < cur.target) return { ...s, count, total, event: 'tap', past }
      // Target reached: move on to the next dhikr (or wrap to the start and count a round).
      const last = s.index === s.seq.length - 1
      return { ...s, index: last ? 0 : s.index + 1, count: 0, total, rounds: last ? s.rounds + 1 : s.rounds, event: last ? 'round' : 'target', past }
    }
    case 'undo': {
      const prev = s.past[s.past.length - 1]
      if (!prev) return s
      return { ...prev, event: 'none', past: s.past.slice(0, -1) }
    }
    case 'reset':
      return initCounter(s.seq)
    case 'load':
      return initCounter(a.seq)
    case 'restore': {
      const r = a.state
      const seq = Array.isArray(r.seq) && r.seq.length ? r.seq : s.seq
      const index = Number.isInteger(r.index) && r.index! >= 0 && r.index! < seq.length ? r.index! : 0
      const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)
      return { seq, index, count: num(r.count), total: num(r.total), rounds: num(r.rounds), event: 'none', past: [] }
    }
  }
}

/** Taps that make up one full pass of the sequence (0 when any step has no target). */
export function roundLength(seq: Dhikr[]): number {
  return seq.some((d) => d.target <= 0) ? 0 : seq.reduce((n, d) => n + d.target, 0)
}

/** Local YYYY-MM-DD key for daily totals. */
export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
