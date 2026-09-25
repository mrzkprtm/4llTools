/** Derivative of [angle, angular velocity] for a damped pendulum. */
export const pendulumDeriv = (g: number, L: number, b: number) => (_t: number, [th, w]: number[]) => [w, -(g / L) * Math.sin(th) - b * w]

/** Arithmetic–geometric mean, used for the exact large-angle period. */
export function agm(a: number, b: number): number {
  for (let i = 0; i < 30 && Math.abs(a - b) > 1e-15; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)]
  return a
}

export const smallAnglePeriod = (L: number, g: number) => 2 * Math.PI * Math.sqrt(L / g)

/** The exact period of an undamped pendulum released from `amp` radians. */
export const exactPeriod = (L: number, g: number, amp: number) => smallAnglePeriod(L, g) / agm(1, Math.cos(Math.abs(amp) / 2))

export function pendulumEnergy(m: number, g: number, L: number, th: number, w: number) {
  const kinetic = 0.5 * m * (L * w) ** 2
  const potential = m * g * L * (1 - Math.cos(th))
  return { kinetic, potential, total: kinetic + potential }
}
