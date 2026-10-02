import { useEffect, useMemo } from 'react'
import Icon from '../../components/Icon'
import { reducedMotion } from '../../motion/springs'
import './parts.css'

/** A big on-screen number pad for quiz answers (also used by the mental math trainer). */
export function NumPad({ onKey, disabled }: { onKey: (key: string) => void; disabled?: boolean }) {
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'back', '0', 'ok']
  return (
    <div className="np-pad" role="group" aria-label="Number pad">
      {keys.map((k) => (
        <button key={k} type="button" className={`btn np-key ${k === 'ok' ? 'primary' : ''}`} disabled={disabled} onClick={() => onKey(k)} aria-label={k === 'back' ? 'Delete' : k === 'ok' ? 'Check answer' : k}>
          {k === 'back' ? <Icon name="arrow-left" size={22} /> : k === 'ok' ? 'OK' : k}
        </button>
      ))}
    </div>
  )
}

/** Listens for digits, Backspace and Enter on the keyboard while `active`. */
export function useNumberKeys(active: boolean, onKey: (key: string) => void) {
  useEffect(() => {
    if (!active) return
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      if (/^\d$/.test(e.key)) onKey(e.key)
      else if (e.key === 'Backspace') onKey('back')
      else if (e.key === 'Enter') onKey('ok')
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [active, onKey])
}

const COLORS = ['#e8590c', '#1c7ed6', '#2f9e44', '#ae3ec9', '#f59f00', '#0ca678', '#e03131']

/** A one-shot burst of confetti. Change `burst` to fire again; nothing shows with reduced motion. */
export function Confetti({ burst }: { burst: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: 50 + (Math.random() - 0.5) * 30,
        dx: (Math.random() - 0.5) * 340,
        dy: -120 - Math.random() * 180,
        rot: (Math.random() - 0.5) * 720,
        color: COLORS[i % COLORS.length],
        delay: Math.random() * 120,
      })),
    [burst],
  )
  if (!burst || reducedMotion()) return null
  return (
    <div className="np-confetti" key={burst} aria-hidden="true">
      {bits.map((b, i) => (
        <i key={i} style={{ left: `${b.left}%`, background: b.color, animationDelay: `${b.delay}ms`, ['--dx' as string]: `${b.dx}px`, ['--dy' as string]: `${b.dy}px`, ['--rot' as string]: `${b.rot}deg` }} />
      ))}
    </div>
  )
}
