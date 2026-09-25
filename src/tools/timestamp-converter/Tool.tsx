import { useEffect, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import MorphText from '../../motion/MorphText'
import Roll from '../../motion/Roll'
import { parseTimestamp } from './parse'

function toLocalInput(d: Date): string {
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 19)
}

export default function TimestampConverter() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const [ts, setTs] = useState(() => String(Math.floor(Date.now() / 1000)))
  const [local, setLocal] = useState(() => toLocalInput(new Date()))

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  const date = parseTimestamp(ts)
  const fromLocal = local ? new Date(local) : null
  const localSeconds = fromLocal && !isNaN(fromLocal.getTime()) ? String(Math.floor(fromLocal.getTime() / 1000)) : ''

  return (
    <div>
      <p>
        Current Unix time: <b><Roll>{now}</Roll></b>
      </p>
      <label htmlFor="ts-in">Timestamp → date</label>
      <input id="ts-in" type="text" inputMode="numeric" value={ts} onChange={(e) => setTs(e.target.value)} placeholder="1700000000" />
      {ts.trim() && !date && <p className="error">Enter a number of seconds or milliseconds.</p>}
      {date && (
        <table className="simple" style={{ marginTop: 8 }}>
          <tbody>
            <tr><th>Your time</th><td><MorphText text={date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' })} stagger={3} /></td></tr>
            <tr><th>UTC</th><td><MorphText text={date.toUTCString()} stagger={3} /></td></tr>
            <tr><th>ISO 8601</th><td><MorphText text={date.toISOString()} stagger={3} /> <CopyButton text={date.toISOString()} /></td></tr>
          </tbody>
        </table>
      )}
      <label htmlFor="ts-local">Date → timestamp</label>
      <input id="ts-local" type="datetime-local" step={1} value={local} onChange={(e) => setLocal(e.target.value)} style={{ width: '100%' }} />
      {localSeconds && (
        <div className="row">
          <div className="output" style={{ flex: 1 }}><Roll>{localSeconds}</Roll></div>
          <CopyButton text={localSeconds} />
        </div>
      )}
    </div>
  )
}
