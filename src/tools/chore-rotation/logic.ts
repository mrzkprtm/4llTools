/**
 * Pure rotation scheduling for the chore planner. It works like a paper chore
 * wheel: chore c sits at slot c mod P, and each week the ring of P people turns
 * one step. Over any P consecutive weeks every person does every chore exactly
 * once, and weekly loads differ by at most one chore.
 */

/** Index of the person who does chore `c` in week `w` (P people). */
export function assignee(c: number, w: number, people: number): number {
  if (people <= 0) return -1
  return (((c + w) % people) + people) % people
}

/** schedule[k][c] = person index for chore c in week `from + k`. */
export function schedule(people: number, chores: number, weeks: number, from = 0): number[][] {
  return Array.from({ length: Math.max(0, weeks) }, (_, k) => Array.from({ length: chores }, (_, c) => assignee(c, from + k, people)))
}

/** The rotation repeats after this many weeks. */
export function cycleLength(people: number): number {
  return Math.max(1, people)
}

/** counts[p][c] = how often person p gets chore c in the schedule. */
export function tally(plan: number[][], people: number, chores: number): number[][] {
  const t = Array.from({ length: people }, () => new Array<number>(chores).fill(0))
  for (const week of plan) week.forEach((p, c) => p >= 0 && t[p][c]++)
  return t
}

/** Chores per person in one week. */
export function load(week: number[], people: number): number[] {
  const l = new Array<number>(people).fill(0)
  for (const p of week) if (p >= 0) l[p]++
  return l
}

/** Monday (local) of the week containing `d`, plus `weeks` weeks. */
export function mondayOf(d: Date, weeks = 0): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7) + weeks * 7)
  return m
}
