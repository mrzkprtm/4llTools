/** Capacitor voltage while charging from 0 V towards V0 through R: V0(1 − e^(−t/RC)). */
export function vcCharge(t: number, V0: number, R: number, C: number): number {
  return V0 * (1 - Math.exp(-t / (R * C)))
}

/** Capacitor voltage while discharging from V1 through R: V1·e^(−t/RC). */
export function vcDischarge(t: number, V1: number, R: number, C: number): number {
  return V1 * Math.exp(-t / (R * C))
}

export interface RCState {
  /** Capacitor voltage (V). */
  vc: number
  /** Current (A), positive while charging and negative while discharging (it flows back out). */
  i: number
}

/**
 * Exact step of the RC circuit: over dt the capacitor voltage relaxes exponentially towards
 * V0 (switch on Charge) or 0 (switch on Discharge), so any step size gives the same curve.
 */
export function rcStep(state: RCState, dt: number, R: number, C: number, V0: number, charging: boolean): RCState {
  const k = Math.exp(-dt / (R * C))
  const target = charging ? V0 : 0
  const vc = target + (state.vc - target) * k
  return { vc, i: (target - vc) / R }
}
