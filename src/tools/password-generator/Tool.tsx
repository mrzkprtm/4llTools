import { useCallback, useEffect, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Roll from '../../motion/Roll'
import { useScramble } from '../../motion/useScramble'
import { generatePassword, strengthBits, type PasswordOptions } from './generate'

const LABELS: Record<Exclude<keyof PasswordOptions, 'length'>, string> = {
  lower: 'Lowercase (a-z)',
  upper: 'Uppercase (A-Z)',
  digits: 'Numbers (0-9)',
  symbols: 'Symbols (!@#…)',
  avoidAmbiguous: 'Avoid look-alikes (l, 1, O, 0)',
}

export default function PasswordGenerator() {
  const [opts, setOpts] = useState<PasswordOptions>({ length: 16, lower: true, upper: true, digits: true, symbols: true, avoidAmbiguous: false })
  const [password, setPassword] = useState('')
  const regenerate = useCallback(() => setPassword(generatePassword(opts)), [opts])
  useEffect(regenerate, [regenerate])

  const shown = useScramble(password, { limit: 64, pool: 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*' })
  const bits = strengthBits(opts)
  const strength = bits >= 100 ? 'Very strong' : bits >= 70 ? 'Strong' : bits >= 50 ? 'Okay' : 'Weak'

  return (
    <div>
      <div className="output" style={{ fontSize: '1.2rem', minHeight: 48 }} aria-live="polite">{shown || '—'}</div>
      <div className="bar" style={{ margin: '10px 0 0' }} aria-hidden="true">
        <i style={{ transform: `scaleX(${Math.min(1, Math.max(0.04, bits / 128))})`, background: bits >= 70 ? 'var(--ok)' : bits >= 50 ? '#d97706' : 'var(--danger)' }} />
      </div>
      <div className="row">
        <button type="button" className="btn primary" onClick={regenerate}>Generate new</button>
        <CopyButton text={password} />
        <span className={bits >= 70 ? 'ok' : bits >= 50 ? 'muted' : 'error'}>{strength} (~<Roll>{bits}</Roll> bits)</span>
      </div>
      <label htmlFor="pw-len">Length: {opts.length}</label>
      <input id="pw-len" type="range" min={4} max={64} value={opts.length} onChange={(e) => setOpts({ ...opts, length: Number(e.target.value) })} />
      {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((k) => (
        <label key={k} style={{ fontWeight: 400, margin: '8px 0' }}>
          <input type="checkbox" checked={opts[k]} onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })} /> {LABELS[k]}
        </label>
      ))}
    </div>
  )
}
