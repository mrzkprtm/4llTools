import { useMemo, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import Check from '../../motion/Check'
import PillRow from '../../motion/PillRow'
import SettleOutput from '../../motion/SettleOutput'
import { useSettled } from '../../motion/useSettled'
import { composeToRun, runToCompose } from './compose'
import './tool.css'

type Mode = 'run2compose' | 'compose2run'

const RUN_EXAMPLES: { label: string; text: string }[] = [
  {
    label: 'Web + database',
    text: `docker run -d --name db --restart unless-stopped \\
  -e POSTGRES_USER=app -e POSTGRES_PASSWORD=$DB_PASSWORD -e POSTGRES_DB=app \\
  -v pgdata:/var/lib/postgresql/data --network appnet \\
  --health-cmd "pg_isready -U app" --health-interval 10s --health-retries 5 \\
  postgres:16-alpine

docker run -d --name web --restart unless-stopped -p 8080:80 \\
  -v ./html:/usr/share/nginx/html:ro --network appnet \\
  --memory 256m --cpus 0.5 --label com.example.tier=frontend \\
  nginx:alpine`,
  },
  {
    label: 'Interactive dev shell',
    text: `docker run --rm -it -w /work -v "$(pwd)":/work -u 1000:1000 -e NODE_ENV=development node:22 bash`,
  },
  {
    label: 'GPU + devices',
    text: `docker run -d --name ollama --gpus all -p 11434:11434 -v ollama:/root/.ollama --cap-add SYS_ADMIN --device /dev/fuse ollama/ollama`,
  },
]

const COMPOSE_EXAMPLE = `services:
  cache:
    image: redis:7-alpine
    restart: always
    ports:
      - "6379:6379"
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redisdata:/data
  api:
    image: ghcr.io/acme/api:latest
    environment:
      LOG_LEVEL: info
      REDIS_URL: redis://cache:6379
    ports:
      - "3000:3000"
    depends_on: [cache]
volumes:
  redisdata:
`

export default function DockerCompose() {
  const [mode, setMode] = useState<Mode>('run2compose')
  const [runText, setRunText] = useState(RUN_EXAMPLES[0].text)
  const [composeText, setComposeText] = useState(COMPOSE_EXAMPLE)

  const result = useMemo(() => {
    try {
      if (mode === 'run2compose') {
        const r = runToCompose(runText)
        return { ok: true as const, output: r.yaml, items: r.services, notes: r.notes }
      }
      const r = composeToRun(composeText)
      return { ok: true as const, output: r.commands.join('\n\n'), items: r.commands.map((c) => /--name (\S+)/.exec(c)?.[1] ?? '?'), notes: r.notes }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
    }
  }, [mode, runText, composeText])

  const settled = useSettled(result.ok ? result.output : '', 300)
  const outName = mode === 'run2compose' ? 'docker-compose.yml' : 'docker-run.sh'

  function download() {
    if (!result.ok) return
    const text = mode === 'run2compose' ? result.output : `#!/bin/sh\n${result.output}\n`
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = outName
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <div>
      <PillRow label="Direction">
        <button type="button" aria-pressed={mode === 'run2compose'} className={`btn ${mode === 'run2compose' ? 'primary' : ''}`} onClick={() => setMode('run2compose')}>docker run → Compose</button>
        <button type="button" aria-pressed={mode === 'compose2run'} className={`btn ${mode === 'compose2run' ? 'primary' : ''}`} onClick={() => setMode('compose2run')}>Compose → docker run</button>
      </PillRow>

      <div className="two-col dc-cols">
        <div>
          {mode === 'run2compose' ? (
            <>
              <label htmlFor="dc-in">docker run command(s)</label>
              <textarea id="dc-in" value={runText} onChange={(e) => setRunText(e.target.value)} spellCheck={false} style={{ minHeight: 320 }} aria-invalid={!result.ok} />
              <div className="row" style={{ gap: 6 }}>
                <span className="muted" style={{ fontSize: '0.85rem' }}>Examples:</span>
                {RUN_EXAMPLES.map((ex) => (
                  <button key={ex.label} type="button" className="btn dc-ex" onClick={() => setRunText(ex.text)}>{ex.label}</button>
                ))}
              </div>
            </>
          ) : (
            <>
              <label htmlFor="dc-yaml">docker-compose.yml</label>
              <textarea id="dc-yaml" value={composeText} onChange={(e) => setComposeText(e.target.value)} spellCheck={false} style={{ minHeight: 320 }} aria-invalid={!result.ok} />
              <div className="row">
                <button type="button" className="btn dc-ex" onClick={() => setComposeText(COMPOSE_EXAMPLE)}>Load example</button>
              </div>
            </>
          )}
        </div>
        <div>
          <div className="row" style={{ justifyContent: 'space-between', margin: '16px 0 6px' }}>
            <label htmlFor="dc-out" style={{ margin: 0 }}>{outName}</label>
            <span className="row" style={{ margin: 0 }}>
              <CopyButton text={result.ok ? result.output : ''} />
              <button type="button" className="btn btn-icon" onClick={download} disabled={!result.ok}>
                <Icon name="arrow-down-circle" size={18} /> Download
              </button>
            </span>
          </div>
          {result.ok ? (
            <SettleOutput id="dc-out" value={result.output} motion="order" style={{ minHeight: 320 }} />
          ) : (
            <p className="error dc-error" role="alert">{result.error}</p>
          )}
        </div>
      </div>

      {result.ok && (
        <div className="row dc-services" key={settled} aria-live="polite">
          <span className="ok" aria-hidden="true"><Check size={18} /></span>
          <span className="muted" style={{ fontSize: '0.88rem' }}>
            {result.items.length} {mode === 'run2compose' ? 'service' : 'command'}{result.items.length === 1 ? '' : 's'}:
          </span>
          {result.items.map((s, i) => (
            <span key={`${s}-${i}`} className="chip good" style={{ animationDelay: `${i * 60}ms` }}>{s}</span>
          ))}
        </div>
      )}

      {result.ok && result.notes.length > 0 && (
        <div className="dc-notes">
          <b>Notes ({result.notes.length})</b>
          <ul>
            {result.notes.map((n, i) => (
              <li key={n} className="settle-in" style={{ animationDelay: `${i * 40}ms` }}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Paste one or more <code>docker run</code> commands (multi-line with <code>\</code> works). Ports, volumes and <code>--mount</code>, env and env files,
        restart policy, networks, labels, capabilities, devices, health checks, memory/CPU limits (as <code>deploy.resources</code>), <code>-it</code> and more
        are converted. Flags without a compose equivalent are listed as notes. Values like <code>$(pwd)</code> are kept literally, so check paths before running.
      </p>
    </div>
  )
}
