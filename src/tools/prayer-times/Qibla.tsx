import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import { kaabaDistance, qibla } from './prayer'

type OrientationCtor = { requestPermission?: () => Promise<'granted' | 'denied'> }
type CompassEvent = DeviceOrientationEvent & { webkitCompassHeading?: number }

/** Qibla bearing on a compass rose; optionally rotates with the phone's compass. */
export default function Qibla({ lat, lng }: { lat: number; lng: number }) {
  const bearing = qibla(lat, lng)
  const [heading, setHeading] = useState<number | null>(null)
  const [msg, setMsg] = useState('')
  const stop = useRef<(() => void) | null>(null)

  useEffect(() => () => stop.current?.(), [])

  async function startLive() {
    if (stop.current) {
      stop.current()
      stop.current = null
      setHeading(null)
      setMsg('')
      return
    }
    if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') {
      setMsg('This device has no compass sensor. Use the bearing with a physical compass instead.')
      return
    }
    const ctor = DeviceOrientationEvent as unknown as OrientationCtor
    if (typeof ctor.requestPermission === 'function') {
      try {
        if ((await ctor.requestPermission()) !== 'granted') {
          setMsg('Compass access was declined. You can still use the bearing shown.')
          return
        }
      } catch {
        setMsg('Compass access could not be requested here.')
        return
      }
    }
    let got = false
    const onAbs = (e: DeviceOrientationEvent) => {
      const ce = e as CompassEvent
      let h: number | null = null
      if (typeof ce.webkitCompassHeading === 'number') h = ce.webkitCompassHeading
      else if (e.absolute && e.alpha != null) h = 360 - e.alpha
      if (h == null) return
      got = true
      setHeading(((h % 360) + 360) % 360)
    }
    const evAbs = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation'
    window.addEventListener(evAbs, onAbs as EventListener)
    stop.current = () => window.removeEventListener(evAbs, onAbs as EventListener)
    setMsg('Hold the phone flat, away from metal and magnets.')
    setTimeout(() => {
      if (!got && stop.current) setMsg('No compass readings came in. This browser or device may not share its heading.')
    }, 2500)
  }

  const rot = heading == null ? 0 : -heading
  const facing = heading != null && Math.abs(((bearing - heading + 540) % 360) - 180) < 5
  return (
    <div className="pt-qibla">
      <svg viewBox="-110 -110 220 220" className={`pt-compass ${facing ? 'facing' : ''}`} role="img" aria-label={`Qibla bearing ${bearing.toFixed(1)} degrees from north`}>
        <circle r="104" className="pt-dial" />
        <g style={{ transform: `rotate(${rot}deg)` }} className="pt-rose">
          {Array.from({ length: 72 }, (_, i) => (
            <line key={i} x1="0" x2="0" y1={-100} y2={i % 18 === 0 ? -86 : i % 2 ? -96 : -92} transform={`rotate(${i * 5})`} className="pt-tickline" />
          ))}
          {(['N', 'E', 'S', 'W'] as const).map((d, i) => (
            <text key={d} transform={`rotate(${i * 90}) translate(0,-70) rotate(${-i * 90 - rot})`} textAnchor="middle" dominantBaseline="middle" className={d === 'N' ? 'pt-north' : 'pt-dir'}>
              {d}
            </text>
          ))}
          <g className="pt-needle" style={{ transform: `rotate(${bearing}deg)` }}>
            <path d="M0,-92 L9,-12 L0,-2 L-9,-12 Z" />
            <rect x="-7" y="-104" width="14" height="14" rx="2" className="pt-kaaba" />
          </g>
        </g>
        <circle r="5" className="pt-hub" />
      </svg>
      <div className="pt-qibla-info">
        <b className="pt-deg">{bearing.toFixed(1)}°</b>
        <span className="muted">from true north · {Math.round(kaabaDistance(lat, lng)).toLocaleString('en-US')} km to the Kaaba</span>
        <button type="button" className={`btn btn-icon ${heading != null || stop.current ? 'primary' : ''}`} onClick={startLive}>
          <Icon name="compass-2" size={18} />
          {stop.current ? 'Stop live compass' : 'Live compass'}
        </button>
        {facing && <span className="ok">You are facing the qibla.</span>}
        {msg && <span className="muted pt-small">{msg}</span>}
      </div>
    </div>
  )
}
