import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import SettleOutput from '../../motion/SettleOutput'
import { csvToJson, jsonToCsv } from './csv'

export default function CsvJson() {
  const [mode, setMode] = useState<'csv2json' | 'json2csv'>('csv2json')
  const [input, setInput] = useState('name,city\nBudi,Jakarta\nSiti,"Bandung, Jawa Barat"')
  const [delimiter, setDelimiter] = useState(',')
  const [header, setHeader] = useState(true)

  let output = ''
  let error = ''
  let rows = 0
  try {
    if (mode === 'csv2json') {
      const data = csvToJson(input, delimiter, header)
      rows = data.length
      output = JSON.stringify(data, null, 2)
    } else if (input.trim()) {
      const data = JSON.parse(input)
      rows = Array.isArray(data) ? data.length : 1
      output = jsonToCsv(data, delimiter)
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
  }

  function download() {
    const blob = new Blob([output], { type: mode === 'csv2json' ? 'application/json' : 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = mode === 'csv2json' ? 'data.json' : 'data.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <PillRow>
        <button type="button" className={`btn ${mode === 'csv2json' ? 'primary' : ''}`} onClick={() => setMode('csv2json')}>CSV → JSON</button>
        <button type="button" className={`btn ${mode === 'json2csv' ? 'primary' : ''}`} onClick={() => setMode('json2csv')}>JSON → CSV</button>
        <select value={delimiter} onChange={(e) => setDelimiter(e.target.value)} style={{ width: 'auto' }} aria-label="Delimiter">
          <option value=",">Comma (,)</option>
          <option value=";">Semicolon (;)</option>
          <option value={'\t'}>Tab</option>
          <option value="|">Pipe (|)</option>
        </select>
        {mode === 'csv2json' && (
          <label style={{ fontWeight: 400, margin: 0 }}>
            <input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} /> First row is the header
          </label>
        )}
      </PillRow>
      <label htmlFor="csv-in">{mode === 'csv2json' ? 'CSV' : 'JSON'}</label>
      <textarea id="csv-in" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
      <label htmlFor="csv-file">Or open a file</label>
      <input id="csv-file" type="file" accept=".csv,.json,.txt,text/csv,application/json" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setInput(await f.text()); e.target.value = '' }} />
      {error ? <p className="error shake-once" key={error}>{error}</p> : output && <p style={{ margin: '10px 0 0' }}><span className="chip"><Roll>{rows}</Roll> {rows === 1 ? 'row' : 'rows'}</span></p>}
      <label htmlFor="csv-out">{mode === 'csv2json' ? 'JSON' : 'CSV'}</label>
      <SettleOutput id="csv-out" value={output} motion="order" />
      <div className="row">
        <CopyButton text={output} />
        <button type="button" className="btn" onClick={download} disabled={!output}>Download</button>
      </div>
    </div>
  )
}
