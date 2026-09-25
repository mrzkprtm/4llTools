import { useMemo, useRef, useState } from 'react'
import Stage from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, line, rrect, text } from '../../sim/draw'
import { TAU, clamp, fmt } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { ALL_CODONS, THREE, aminoClass, cleanDNA, codonToAmino, complement, gcContent, proteinString, randomCoding, transcribe, translate } from './genetics'

const W = 800
const H = 500
const SP = 18
const X0 = 40
const CY = 118
const AMP = 30
const SEP = 34
const YM = 272
const YC = 420
const MAXLEN = 150
const BASE_COLOR: Record<string, string> = { A: '#e03131', T: '#f59f00', U: '#ae3ec9', G: '#2f9e44', C: '#1c7ed6' }
const CLASS_COLOR = { nonpolar: '#f59f00', polar: '#2f9e44', acidic: '#e03131', basic: '#1c7ed6', stop: '#868e96' }
const PHASES = ['1 · DNA double helix', '2 · Transcription: RNA polymerase copies the template into mRNA', '3 · Translation: the ribosome reads one codon at a time', 'Done: the protein chain is released']
const DEFAULT = 'CGTACCGGTTCAAACCTGACACCGTAATTCG'

const smooth = (x: number) => {
  const t = clamp(x, 0, 1)
  return t * t * (3 - 2 * t)
}

type Mode = 'template' | 'coding'

export default function DnaTranscription() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [raw, setRaw] = useState(DEFAULT)
  const [mode, setMode] = useState<Mode>('template')
  const [fromStart, setFromStart] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [info, setInfo] = useState({ phase: 0, codons: 0, aminos: 0 })
  const anim = useRef({ key: '', phase: 0, t: 0, pol: -6, q: 0, camX: 0 })

  const { seq, bad } = cleanDNA(raw)
  const dna = seq.slice(0, MAXLEN)
  const coding = mode === 'template' ? complement(dna) : dna
  const template = complement(coding)
  const mrna = transcribe(template)
  const tr = useMemo(() => translate(mrna, fromStart), [mrna, fromStart])
  const L = dna.length
  const nC = tr.codons.length

  const a = anim.current
  const key = `${coding}|${fromStart}`
  if (a.key !== key) Object.assign(a, { key, phase: 0, t: 0, pol: -6, q: 0 })

  function restart() {
    Object.assign(a, { phase: 0, t: 0, pol: -6, q: 0 })
    setInfo({ phase: 0, codons: 0, aminos: 0 })
  }

  function advance(dt: number) {
    if (a.phase === 0) {
      a.t += dt
      if (a.t > 1.6) Object.assign(a, { phase: 1, pol: -6 })
    } else if (a.phase === 1) {
      a.pol += dt * 7
      if (a.pol > L + 6) {
        a.phase = tr.start >= 0 && nC > 0 ? 2 : 3
        a.q = 0
      }
    } else if (a.phase === 2) {
      a.q += dt * 1.1
      if (a.q >= nC) {
        a.q = nC
        a.phase = 3
      }
    }
  }

  function step() {
    if (a.phase === 0) Object.assign(a, { phase: 1, pol: -6 })
    else if (a.phase === 1) advance(3 / 7)
    else if (a.phase === 2) advance((Math.floor(a.q + 1e-6) + 1 - a.q) / 1.1)
  }

  /** Amino acids joined to the chain so far (stop codons add nothing). */
  const joined = () => {
    if (a.phase < 2) return 0
    const k = Math.floor(a.q)
    const done = k + (a.q - k >= 0.5 ? 1 : 0)
    return tr.aminos.slice(0, Math.min(done, nC)).filter((x) => x !== '*').length
  }

  const current = a.phase === 2 ? tr.codons[Math.min(nC - 1, Math.floor(a.q))] : null
  const made = tr.aminos.filter((x) => x !== '*').slice(0, info.aminos).join('')

  return (
    <SimLayout
      wide
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            speed={speed}
            label={`DNA of ${L} bases being transcribed into mRNA ${mrna.slice(0, 30)} and translated into the protein ${proteinString(tr) || 'none'}.`}
            onFrame={(ctx, f) => {
              if (f.dt > 0) advance(f.dt)
              const bx = (i: number) => X0 + i * SP + SP / 2 - a.camX
              // Camera follows the polymerase or the ribosome.
              const focus = a.phase === 1 ? X0 + a.pol * SP : a.phase === 2 ? X0 + (tr.start + 3 * Math.floor(a.q) + 1.5) * SP : X0
              const target = clamp(focus - W / 2, 0, Math.max(0, X0 * 2 + L * SP - W))
              a.camX = f.frame === 0 ? target : a.camX + (target - a.camX) * Math.min(1, (f.dt || 0.016) * 4)

              clear(ctx, W, H, theme.sunken)
              text(ctx, PHASES[a.phase], 16, 26, { color: theme.text, size: 15, weight: 700, mono: false })
              if (!L) {
                text(ctx, 'Type a DNA sequence (A, C, G, T) to begin.', W / 2, H / 2, { color: theme.muted, size: 15, align: 'center' })
                return
              }
              const lo = Math.max(0, Math.floor((a.camX - X0) / SP) - 2)
              const hi = Math.min(L - 1, Math.ceil((a.camX - X0 + W) / SP) + 2)
              const phi = f.t * 0.9
              const theta = (i: number) => (i * TAU) / 10.5 + phi
              const open = (i: number) => (a.phase === 1 ? smooth(1.6 - Math.abs(i - a.pol) / 4) : 0)
              const y1 = (i: number) => CY + (1 - open(i)) * AMP * Math.sin(theta(i)) - open(i) * SEP
              const y2 = (i: number) => CY - (1 - open(i)) * AMP * Math.sin(theta(i)) + open(i) * SEP
              const dim = a.phase >= 2 ? 0.45 : 1
              const coding0 = alpha(theme.muted, dim)
              const templ0 = alpha(theme.text, dim)

              // Backbones: back halves, then base pairs, then front halves.
              const strand = (which: 1 | 2, front: boolean) => {
                const color = which === 1 ? coding0 : templ0
                for (let x = lo - 0.5; x < hi + 0.5; x += 0.25) {
                  const z = Math.cos(theta(x + 0.125)) * (which === 1 ? 1 : -1)
                  if (open(x) < 0.5 && z > 0 !== front) continue
                  const ya = which === 1 ? y1(x) : y2(x)
                  const yb = which === 1 ? y1(x + 0.25) : y2(x + 0.25)
                  line(ctx, bx(x), ya, bx(x + 0.25), yb, front || open(x) >= 0.5 ? color : alpha(which === 1 ? theme.muted : theme.text, 0.3 * dim), front ? 4 : 3)
                }
              }
              strand(1, false)
              strand(2, false)
              for (let i = lo; i <= hi; i++) {
                const x = bx(i)
                const u = open(i)
                const cb = coding[i]
                const tb = template[i]
                if (u < 0.5) {
                  const ym = (y1(i) + y2(i)) / 2
                  line(ctx, x, y1(i), x, ym, alpha(BASE_COLOR[cb], 0.85 * dim), 4)
                  line(ctx, x, ym, x, y2(i), alpha(BASE_COLOR[tb], 0.85 * dim), 4)
                } else {
                  rrect(ctx, x - 7, y1(i) - 20, 14, 18, 3, BASE_COLOR[cb])
                  text(ctx, cb, x, y1(i) - 7, { color: '#fff', size: 12, align: 'center', weight: 700 })
                  rrect(ctx, x - 7, y2(i) + 2, 14, 18, 3, BASE_COLOR[tb])
                  text(ctx, tb, x, y2(i) + 15, { color: '#fff', size: 12, align: 'center', weight: 700 })
                }
              }
              strand(1, true)
              strand(2, true)
              text(ctx, "5'", bx(-1) - 4, y1(-1) + 4, { color: theme.muted, size: 12, align: 'right' })
              text(ctx, "3'", bx(-1) - 4, y2(-1) + 4, { color: theme.muted, size: 12, align: 'right' })
              text(ctx, 'coding', bx(0) - 18, CY - 52, { color: theme.muted, size: 12 })
              text(ctx, 'template', bx(0) - 18, CY + 62, { color: theme.text, size: 12 })

              // mRNA: paired in the bubble, peeling off to its own track behind the polymerase.
              const built = a.phase === 1 ? Math.min(L, Math.floor(a.pol) + 1) : a.phase >= 2 ? L : 0
              let prev: [number, number] | null = null
              for (let i = 0; i < built; i++) {
                const x = bx(i)
                const k = a.phase === 1 ? smooth((a.pol - 2 - i) / 4) : 1
                const y = (1 - k) * (y2(i) + 30) + k * YM
                if (prev && x > -20 && x < W + 20) line(ctx, prev[0], prev[1], x, y, alpha(BASE_COLOR.U, 0.8), 3)
                prev = [x, y]
              }
              for (let i = Math.max(0, lo); i < Math.min(built, hi + 1); i++) {
                const x = bx(i)
                const k = a.phase === 1 ? smooth((a.pol - 2 - i) / 4) : 1
                const y = (1 - k) * (y2(i) + 30) + k * YM
                const inFrame = a.phase < 2 || tr.start < 0 || (i >= tr.start && i < tr.start + 3 * nC)
                rrect(ctx, x - 7, y - 10, 14, 20, 3, alpha(BASE_COLOR[mrna[i]], inFrame ? 1 : 0.4))
                text(ctx, mrna[i], x, y + 5, { color: '#fff', size: 12, align: 'center', weight: 700 })
              }
              if (built > 0) {
                text(ctx, "5'", bx(0) - 12, YM + 5, { color: theme.muted, size: 12, align: 'right' })
                text(ctx, 'mRNA', bx(0) - 12, YM + 22, { color: BASE_COLOR.U, size: 12, align: 'right', weight: 700 })
              }

              if (a.phase === 1) {
                const px = bx(a.pol)
                ctx.beginPath()
                ctx.ellipse(px, CY + 12, 56, 66, 0, 0, TAU)
                ctx.fillStyle = alpha('#f59f00', 0.18)
                ctx.fill()
                ctx.strokeStyle = alpha('#f59f00', 0.8)
                ctx.lineWidth = 2
                ctx.stroke()
                text(ctx, 'RNA polymerase →', px, CY - 62, { color: '#e67700', size: 13, weight: 700, align: 'center' })
              }

              // Translation.
              if (a.phase >= 2 && tr.start >= 0) {
                const centre = (k: number) => bx(tr.start + 3 * k + 1)
                for (let k = 0; k < nC; k++) {
                  const x0 = centre(k) - 1.5 * SP + 2
                  const x1 = centre(k) + 1.5 * SP - 2
                  if (x1 < 0 || x0 > W) continue
                  line(ctx, x0, YM + 16, x1, YM + 16, tr.aminos[k] === '*' ? theme.danger : theme.muted, 2)
                  text(ctx, THREE[tr.aminos[k]] ?? '?', centre(k), YM + 30, { color: tr.aminos[k] === '*' ? theme.danger : theme.muted, size: 12, align: 'center' })
                }
                const k = Math.min(nC - 1, Math.floor(a.q))
                const frac = a.q - k
                const rx = centre(k) + (a.phase === 2 && k < nC - 1 ? smooth((frac - 0.5) * 2) * 3 * SP : 0)
                const fade = a.phase === 3 ? 0.35 : 1
                // Ribosome: small subunit above the mRNA, large below.
                ctx.beginPath()
                ctx.ellipse(rx, YM - 26, 46, 22, 0, 0, TAU)
                ctx.fillStyle = alpha('#0ca678', 0.25 * fade)
                ctx.fill()
                ctx.beginPath()
                ctx.ellipse(rx - 10, YM + 58, 70, 38, 0, 0, TAU)
                ctx.fillStyle = alpha('#0ca678', 0.25 * fade)
                ctx.fill()
                text(ctx, 'ribosome', rx, YM - 22, { color: alpha('#0ca678', fade), size: 13, weight: 700, align: 'center' })
                if (a.phase === 2) rrect(ctx, centre(k) - 1.5 * SP, YM - 13, 3 * SP, 26, 4, undefined, theme.accent, 2)

                // Incoming tRNA with its anticodon and amino acid.
                const aa = tr.aminos[k]
                if (a.phase === 2 && frac < 0.5 && aa !== '*') {
                  const e = smooth(frac * 2.2)
                  const ty = YM + 150 - e * 110
                  const anti = transcribe(tr.codons[k].replace(/U/g, 'T'))
                  rrect(ctx, centre(k) - 1.5 * SP, ty - 10, 3 * SP, 22, 5, alpha(theme.surface, 0.95), theme.border)
                  text(ctx, anti, centre(k), ty + 5, { color: theme.text, size: 12, align: 'center', weight: 700 })
                  circle(ctx, centre(k), ty + 32, 16, CLASS_COLOR[aminoClass(aa)])
                  text(ctx, THREE[aa], centre(k), ty + 36, { color: '#fff', size: 12, align: 'center', weight: 700 })
                }
                if (a.phase >= 2 && aa === '*' && frac >= 0.2) text(ctx, 'STOP: chain released', rx, YM + 104, { color: theme.danger, size: 13, weight: 700, align: 'center' })

                // Growing chain, newest next to the ribosome.
                const chain = tr.aminos.filter((x) => x !== '*').slice(0, joined())
                const n = chain.length
                for (let j = n - 1; j >= 0; j--) {
                  const back = n - 1 - j
                  const cx = rx - 30 - back * 34
                  const cy = YC + Math.sin(j * 0.9) * 10
                  if (j < n - 1) line(ctx, cx, cy, rx - 30 - (back - 1) * 34, YC + Math.sin((j + 1) * 0.9) * 10, theme.muted, 3)
                  if (cx < -20) continue
                  circle(ctx, cx, cy, 16, CLASS_COLOR[aminoClass(chain[j])], theme.surface, 2)
                  text(ctx, THREE[chain[j]], cx, cy + 4, { color: '#fff', size: 12, align: 'center', weight: 700 })
                }
                if (n) text(ctx, `protein: ${chain.join('')}`, 16, H - 12, { color: theme.text, size: 13, weight: 700 })
              } else if (a.phase >= 2) text(ctx, 'No AUG start codon in this mRNA, so nothing is translated.', W / 2, YC, { color: theme.danger, size: 14, align: 'center' })

              if (f.frame % 6 === 0) {
                const nn = joined()
                const cod = a.phase >= 2 ? Math.min(nC, Math.floor(a.q) + (a.q % 1 >= 0.5 || a.phase === 3 ? 1 : 0)) : 0
                if (nn !== info.aminos || a.phase !== info.phase || cod !== info.codons) setInfo({ phase: a.phase, codons: cod, aminos: nn })
              }
            }}
          />
          <Readout
            items={[
              ['Bases', L],
              ['Codons read', `${info.codons} / ${nC}`],
              ['Amino acids', info.aminos],
              ['Protein', made || '—'],
              ['GC content', `${fmt(gcContent(dna) * 100, 1)}%`],
            ]}
          />
        </>
      }
      below={
        <div style={{ marginTop: 14 }}>
          <p className="sim-label" style={{ marginBottom: 6 }}>
            Codon table (mRNA){current ? `: ${current} → ${THREE[codonToAmino(current)]}` : ''}
          </p>
          <div className="sim-mono" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 4, fontSize: '0.78rem' }}>
            {Array.from({ length: 16 }, (_, cell) => {
              const row = Math.floor(cell / 4)
              const col = cell % 4
              return (
                <div key={cell} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', background: 'var(--surface)' }}>
                  {[0, 1, 2, 3].map((third) => {
                    const c = ALL_CODONS[row * 16 + col * 4 + third]
                    const aa = codonToAmino(c)
                    const on = c === current
                    const used = tr.codons.includes(c)
                    return (
                      <div key={c} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, borderRadius: 4, padding: '0 4px', background: on ? 'var(--accent)' : 'transparent', color: on ? 'var(--accent-text)' : aa === '*' ? 'var(--danger)' : used ? 'var(--text)' : 'var(--muted)', fontWeight: on || used ? 700 : 400 }}>
                        <span>{c}</span>
                        <span>{THREE[aa]}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={restart} onStep={step} resetLabel="Restart" />
      <div className="sim-field">
        <label className="sim-label" htmlFor="dna-input">
          DNA sequence
        </label>
        <input id="dna-input" className="sim-text sim-mono" value={raw} spellCheck={false} onChange={(e) => setRaw(e.target.value)} />
        {bad.length > 0 && <p className="sim-hint" style={{ color: 'var(--danger)' }}>Ignoring {bad.join(', ')}: only A, C, G and T are allowed.</p>}
        {seq.length > MAXLEN && <p className="sim-hint">Only the first {MAXLEN} bases are used.</p>}
      </div>
      <div className="row" style={{ margin: 0, gap: 6 }}>
        <button type="button" className="btn" onClick={() => setRaw(mode === 'template' ? complement(randomCoding(6 + Math.floor(Math.random() * 6))) : randomCoding(6 + Math.floor(Math.random() * 6)))}>
          Random gene
        </button>
      </div>
      <Choice label="The typed strand is the" value={mode} options={[['template', 'Template'], ['coding', 'Coding']]} onChange={setMode} />
      <Toggle label="Start at the first AUG" checked={fromStart} onChange={setFromStart} />
      <Slider label="Speed" value={speed} min={0.25} max={4} step={0.25} unit="×" onChange={setSpeed} />
      <Hint>The polymerase pairs U with A, A with T, G with C and C with G on the template strand. Then the ribosome reads the mRNA three bases at a time from AUG until a stop codon. Pause and use Step to go one codon at a time.</Hint>
    </SimLayout>
  )
}
