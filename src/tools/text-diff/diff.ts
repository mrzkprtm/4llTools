export type DiffOp = { type: 'same' | 'add' | 'del'; text: string }

/** Line-by-line diff using a longest-common-subsequence table. */
export function diffLines(a: string, b: string): DiffOp[] {
  const x = a.split('\n')
  const y = b.split('\n')
  const n = x.length
  const m = y.length
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])

  const ops: DiffOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (x[i] === y[j]) ops.push({ type: 'same', text: x[i++] }), j++
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) ops.push({ type: 'del', text: x[i++] })
    else ops.push({ type: 'add', text: y[j++] })
  }
  while (i < n) ops.push({ type: 'del', text: x[i++] })
  while (j < m) ops.push({ type: 'add', text: y[j++] })
  return ops
}
