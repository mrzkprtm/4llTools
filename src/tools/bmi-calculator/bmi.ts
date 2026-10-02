export type Scheme = 'who' | 'asia'
export type Sex = 'male' | 'female'

export interface BmiClass {
  label: string
  /** Indonesian label, shown under the English one. */
  id: string
  tone: 'low' | 'good' | 'warn' | 'high'
}

export const LB = 0.45359237
export const INCH = 2.54

export function bmiOf(weightKg: number, heightCm: number): number {
  const m = heightCm / 100
  if (!(weightKg > 0) || !(m > 0)) return NaN
  return weightKg / (m * m)
}

/** Upper bounds (exclusive) for each class. WHO global and WHO Asia-Pacific (WPRO 2000) cut-offs. */
export const CUTS: Record<Scheme, { max: number; cls: BmiClass }[]> = {
  who: [
    { max: 18.5, cls: { label: 'Underweight', id: 'Berat badan kurang', tone: 'low' } },
    { max: 25, cls: { label: 'Normal weight', id: 'Normal', tone: 'good' } },
    { max: 30, cls: { label: 'Overweight', id: 'Berat badan berlebih', tone: 'warn' } },
    { max: 35, cls: { label: 'Obesity class I', id: 'Obesitas I', tone: 'high' } },
    { max: 40, cls: { label: 'Obesity class II', id: 'Obesitas II', tone: 'high' } },
    { max: Infinity, cls: { label: 'Obesity class III', id: 'Obesitas III', tone: 'high' } },
  ],
  asia: [
    { max: 18.5, cls: { label: 'Underweight', id: 'Berat badan kurang', tone: 'low' } },
    { max: 23, cls: { label: 'Normal weight', id: 'Normal', tone: 'good' } },
    { max: 25, cls: { label: 'Overweight (at risk)', id: 'Berat badan berlebih', tone: 'warn' } },
    { max: 30, cls: { label: 'Obesity class I', id: 'Obesitas I', tone: 'high' } },
    { max: Infinity, cls: { label: 'Obesity class II', id: 'Obesitas II', tone: 'high' } },
  ],
}

export function classify(bmi: number, scheme: Scheme): BmiClass | null {
  if (!Number.isFinite(bmi)) return null
  return CUTS[scheme].find((c) => bmi < c.max)!.cls
}

/** Weight range (kg) that gives a "normal" BMI for this height. */
export function healthyRange(heightCm: number, scheme: Scheme): [number, number] {
  const m2 = (heightCm / 100) ** 2
  return [18.5 * m2, (scheme === 'asia' ? 22.9 : 24.9) * m2]
}

/** Basal metabolic rate, Mifflin-St Jeor (kcal/day). */
export function bmr(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161)
}

export const ACTIVITY = [
  { factor: 1.2, label: 'Sedentary (little or no exercise)' },
  { factor: 1.375, label: 'Light (1–3 days/week)' },
  { factor: 1.55, label: 'Moderate (3–5 days/week)' },
  { factor: 1.725, label: 'Active (6–7 days/week)' },
  { factor: 1.9, label: 'Very active (hard training or physical job)' },
] as const

/** Rough body fat % from BMI (Deurenberg 1991). Only a population estimate. */
export function bodyFatEstimate(bmi: number, age: number, sex: Sex): number {
  return 1.2 * bmi + 0.23 * age - 10.8 * (sex === 'male' ? 1 : 0) - 5.4
}

/** Converts imperial input (lb, ft, in) to metric. */
export function toMetric(lb: number, ft: number, inch: number): { kg: number; cm: number } {
  return { kg: lb * LB, cm: (ft * 12 + inch) * INCH }
}

/** Position of a BMI on the gauge scale from `min` to `max`, as 0–1. */
export function gaugePos(bmi: number, min = 15, max = 40): number {
  if (!Number.isFinite(bmi)) return 0
  return Math.min(1, Math.max(0, (bmi - min) / (max - min)))
}
