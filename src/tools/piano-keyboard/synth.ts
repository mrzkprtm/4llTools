/**
 * A small piano-ish synth on one AudioContext per tool: two detuned oscillators
 * and an octave partial through a closing low-pass, with a percussive envelope
 * that decays naturally while held. Created lazily after a click.
 */
export interface Voice {
  stop: (when?: number) => void
}

export class PianoSynth {
  ctx: AudioContext
  private out: GainNode

  constructor(volume = 0.8) {
    this.ctx = new AudioContext()
    const comp = this.ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 4
    this.out = this.ctx.createGain()
    this.out.gain.value = volume
    this.out.connect(comp).connect(this.ctx.destination)
  }

  resume() {
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  set volume(v: number) {
    this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03)
  }

  /** Starts a note now (or at `when`) that rings until `stop()` or its natural decay. */
  noteOn(midi: number, velocity = 0.8, when = this.ctx.currentTime, tone: 'piano' | 'pluck' = 'piano'): Voice {
    const ctx = this.ctx
    const f = 440 * 2 ** ((midi - 69) / 12)
    const t = Math.max(when, ctx.currentTime)
    const env = ctx.createGain()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    const bright = tone === 'pluck' ? 10 : 6
    lp.frequency.setValueAtTime(Math.min(12000, f * bright + 800), t)
    lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.4), t + (tone === 'pluck' ? 0.8 : 2.2))
    lp.connect(env).connect(this.out)
    // Lower notes ring longer, like real strings.
    const ring = tone === 'pluck' ? 1.8 : Math.max(1.2, 5.5 - (midi - 36) * 0.06)
    const peak = 0.22 * velocity
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(peak, t + 0.006)
    env.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.35)
    env.gain.exponentialRampToValueAtTime(0.0001, t + ring)
    const partials: [OscillatorType, number, number, number][] =
      tone === 'pluck'
        ? [['sawtooth', 1, 0, 0.5], ['triangle', 2, 3, 0.25]]
        : [['triangle', 1, -3, 0.6], ['triangle', 1, 3, 0.6], ['sine', 2, 0, 0.25], ['sine', 3, 1, 0.08]]
    const oscs = partials.map(([type, mult, detune, gain]) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = type
      o.frequency.value = f * mult
      o.detune.value = detune
      g.gain.value = gain
      o.connect(g).connect(lp)
      o.start(t)
      o.stop(t + ring + 0.1)
      return o
    })
    let stopped = false
    return {
      stop: (at = ctx.currentTime) => {
        if (stopped) return
        stopped = true
        const s = Math.max(at, t + 0.02)
        const g = env.gain as AudioParam & { cancelAndHoldAtTime?: (t: number) => void }
        if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(s)
        else g.cancelScheduledValues(s)
        env.gain.setTargetAtTime(0.0001, s, 0.08)
        oscs.forEach((o) => {
          try {
            o.stop(s + 0.6)
          } catch {
            // Already stopped.
          }
        })
      },
    }
  }

  /** Fire-and-forget note of `dur` seconds. */
  play(midi: number, when = this.ctx.currentTime, dur = 0.9, velocity = 0.8, tone: 'piano' | 'pluck' = 'piano') {
    this.noteOn(midi, velocity, when, tone).stop(when + dur)
  }

  close() {
    void this.ctx.close()
  }
}

/** Lazily creates the synth on first use (after a click) and closes it on unmount. */
export function lazySynth() {
  let synth: PianoSynth | null = null
  return {
    get(): PianoSynth | null {
      try {
        synth ??= new PianoSynth()
        synth.resume()
        return synth
      } catch {
        return null
      }
    },
    close() {
      synth?.close()
      synth = null
    },
  }
}
