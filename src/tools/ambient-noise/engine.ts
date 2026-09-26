import { brownNoise, pinkNoise, swell, whiteNoise, type LayerId } from './noise'

const SCALE: Record<LayerId, number> = { white: 0.22, pink: 0.4, brown: 0.7, rain: 0.8, fan: 1, cafe: 0.9, ocean: 1 }

/** The Web Audio graph for every layer, built once after the first click. */
export class NoiseEngine {
  ctx: AudioContext
  private master: GainNode
  private layer = {} as Record<LayerId, GainNode>
  private vol = {} as Record<LayerId, number>
  private bufs: Record<'white' | 'pink' | 'brown', AudioBuffer>
  private oceanMod: GainNode
  private oceanLp: BiquadFilterNode
  private fanMod: GainNode
  private cafeMod: GainNode
  private timer = 0

  constructor() {
    const ctx = new AudioContext()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.connect(ctx.destination)
    const len = ctx.sampleRate * 5
    const mk = (data: Float32Array) => {
      const b = ctx.createBuffer(1, data.length, ctx.sampleRate)
      b.copyToChannel(data as Float32Array<ArrayBuffer>, 0)
      return b
    }
    this.bufs = { white: mk(whiteNoise(len)), pink: mk(pinkNoise(len)), brown: mk(brownNoise(len)) }
    for (const id of ['white', 'pink', 'brown', 'rain', 'fan', 'cafe', 'ocean'] as LayerId[]) {
      const g = ctx.createGain()
      g.gain.value = 0
      g.connect(this.master)
      this.layer[id] = g
      this.vol[id] = 0
    }
    this.loop('white', this.layer.white)
    this.loop('pink', this.layer.pink)
    this.loop('brown', this.layer.brown)
    // Rain: bright hiss plus droplets scheduled in tick().
    this.loop('pink', this.chain(this.layer.rain, this.filter('highpass', 700, 0.5), this.filter('lowpass', 8000, 0.5), this.gain(0.5)), 1.3)
    // Fan: low rumble and a little air, gently wobbling.
    this.fanMod = this.gain(1)
    this.fanMod.connect(this.layer.fan)
    this.loop('brown', this.chain(this.fanMod, this.filter('lowpass', 420, 0.7)), 2.1)
    this.loop('white', this.chain(this.fanMod, this.filter('bandpass', 1400, 0.6), this.gain(0.05)), 3.3)
    // Café: band-passed murmur whose level wanders, plus cup clinks.
    this.cafeMod = this.gain(0.6)
    this.cafeMod.connect(this.layer.cafe)
    this.loop('pink', this.chain(this.cafeMod, this.filter('bandpass', 650, 0.9), this.filter('peaking', 1800, 1, 4)), 0.7)
    // Ocean: a swelling low-passed roar.
    this.oceanMod = this.gain(0.3)
    this.oceanMod.connect(this.layer.ocean)
    this.oceanLp = this.filter('lowpass', 600, 0.6)
    this.oceanLp.connect(this.oceanMod)
    this.loop('brown', this.oceanLp, 0.4)
    this.loop('pink', this.chain(this.oceanLp, this.gain(0.35)), 2.6)
    this.timer = window.setInterval(() => this.tick(), 100)
  }

  private gain(v: number) {
    const g = this.ctx.createGain()
    g.gain.value = v
    return g
  }

  private filter(type: BiquadFilterType, freq: number, q: number, gainDb = 0) {
    const f = this.ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    f.gain.value = gainDb
    return f
  }

  /** Connects nodes in order to `dest`, returning the first as the chain input. */
  private chain(dest: AudioNode, ...nodes: AudioNode[]): AudioNode {
    let next = dest
    for (let i = nodes.length - 1; i >= 0; i--) {
      nodes[i].connect(next)
      next = nodes[i]
    }
    return next
  }

  private loop(kind: 'white' | 'pink' | 'brown', dest: AudioNode, offset = 0) {
    const s = this.ctx.createBufferSource()
    s.buffer = this.bufs[kind]
    s.loop = true
    s.connect(dest)
    s.start(0, offset)
  }

  private burst(t: number, dest: AudioNode, freq: number, q: number, level: number, decay: number) {
    const s = this.ctx.createBufferSource()
    s.buffer = this.bufs.white
    const f = this.filter('bandpass', freq, q)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(level, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    s.connect(f).connect(g).connect(dest)
    s.start(t, Math.random() * 4, decay + 0.02)
  }

  private clink(t: number) {
    for (const [f, v] of [[2600 + Math.random() * 1200, 0.05], [5200 + Math.random() * 900, 0.025]] as const) {
      const o = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      o.frequency.value = f
      g.gain.setValueAtTime(v, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
      o.connect(g).connect(this.layer.cafe)
      o.start(t)
      o.stop(t + 0.4)
    }
  }

  private tick() {
    const t = this.ctx.currentTime
    if (this.ctx.state !== 'running') return
    if (this.vol.ocean > 0) {
      const s = swell(t)
      this.oceanMod.gain.setTargetAtTime(0.12 + 0.88 * s, t, 0.12)
      this.oceanLp.frequency.setTargetAtTime(280 + 1700 * s, t, 0.2)
    }
    if (this.vol.fan > 0) this.fanMod.gain.setTargetAtTime(0.88 + 0.12 * Math.sin(t * 1.3), t, 0.1)
    if (this.vol.cafe > 0) {
      if (Math.random() < 0.25) this.cafeMod.gain.setTargetAtTime(0.35 + Math.random() * 0.65, t, 0.25)
      if (Math.random() < 0.012) this.clink(t + Math.random() * 0.1)
    }
    if (this.vol.rain > 0) {
      const drops = Math.floor(Math.random() * (2 + this.vol.rain / 25))
      for (let i = 0; i < drops; i++) this.burst(t + 0.05 + Math.random() * 0.1, this.layer.rain, 1800 + Math.random() * 4500, 4, 0.25 + Math.random() * 0.35, 0.02 + Math.random() * 0.03)
    }
  }

  /** Current ocean swell, for visuals. */
  swellNow() {
    return swell(this.ctx.currentTime)
  }

  setVolume(id: LayerId, v: number) {
    this.vol[id] = v
    this.layer[id].gain.setTargetAtTime((v / 100) ** 2 * SCALE[id], this.ctx.currentTime, 0.08)
  }

  setMaster(v: number) {
    this.master.gain.setTargetAtTime(Math.max(0, v), this.ctx.currentTime, 0.15)
  }

  close() {
    clearInterval(this.timer)
    void this.ctx.close()
  }
}
