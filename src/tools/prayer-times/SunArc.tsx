import { useEffect, useMemo, useRef, useState } from 'react'
import { reducedMotion } from '../../motion/springs'
import { hhmm, PRAYER_LABEL, sunAltitude, type Place, type PrayerKey, type Times } from './prayer'

const W = 360
const H = 190
const TOP = 16
const HORIZON = 120
const x = (h: number) => (h / 24) * W
const y = (alt: number) => (alt >= 0 ? HORIZON - (alt / 90) * (HORIZON - TOP) : HORIZON - (alt / 90) * 120)

const SHOWN: PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']

/** The sun's real altitude through the day, with each prayer marked and the sun at `hour`. */
export default function SunArc({ date, place, times, hour, next }: { date: [number, number, number]; place: Place; times: Times; hour: number; next: PrayerKey | null }) {
  const [yy, mm, dd] = date
  const path = useMemo(() => {
    let d = ''
    for (let i = 0; i <= 96; i++) {
      const h = i / 4
      d += `${i ? 'L' : 'M'}${x(h).toFixed(1)},${y(sunAltitude(yy, mm, dd, h, place)).toFixed(1)}`
    }
    return d
  }, [yy, mm, dd, place])

  // Sweep the sun from sunrise to its target when the day or place changes.
  const [shown, setShown] = useState(hour)
  const from = useRef(times.sunrise)
  const key = `${yy}-${mm}-${dd}-${place.lat}-${place.lng}`
  const lastKey = useRef('')
  useEffect(() => {
    if (reducedMotion()) {
      setShown(hour)
      return
    }
    if (lastKey.current === key) {
      setShown(hour)
      return
    }
    lastKey.current = key
    from.current = Number.isFinite(times.sunrise) ? times.sunrise : 6
    const start = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 1400)
      const e = 1 - (1 - k) ** 3
      setShown(from.current + (hour - from.current) * e)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hour])

  const sunAlt = sunAltitude(yy, mm, dd, shown, place)
  const up = sunAlt > -0.833
  return (
    <svg className="pt-arc" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sun path across the sky with prayer times marked">
      <defs>
        <linearGradient id="pt-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--pt-sky-top)" />
          <stop offset="1" stopColor="var(--pt-sky-low)" />
        </linearGradient>
        <clipPath id="pt-above">
          <rect x="0" y="0" width={W} height={HORIZON} />
        </clipPath>
      </defs>
      <rect x="0" y="0" width={W} height={HORIZON} fill="url(#pt-sky)" rx="8" opacity={up ? 1 : 0.45} className="pt-sky" />
      <rect x="0" y={HORIZON} width={W} height={H - HORIZON} fill="var(--pt-ground)" />
      <path d={path} className="pt-path-dim" />
      <path d={path} className="pt-path" clipPath="url(#pt-above)" pathLength={1} />
      <line x1="0" x2={W} y1={HORIZON} y2={HORIZON} className="pt-horizon" />
      {[0, 6, 12, 18, 24].map((h) => (
        <text key={h} x={Math.min(W - 12, Math.max(10, x(h)))} y={H - 4} className="pt-tick" textAnchor="middle">
          {String(h % 24).padStart(2, '0')}
        </text>
      ))}
      {SHOWN.map((k, i) => {
        const t = times[k]
        if (!Number.isFinite(t)) return null
        const px = x(t)
        const py = y(sunAltitude(yy, mm, dd, t, place))
        const labelY = i % 2 ? py - 10 : py + 17
        return (
          <g key={k} className={`pt-mark ${next === k ? 'next' : ''}`} style={{ animationDelay: `${i * 90}ms` }}>
            <circle cx={px} cy={py} r={next === k ? 5 : 3.5} />
            <text x={px} y={Math.max(11, Math.min(H - 16, labelY))} textAnchor="middle">
              {PRAYER_LABEL[k]} {hhmm(t)}
            </text>
          </g>
        )
      })}
      <g transform={`translate(${x(shown)},${y(sunAlt)})`} className="pt-sun">
        <circle r="13" className="pt-sun-glow" />
        <circle r="7.5" className={up ? 'pt-sun-body' : 'pt-sun-body night'} />
      </g>
    </svg>
  )
}
