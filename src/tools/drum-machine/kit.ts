import type { DrumId } from './logic'

/** Eight synthesized drums on one AudioContext. */
export class DrumKit {
  ctx: AudioContext
  private out: GainNode
  private noise: AudioBuffer
  private open: GainNode | null = null

  constructor() {
    this.ctx = new AudioContext()
    const comp = this.ctx.createDynamicsCompressor()
    comp.threshold.value = -10
    comp.ratio.value = 3
    this.out = this.ctx.createGain()
    this.out.gain.value = 0.9
    this.out.connect(comp).connect(this.ctx.destination)
    const len = this.ctx.sampleRate
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const d = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  }

  private env(t: number, peak: number, decay: number, dest: AudioNode = this.out) {
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    g.connect(dest)
    return g
  }

  private osc(type: OscillatorType, f0: number, f1: number, t: number, dur: number, dest: AudioNode) {
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6)
    o.connect(dest)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  private hiss(t: number, dur: number, type: BiquadFilterType, freq: number, dest: AudioNode, q = 0.8) {
    const s = this.ctx.createBufferSource()
    s.buffer = this.noise
    const f = this.ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    s.connect(f).connect(dest)
    s.start(t, Math.random() * 0.5, dur + 0.02)
  }

  play(id: DrumId, t: number, vol = 1) {
    const v = Math.max(0.0002, vol)
    switch (id) {
      case 'kick':
        this.osc('sine', 160, 42, t, 0.45, this.env(t, 1 * v, 0.45))
        this.osc('triangle', 900, 120, t, 0.02, this.env(t, 0.25 * v, 0.02))
        break
      case 'snare':
        this.hiss(t, 0.2, 'highpass', 1200, this.env(t, 0.55 * v, 0.2))
        this.osc('triangle', 220, 160, t, 0.12, this.env(t, 0.45 * v, 0.12))
        break
      case 'clap': {
        for (const k of [0, 0.011, 0.022]) this.hiss(t + k, 0.02, 'bandpass', 1300, this.env(t + k, 0.6 * v, 0.02), 1.4)
        this.hiss(t + 0.03, 0.22, 'bandpass', 1200, this.env(t + 0.03, 0.4 * v, 0.22), 1.2)
        break
      }
      case 'chat':
        if (this.open) this.open.gain.setTargetAtTime(0.0001, t, 0.01)
        this.hiss(t, 0.05, 'highpass', 7500, this.env(t, 0.35 * v, 0.05))
        break
      case 'ohat': {
        const g = this.env(t, 0.3 * v, 0.4)
        this.open = g
        this.hiss(t, 0.4, 'highpass', 7000, g)
        break
      }
      case 'tom':
        this.osc('sine', 240, 120, t, 0.32, this.env(t, 0.8 * v, 0.32))
        break
      case 'rim':
        this.osc('square', 1750, 1750, t, 0.03, this.env(t, 0.25 * v, 0.03))
        this.hiss(t, 0.025, 'bandpass', 3200, this.env(t, 0.3 * v, 0.025), 3)
        break
      case 'cow': {
        const bp = this.ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 800
        bp.Q.value = 1.5
        bp.connect(this.env(t, 0.35 * v, 0.3))
        this.osc('square', 540, 540, t, 0.3, bp)
        this.osc('square', 800, 800, t, 0.3, bp)
        break
      }
    }
  }

  close() {
    void this.ctx.close()
  }
}
