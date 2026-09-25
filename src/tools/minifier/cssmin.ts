/**
 * A conservative CSS minifier. It removes comments (except /*! licence comments),
 * collapses whitespace and drops it only where CSS grammar allows, while leaving
 * strings, url(...) contents and the spaces calc() needs around + and - untouched.
 */
export function minifyCss(input: string): string {
  let out = ''
  let i = 0
  let parenDepth = 0
  let pendingSpace = false
  const n = input.length

  // Characters around which whitespace is never significant.
  const ALWAYS = new Set(['{', '}', ';', ','])
  const lastChar = () => out[out.length - 1] ?? ''

  const flushSpace = (next: string) => {
    if (!pendingSpace) return
    pendingSpace = false
    const prev = lastChar()
    if (!prev) return
    if (ALWAYS.has(prev) || ALWAYS.has(next)) return
    if (prev === '(' || next === ')') return
    if (prev === ':') return // "color: red" → "color:red" (a space after a colon never matters)
    if (next === '!') return // "red !important"
    if (out.endsWith('*/')) return
    // Combinators: only outside parentheses so calc(1px + 2px) keeps its spaces.
    if (parenDepth === 0 && ('>~+'.includes(prev) || '>~+'.includes(next))) return
    out += ' '
  }

  while (i < n) {
    const ch = input[i]

    // Comments
    if (ch === '/' && input[i + 1] === '*') {
      const end = input.indexOf('*/', i + 2)
      const stop = end < 0 ? n : end + 2
      if (input[i + 2] === '!') {
        flushSpace('/')
        out += input.slice(i, stop)
      } else if (/\s/.test(input[i - 1] ?? '') || /\s/.test(input[stop] ?? '')) {
        pendingSpace = true
      }
      i = stop
      continue
    }

    // Strings
    if (ch === '"' || ch === "'") {
      flushSpace(ch)
      let j = i + 1
      while (j < n && input[j] !== ch) {
        if (input[j] === '\\') j++
        else if (input[j] === '\n') break // unterminated string: stop at the line end like CSS does
        j++
      }
      out += input.slice(i, Math.min(j + 1, n))
      i = j + 1
      continue
    }

    // url( unquoted ) – copy verbatim
    if ((ch === 'u' || ch === 'U') && /^url\(/i.test(input.slice(i, i + 4))) {
      flushSpace(ch)
      let j = i + 4
      while (j < n && /\s/.test(input[j])) j++
      if (input[j] !== '"' && input[j] !== "'") {
        const close = input.indexOf(')', j)
        const stop = close < 0 ? n : close
        out += `url(${input.slice(j, stop).trim()})`
        i = stop + 1
        continue
      }
      out += input.slice(i, i + 4)
      parenDepth++
      i += 4
      continue
    }

    if (/\s/.test(ch)) {
      pendingSpace = true
      i++
      continue
    }

    if (ch === '(') parenDepth++
    if (ch === ')') parenDepth = Math.max(0, parenDepth - 1)

    flushSpace(ch)
    if (ch === '}' && lastChar() === ';') out = out.slice(0, -1)
    out += ch
    i++
  }
  return out.trim()
}
