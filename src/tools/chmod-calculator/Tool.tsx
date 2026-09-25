import { useState, type CSSProperties } from 'react'
import CopyButton from '../../components/CopyButton'
import MorphText from '../../motion/MorphText'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import { PERMS, PRESETS, SPECIAL, SPECIAL_BITS, WHO, bit, explain, parseOctal, parseSymbolic, toChmodSymbolic, toOctal, toSymbolic, warnings } from './chmod'

export default function ChmodCalculator() {
  const [mode, setModeState] = useState(0o755)
  const [octalText, setOctalText] = useState('755')
  const [symText, setSymText] = useState('rwxr-xr-x')
  const [file, setFile] = useState('file')
  const [octalErr, setOctalErr] = useState(false)
  const [symErr, setSymErr] = useState(false)

  function setMode(m: number, from?: 'octal' | 'sym') {
    setModeState(m)
    if (from !== 'octal') { setOctalText(toOctal(m)); setOctalErr(false) }
    if (from !== 'sym') { setSymText(toSymbolic(m)); setSymErr(false) }
  }

  const octal = toOctal(mode)
  const target = file.trim() || 'file'
  const quoted = /[^\w./-]/.test(target) ? `'${target.replace(/'/g, `'\\''`)}'` : target
  const numericCmd = `chmod ${octal} ${quoted}`
  const symbolicCmd = `chmod ${toChmodSymbolic(mode)} ${quoted}`
  const warns = warnings(mode)

  const cell: CSSProperties = { padding: '8px 6px', borderBottom: '1px solid var(--border)', textAlign: 'center' }

  return (
    <div>
      <div className="two-col">
        <div>
          <label htmlFor="chmod-octal">Octal</label>
          <input id="chmod-octal" type="text" inputMode="numeric" value={octalText} spellCheck={false} style={{ fontFamily: 'var(--mono)', fontSize: '1.2rem' }}
            onChange={(e) => {
              setOctalText(e.target.value)
              const m = parseOctal(e.target.value)
              setOctalErr(m === null)
              if (m !== null) setMode(m, 'octal')
            }} />
          {octalErr && <p className="error" style={{ margin: '6px 0 0' }}>Use 3 or 4 digits from 0 to 7, like 644 or 2755.</p>}
        </div>
        <div>
          <label htmlFor="chmod-sym">Symbolic (ls -l style works too)</label>
          <input id="chmod-sym" type="text" value={symText} spellCheck={false} style={{ fontFamily: 'var(--mono)', fontSize: '1.2rem' }}
            onChange={(e) => {
              setSymText(e.target.value)
              const m = parseSymbolic(e.target.value)
              setSymErr(m === null)
              if (m !== null) setMode(m, 'sym')
            }} />
          {symErr && <p className="error" style={{ margin: '6px 0 0' }}>Use 9 characters like rwxr-xr-x (or -rwsr-xr-x from ls -l).</p>}
        </div>
      </div>

      <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem', minWidth: 300 }}>
          <thead>
            <tr>
              <th style={{ ...cell, textAlign: 'left' }} />
              {PERMS.map((p) => <th key={p} style={cell}>{p[0].toUpperCase() + p.slice(1)}</th>)}
              <th style={{ ...cell, fontFamily: 'var(--mono)' }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {WHO.map((who, w) => (
              <tr key={who}>
                <th style={{ ...cell, textAlign: 'left' }}>{who[0].toUpperCase() + who.slice(1)}</th>
                {PERMS.map((p, pi) => (
                  <td key={p} style={cell}>
                    <input type="checkbox" aria-label={`${who} ${p}`} checked={!!(mode & bit(w, pi))} onChange={() => setMode(mode ^ bit(w, pi))} style={{ width: 20, height: 20 }} />
                  </td>
                ))}
                <td style={{ ...cell, fontFamily: 'var(--mono)', fontWeight: 700 }}><Roll>{(mode >> ((2 - w) * 3)) & 7}</Roll></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row">
        <b style={{ fontSize: '0.92rem' }}>Special:</b>
        {SPECIAL.map((s) => (
          <label key={s} style={{ fontWeight: 400 }}>
            <input type="checkbox" checked={!!(mode & SPECIAL_BITS[s])} onChange={() => setMode(mode ^ SPECIAL_BITS[s])} /> {s === 'sticky' ? 'Sticky bit' : s}
          </label>
        ))}
      </div>

      <div className="stats">
        <div className="stat"><b style={{ fontFamily: 'var(--mono)' }}><Roll>{octal}</Roll></b>Octal</div>
        <div className="stat"><b style={{ fontFamily: 'var(--mono)', fontSize: '1.15rem', paddingTop: 6 }}><MorphText text={toSymbolic(mode)} /></b>Symbolic</div>
      </div>

      <label htmlFor="chmod-file">File or directory name</label>
      <input id="chmod-file" type="text" value={file} onChange={(e) => setFile(e.target.value)} spellCheck={false} />
      {[numericCmd, symbolicCmd].map((c) => (
        <div key={c} className="row" style={{ flexWrap: 'nowrap' }}>
          <div className="output" style={{ flex: 1, minWidth: 0 }}>{c}</div>
          <CopyButton text={c} />
        </div>
      ))}

      {warns.map((w) => <p key={w} className="error shake-once" style={{ margin: '6px 0' }}>⚠ {w}</p>)}
      <ul className="muted" style={{ paddingLeft: 20, margin: '10px 0' }}>
        {explain(mode).map((n) => <li key={n}>{n}</li>)}
      </ul>

      <label>Common presets</label>
      <PillRow style={{ marginTop: 0 }}>
        {PRESETS.map((p) => (
          <button key={p.mode} type="button" className={`btn ${octal === p.mode ? 'primary' : ''}`} title={p.label}
            style={p.warn ? { borderColor: 'var(--danger)', color: octal === p.mode ? undefined : 'var(--danger)' } : undefined}
            onClick={() => setMode(parseOctal(p.mode)!)}>
            <span style={{ fontFamily: 'var(--mono)' }}>{p.mode}</span> <span style={{ fontWeight: 400, fontSize: '0.82rem' }}>{p.label}</span>
          </button>
        ))}
      </PillRow>
    </div>
  )
}
