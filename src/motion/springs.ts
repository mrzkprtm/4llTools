/**
 * Spring presets, pre-computed from stiffness / damping / mass into CSS linear()
 * easing curves so the browser plays real spring motion natively. The same
 * strings are the --spring-* tokens in styles.css.
 */
export const SPRINGS = {
  /** stiffness 520, damping 34, mass 1 */
  snap: { easing: 'linear(0, 0.0213, 0.0728, 0.1446, 0.2286, 0.3184, 0.4092, 0.4973, 0.5804, 0.6566, 0.725, 0.7852, 0.8372, 0.8813, 0.9179, 0.9477, 0.9715, 0.99, 1.0039, 1.0139, 1.0207, 1.025, 1.0272, 1.0278, 1.0272, 1.0258, 1.0238, 1.0215, 1.019, 1.0165, 1.014, 1.0117, 1.0096, 1.0077, 1.006, 1.0045, 1.0033, 1.0023, 1.0015, 1.0008, 1.0003, 0.9999, 0.9996, 0.9994, 1)', duration: 397 },
  /** stiffness 240, damping 30, mass 1 */
  soft: { easing: 'linear(0, 0.0221, 0.0744, 0.1444, 0.2232, 0.3048, 0.385, 0.4611, 0.5317, 0.5959, 0.6535, 0.7045, 0.7492, 0.7882, 0.8218, 0.8506, 0.8752, 0.8961, 0.9138, 0.9287, 0.9412, 0.9516, 0.9603, 0.9675, 0.9734, 0.9783, 0.9824, 0.9857, 0.9885, 0.9907, 0.9925, 0.994, 0.9952, 0.9961, 0.9969, 0.9975, 0.9981, 0.9985, 0.9988, 0.999, 0.9992, 1)', duration: 577 },
  /** stiffness 420, damping 22, mass 1 */
  bouncy: { easing: 'linear(0, 0.0508, 0.1725, 0.3327, 0.5054, 0.6713, 0.8173, 0.9361, 1.0251, 1.0852, 1.1196, 1.1328, 1.1301, 1.1163, 1.0962, 1.0733, 1.0507, 1.0302, 1.0131, 1.0, 0.9908, 0.9852, 0.9826, 0.9823, 0.9838, 0.9863, 0.9892, 0.9923, 0.9951, 0.9976, 0.9995, 1.0009, 1.0018, 1.0023, 1.0024, 1.0022, 1.0019, 1.0016, 1.0012, 1.0008, 1.0004, 1.0001, 1)', duration: 676 },
} as const

export type SpringName = keyof typeof SPRINGS

/** True when the visitor asked for less motion (or during prerendering). */
export function reducedMotion(): boolean {
  return typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
