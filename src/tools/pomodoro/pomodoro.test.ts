import { describe, expect, it } from 'vitest'
import { initState, mmss, reducer, remaining, type TimerState } from './pomodoro'

const MIN = 60_000

describe('pomodoro timer', () => {
  it('starts, pauses and resumes from wall-clock time', () => {
    let s = reducer(initState(), { type: 'start', now: 0 })
    expect(s.endsAt).toBe(25 * MIN)
    expect(remaining(s, 10 * MIN)).toBe(15 * MIN)
    s = reducer(s, { type: 'pause', now: 10 * MIN })
    expect(s.running).toBe(false)
    expect(remaining(s, 99 * MIN)).toBe(15 * MIN)
    s = reducer(s, { type: 'start', now: 100 * MIN })
    expect(s.endsAt).toBe(115 * MIN)
  })

  it('moves to a short break when focus ends, and a long one every 4th', () => {
    let s: TimerState = reducer(initState(), { type: 'start', now: 0 })
    expect(reducer(s, { type: 'tick', now: 25 * MIN - 1 })).toBe(s)
    s = reducer(s, { type: 'tick', now: 25 * MIN })
    expect(s).toMatchObject({ phase: 'short', done: 1, running: false, finished: 1, lastFinished: 'focus', left: 5 * MIN })
    for (let i = 0; i < 3; i++) {
      s = reducer(reducer(s, { type: 'phase', phase: 'focus' }), { type: 'start', now: 0 })
      s = reducer(s, { type: 'tick', now: 25 * MIN })
    }
    expect(s.phase).toBe('long')
    expect(s.done).toBe(4)
  })

  it('auto-starts the next phase when asked', () => {
    let s = reducer(initState(), { type: 'settings', settings: { autoStart: true, focus: 1 } })
    expect(s.left).toBe(MIN)
    s = reducer(reducer(s, { type: 'start', now: 0 }), { type: 'tick', now: MIN + 500 })
    expect(s).toMatchObject({ phase: 'short', running: true, endsAt: MIN + 500 + 5 * MIN })
    s = reducer(s, { type: 'tick', now: 7 * MIN })
    expect(s.phase).toBe('focus')
  })

  it('skips without counting a session and resets the phase', () => {
    let s = reducer(initState(), { type: 'skip', now: 0 })
    expect(s).toMatchObject({ phase: 'short', done: 0, finished: 0 })
    s = reducer(reducer(s, { type: 'start', now: 0 }), { type: 'reset' })
    expect(s).toMatchObject({ running: false, left: 5 * MIN })
  })

  it('formats the countdown', () => {
    expect(mmss(25 * MIN)).toBe('25:00')
    expect(mmss(61_001)).toBe('01:02')
    expect(mmss(0)).toBe('00:00')
  })
})
