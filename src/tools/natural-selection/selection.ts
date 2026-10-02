import { TAU, clamp, gaussian, mean } from '../../sim/math'

export interface Genes {
  speed: number
  size: number
  sense: number
}

export const BOUNDS: Record<keyof Genes, [number, number]> = {
  speed: [0.2, 4],
  size: [0.3, 3],
  sense: [0.2, 4],
}

/** Each gene is scaled by (1 + rate·N(0,1)) and clamped to its bounds. */
export function mutate(g: Genes, rate: number, random: () => number): Genes {
  const out = { ...g }
  for (const k of Object.keys(BOUNDS) as (keyof Genes)[]) out[k] = clamp(g[k] * (1 + rate * gaussian(random)), BOUNDS[k][0], BOUNDS[k][1])
  return out
}

/** Energy burned per second of moving: big fast bodies are expensive, and so is a wide sense. */
export function energyCost(g: Genes): number {
  return g.size ** 3 * g.speed ** 2 + g.sense
}

export const ENERGY = 25
export const BASE_SPEED = 40
export const BASE_SENSE = 45
export const DAY = 15
const MAX_POP = 400

export const radiusOf = (g: Genes) => 3 + g.size * 4

export interface Creature {
  id: number
  x: number
  y: number
  a: number
  genes: Genes
  energy: number
  eaten: number
  alive: boolean
}

export interface Food {
  x: number
  y: number
  eaten: boolean
}

export interface DayStats {
  pop: number
  speed: number
  size: number
  sense: number
}

export interface World {
  size: number
  creatures: Creature[]
  food: Food[]
  day: number
  t: number
  nextId: number
  history: DayStats[]
}

export function stats(w: World): DayStats {
  const c = w.creatures
  return { pop: c.length, speed: mean(c.map((k) => k.genes.speed)), size: mean(c.map((k) => k.genes.size)), sense: mean(c.map((k) => k.genes.sense)) }
}

export function createWorld(size: number, count: number, foodCount: number, random: () => number): World {
  const w: World = { size, creatures: [], food: [], day: 1, t: 0, nextId: 0, history: [] }
  for (let i = 0; i < count; i++) w.creatures.push({ id: w.nextId++, x: 0, y: 0, a: 0, genes: { speed: 1, size: 1, sense: 1 }, energy: ENERGY, eaten: 0, alive: true })
  startDay(w, foodCount, random)
  w.history.push(stats(w))
  return w
}

/** Creatures line up around the edge and fresh food is scattered inside. */
export function startDay(w: World, foodCount: number, random: () => number) {
  const s = w.size
  const n = w.creatures.length
  const offset = random()
  w.creatures.forEach((c, i) => {
    const u = ((i + offset) / Math.max(1, n)) * 4
    const side = Math.floor(u)
    const f = u - side
    const m = 8
    ;[c.x, c.y] = side === 0 ? [m + f * (s - 2 * m), m] : side === 1 ? [s - m, m + f * (s - 2 * m)] : side === 2 ? [s - m - f * (s - 2 * m), s - m] : [m, s - m - f * (s - 2 * m)]
    c.a = Math.atan2(s / 2 - c.y, s / 2 - c.x) + (random() - 0.5)
    c.energy = ENERGY
    c.eaten = 0
    c.alive = true
  })
  w.food = Array.from({ length: foodCount }, () => ({ x: 30 + random() * (s - 60), y: 30 + random() * (s - 60), eaten: false }))
  w.t = 0
}

const full = (c: Creature) => c.eaten >= 2

/** Moves everyone for dt seconds. Returns true when the day is over. */
export function stepDay(w: World, dt: number, predation: boolean, random: () => number): boolean {
  const s = w.size
  w.t += dt
  let active = 0
  for (const c of w.creatures) {
    if (!c.alive || full(c) || c.energy <= 0) continue
    active++
    const range = c.genes.sense * BASE_SENSE
    let tx = NaN
    let ty = NaN
    let best = range * range
    let flee = false
    // Danger first: run from anything big enough to eat you.
    if (predation)
      for (const o of w.creatures) {
        if (!o.alive || o === c || o.genes.size < c.genes.size * 1.2) continue
        const d = (o.x - c.x) ** 2 + (o.y - c.y) ** 2
        if (d < best) {
          best = d
          tx = c.x - (o.x - c.x)
          ty = c.y - (o.y - c.y)
          flee = true
        }
      }
    if (!flee) {
      for (const f of w.food) {
        if (f.eaten) continue
        const d = (f.x - c.x) ** 2 + (f.y - c.y) ** 2
        if (d < best) (best = d), (tx = f.x), (ty = f.y)
      }
      if (predation)
        for (const o of w.creatures) {
          if (!o.alive || o === c || c.genes.size < o.genes.size * 1.2) continue
          const d = (o.x - c.x) ** 2 + (o.y - c.y) ** 2
          if (d < best) (best = d), (tx = o.x), (ty = o.y)
        }
    }
    if (Number.isFinite(tx)) c.a = Math.atan2(ty - c.y, tx - c.x)
    else c.a += (random() - 0.5) * 6 * Math.sqrt(dt)
    const v = c.genes.speed * BASE_SPEED
    c.x += Math.cos(c.a) * v * dt
    c.y += Math.sin(c.a) * v * dt
    const r = radiusOf(c.genes)
    if (c.x < r) (c.x = r), (c.a = Math.PI - c.a)
    if (c.x > s - r) (c.x = s - r), (c.a = Math.PI - c.a)
    if (c.y < r) (c.y = r), (c.a = -c.a)
    if (c.y > s - r) (c.y = s - r), (c.a = -c.a)
    c.energy -= energyCost(c.genes) * dt
    for (const f of w.food)
      if (!f.eaten && Math.hypot(f.x - c.x, f.y - c.y) < r + 2) {
        f.eaten = true
        c.eaten++
        if (full(c)) break
      }
    if (predation && !full(c))
      for (const o of w.creatures)
        if (o.alive && o !== c && c.genes.size >= o.genes.size * 1.2 && Math.hypot(o.x - c.x, o.y - c.y) < r) {
          o.alive = false
          c.eaten++
          break
        }
  }
  const foodLeft = w.food.some((f) => !f.eaten)
  return w.t >= DAY || active === 0 || (!foodLeft && !predation)
}

/** Nobody who ate nothing survives; one meal keeps you alive; two meals also buys a mutated child. */
export function endDay(w: World, mutationRate: number, random: () => number) {
  const next: Creature[] = []
  for (const c of w.creatures) {
    if (!c.alive || c.eaten < 1) continue
    next.push(c)
    if (c.eaten >= 2 && next.length < MAX_POP) next.push({ ...c, id: w.nextId++, genes: mutate(c.genes, mutationRate, random), a: random() * TAU })
  }
  w.creatures = next
  w.day++
  w.history.push(stats(w))
}
