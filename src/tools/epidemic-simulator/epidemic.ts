import { TAU, gaussian, rk4 } from '../../sim/math'

/** Health states of an agent. */
export const SUS = 0
export const INF = 1
export const REC = 2
export const VAC = 3
export const DEAD = 4

export type Extra = 'none' | 'market' | 'quarantine'

export interface EpiParams {
  /** Contact distance in box units. */
  radius: number
  /** Chance per day of passing the infection to each susceptible within the radius. */
  pInfect: number
  recoverDays: number
  /** Chance that an infection ends in death. */
  mortality: number
  extra: Extra
}

/** Walking speed in box units per day. */
export const SPEED = 60
/** Side of the quarantine square in the top-left corner. */
export const QZONE = 110
/** Half-size of the central market square. */
export const MARKET = 30

export interface World {
  n: number
  w: number
  h: number
  x: Float32Array
  y: Float32Array
  ang: Float32Array
  state: Uint8Array
  still: Uint8Array
  quarantined: Uint8Array
  /** 0 wandering, 1 walking to the market, 2 shopping. */
  trip: Uint8Array
  until: Float32Array
  infectedAt: Float32Array
  recoverAt: Float32Array
  endedAt: Float32Array
  /** Secondary infections caused by each agent. */
  caused: Uint16Array
  /** Fixed random keys used to pick who distances and who is vaccinated. */
  keyStill: Float32Array
  keyVac: Float32Array
  day: number
  everInfected: number
  peak: number
  peakDay: number
  /** Counts sampled every half day: [S, I, R, V, D] per sample. */
  history: number[][]
  nextSample: number
}

export function createWorld(n: number, w: number, h: number, distancing: number, vaccinated: number, seeds: number, extra: Extra, random: () => number): World {
  const wd: World = {
    n,
    w,
    h,
    x: new Float32Array(n),
    y: new Float32Array(n),
    ang: new Float32Array(n),
    state: new Uint8Array(n),
    still: new Uint8Array(n),
    quarantined: new Uint8Array(n),
    trip: new Uint8Array(n),
    until: new Float32Array(n),
    infectedAt: new Float32Array(n),
    recoverAt: new Float32Array(n),
    endedAt: new Float32Array(n).fill(-1),
    caused: new Uint16Array(n),
    keyStill: new Float32Array(n),
    keyVac: new Float32Array(n),
    day: 0,
    everInfected: 0,
    peak: 0,
    peakDay: 0,
    history: [],
    nextSample: 0,
  }
  for (let i = 0; i < n; i++) {
    do {
      wd.x[i] = 4 + random() * (w - 8)
      wd.y[i] = 4 + random() * (h - 8)
    } while (extra === 'quarantine' && wd.x[i] < QZONE + 4 && wd.y[i] < QZONE + 4)
    wd.ang[i] = random() * TAU
    wd.keyStill[i] = random()
    wd.keyVac[i] = random()
  }
  applyPolicies(wd, distancing, vaccinated)
  // Seed the outbreak with people who are neither vaccinated nor staying still.
  let k = 0
  for (let i = 0; i < n && k < seeds; i++)
    if (wd.state[i] === SUS && !wd.still[i]) {
      infect(wd, i, 12, random)
      k++
    }
  record(wd)
  return wd
}

/** Re-applies the distancing and vaccination shares using each agent's fixed random key. */
export function applyPolicies(wd: World, distancing: number, vaccinated: number) {
  for (let i = 0; i < wd.n; i++) {
    wd.still[i] = wd.keyStill[i] < distancing ? 1 : 0
    const s = wd.state[i]
    if (s === SUS && wd.keyVac[i] < vaccinated) wd.state[i] = VAC
    else if (s === VAC && wd.keyVac[i] >= vaccinated) wd.state[i] = SUS
  }
}

function infect(wd: World, i: number, recoverDays: number, random: () => number) {
  wd.state[i] = INF
  wd.infectedAt[i] = wd.day
  wd.recoverAt[i] = wd.day + recoverDays * (0.6 + 0.8 * random())
  wd.everInfected++
}

/** Infects agent i by hand (a click). Returns false when it cannot be infected. */
export function infectAgent(wd: World, i: number, recoverDays: number, random: () => number): boolean {
  if (wd.state[i] !== SUS) return false
  infect(wd, i, recoverDays, random)
  return true
}

export function counts(wd: World): [number, number, number, number, number] {
  const c: [number, number, number, number, number] = [0, 0, 0, 0, 0]
  for (let i = 0; i < wd.n; i++) c[wd.state[i]]++
  return c
}

function record(wd: World) {
  const c = counts(wd)
  wd.history.push(c)
  if (c[INF] > wd.peak) {
    wd.peak = c[INF]
    wd.peakDay = wd.day
  }
  wd.nextSample += 0.5
}

/** Advances the crowd by dt days: walking, transmission, detection and recovery. */
export function stepWorld(wd: World, p: EpiParams, dt: number, random: () => number) {
  const { n, x, y, ang, state, still, quarantined: q, trip, until, w, h } = wd
  wd.day += dt
  const day = wd.day
  const cx = w / 2
  const cy = h / 2
  for (let i = 0; i < n; i++) {
    if (state[i] === DEAD || still[i]) continue
    let sp = SPEED
    if (p.extra === 'market' && !q[i]) {
      if (trip[i] === 0 && random() < 0.35 * dt) trip[i] = 1
      if (trip[i] === 1) {
        ang[i] = Math.atan2(cy - y[i], cx - x[i]) + gaussian(random) * 0.3
        sp = SPEED * 2.2
        if (Math.abs(x[i] - cx) < MARKET - 4 && Math.abs(y[i] - cy) < MARKET - 4) {
          trip[i] = 2
          until[i] = day + 0.3 + random() * 0.4
        }
      } else if (trip[i] === 2) {
        sp = SPEED * 0.5
        if (day > until[i]) trip[i] = 0
      }
    } else trip[i] = 0
    if (trip[i] !== 1) ang[i] += gaussian(random) * 2.2 * Math.sqrt(dt)
    x[i] += Math.cos(ang[i]) * sp * dt
    y[i] += Math.sin(ang[i]) * sp * dt
    let loX = 2
    let loY = 2
    let hiX = w - 2
    let hiY = h - 2
    if (q[i]) {
      hiX = QZONE - 4
      hiY = QZONE - 4
      loX = loY = 4
    } else if (trip[i] === 2) {
      loX = cx - MARKET + 3
      hiX = cx + MARKET - 3
      loY = cy - MARKET + 3
      hiY = cy + MARKET - 3
    }
    if (x[i] < loX) (x[i] = loX), (ang[i] = Math.PI - ang[i])
    if (x[i] > hiX) (x[i] = hiX), (ang[i] = Math.PI - ang[i])
    if (y[i] < loY) (y[i] = loY), (ang[i] = -ang[i])
    if (y[i] > hiY) (y[i] = hiY), (ang[i] = -ang[i])
    // Everyone else stays out of the quarantine square.
    if (p.extra === 'quarantine' && !q[i] && x[i] < QZONE + 3 && y[i] < QZONE + 3) {
      if (QZONE + 3 - x[i] < QZONE + 3 - y[i]) (x[i] = QZONE + 3), (ang[i] = Math.PI - ang[i])
      else (y[i] = QZONE + 3), (ang[i] = -ang[i])
    }
  }

  // Transmission: a uniform grid of susceptibles, searched around each infected agent.
  const r = p.radius
  const cell = Math.max(r, 6)
  const cols = Math.ceil(w / cell) + 1
  const rows = Math.ceil(h / cell) + 1
  const head = new Int32Array(cols * rows).fill(-1)
  const next = new Int32Array(n)
  const sources: number[] = []
  for (let i = 0; i < n; i++) {
    if (state[i] === SUS && !q[i]) {
      const k = Math.floor(y[i] / cell) * cols + Math.floor(x[i] / cell)
      next[i] = head[k]
      head[k] = i
    } else if (state[i] === INF && !q[i]) sources.push(i)
  }
  const pStep = 1 - Math.pow(1 - Math.min(p.pInfect, 1), dt)
  const r2 = r * r
  for (const i of sources) {
    const gx = Math.floor(x[i] / cell)
    const gy = Math.floor(y[i] / cell)
    for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        const cx2 = gx + ox
        const cy2 = gy + oy
        if (cx2 < 0 || cy2 < 0 || cx2 >= cols || cy2 >= rows) continue
        for (let j = head[cy2 * cols + cx2]; j >= 0; j = next[j]) {
          if (state[j] !== SUS) continue
          const dx = x[j] - x[i]
          const dy = y[j] - y[i]
          if (dx * dx + dy * dy < r2 && random() < pStep) {
            infect(wd, j, p.recoverDays, random)
            wd.caused[i]++
          }
        }
      }
  }

  for (let i = 0; i < n; i++) {
    if (state[i] !== INF) continue
    if (p.extra === 'quarantine' && !q[i] && day - wd.infectedAt[i] > 1.5 && random() < 0.7 * dt) {
      q[i] = 1
      x[i] = 8 + random() * (QZONE - 16)
      y[i] = 8 + random() * (QZONE - 16)
    }
    if (day >= wd.recoverAt[i]) {
      state[i] = random() < p.mortality ? DEAD : REC
      wd.endedAt[i] = day
      if (q[i] && state[i] === REC) {
        q[i] = 0
        x[i] = QZONE + 6 + random() * 20
        y[i] = 4 + random() * (QZONE - 8)
      }
    }
  }
  while (day >= wd.nextSample) record(wd)
}

/** Mean secondary infections among cases that ended in the last `window` days (NaN when too few). */
export function effectiveR(wd: World, window = 10): number {
  let sum = 0
  let k = 0
  for (let i = 0; i < wd.n; i++)
    if (wd.endedAt[i] >= 0 && wd.endedAt[i] >= wd.day - window) {
      sum += wd.caused[i]
      k++
    }
  return k >= 3 ? sum / k : NaN
}

/** SIR equations on fractions: dS = −βSI, dI = βSI − γI, dR = γI. */
export function sirDeriv(beta: number, gamma: number) {
  return (_t: number, y: number[]): number[] => {
    const inf = beta * y[0] * y[1]
    return [-inf, inf - gamma * y[1], gamma * y[1]]
  }
}

/**
 * The mean-field transmission rate that matches the agent model: each infected
 * neighbour is a hazard of −ln(1 − p) per day, and on average N·πr²/A people
 * share a disc of radius r.
 */
export function meanFieldBeta(pInfect: number, radius: number, n: number, area: number): number {
  return -Math.log(1 - Math.min(pInfect, 0.999)) * ((n * Math.PI * radius * radius) / area)
}

/** Integrates the SIR model with RK4 and returns [S, I, R] every `every` days. */
export function sirCurve(beta: number, gamma: number, s0: number, i0: number, days: number, dt = 0.05, every = 0.5): number[][] {
  let y = [s0, i0, 1 - s0 - i0]
  const out = [y]
  const f = sirDeriv(beta, gamma)
  const per = Math.round(every / dt)
  const steps = Math.round(days / dt)
  for (let k = 1; k <= steps; k++) {
    y = rk4(f, k * dt, y, dt)
    if (k % per === 0) out.push(y)
  }
  return out
}
