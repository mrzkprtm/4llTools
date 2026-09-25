import { useMemo, useRef, useState } from 'react'
import Stage from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, Select, SimLayout, useRunning } from '../../sim/controls'
import { circle, clear, rrect, text } from '../../sim/draw'
import { fmt } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { chiSquare, chiSquareP, gametes, parseGenotype, phenotypeKey, punnett, simplestRatio, tally, type Dominance, type GeneState } from './mendel'

const W = 800
const H = 540
const SQ = { x: 96, y: 96, size: 400 }
const PX = 530

interface Trait {
  id: string
  name: string
  dom: string
  rec: string
  mid: string
  c: [string, string]
}
const TRAITS: Trait[] = [
  { id: 'flower', name: 'Flower colour', dom: 'red', rec: 'white', mid: 'pink', c: ['#e03131', '#f1f3f5'] },
  { id: 'seed', name: 'Seed colour', dom: 'yellow', rec: 'green', mid: 'lime', c: ['#fcc419', '#37b24d'] },
  { id: 'fur', name: 'Fur colour', dom: 'black', rec: 'white', mid: 'grey', c: ['#343a40', '#f1f3f5'] },
  { id: 'eye', name: 'Eye colour', dom: 'brown', rec: 'blue', mid: 'hazel', c: ['#8d5524', '#339af0'] },
]
const CROSSES = [
  ['Aa|Aa', 'Aa × Aa (monohybrid)'],
  ['AA|aa', 'AA × aa (pure lines)'],
  ['Aa|aa', 'Aa × aa (test cross)'],
  ['AaBb|AaBb', 'AaBb × AaBb (dihybrid)'],
  ['AaBb|aabb', 'AaBb × aabb (test cross)'],
  ['AABb|aaBb', 'AABb × aaBb'],
] as const

function mix(a: string, b: string): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [p(a), p(b)]
  return `rgb(${x.map((v, i) => Math.round((v + y[i]) / 2)).join(', ')})`
}

export default function PunnettSquare() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [p1Text, setP1Text] = useState('Aa')
  const [p2Text, setP2Text] = useState('Aa')
  const [dom, setDom] = useState<Dominance[]>(['complete', 'complete'])
  const [traitIds, setTraitIds] = useState(['flower', 'seed'])
  const [bred, setBred] = useState<{ cell: number; x: number; y: number; key: string; t: number }[]>([])
  const anim = useRef({ t: 0, key: '', queue: 0 })
  const [, force] = useState(0)

  const p1Parsed = parseGenotype(p1Text)
  const p2Parsed = parseGenotype(p2Text)
  const compatible = p1Parsed && p2Parsed && p1Parsed.map((g) => g[0].toLowerCase()).join('') === p2Parsed.map((g) => g[0].toLowerCase()).join('')
  const lastGood = useRef({ p1: [['A', 'a']], p2: [['A', 'a']] })
  if (compatible) lastGood.current = { p1: p1Parsed, p2: p2Parsed }
  const { p1, p2 } = lastGood.current
  const nGenes = p1.length
  const letters = p1.map((g) => g[0].toUpperCase())
  const traits = traitIds.map((id) => TRAITS.find((t) => t.id === id) ?? TRAITS[0])

  const sq = useMemo(() => punnett(p1, p2), [JSON.stringify(p1), JSON.stringify(p2)])
  const flat = sq.cells.flat()
  const genoTally = tally([...flat].sort())
  const phenoOf = (g: string) => phenotypeKey(g, dom)
  const phenoTally = tally(flat.map(phenoOf))
  const phenoKeys = [...phenoTally.keys()].sort()
  const total = flat.length
  const a = anim.current
  const key = `${JSON.stringify(sq.cells)}|${dom.join()}`
  if (a.key !== key) {
    a.key = key
    a.t = 0
    a.queue = 0
    if (bred.length) setBred([])
  }

  const stateName = (s: GeneState, t: Trait) => (s === 'dom' ? t.dom : s === 'rec' ? t.rec : s === 'mid' ? t.mid : `${t.dom}+${t.rec}`)
  const phenoName = (k: string) => k.split('|').map((s, i) => stateName(s as GeneState, traits[i])).join(', ')

  /** Phenotype icon: outer disc for gene 1, inner disc for gene 2. */
  function icon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, k: string) {
    const parts = k.split('|') as GeneState[]
    parts.forEach((s, i) => {
      const t = traits[i]
      const rr = i === 0 ? r : r * 0.5
      if (s === 'both') {
        ctx.beginPath()
        ctx.arc(x, y, rr, Math.PI / 2, (3 * Math.PI) / 2)
        ctx.fillStyle = t.c[0]
        ctx.fill()
        ctx.beginPath()
        ctx.arc(x, y, rr, -Math.PI / 2, Math.PI / 2)
        ctx.fillStyle = t.c[1]
        ctx.fill()
        circle(ctx, x, y, rr, undefined, alpha(theme.text, 0.5), 1)
      } else circle(ctx, x, y, rr, s === 'dom' ? t.c[0] : s === 'rec' ? t.c[1] : mix(t.c[0], t.c[1]), alpha(theme.text, 0.5), 1)
    })
  }

  function breed(n: number) {
    a.queue += n
    if (!running) setRunning(true)
  }

  const cellsDone = () => Math.min(total, Math.max(0, Math.floor((a.t - 1) / (nGenes === 1 ? 0.35 : 0.09)) + 1))
  const counts = phenoKeys.map((k) => bred.filter((b) => b.key === k).length)
  const expected = phenoKeys.map((k) => (bred.length * (phenoTally.get(k) ?? 0)) / total)
  const chi = bred.length ? chiSquare(counts, expected) : NaN
  const df = phenoKeys.length - 1
  const p = bred.length && df > 0 ? chiSquareP(chi, df) : NaN
  const genoRatio = simplestRatio([...genoTally.values()]).join(' : ')
  const phenoRatio = simplestRatio(phenoKeys.map((k) => phenoTally.get(k) ?? 0)).join(' : ')

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            label={`Punnett square for ${p1.flat().join('')} crossed with ${p2.flat().join('')}: genotype ratio ${genoRatio}, phenotype ratio ${phenoRatio}.`}
            onFrame={(ctx, f) => {
              a.t += f.dt
              // Release queued offspring a few per frame.
              if (a.queue > 0 && f.dt > 0) {
                const n = Math.min(a.queue, 3)
                a.queue -= n
                const add: typeof bred = []
                for (let k = 0; k < n; k++) {
                  const r = Math.floor(Math.random() * sq.rows.length)
                  const c = Math.floor(Math.random() * sq.cols.length)
                  add.push({ cell: r * sq.cols.length + c, x: 0.15 + Math.random() * 0.7, y: 0.52 + Math.random() * 0.4, key: phenoOf(sq.cells[r][c]), t: a.t })
                }
                setBred((prev) => [...prev, ...add])
              }
              if (f.frame % 5 === 0) force((v) => v + 1)

              clear(ctx, W, H, theme.sunken)
              const n = sq.cols.length
              const cell = SQ.size / n
              const done = cellsDone()

              // Parents and gametes sliding in along the edges.
              text(ctx, `Parent 1: ${p1.flat().join('')}`, SQ.x + SQ.size / 2, 26, { color: theme.text, size: 15, weight: 700, align: 'center', mono: false })
              ctx.save()
              ctx.translate(26, SQ.y + SQ.size / 2)
              ctx.rotate(-Math.PI / 2)
              text(ctx, `Parent 2: ${p2.flat().join('')}`, 0, 0, { color: theme.text, size: 15, weight: 700, align: 'center', mono: false })
              ctx.restore()
              const slide = (i: number) => {
                const e = Math.min(1, Math.max(0, (a.t - i * 0.08) / 0.7))
                return 1 - (1 - e) ** 3
              }
              sq.cols.forEach((g, i) => {
                const e = slide(i)
                const x = SQ.x + cell * (i + 0.5)
                const y = 30 + e * (SQ.y - 30 - 30)
                ctx.globalAlpha = e
                circle(ctx, SQ.x + SQ.size / 2 + (x - SQ.x - SQ.size / 2) * e, y + 18, 20, alpha('#1c7ed6', 0.18), '#1c7ed6', 1.5)
                text(ctx, g, SQ.x + SQ.size / 2 + (x - SQ.x - SQ.size / 2) * e, y + 23, { color: theme.text, size: 14, weight: 700, align: 'center' })
                ctx.globalAlpha = 1
              })
              sq.rows.forEach((g, i) => {
                const e = slide(i)
                const y = SQ.y + cell * (i + 0.5)
                const x = 34 + e * (SQ.x - 34 - 30)
                ctx.globalAlpha = e
                circle(ctx, x + 12, SQ.y + SQ.size / 2 + (y - SQ.y - SQ.size / 2) * e, 20, alpha('#e8590c', 0.18), '#e8590c', 1.5)
                text(ctx, g, x + 12, SQ.y + SQ.size / 2 + (y - SQ.y - SQ.size / 2) * e + 5, { color: theme.text, size: 14, weight: 700, align: 'center' })
                ctx.globalAlpha = 1
              })

              // The square fills cell by cell.
              for (let r = 0; r < n; r++)
                for (let c = 0; c < n; c++) {
                  const k = r * n + c
                  const x = SQ.x + c * cell
                  const y = SQ.y + r * cell
                  rrect(ctx, x + 2, y + 2, cell - 4, cell - 4, 6, theme.surface, theme.border)
                  if (k >= done) continue
                  const g = sq.cells[r][c]
                  const age = a.t - (1 + k * (nGenes === 1 ? 0.35 : 0.09))
                  const pop = Math.min(1, Math.max(0.2, age / 0.25))
                  const key2 = phenoOf(g)
                  ctx.globalAlpha = pop
                  text(ctx, g, x + cell / 2, y + (nGenes === 1 ? 34 : 22), { color: theme.text, size: nGenes === 1 ? 20 : 14, weight: 700, align: 'center' })
                  icon(ctx, x + cell / 2, y + cell * (nGenes === 1 ? 0.58 : 0.62), (nGenes === 1 ? 26 : 13) * pop, key2)
                  ctx.globalAlpha = 1
                }
              // Bred offspring land in the cell they came from.
              for (const b of bred) {
                const r = Math.floor(b.cell / n)
                const c = b.cell % n
                const age = Math.min(1, (a.t - b.t) / 0.3)
                const x = SQ.x + c * cell + b.x * cell
                const y = SQ.y + r * cell + (nGenes === 1 ? b.y : 0.78 + (b.y - 0.52) * 0.45) * cell - (1 - age) * 20
                ctx.globalAlpha = 0.3 + 0.7 * age
                icon(ctx, x, y, nGenes === 1 ? 5 : 3.5, b.key)
                ctx.globalAlpha = 1
              }

              // Ratio panel: genotypes from the filled cells, phenotypes against bred counts.
              const shown = flat.slice(0, done)
              const gShown = tally(shown)
              let y = 40
              text(ctx, 'Genotypes', PX, y, { color: theme.text, size: 14, weight: 700, mono: false })
              y += 10
              const gRow = nGenes === 1 ? 26 : 19
              for (const [g, cnt] of genoTally) {
                const have = gShown.get(g) ?? 0
                text(ctx, g, PX, y + gRow - 6, { color: theme.text, size: 12 })
                rrect(ctx, PX + 44, y + 4, 150, gRow - 8, 3, alpha(theme.muted, 0.15))
                if (have) rrect(ctx, PX + 44, y + 4, (150 * have) / total, gRow - 8, 3, alpha('#1c7ed6', 0.75))
                text(ctx, `${cnt}/${total}`, PX + 200, y + gRow - 6, { color: theme.muted, size: 12 })
                y += gRow
              }
              y += 22
              text(ctx, bred.length ? `Phenotypes: expected vs ${bred.length} bred` : 'Phenotypes', PX, y, { color: theme.text, size: 14, weight: 700, mono: false })
              y += 8
              const pRow = phenoKeys.length > 5 ? 26 : 34
              const pShown = tally(shown.map(phenoOf))
              phenoKeys.forEach((k, i) => {
                const exp = (phenoTally.get(k) ?? 0) / total
                icon(ctx, PX + 10, y + pRow / 2 + 4, 9, k)
                text(ctx, phenoName(k), PX + 26, y + pRow / 2, { color: theme.text, size: 12 })
                const bw = 200
                rrect(ctx, PX + 26, y + pRow / 2 + 4, bw, 6, 2, alpha(theme.muted, 0.18))
                if (pShown.get(k)) rrect(ctx, PX + 26, y + pRow / 2 + 4, (bw * (pShown.get(k) ?? 0)) / total, 6, 2, alpha(theme.accent, 0.5))
                if (bred.length) rrect(ctx, PX + 26, y + pRow / 2 + 12, (bw * counts[i]) / bred.length, 6, 2, theme.accent)
                text(ctx, bred.length ? `${fmt(exp * 100, 1)}% | ${counts[i]}` : `${fmt(exp * 100, 1)}%`, PX + 234, y + pRow / 2 + 12, { color: theme.muted, size: 12 })
                y += pRow
              })
              y += 18
              if (bred.length && df > 0) {
                text(ctx, `χ² = ${fmt(chi, 2)}, df = ${df}, p = ${fmt(p, 3)}`, PX, y, { color: theme.text, size: 13, weight: 700 })
                text(ctx, p < 0.05 ? 'Unusual: p < 0.05' : 'Consistent with the expected ratio', PX, y + 18, { color: p < 0.05 ? theme.danger : theme.ok, size: 12 })
              } else text(ctx, 'Press “Breed 100” to test the ratio', PX, y, { color: theme.muted, size: 12 })
            }}
          />
          <Readout
            items={[
              ['Genotype ratio', genoRatio],
              ['Phenotype ratio', phenoRatio],
              ['Offspring bred', bred.length],
              ['Chi-square', Number.isFinite(chi) ? fmt(chi, 2) : '—'],
              ['p-value', Number.isFinite(p) ? fmt(p, 3) : '—'],
            ]}
          />
        </>
      }
    >
      <PlayBar
        running={running}
        setRunning={setRunning}
        onReset={() => {
          a.t = 0
          a.queue = 0
          setBred([])
        }}
        resetLabel="Replay"
      >
        <button type="button" className="btn" onClick={() => breed(100)}>
          Breed 100
        </button>
      </PlayBar>
      <Select
        label="Classic cross"
        value={CROSSES.some(([v]) => v === `${p1Text}|${p2Text}`) ? `${p1Text}|${p2Text}` : 'custom'}
        options={[...CROSSES, ['custom', 'Custom (type below)'] as const]}
        onChange={(v) => {
          if (v === 'custom') return
          const [x, y] = v.split('|')
          setP1Text(x)
          setP2Text(y)
        }}
      />
      <div className="row" style={{ margin: 0, gap: 8 }}>
        {[
          ['Parent 1', p1Text, setP1Text],
          ['Parent 2', p2Text, setP2Text],
        ].map(([label, value, set]) => (
          <label key={label as string} className="sim-field" style={{ flex: 1 }}>
            <span className="sim-label">{label as string}</span>
            <input className="sim-text sim-mono" value={value as string} maxLength={4} spellCheck={false} onChange={(e) => (set as (v: string) => void)(e.target.value)} />
          </label>
        ))}
      </div>
      {!compatible && <p className="sim-hint" style={{ color: 'var(--danger)' }}>Use pairs like Aa or AaBb, with the same genes for both parents.</p>}
      {letters.map((letter, i) => (
        <div key={letter} style={{ display: 'grid', gap: 8 }}>
          <Select
            label={`Gene ${letter} trait`}
            value={traitIds[i]}
            options={TRAITS.map((t) => [t.id, `${t.name} (${t.dom} / ${t.rec})`] as const)}
            onChange={(v) => setTraitIds(traitIds.map((x, j) => (j === i ? v : x)))}
          />
          <Choice label={`Gene ${letter} dominance`} value={dom[i]} options={[['complete', 'Complete'], ['incomplete', 'Incomplete'], ['codominant', 'Codominant']]} onChange={(v) => setDom(dom.map((x, j) => (j === i ? v : x)))} />
        </div>
      ))}
      <Hint>Gametes carry one allele of each gene, so every square is one equally likely pairing. Breed offspring to see chance scatter around the 3 : 1 or 9 : 3 : 3 : 1 ratio; the chi-square p-value says whether the difference is plausible luck.</Hint>
    </SimLayout>
  )
}

export { gametes }
