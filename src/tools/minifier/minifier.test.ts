import { describe, expect, it } from 'vitest'
import { minifyCss } from './cssmin'
import { run } from './process'

const opts = { indent: 2 as const, mangle: true, keepLicense: true }

describe('css minifier', () => {
  it('removes comments and needless whitespace', () => {
    expect(minifyCss('/* hi */\n.a  >  .b ,\n.c {\n  color : red ;\n  margin: 0  auto;\n}\n')).toBe('.a>.b,.c{color :red;margin:0 auto}')
  })

  it('keeps spaces that matter', () => {
    expect(minifyCss('.a .b { width: calc(100% - 2 * 8px); height: calc(1px + 2px) }')).toBe('.a .b{width:calc(100% - 2 * 8px);height:calc(1px + 2px)}')
    expect(minifyCss('@media screen and (min-width: 600px) { a :hover { color: red !important } }')).toBe('@media screen and (min-width:600px){a :hover{color:red!important}}')
  })

  it('leaves strings, url() and licence comments alone', () => {
    const css = `/*! MIT */ a::before { content: "  a  ;  }  /* x */ "; background: url( data:image/png;base64,AA==  ) no-repeat; font-family: 'Open  Sans' }`
    expect(minifyCss(css)).toBe(`/*! MIT */a::before{content:"  a  ;  }  /* x */ ";background:url(data:image/png;base64,AA==) no-repeat;font-family:'Open  Sans'}`)
  })
})

describe('run', () => {
  it('minifies JS with terser', async () => {
    const r = await run('js', 'minify', 'function add(first, second) {\n  // sum\n  return first + second\n}\nconsole.log(add(1, 2))', opts)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.output).toMatch(/^function add\((\w),(\w)\){return \1\+\2}console\.log\(add\(1,2\)\);$/)
  })

  it('reports JS syntax errors with a position', async () => {
    const r = await run('js', 'minify', 'let a = 1\nlet b = (2 +\n', opts)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.line).toBe(3)
  })

  it('beautifies JS and CSS', async () => {
    const js = await run('js', 'beautify', 'function f(a){if(a){return 1}return 2}', opts)
    expect(js.ok && js.output).toBe('function f(a) {\n  if (a) {\n    return 1\n  }\n  return 2\n}\n')
    const css = await run('css', 'beautify', 'a{color:red}b{margin:0}', opts)
    expect(css.ok && css.output).toBe('a {\n  color: red\n}\n\nb {\n  margin: 0\n}\n')
  })
})
