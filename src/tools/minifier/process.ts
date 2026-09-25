import beautify from 'js-beautify'
import { minifyCss } from './cssmin'

export type Lang = 'js' | 'css'
export type Mode = 'minify' | 'beautify'

export interface Options {
  indent: number | 'tab'
  /** JS minify: rename local variables. */
  mangle: boolean
  /** JS minify: keep /*! and @license comments. */
  keepLicense: boolean
}

export type Result = { ok: true; output: string } | { ok: false; message: string; line?: number; col?: number }

interface TerserErrorShape {
  message?: string
  line?: number
  col?: number
}

export async function run(lang: Lang, mode: Mode, code: string, o: Options): Promise<Result> {
  if (!code.trim()) return { ok: true, output: '' }
  const indentOpts = o.indent === 'tab' ? { indent_with_tabs: true, indent_size: 1 } : { indent_size: o.indent, indent_char: ' ' }
  try {
    if (lang === 'css') {
      if (mode === 'minify') return { ok: true, output: minifyCss(code) }
      return { ok: true, output: beautify.css(code, { ...indentOpts, end_with_newline: true, newline_between_rules: true }) }
    }
    if (mode === 'beautify') {
      return { ok: true, output: beautify.js(code, { ...indentOpts, end_with_newline: true, preserve_newlines: true, max_preserve_newlines: 2 }) }
    }
    const { minify } = await import('terser')
    const res = await minify(code, {
      compress: true,
      mangle: o.mangle,
      module: /^\s*(import|export)\b/m.test(code),
      format: { comments: o.keepLicense ? 'some' : false },
    })
    return { ok: true, output: res.code ?? '' }
  } catch (err) {
    const e = err as TerserErrorShape
    return { ok: false, message: e?.message ?? String(err), line: e?.line, col: e?.col }
  }
}

export const byteSize = (s: string) => new TextEncoder().encode(s).length
