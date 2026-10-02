import { stepsToFinish, type SortId } from '../sorting-visualizer/sorts'

export interface RaceResult {
  id: SortId
  steps: number
}

/** Runs every sort on its own copy of `data` and ranks them by work steps needed (fewest first). */
export function raceOrder(ids: SortId[], data: number[]): RaceResult[] {
  return ids.map((id) => ({ id, steps: stepsToFinish(id, data) })).sort((a, b) => a.steps - b.steps)
}

/** Columns and rows for k panels: 2×2 up to four, then three across. */
export function gridShape(k: number): { cols: number; rows: number } {
  const cols = k <= 4 ? 2 : 3
  return { cols, rows: Math.max(1, Math.ceil(k / cols)) }
}

/** Log-scale speed slider value (0–100) → work steps per frame, 0.1 … 10 000. */
export const raceSteps = (v: number) => 0.1 * 10 ** ((v / 100) * 5)
