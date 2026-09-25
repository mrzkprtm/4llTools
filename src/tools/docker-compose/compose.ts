import { Document, isScalar, isSeq, parse as parseYaml, visit } from 'yaml'

/* ---------------- Shell tokenizer ---------------- */

/** A command separator in the token stream (newline, `;`, `&&`, `||`, `|`). */
export const SEP = '\u0000SEP'

/**
 * Splits shell text into words the way a POSIX shell would for our purposes:
 * single quotes are literal, double quotes allow \" \\ \$ \` escapes,
 * a backslash before a newline joins lines, and a `#` at the start of a word
 * starts a comment. Unquoted newlines, `;`, `&&`, `||` and `|` become SEP.
 */
export function tokenize(input: string): string[] {
  const out: string[] = []
  let cur = ''
  let has = false
  const push = () => {
    if (has) out.push(cur)
    cur = ''
    has = false
  }
  const sep = () => {
    push()
    if (out.length && out[out.length - 1] !== SEP) out.push(SEP)
  }
  const s = input.replace(/\r\n?/g, '\n')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\') {
      const n = s[i + 1]
      if (n === '\n') {
        i++
        continue
      }
      if (n === undefined) continue
      cur += n
      has = true
      i++
      continue
    }
    if (c === "'") {
      const end = s.indexOf("'", i + 1)
      if (end < 0) throw new Error('Unclosed single quote.')
      cur += s.slice(i + 1, end)
      has = true
      i = end
      continue
    }
    if (c === '"') {
      has = true
      let j = i + 1
      for (; j < s.length && s[j] !== '"'; j++) {
        if (s[j] === '\\' && j + 1 < s.length) {
          const n = s[j + 1]
          if (n === '\n') {
            j++
            continue
          }
          if ('"\\$`'.includes(n)) {
            cur += n
            j++
            continue
          }
        }
        cur += s[j]
      }
      if (j >= s.length) throw new Error('Unclosed double quote.')
      i = j
      continue
    }
    if (c === '#' && !has) {
      while (i < s.length && s[i] !== '\n') i++
      sep()
      continue
    }
    if (c === '\n' || c === ';') {
      sep()
      continue
    }
    if ((c === '&' && s[i + 1] === '&') || (c === '|' && s[i + 1] === '|')) {
      sep()
      i++
      continue
    }
    if (c === '|') {
      sep()
      continue
    }
    if (c === ' ' || c === '\t') {
      push()
      continue
    }
    cur += c
    has = true
  }
  push()
  while (out.length && out[out.length - 1] === SEP) out.pop()
  return out
}

/* ---------------- docker run → compose ---------------- */

const SHORT_VALUE = new Set(['a', 'c', 'e', 'h', 'l', 'm', 'p', 'u', 'v', 'w'])
const SHORT_BOOL = new Set(['d', 'i', 't', 'P', 'q'])
const SHORT_LONG: Record<string, string> = {
  a: 'attach', c: 'cpu-shares', e: 'env', h: 'hostname', l: 'label', m: 'memory', p: 'publish', u: 'user', v: 'volume', w: 'workdir',
  d: 'detach', i: 'interactive', t: 'tty', P: 'publish-all', q: 'quiet',
}
const LONG_BOOL = new Set(['detach', 'interactive', 'tty', 'rm', 'privileged', 'init', 'read-only', 'publish-all', 'no-healthcheck', 'oom-kill-disable', 'quiet', 'sig-proxy', 'disable-content-trust', 'help'])
const LONG_VALUE = new Set([
  'add-host', 'annotation', 'attach', 'blkio-weight', 'cap-add', 'cap-drop', 'cgroup-parent', 'cgroupns', 'cidfile', 'cpu-period', 'cpu-quota', 'cpu-shares', 'cpus', 'cpuset-cpus', 'cpuset-mems',
  'device', 'dns', 'dns-option', 'dns-search', 'domainname', 'entrypoint', 'env', 'env-file', 'expose', 'gpus', 'group-add',
  'health-cmd', 'health-interval', 'health-retries', 'health-start-period', 'health-start-interval', 'health-timeout', 'hostname', 'ip', 'ip6', 'ipc', 'isolation', 'kernel-memory',
  'label', 'label-file', 'link', 'log-driver', 'log-opt', 'mac-address', 'memory', 'memory-reservation', 'memory-swap', 'memory-swappiness', 'mount', 'name', 'network', 'net', 'network-alias', 'net-alias',
  'oom-score-adj', 'pid', 'pids-limit', 'platform', 'publish', 'pull', 'restart', 'runtime', 'security-opt', 'shm-size', 'stop-signal', 'stop-timeout', 'storage-opt', 'sysctl', 'tmpfs', 'ulimit', 'user', 'userns', 'uts', 'volume', 'volumes-from', 'workdir',
])

export interface ParsedRun {
  name: string
  service: Record<string, unknown>
  networks: string[]
  volumes: string[]
  notes: string[]
}

type Opt = { flag: string; value?: string }

function splitKV(s: string): [string, string | undefined] {
  const i = s.indexOf('=')
  return i < 0 ? [s, undefined] : [s.slice(0, i), s.slice(i + 1)]
}

/** Service name from an image like "ghcr.io/org/my-app:1.2" → "my-app". */
export function serviceNameFromImage(image: string): string {
  const noDigest = image.split('@')[0]
  const last = noDigest.split('/').pop() ?? 'app'
  const base = last.replace(/:[^:]*$/, '')
  return base.toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^[^a-z0-9]+/, '') || 'app'
}

const num = (v: string) => (/^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v)

function parseMount(spec: string, notes: string[]): Record<string, unknown> | null {
  const m: Record<string, string> = {}
  let readOnly = false
  for (const part of spec.split(',')) {
    const [k, v] = splitKV(part.trim())
    const key = k.toLowerCase()
    if (key === 'readonly' || key === 'ro') readOnly = v === undefined || v === 'true' || v === '1'
    else if (v !== undefined) m[key] = v
  }
  const type = m.type ?? 'volume'
  const source = m.source ?? m.src
  const target = m.target ?? m.destination ?? m.dst
  if (!target) {
    notes.push(`--mount "${spec}" has no target, skipped.`)
    return null
  }
  const out: Record<string, unknown> = { type }
  if (source) out.source = source
  out.target = target
  if (readOnly) out.read_only = true
  if (m['bind-propagation']) out.bind = { propagation: m['bind-propagation'] }
  if (m['volume-nocopy'] === 'true') out.volume = { nocopy: true }
  if (m['tmpfs-size']) out.tmpfs = { size: num(m['tmpfs-size']) }
  return out
}

const isNamedVolume = (src: string) => !!src && !/^[/.~$]/.test(src) && !/^[A-Za-z]:[\\/]/.test(src)

/** Parses the words after `docker run` into a compose service. */
export function parseRun(args: string[]): ParsedRun {
  const notes: string[] = []
  const opts: Opt[] = []
  let i = 0
  let image = ''
  for (; i < args.length; i++) {
    const a = args[i]
    if (a === '--') {
      i++
      break
    }
    if (a.startsWith('--')) {
      const [rawName, inline] = splitKV(a.slice(2))
      const name = rawName
      if (LONG_BOOL.has(name)) {
        opts.push({ flag: name, value: inline })
      } else if (LONG_VALUE.has(name)) {
        const value = inline ?? args[++i]
        if (value === undefined) throw new Error(`--${name} needs a value.`)
        opts.push({ flag: name, value })
      } else {
        // Unknown long flag: guess that it takes a value when written as --x=y.
        opts.push({ flag: name, value: inline })
      }
      continue
    }
    if (a.startsWith('-') && a.length > 1) {
      const chars = a.slice(1)
      for (let k = 0; k < chars.length; k++) {
        const ch = chars[k]
        if (SHORT_VALUE.has(ch)) {
          const rest = chars.slice(k + 1).replace(/^=/, '')
          const value = rest || args[++i]
          if (value === undefined) throw new Error(`-${ch} needs a value.`)
          opts.push({ flag: SHORT_LONG[ch], value })
          break
        }
        if (SHORT_BOOL.has(ch)) opts.push({ flag: SHORT_LONG[ch] })
        else opts.push({ flag: `-${ch}` })
      }
      continue
    }
    break
  }
  image = args[i] ?? ''
  if (!image) throw new Error('No image found. A docker run command ends with an image name, like nginx:alpine.')
  const command = args.slice(i + 1)

  const svc: Record<string, unknown> = {}
  const networks: string[] = []
  const volumes: string[] = []
  const ports: string[] = []
  const vols: unknown[] = []
  const env: [string, string | undefined][] = []
  const envFiles: string[] = []
  const labels: Record<string, string> = {}
  const list = (key: string, v: string) => {
    const arr = (svc[key] as string[] | undefined) ?? []
    arr.push(v)
    svc[key] = arr
  }
  const limits: Record<string, unknown> = {}
  const reservations: Record<string, unknown> = {}
  const health: Record<string, unknown> = {}
  const logging: Record<string, unknown> = {}
  let name = ''
  const bool = (v: string | undefined) => v === undefined || v === 'true' || v === '1'

  for (const { flag, value = '' } of opts) {
    switch (flag) {
      case 'detach':
      case 'quiet':
      case 'sig-proxy':
      case 'disable-content-trust':
        break
      case 'rm':
        notes.push('--rm has no compose equivalent; use `docker compose run --rm` for one-off containers.')
        break
      case 'interactive':
        if (bool(value || undefined)) svc.stdin_open = true
        break
      case 'tty':
        if (bool(value || undefined)) svc.tty = true
        break
      case 'privileged':
        svc.privileged = true
        break
      case 'init':
        svc.init = true
        break
      case 'read-only':
        svc.read_only = true
        break
      case 'publish-all':
        notes.push('-P / --publish-all has no compose equivalent; list the ports explicitly.')
        break
      case 'oom-kill-disable':
        svc.oom_kill_disable = true
        break
      case 'name':
        name = value
        svc.container_name = value
        break
      case 'publish':
        ports.push(value)
        break
      case 'expose':
        list('expose', value)
        break
      case 'volume': {
        vols.push(value)
        const src = value.split(':')[0]
        if (value.includes(':') && isNamedVolume(src)) volumes.push(src)
        break
      }
      case 'mount': {
        const m = parseMount(value, notes)
        if (m) {
          vols.push(m)
          if (m.type === 'volume' && typeof m.source === 'string') volumes.push(m.source)
        }
        break
      }
      case 'tmpfs':
        list('tmpfs', value)
        break
      case 'volumes-from':
        list('volumes_from', value)
        break
      case 'env': {
        const [k, v] = splitKV(value)
        env.push([k, v])
        break
      }
      case 'env-file':
        envFiles.push(value)
        break
      case 'label': {
        const [k, v] = splitKV(value)
        labels[k] = v ?? ''
        break
      }
      case 'restart':
        svc.restart = value
        break
      case 'network':
      case 'net':
        if (['host', 'none', 'bridge'].includes(value) || value.startsWith('container:') || value.startsWith('service:')) svc.network_mode = value
        else {
          list('networks', value)
          networks.push(value)
        }
        break
      case 'network-alias':
      case 'net-alias':
        notes.push(`--${flag} ${value}: add it under networks.<name>.aliases in the compose file.`)
        break
      case 'workdir':
        svc.working_dir = value
        break
      case 'user':
        svc.user = value
        break
      case 'entrypoint':
        svc.entrypoint = value
        break
      case 'hostname':
        svc.hostname = value
        break
      case 'domainname':
        svc.domainname = value
        break
      case 'cap-add':
        list('cap_add', value)
        break
      case 'cap-drop':
        list('cap_drop', value)
        break
      case 'device':
        list('devices', value)
        break
      case 'dns':
        list('dns', value)
        break
      case 'dns-search':
        list('dns_search', value)
        break
      case 'dns-option':
        list('dns_opt', value)
        break
      case 'add-host':
        list('extra_hosts', value)
        break
      case 'security-opt':
        list('security_opt', value)
        break
      case 'group-add':
        list('group_add', value)
        break
      case 'link':
        list('links', value)
        break
      case 'sysctl': {
        const [k, v] = splitKV(value)
        const s = (svc.sysctls as Record<string, unknown>) ?? {}
        s[k] = num(v ?? '')
        svc.sysctls = s
        break
      }
      case 'ulimit': {
        const [k, v = ''] = splitKV(value)
        const u = (svc.ulimits as Record<string, unknown>) ?? {}
        const [soft, hard] = v.split(':')
        u[k] = hard !== undefined ? { soft: num(soft), hard: num(hard) } : num(soft)
        svc.ulimits = u
        break
      }
      case 'memory':
        limits.memory = value
        break
      case 'cpus':
        limits.cpus = value
        break
      case 'pids-limit':
        limits.pids = num(value)
        break
      case 'memory-reservation':
        reservations.memory = value
        break
      case 'memory-swap':
        svc.memswap_limit = value
        break
      case 'memory-swappiness':
        svc.mem_swappiness = num(value)
        break
      case 'cpu-shares':
        svc.cpu_shares = num(value)
        break
      case 'cpuset-cpus':
        svc.cpuset = value
        break
      case 'cpu-period':
        svc.cpu_period = num(value)
        break
      case 'cpu-quota':
        svc.cpu_quota = num(value)
        break
      case 'gpus':
        reservations.devices = [{ driver: 'nvidia', count: value === 'all' ? 'all' : num(value.replace(/^count=/, '')), capabilities: ['gpu'] }]
        break
      case 'shm-size':
        svc.shm_size = value
        break
      case 'health-cmd':
        health.test = ['CMD-SHELL', value]
        break
      case 'health-interval':
        health.interval = value
        break
      case 'health-timeout':
        health.timeout = value
        break
      case 'health-retries':
        health.retries = num(value)
        break
      case 'health-start-period':
        health.start_period = value
        break
      case 'health-start-interval':
        health.start_interval = value
        break
      case 'no-healthcheck':
        health.disable = true
        break
      case 'log-driver':
        logging.driver = value
        break
      case 'log-opt': {
        const [k, v] = splitKV(value)
        const o = (logging.options as Record<string, string>) ?? {}
        o[k] = v ?? ''
        logging.options = o
        break
      }
      case 'platform':
        svc.platform = value
        break
      case 'pid':
        svc.pid = value
        break
      case 'ipc':
        svc.ipc = value
        break
      case 'uts':
        svc.uts = value
        break
      case 'userns':
        svc.userns_mode = value
        break
      case 'cgroupns':
        svc.cgroup = value
        break
      case 'cgroup-parent':
        svc.cgroup_parent = value
        break
      case 'runtime':
        svc.runtime = value
        break
      case 'isolation':
        svc.isolation = value
        break
      case 'mac-address':
        svc.mac_address = value
        break
      case 'stop-signal':
        svc.stop_signal = value
        break
      case 'stop-timeout':
        svc.stop_grace_period = /^\d+$/.test(value) ? `${value}s` : value
        break
      case 'pull':
        svc.pull_policy = value
        break
      case 'oom-score-adj':
        svc.oom_score_adj = num(value)
        break
      case 'storage-opt': {
        const [k, v] = splitKV(value)
        const s = (svc.storage_opt as Record<string, string>) ?? {}
        s[k] = v ?? ''
        svc.storage_opt = s
        break
      }
      case 'annotation': {
        const [k, v] = splitKV(value)
        const s = (svc.annotations as Record<string, string>) ?? {}
        s[k] = v ?? ''
        svc.annotations = s
        break
      }
      case 'label-file':
        list('label_file', value)
        break
      case 'ip':
      case 'ip6':
        notes.push(`--${flag} ${value}: set ipv4_address / ipv6_address under the service's network in compose.`)
        break
      default:
        notes.push(`Unsupported flag ${flag.startsWith('-') ? flag : `--${flag}`}${value ? ` ${value}` : ''} was skipped.`)
    }
  }

  // Assemble in a readable key order.
  const service: Record<string, unknown> = { image }
  if (svc.container_name) service.container_name = svc.container_name
  if (svc.restart) service.restart = svc.restart
  if (svc.entrypoint) service.entrypoint = svc.entrypoint
  if (command.length) service.command = command
  if (ports.length) service.ports = ports
  if (vols.length) service.volumes = vols
  if (envFiles.length) service.env_file = envFiles
  if (env.length) {
    service.environment = env.every(([, v]) => v !== undefined)
      ? Object.fromEntries(env.map(([k, v]) => [k, v]))
      : env.map(([k, v]) => (v === undefined ? k : `${k}=${v}`))
  }
  if (Object.keys(labels).length) service.labels = labels
  for (const [k, v] of Object.entries(svc)) if (!(k in service)) service[k] = v
  if (Object.keys(health).length) service.healthcheck = health
  if (Object.keys(logging).length) service.logging = logging
  if (Object.keys(limits).length || Object.keys(reservations).length) {
    const resources: Record<string, unknown> = {}
    if (Object.keys(limits).length) resources.limits = limits
    if (Object.keys(reservations).length) resources.reservations = reservations
    service.deploy = { resources }
  }

  return { name: name || serviceNameFromImage(image), service, networks, volumes, notes }
}

/** Finds each `docker run` (or `docker container run`) in the text. */
export function splitCommands(tokens: string[]): string[][] {
  const cmds: string[][] = []
  let cur: string[] = []
  const flush = () => {
    if (cur.length) cmds.push(cur)
    cur = []
  }
  for (const t of tokens) {
    if (t === SEP) flush()
    else cur.push(t)
  }
  flush()
  const runs: string[][] = []
  for (const c of cmds) {
    let k = 0
    while (k < c.length && (c[k] === 'sudo' || c[k] === '$' || /^[A-Z_][A-Z0-9_]*=/.test(c[k]))) k++
    if (c[k] !== 'docker' && c[k] !== 'podman') continue
    k++
    if (c[k] === 'container') k++
    if (c[k] !== 'run' && c[k] !== 'create') continue
    runs.push(c.slice(k + 1))
  }
  return runs
}

export interface ComposeResult {
  yaml: string
  services: string[]
  notes: string[]
}

export function runToCompose(input: string): ComposeResult {
  const runs = splitCommands(tokenize(input))
  if (!runs.length) throw new Error('No `docker run` command found. Paste one or more commands that start with docker run.')
  const services: Record<string, unknown> = {}
  const networks = new Set<string>()
  const volumes = new Set<string>()
  const notes: string[] = []
  for (const args of runs) {
    const r = parseRun(args)
    let name = r.name
    for (let n = 2; name in services; n++) name = `${r.name}-${n}`
    services[name] = r.service
    r.networks.forEach((n) => networks.add(n))
    r.volumes.forEach((v) => volumes.add(v))
    notes.push(...r.notes.map((n) => (runs.length > 1 ? `${name}: ${n}` : n)))
  }
  const doc: Record<string, unknown> = { services }
  if (volumes.size) doc.volumes = Object.fromEntries([...volumes].map((v) => [v, {}]))
  if (networks.size) doc.networks = Object.fromEntries([...networks].map((n) => [n, { external: true }]))
  if (networks.size) notes.push('Networks are marked external: create them with `docker network create`, or remove `external: true` to let compose create them.')
  const ydoc = new Document(doc)
  // Quote port mappings: YAML 1.1 parsers read 22:22 as a base-60 number.
  visit(ydoc, {
    Pair(_, pair) {
      if (isScalar(pair.key) && pair.key.value === 'ports' && isSeq(pair.value)) {
        for (const item of pair.value.items) if (isScalar(item)) item.type = 'QUOTE_DOUBLE'
      }
    },
  })
  const yaml = ydoc.toString({ lineWidth: 0 }).replace(/: \{\}$/gm, ':')
  return { yaml, services: Object.keys(services), notes }
}

/* ---------------- compose → docker run ---------------- */

/** Quotes a word for POSIX shells only when needed. */
export function shellQuote(s: string): string {
  if (s === '') return "''"
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(s)) return s
  return `'${s.replace(/'/g, `'\\''`)}'`
}

type Obj = Record<string, unknown>
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v])
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))

function kvList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(str)
  if (v && typeof v === 'object') return Object.entries(v as Obj).map(([k, x]) => (x === null || x === undefined ? k : `${k}=${str(x)}`))
  return []
}

export function composeToRun(input: string): { commands: string[]; notes: string[] } {
  let doc: unknown
  try {
    doc = parseYaml(input)
  } catch (e) {
    throw new Error(`YAML error: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`)
  }
  const services = (doc as Obj | null)?.services as Obj | undefined
  if (!services || typeof services !== 'object') throw new Error('No `services:` section found in the YAML.')
  const commands: string[] = []
  const notes: string[] = []
  const handled = new Set([
    'image', 'container_name', 'restart', 'ports', 'volumes', 'environment', 'env_file', 'labels', 'networks', 'network_mode', 'working_dir', 'user', 'entrypoint', 'command',
    'hostname', 'cap_add', 'cap_drop', 'devices', 'dns', 'extra_hosts', 'privileged', 'init', 'read_only', 'stdin_open', 'tty', 'healthcheck', 'deploy', 'expose', 'shm_size', 'platform', 'security_opt', 'tmpfs', 'logging', 'stop_signal', 'stop_grace_period', 'depends_on', 'ulimits', 'sysctls',
  ])
  for (const [name, raw] of Object.entries(services)) {
    const s = (raw ?? {}) as Obj
    const parts: string[] = []
    const add = (flag: string, v: unknown) => parts.push(`${flag} ${shellQuote(str(v))}`)
    add('--name', s.container_name ?? name)
    if (s.restart) add('--restart', s.restart)
    if (s.stdin_open && s.tty) parts.push('-it')
    else {
      if (s.stdin_open) parts.push('-i')
      if (s.tty) parts.push('-t')
    }
    if (s.privileged) parts.push('--privileged')
    if (s.init) parts.push('--init')
    if (s.read_only) parts.push('--read-only')
    for (const p of asList(s.ports)) {
      if (p && typeof p === 'object') {
        const o = p as Obj
        add('-p', `${o.host_ip ? `${o.host_ip}:` : ''}${o.published ? `${o.published}:` : ''}${o.target}${o.protocol && o.protocol !== 'tcp' ? `/${o.protocol}` : ''}`)
      } else add('-p', p)
    }
    for (const v of asList(s.volumes)) {
      if (v && typeof v === 'object') {
        const o = v as Obj
        const bits = [`type=${o.type ?? 'volume'}`]
        if (o.source) bits.push(`source=${o.source}`)
        bits.push(`target=${o.target}`)
        if (o.read_only) bits.push('readonly')
        add('--mount', bits.join(','))
      } else add('-v', v)
    }
    for (const f of asList(s.env_file)) add('--env-file', typeof f === 'object' && f ? (f as Obj).path : f)
    for (const e of kvList(s.environment)) add('-e', e)
    for (const l of kvList(s.labels)) add('--label', l)
    if (s.network_mode) add('--network', s.network_mode)
    const nets = Array.isArray(s.networks) ? s.networks : s.networks && typeof s.networks === 'object' ? Object.keys(s.networks as Obj) : []
    nets.forEach((n, idx) => {
      if (idx === 0) add('--network', n)
      else notes.push(`${name}: attach extra network with \`docker network connect ${str(n)} ${str(s.container_name ?? name)}\`.`)
    })
    if (s.working_dir) add('-w', s.working_dir)
    if (s.user !== undefined) add('-u', s.user)
    if (s.hostname) add('--hostname', s.hostname)
    for (const c of asList(s.cap_add)) add('--cap-add', c)
    for (const c of asList(s.cap_drop)) add('--cap-drop', c)
    for (const d of asList(s.devices)) add('--device', d)
    for (const d of asList(s.dns)) add('--dns', d)
    for (const h of kvList(s.extra_hosts)) add('--add-host', h.replace('=', ':'))
    for (const x of asList(s.expose)) add('--expose', x)
    for (const x of asList(s.security_opt)) add('--security-opt', x)
    for (const x of asList(s.tmpfs)) add('--tmpfs', x)
    for (const x of kvList(s.sysctls)) add('--sysctl', x)
    if (s.ulimits && typeof s.ulimits === 'object') {
      for (const [k, v] of Object.entries(s.ulimits as Obj)) add('--ulimit', v && typeof v === 'object' ? `${k}=${(v as Obj).soft}:${(v as Obj).hard}` : `${k}=${str(v)}`)
    }
    if (s.shm_size) add('--shm-size', s.shm_size)
    if (s.platform) add('--platform', s.platform)
    if (s.stop_signal) add('--stop-signal', s.stop_signal)
    if (s.stop_grace_period) add('--stop-timeout', str(s.stop_grace_period).replace(/s$/, ''))
    const hc = s.healthcheck as Obj | undefined
    if (hc) {
      if (hc.disable) parts.push('--no-healthcheck')
      else {
        const test = hc.test
        if (Array.isArray(test)) {
          const [kind, ...rest] = test.map(str)
          if (kind === 'CMD-SHELL') add('--health-cmd', rest.join(' '))
          else if (kind === 'CMD') add('--health-cmd', rest.map(shellQuote).join(' '))
          else if (kind === 'NONE') parts.push('--no-healthcheck')
        } else if (test) add('--health-cmd', test)
        if (hc.interval) add('--health-interval', hc.interval)
        if (hc.timeout) add('--health-timeout', hc.timeout)
        if (hc.retries !== undefined) add('--health-retries', hc.retries)
        if (hc.start_period) add('--health-start-period', hc.start_period)
      }
    }
    const lg = s.logging as Obj | undefined
    if (lg?.driver) add('--log-driver', lg.driver)
    for (const o of kvList(lg?.options)) add('--log-opt', o)
    const res = ((s.deploy as Obj | undefined)?.resources ?? {}) as Obj
    const lim = (res.limits ?? {}) as Obj
    const rsv = (res.reservations ?? {}) as Obj
    if (lim.memory) add('--memory', lim.memory)
    if (lim.cpus) add('--cpus', lim.cpus)
    if (rsv.memory) add('--memory-reservation', rsv.memory)
    if (Array.isArray(rsv.devices) && rsv.devices.some((d) => asList((d as Obj).capabilities).includes('gpu'))) add('--gpus', str((rsv.devices[0] as Obj).count ?? 'all'))
    if (s.entrypoint) add('--entrypoint', Array.isArray(s.entrypoint) ? s.entrypoint.map(str).join(' ') : s.entrypoint)
    if (s.build && !s.image) notes.push(`${name}: uses build:, so build it first with \`docker build -t ${name} .\`.`)
    const tail = [shellQuote(str(s.image ?? name))]
    if (Array.isArray(s.command)) tail.push(...s.command.map((c) => shellQuote(str(c))))
    else if (s.command) tail.push(str(s.command))
    parts.push(tail.join(' '))
    if (s.depends_on) notes.push(`${name}: depends_on has no docker run equivalent; start its dependencies first.`)
    for (const k of Object.keys(s)) if (!handled.has(k) && k !== 'build') notes.push(`${name}: \`${k}\` was not converted.`)
    commands.push(['docker run -d', ...parts].join(' \\\n  '))
  }
  return { commands, notes }
}
