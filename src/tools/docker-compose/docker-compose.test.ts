import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { composeToRun, runToCompose, serviceNameFromImage, SEP, shellQuote, tokenize } from './compose'

type Svc = Record<string, unknown>
const services = (yaml: string) => (parse(yaml) as { services: Record<string, Svc> }).services

describe('tokenize', () => {
  it('handles quotes, escapes and backslash continuations', () => {
    expect(tokenize(`docker run -e 'A=b c' -e "D=\\"q\\"" \\\n  nginx`)).toEqual(['docker', 'run', '-e', 'A=b c', '-e', 'D="q"', 'nginx'])
    expect(tokenize('a b\\ c')).toEqual(['a', 'b c'])
  })
  it('splits commands on newlines, ; and &&, and skips comments', () => {
    expect(tokenize('a # note\nb; c && d')).toEqual(['a', SEP, 'b', SEP, 'c', SEP, 'd'])
  })
  it('reports unclosed quotes', () => {
    expect(() => tokenize("docker run 'oops")).toThrow(/quote/)
  })
})

describe('docker run → compose', () => {
  it('maps the common flags', () => {
    const { yaml, notes } = runToCompose(`docker run -d --name web --restart unless-stopped \\
      -p 8080:80 -p 443:443 -v ./html:/usr/share/nginx/html:ro -v data:/data \\
      -e TZ=UTC --env-file .env -w /app -u 1000:1000 --label tier=front \\
      --cap-add NET_ADMIN --device /dev/fuse --hostname web1 --memory 512m --cpus 1.5 \\
      --health-cmd "curl -f http://localhost || exit 1" --health-interval 30s --health-retries 3 \\
      -it nginx:alpine nginx -g 'daemon off;'`)
    const web = services(yaml).web
    expect(web.image).toBe('nginx:alpine')
    expect(web.container_name).toBe('web')
    expect(web.restart).toBe('unless-stopped')
    expect(web.ports).toEqual(['8080:80', '443:443'])
    expect(web.volumes).toEqual(['./html:/usr/share/nginx/html:ro', 'data:/data'])
    expect(web.environment).toEqual({ TZ: 'UTC' })
    expect(web.env_file).toEqual(['.env'])
    expect(web.working_dir).toBe('/app')
    expect(web.user).toBe('1000:1000')
    expect(web.labels).toEqual({ tier: 'front' })
    expect(web.cap_add).toEqual(['NET_ADMIN'])
    expect(web.devices).toEqual(['/dev/fuse'])
    expect(web.hostname).toBe('web1')
    expect(web.deploy).toEqual({ resources: { limits: { memory: '512m', cpus: '1.5' } } })
    expect(web.healthcheck).toEqual({ test: ['CMD-SHELL', 'curl -f http://localhost || exit 1'], interval: '30s', retries: 3 })
    expect(web.stdin_open).toBe(true)
    expect(web.tty).toBe(true)
    expect(web.command).toEqual(['nginx', '-g', 'daemon off;'])
    expect(parse(yaml).volumes).toHaveProperty('data')
    expect(yaml).toContain('- "8080:80"')
    expect(notes).toEqual([])
  })

  it('handles attached values, --flag=value, mounts, networks and entrypoint', () => {
    const { yaml, notes } = runToCompose(
      'docker container run -p5432:5432 -ePOSTGRES_DB=app --network=backend --entrypoint /bin/sh --mount type=bind,source=/srv,target=/srv,readonly postgres:16',
    )
    const pg = services(yaml).postgres
    expect(pg.ports).toEqual(['5432:5432'])
    expect(pg.environment).toEqual({ POSTGRES_DB: 'app' })
    expect(pg.networks).toEqual(['backend'])
    expect(pg.entrypoint).toBe('/bin/sh')
    expect(pg.volumes).toEqual([{ type: 'bind', source: '/srv', target: '/srv', read_only: true }])
    expect(parse(yaml).networks).toEqual({ backend: { external: true } })
    expect(notes.some((n) => n.includes('external'))).toBe(true)
  })

  it('converts several commands and names services from images', () => {
    const { services: names } = runToCompose('docker run redis\ndocker run -d redis:7 && sudo docker run ghcr.io/acme/my-api:1.0')
    expect(names).toEqual(['redis', 'redis-2', 'my-api'])
    expect(serviceNameFromImage('registry.local:5000/team/Web_App@sha256:abc')).toBe('web_app')
  })

  it('uses network_mode for host networking and lists unknown flags', () => {
    const { yaml, notes } = runToCompose('docker run --net host --rm --frobnicate=yes alpine')
    expect(services(yaml).alpine.network_mode).toBe('host')
    expect(notes.join(' ')).toMatch(/--rm/)
    expect(notes.join(' ')).toMatch(/--frobnicate yes/)
  })

  it('explains missing input', () => {
    expect(() => runToCompose('echo hi')).toThrow(/docker run/)
    expect(() => runToCompose('docker run -d')).toThrow(/image/)
  })
})

describe('compose → docker run', () => {
  it('round-trips the main options', () => {
    const { commands } = composeToRun(`services:
  db:
    image: postgres:16
    restart: always
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: app
      GREETING: hello world
    volumes: [pgdata:/var/lib/postgresql/data]
    command: ["postgres", "-c", "max_connections=200"]
    deploy: { resources: { limits: { memory: 1g } } }
volumes:
  pgdata:
`)
    expect(commands).toHaveLength(1)
    const cmd = commands[0]
    expect(cmd).toContain('--name db')
    expect(cmd).toContain('--restart always')
    expect(cmd).toContain('-p 5432:5432')
    expect(cmd).toContain("-e 'GREETING=hello world'")
    expect(cmd).toContain('--memory 1g')
    expect(cmd.trim().endsWith('postgres:16 postgres -c max_connections=200')).toBe(true)
    // The generated command parses back into the same service.
    const back = services(runToCompose(cmd).yaml).db
    expect(back.environment).toEqual({ POSTGRES_DB: 'app', GREETING: 'hello world' })
    expect(back.command).toEqual(['postgres', '-c', 'max_connections=200'])
  })

  it('reports YAML without services', () => {
    expect(() => composeToRun('foo: bar')).toThrow(/services/)
  })

  it('quotes shell words only when needed', () => {
    expect(shellQuote('abc/def:1')).toBe('abc/def:1')
    expect(shellQuote("it's")).toBe(`'it'\\''s'`)
  })
})
