export interface NormalizePlan {
  peak: number
  peakDb: number
  targetDb: number
  gain: number
  outPeakDb: number
  alreadyNormalized: boolean
}

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20)
}

export function gainToDb(gain: number): number {
  return gain <= 0 ? -Infinity : 20 * Math.log10(gain)
}

export function recommendedGain(peak: number, targetDb: number): number {
  if (!(peak > 0)) return 1
  return dbToGain(targetDb) / peak
}

export function normalizePlan(peak: number, targetDb: number): NormalizePlan {
  const safePeak = Math.max(0, peak)
  const gain = recommendedGain(safePeak, targetDb)
  return {
    peak: safePeak,
    peakDb: gainToDb(safePeak),
    targetDb,
    gain,
    outPeakDb: safePeak > 0 ? targetDb : -Infinity,
    alreadyNormalized: safePeak > 0 && Math.abs(gainToDb(safePeak) - targetDb) < 0.5,
  }
}

export const TARGETS: { db: number; label: string }[] = [
  { db: -1, label: '-1 dB (loud, streaming standard)' },
  { db: -3, label: '-3 dB (safe, no clipping risk)' },
  { db: -6, label: '-6 dB (quiet headroom)' },
]
