import { describe, expect, it } from 'vitest'
import { attrName, componentName, eventName, htmlToJsx, parseHtml, styleToObject } from './convert'

const opts = { indent: '  ', component: null, uncontrolled: true }
const jsx = (html: string, o = {}) => htmlToJsx(html, { ...opts, ...o }).jsx

describe('html-to-jsx', () => {
  it('maps attribute names', () => {
    expect(attrName('class', 'div')).toBe('className')
    expect(attrName('for', 'label')).toBe('htmlFor')
    expect(attrName('tabindex', 'div')).toBe('tabIndex')
    expect(attrName('stroke-width', 'path')).toBe('strokeWidth')
    expect(attrName('xlink:href', 'use')).toBe('xlinkHref')
    expect(attrName('viewbox', 'svg')).toBe('viewBox')
    expect(attrName('data-id', 'div')).toBe('data-id')
    expect(attrName('aria-label', 'div')).toBe('aria-label')
  })

  it('camelCases event names', () => {
    expect(eventName('onclick')).toBe('onClick')
    expect(eventName('onmouseenter')).toBe('onMouseEnter')
    expect(eventName('onkeydown')).toBe('onKeyDown')
    expect(eventName('ondblclick')).toBe('onDoubleClick')
    expect(eventName('oncontextmenu')).toBe('onContextMenu')
  })

  it('turns style strings into objects', () => {
    expect(styleToObject('color: red; font-size:12px; opacity: 0.5;')).toBe("{{ color: 'red', fontSize: '12px', opacity: 0.5 }}")
    expect(styleToObject("background: url('a;b.png'); -webkit-transition: all 1s; -ms-flex: 1; --gap: 4px")).toBe(
      "{{ background: 'url(\\'a;b.png\\')', WebkitTransition: 'all 1s', msFlex: 1, '--gap': '4px' }}",
    )
  })

  it('self-closes void and empty elements and converts comments', () => {
    expect(jsx('<div class="a"><!-- note --><img src="x.png" alt=""><br><span></span></div>')).toBe(
      ['<div className="a">', '  {/* note */}', '  <img src="x.png" alt="" />', '  <br />', '  <span />', '</div>'].join('\n'),
    )
  })

  it('wraps multiple roots in a fragment and keeps meaningful spaces', () => {
    expect(jsx('<p>Hello <b>world</b> again</p><p>Two</p>')).toBe(['<>', '  <p>', '    Hello{" "}', '    <b>world</b>', '    {" "}again', '  </p>', '  <p>Two</p>', '</>'].join('\n'))
  })

  it('handles forms, labels, booleans and events', () => {
    const out = jsx('<label for="e">Email</label><input id="e" type="email" value="a" required onclick="go()" tabindex="2" maxlength="40">')
    expect(out).toContain('<label htmlFor="e">Email</label>')
    expect(out).toContain('<input id="e" type="email" defaultValue="a" required onClick={(event) => { go() }} tabIndex={2} maxLength="40" />')
  })

  it('escapes braces and angle brackets in text', () => {
    expect(jsx('<code>{a} &lt; b</code>')).toBe("<code>{'{'}a{'}'} &lt; b</code>")
  })

  it('converts SVG attributes', () => {
    expect(jsx('<svg viewBox="0 0 24 24"><path stroke-width="2" fill-rule="evenodd" d="M0 0"/></svg>')).toBe(
      ['<svg viewBox="0 0 24 24">', '  <path strokeWidth="2" fillRule="evenodd" d="M0 0" />', '</svg>'].join('\n'),
    )
  })

  it('wraps in a named component', () => {
    expect(jsx('<h1>Hi</h1>', { component: 'hero banner' })).toBe('export default function HeroBanner() {\n  return (\n    <h1>Hi</h1>\n  );\n}\n')
    expect(componentName('123 my-card')).toBe('MyCard')
  })

  it('parses leniently: unclosed li, stray closing tags, raw text', () => {
    const tree = parseHtml('<ul><li>a<li>b</ul></span><style>a > b { x: 1 }</style>')
    expect(tree[0]).toMatchObject({ name: 'ul', children: [{ name: 'li' }, { name: 'li' }] })
    expect(jsx('<style>a > b { color: red }</style>')).toBe('<style>{`a > b { color: red }`}</style>')
  })
})
