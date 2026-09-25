import { RegExpParser, type AST } from '@eslint-community/regexpp'

/* ---------------------------------------------------------------- parsing */

export type Parsed = { ok: true; pattern: AST.Pattern; flags: AST.Flags } | { ok: false; error: string }

export function parseRegex(pattern: string, flags: string): Parsed {
  const parser = new RegExpParser()
  try {
    const f = parser.parseFlags(flags)
    const p = parser.parsePattern(pattern, 0, pattern.length, { unicode: f.unicode, unicodeSets: f.unicodeSets })
    return { ok: true, pattern: p, flags: f }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/* ------------------------------------------------------------ descriptions */

export function describeChar(code: number): string {
  switch (code) {
    case 9: return 'tab'
    case 10: return 'newline'
    case 13: return 'carriage return'
    case 32: return 'space'
    case 0: return 'null'
    case 11: return 'vertical tab'
    case 12: return 'form feed'
  }
  if (code < 32 || (code >= 127 && code < 160)) return 'U+' + code.toString(16).toUpperCase().padStart(4, '0')
  return String.fromCodePoint(code)
}

function charText(chars: AST.Character[]): string {
  if (chars.length === 1) {
    const d = describeChar(chars[0].value)
    return d.length > 1 ? d : `"${d}"`
  }
  return '"' + chars.map((c) => (c.value === 32 ? ' ' : describeChar(c.value).length > 1 ? `\\u{${c.value.toString(16)}}` : String.fromCodePoint(c.value))).join('') + '"'
}

export function describeQuantifier(min: number, max: number, greedy: boolean): string {
  let s: string
  if (min === 0 && max === 1) s = 'optional'
  else if (max === Infinity) s = min === 0 ? '0+ times' : min === 1 ? '1+ times' : `${min}+ times`
  else if (min === max) s = min === 1 ? 'once' : `exactly ${min} times`
  else s = `${min}–${max} times`
  return greedy ? s : `${s}, lazy`
}

function setName(n: AST.EscapeCharacterSet | AST.UnicodePropertyCharacterSet): string {
  if (n.kind === 'property') {
    const v = n.value ? `${n.key}=${n.value}` : n.key
    return n.negate ? `not Unicode ${v}` : `Unicode ${v}`
  }
  const names = { digit: ['digit', 'non-digit'], word: ['word character', 'non-word character'], space: ['whitespace', 'non-whitespace'] }
  return names[n.kind][n.negate ? 1 : 0]
}

function classElementText(e: AST.CharacterClassElement): string {
  switch (e.type) {
    case 'Character': return charText([e])
    case 'CharacterClassRange': return `${describeChar(e.min.value)}-${describeChar(e.max.value)}`
    case 'CharacterSet': return setName(e)
    case 'CharacterClass': return (e.negate ? 'not ' : '') + '[' + e.elements.map(classElementText).join(', ') + ']'
    default: return e.raw
  }
}

export function describeClass(n: AST.CharacterClass): string {
  const items = n.elements.map(classElementText).join(', ')
  if (!items) return n.negate ? 'any character' : 'nothing (empty class)'
  return n.negate ? `not: ${items}` : `one of: ${items}`
}

type Ctx = { flags: AST.Flags; groupIndex: Map<AST.CapturingGroup, number> }

function makeCtx(pattern: AST.Pattern, flags: AST.Flags): Ctx {
  const groupIndex = new Map<AST.CapturingGroup, number>()
  const walk = (n: AST.Node) => {
    if (n.type === 'CapturingGroup') groupIndex.set(n, groupIndex.size + 1)
    if ('alternatives' in n && n.type !== 'ClassStringDisjunction') n.alternatives.forEach(walk)
    if (n.type === 'Alternative') n.elements.forEach(walk)
    if (n.type === 'Quantifier') walk(n.element)
  }
  walk(pattern)
  return { flags, groupIndex }
}

function groupLabel(n: AST.CapturingGroup | AST.Group | AST.LookaroundAssertion, ctx: Ctx): string {
  if (n.type === 'CapturingGroup') return `group #${ctx.groupIndex.get(n)}${n.name ? ` ‹${n.name}›` : ''}`
  if (n.type === 'Group') {
    if (!n.modifiers) return 'non-capturing'
    const add = n.modifiers.add.raw
    const rem = n.modifiers.remove?.raw
    return `flags ${add ? '+' + add : ''}${rem ? ' -' + rem : ''}`.trim()
  }
  if (n.kind === 'lookahead') return n.negate ? 'not followed by' : 'followed by'
  return n.negate ? 'not preceded by' : 'preceded by'
}

function assertionText(n: AST.BoundaryAssertion, ctx: Ctx): string {
  if (n.kind === 'word') return n.negate ? 'not a word boundary' : 'word boundary'
  if (n.kind === 'start') return ctx.flags.multiline ? 'start of line' : 'start of string'
  return ctx.flags.multiline ? 'end of line' : 'end of string'
}

function anyText(ctx: Ctx) {
  return ctx.flags.dotAll ? 'any character' : 'any character except newline'
}

function backrefText(n: AST.Backreference, ctx: Ctx): string {
  const g = Array.isArray(n.resolved) ? n.resolved[0] : n.resolved
  return `same text as group #${ctx.groupIndex.get(g) ?? n.ref}${typeof n.ref === 'string' ? ` ‹${n.ref}›` : ''}`
}

/* ------------------------------------------------------------ explanation */

export type Explanation = { text: string; code: string; children: Explanation[] }

export function explain(pattern: AST.Pattern, flags: AST.Flags): Explanation[] {
  const ctx = makeCtx(pattern, flags)
  return explainAlts(pattern.alternatives, ctx)
}

function explainAlts(alts: AST.Alternative[], ctx: Ctx): Explanation[] {
  if (alts.length === 1) return explainSeq(alts[0].elements, ctx)
  return [
    {
      text: `Either of ${alts.length} alternatives:`,
      code: alts.map((a) => a.raw).join('|'),
      children: alts.map((a, i) => ({ text: `Option ${i + 1}${a.elements.length ? ':' : ': nothing (empty)'}`, code: a.raw, children: explainSeq(a.elements, ctx) })),
    },
  ]
}

function explainSeq(els: AST.Element[], ctx: Ctx): Explanation[] {
  const out: Explanation[] = []
  for (const run of mergeChars(els)) {
    if (Array.isArray(run)) out.push({ text: `Literal text ${charText(run)}`, code: run.map((c) => c.raw).join(''), children: [] })
    else out.push(explainEl(run, ctx))
  }
  return out
}

function explainEl(n: AST.Element, ctx: Ctx): Explanation {
  const leaf = (text: string): Explanation => ({ text, code: n.raw, children: [] })
  switch (n.type) {
    case 'Character': return leaf(`Literal ${charText([n])}`)
    case 'CharacterSet': return leaf(n.kind === 'any' ? capitalize(anyText(ctx)) : `A ${setName(n)}`)
    case 'CharacterClass': return leaf(capitalize(describeClass(n)))
    case 'ExpressionCharacterClass': return leaf(`Set expression ${n.raw}`)
    case 'Backreference': return leaf(capitalize(backrefText(n, ctx)))
    case 'Quantifier': {
      const inner = explainEl(n.element, ctx)
      const q = describeQuantifier(n.min, n.max, n.greedy)
      const lazy = n.greedy ? '' : ' (as few as possible)'
      const text = n.min === 0 && n.max === 1 ? `Optionally${lazy}:` : `Repeat ${q.replace(', lazy', '')}${lazy}:`
      return { text, code: n.raw, children: [inner] }
    }
    case 'Assertion':
      if (n.kind === 'lookahead' || n.kind === 'lookbehind') {
        return { text: `Check (without consuming) it is ${groupLabel(n, ctx)}:`, code: n.raw, children: explainAlts(n.alternatives, ctx) }
      }
      return leaf(capitalize(assertionText(n, ctx)))
    case 'CapturingGroup':
      return { text: `Capture as ${groupLabel(n, ctx)}:`, code: n.raw, children: explainAlts(n.alternatives, ctx) }
    case 'Group':
      return { text: n.modifiers ? `Group with ${groupLabel(n, ctx)}:` : 'Group (not captured):', code: n.raw, children: explainAlts(n.alternatives, ctx) }
  }
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Groups runs of plain characters so "abc" becomes one literal. */
function mergeChars(els: AST.Element[]): (AST.Element | AST.Character[])[] {
  const out: (AST.Element | AST.Character[])[] = []
  for (const e of els) {
    const last = out[out.length - 1]
    if (e.type === 'Character') {
      if (Array.isArray(last)) last.push(e)
      else out.push([e])
    } else out.push(e)
  }
  return out
}

/* ----------------------------------------------------------------- layout */

export type BoxKind = 'literal' | 'set' | 'class' | 'anchor' | 'backref' | 'terminal'
export type FrameKind = 'capture' | 'group' | 'lookaround'

export type Prim =
  | { kind: 'box'; x: number; y: number; w: number; h: number; label: string; style: BoxKind }
  | { kind: 'frame'; x: number; y: number; w: number; h: number; label: string; style: FrameKind }
  | { kind: 'path'; d: string; role?: 'branch' | 'loop' | 'skip' }
  | { kind: 'text'; x: number; y: number; text: string }

type Laid = { w: number; h: number; cy: number; prims: Prim[] }

export const CHAR_W = 7.4
const BOX_H = 28
const PAD_X = 10
const GAP = 14
const ARC = 18
const V_GAP = 10
const FRAME_PAD = 10
const FRAME_LABEL = 16
const Q_LABEL = 16
const MAX_LABEL = 48

export function textWidth(s: string) {
  return [...s].length * CHAR_W
}

function clip(s: string) {
  const chars = [...s]
  return chars.length > MAX_LABEL ? chars.slice(0, MAX_LABEL - 1).join('') + '…' : s
}

function r(n: number) {
  return Math.round(n * 10) / 10
}

function hline(x1: number, x2: number, y: number): Prim {
  return { kind: 'path', d: `M${r(x1)} ${r(y)}H${r(x2)}` }
}

function shift(p: Prim, dx: number, dy: number): Prim {
  if (p.kind === 'path') {
    // Paths are built from absolute M/H/V/C/L commands with x,y pairs; shift every coordinate.
    return { ...p, d: shiftPath(p.d, dx, dy) }
  }
  return { ...p, x: p.x + dx, y: p.y + dy }
}

function shiftPath(d: string, dx: number, dy: number): string {
  return d.replace(/([MLCHV])([^MLCHV]*)/g, (_, cmd: string, args: string) => {
    const nums = args.trim().split(/[\s,]+/).filter(Boolean).map(Number)
    let shifted: number[]
    if (cmd === 'H') shifted = nums.map((n) => n + dx)
    else if (cmd === 'V') shifted = nums.map((n) => n + dy)
    else shifted = nums.map((n, i) => (i % 2 === 0 ? n + dx : n + dy))
    return cmd + shifted.map(r).join(' ')
  })
}

function place(l: Laid, dx: number, dy: number): Prim[] {
  return l.prims.map((p) => shift(p, dx, dy))
}

function box(label: string, style: BoxKind): Laid {
  const text = clip(label)
  const w = Math.max(28, textWidth(text) + PAD_X * 2)
  return { w, h: BOX_H, cy: BOX_H / 2, prims: [{ kind: 'box', x: 0, y: 0, w, h: BOX_H, label: text, style }] }
}

function sequence(items: Laid[]): Laid {
  if (!items.length) return { w: 24, h: 10, cy: 5, prims: [hline(0, 24, 5)] }
  const cy = Math.max(...items.map((i) => i.cy))
  const prims: Prim[] = []
  let x = 0
  let h = 0
  items.forEach((it, i) => {
    if (i > 0) {
      prims.push(hline(x, x + GAP, cy))
      x += GAP
    }
    const top = cy - it.cy
    prims.push(...place(it, x, top))
    x += it.w
    h = Math.max(h, top + it.h)
  })
  return { w: x, h, cy, prims }
}

function alternation(branches: Laid[]): Laid {
  if (branches.length === 1) return branches[0]
  const inner = Math.max(...branches.map((b) => b.w))
  const w = inner + ARC * 2
  const prims: Prim[] = []
  let y = 0
  const ys: number[] = []
  branches.forEach((b, i) => {
    if (i > 0) y += V_GAP
    ys.push(y + b.cy)
    prims.push(...place(b, ARC, y))
    // Pad short branches out to the full width.
    if (b.w < inner) prims.push(hline(ARC + b.w, ARC + inner, y + b.cy))
    y += b.h
  })
  const h = y
  const cy = (ys[0] + ys[ys.length - 1]) / 2
  for (const by of ys) {
    prims.push({ kind: 'path', role: 'branch', d: `M0 ${r(cy)}C${r(ARC / 2)} ${r(cy)} ${r(ARC / 2)} ${r(by)} ${ARC} ${r(by)}` })
    prims.push({ kind: 'path', d: `M${r(w - ARC)} ${r(by)}C${r(w - ARC / 2)} ${r(by)} ${r(w - ARC / 2)} ${r(cy)} ${r(w)} ${r(cy)}` })
  }
  return { w, h, cy, prims }
}

function frame(child: Laid, label: string, style: FrameKind): Laid {
  const text = clip(label)
  const w = Math.max(child.w + FRAME_PAD * 2, textWidth(text) + 12)
  const h = child.h + FRAME_PAD * 2 + FRAME_LABEL
  const top = FRAME_LABEL + FRAME_PAD
  const cy = top + child.cy
  const cx = (w - child.w) / 2
  return {
    w,
    h,
    cy,
    prims: [
      { kind: 'frame', x: 0, y: FRAME_LABEL, w, h: h - FRAME_LABEL, label: text, style },
      hline(0, cx, cy),
      ...place(child, cx, top),
      hline(cx + child.w, w, cy),
    ],
  }
}

function quantified(child: Laid, min: number, max: number, greedy: boolean): Laid {
  if (min === 1 && max === 1) return child
  const M = ARC
  const skip = min === 0
  const loop = max > 1
  const label = describeQuantifier(min, max, greedy)
  const top = skip ? 14 : 0
  const cy = top + child.cy
  const bodyBottom = top + child.h
  const loopY = bodyBottom + 10
  const w = Math.max(child.w + M * 2, textWidth(label) + 8)
  const cx = (w - child.w) / 2
  const prims: Prim[] = [hline(0, cx, cy), ...place(child, cx, top), hline(cx + child.w, w, cy)]
  if (skip) {
    const k = 8
    prims.push({
      kind: 'path',
      role: 'skip',
      d: `M0 ${r(cy)}C${k} ${r(cy)} ${k} ${4} ${k * 2} ${4}H${r(w - k * 2)}C${r(w - k)} 4 ${r(w - k)} ${r(cy)} ${r(w)} ${r(cy)}`,
    })
  }
  if (loop) {
    const a = cx + child.w
    const b = cx
    prims.push({
      kind: 'path',
      role: 'loop',
      d: `M${r(a)} ${r(cy)}C${r(a + M * 0.8)} ${r(cy)} ${r(a + M * 0.8)} ${r(loopY)} ${r(a)} ${r(loopY)}H${r(b)}C${r(b - M * 0.8)} ${r(loopY)} ${r(b - M * 0.8)} ${r(cy)} ${r(b)} ${r(cy)}`,
    })
  }
  const labelTop = (loop ? loopY : bodyBottom) + 4
  prims.push({ kind: 'text', x: w / 2, y: labelTop + Q_LABEL / 2 + 1, text: label })
  return { w, h: labelTop + Q_LABEL, cy, prims }
}

function layAlts(alts: AST.Alternative[], ctx: Ctx): Laid {
  return alternation(alts.map((a) => laySeq(a.elements, ctx)))
}

function laySeq(els: AST.Element[], ctx: Ctx): Laid {
  return sequence(mergeChars(els).map((run) => (Array.isArray(run) ? box(charText(run), 'literal') : layEl(run, ctx))))
}

function layEl(n: AST.Element, ctx: Ctx): Laid {
  switch (n.type) {
    case 'Character': return box(charText([n]), 'literal')
    case 'CharacterSet': return box(n.kind === 'any' ? anyText(ctx) : setName(n), 'set')
    case 'CharacterClass': return box(describeClass(n), 'class')
    case 'ExpressionCharacterClass': return box(n.raw, 'class')
    case 'Backreference': return box(backrefText(n, ctx), 'backref')
    case 'Quantifier': return quantified(layEl(n.element, ctx), n.min, n.max, n.greedy)
    case 'Assertion':
      if (n.kind === 'lookahead' || n.kind === 'lookbehind') return frame(layAlts(n.alternatives, ctx), groupLabel(n, ctx), 'lookaround')
      return box(assertionText(n, ctx), 'anchor')
    case 'CapturingGroup': return frame(layAlts(n.alternatives, ctx), groupLabel(n, ctx), 'capture')
    case 'Group': return frame(layAlts(n.alternatives, ctx), groupLabel(n, ctx), 'group')
  }
}

export type Diagram = { width: number; height: number; prims: Prim[] }

const MARGIN = 12
const TERM_R = 6
const LEAD = 20

/** Lays out a parsed pattern as a railroad diagram with absolute coordinates. */
export function layoutDiagram(pattern: AST.Pattern, flags: AST.Flags): Diagram {
  const ctx = makeCtx(pattern, flags)
  const body = layAlts(pattern.alternatives, ctx)
  const x0 = MARGIN + TERM_R * 2 + LEAD
  const y0 = MARGIN
  const cy = y0 + body.cy
  const endX = x0 + body.w + LEAD
  const prims: Prim[] = [
    { kind: 'box', x: MARGIN, y: cy - TERM_R, w: TERM_R * 2, h: TERM_R * 2, label: 'start', style: 'terminal' },
    hline(MARGIN + TERM_R * 2, x0, cy),
    ...place(body, x0, y0),
    hline(x0 + body.w, endX, cy),
    { kind: 'box', x: endX, y: cy - TERM_R, w: TERM_R * 2, h: TERM_R * 2, label: 'end', style: 'terminal' },
  ]
  return { width: r(endX + TERM_R * 2 + MARGIN), height: r(body.h + MARGIN * 2), prims }
}

/* ---------------------------------------------------------------- matches */

export type Match = { index: number; text: string }

export function findMatches(pattern: string, flags: string, text: string, limit = 500): Match[] {
  const re = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g')
  const out: Match[] = []
  for (const m of text.matchAll(re)) {
    out.push({ index: m.index ?? 0, text: m[0] })
    if (out.length >= limit || !flags.includes('g')) break
  }
  return out
}
