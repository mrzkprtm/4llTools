import { optimize, type Config } from 'svgo/browser'

export type SvgOptions = {
  multipass: boolean
  removeViewBox: boolean
  keepIds: boolean
  precision: number
  pretty: boolean
}

export const DEFAULT_OPTIONS: SvgOptions = {
  multipass: true,
  removeViewBox: false,
  keepIds: false,
  precision: 3,
  pretty: false,
}

export type SvgResult = { ok: true; data: string; before: number; after: number } | { ok: false; error: string }

export const byteSize = (s: string) => new TextEncoder().encode(s).length

export function buildConfig(opts: SvgOptions): Config {
  const plugins: NonNullable<Config['plugins']> = [
    {
      name: 'preset-default',
      params: { overrides: opts.keepIds ? { cleanupIds: false } : {} },
    },
  ]
  if (opts.removeViewBox) plugins.push('removeViewBox')
  return {
    multipass: opts.multipass,
    floatPrecision: opts.precision,
    js2svg: { pretty: opts.pretty, indent: 2 },
    plugins,
  }
}

export function optimizeSvg(input: string, opts: SvgOptions = DEFAULT_OPTIONS): SvgResult {
  if (!input.trim()) return { ok: false, error: 'Paste some SVG markup first.' }
  if (!/<svg[\s>]/i.test(input)) return { ok: false, error: 'This does not look like an SVG (no <svg> element found).' }
  try {
    const { data } = optimize(input, buildConfig(opts))
    return { ok: true, data, before: byteSize(input), after: byteSize(data) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.split('\n')[0] : String(err) }
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  return `${(n / 1024).toFixed(n < 10240 ? 2 : 1)} KB`
}

export function svgDataUrl(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}
