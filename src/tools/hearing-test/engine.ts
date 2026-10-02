import { dbToGain } from './logic'

/** Peak amplitude of a 0 dB tone before the volume slider. Leaves headroom. */
const REF = 0.3

/** Small Web Audio helper: pure sine tones panned to one ear. Create only after a click. */
export class ToneEngine {
  ctx: AudioContext
  master: GainNode
  private live = new Set<OscillatorNode>()

  constructor() {
    this.ctx = new AudioContext()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.5
    this.master.connect(this.ctx.destination)
  }

  setVolume(v: number) {
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03)
  }

  private chain(freq: number, pan: number) {
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    const env = this.ctx.createGain()
    env.gain.value = 0
    const p = this.ctx.createStereoPanner()
    p.pan.value = pan
    osc.connect(env).connect(p).connect(this.master)
    this.live.add(osc)
    osc.onended = () => {
      this.live.delete(osc)
      osc.disconnect()
      env.disconnect()
      p.disconnect()
    }
    return { osc, env }
  }

  /** A tone of `dur` seconds at `db` relative to the reference, with soft edges so it does not click. */
  tone(freq: number, db: number, pan: number, dur = 1.2) {
    const { osc, env } = this.chain(freq, pan)
    const t = this.ctx.currentTime + 0.02
    const a = REF * dbToGain(db)
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(a, t + 0.06)
    env.gain.setValueAtTime(a, t + dur - 0.06)
    env.gain.linearRampToValueAtTime(0, t + dur)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  /** A steady tone until stopped; optionally sweeps exponentially to `to` Hz over `sweep` seconds. */
  hold(freq: number, db: number, pan: number, to?: number, sweep = 0) {
    const { osc, env } = this.chain(freq, pan)
    const t = this.ctx.currentTime + 0.02
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(REF * dbToGain(db), t + 0.08)
    if (to && sweep) {
      osc.frequency.setValueAtTime(freq, t)
      osc.frequency.exponentialRampToValueAtTime(to, t + sweep)
    }
    osc.start(t)
    return {
      startedAt: t,
      stop: () => {
        const n = this.ctx.currentTime
        env.gain.cancelScheduledValues(n)
        env.gain.setValueAtTime(env.gain.value, n)
        env.gain.linearRampToValueAtTime(0, n + 0.06)
        try { osc.stop(n + 0.08) } catch { /* already stopped */ }
      },
    }
  }

  stopAll() {
    for (const o of this.live) {
      try { o.stop() } catch { /* already stopped */ }
    }
  }

  close() {
    this.stopAll()
    void this.ctx.close().catch(() => {})
  }
}
