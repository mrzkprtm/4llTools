export const percentOf = (p: number, x: number) => (p / 100) * x
export const whatPercent = (x: number, y: number) => (y === 0 ? NaN : (x / y) * 100)
export const percentChange = (from: number, to: number) => (from === 0 ? NaN : ((to - from) / Math.abs(from)) * 100)
export const afterDiscount = (price: number, p: number) => price * (1 - p / 100)
