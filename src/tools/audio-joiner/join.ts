export interface JoinItem {
  id: number
  name: string
  duration: number
}

export function totalDuration(items: JoinItem[]): number {
  return items.reduce((sum, item) => sum + Math.max(0, item.duration), 0)
}

export function clampGap(gapSec: number): number {
  if (!Number.isFinite(gapSec)) return 0
  return Math.min(5, Math.max(0, gapSec))
}

export function outputName(firstName: string, count: number, ext: string): string {
  const base = firstName.replace(/\.[^.]+$/, '') || 'audio'
  return `${base}-joined-${count}-tracks.${ext}`
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list
  const copy = list.slice()
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}
