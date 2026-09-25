import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import CopyButton from '../../components/CopyButton'

const SAMPLE = `# Hello 👋

Write **Markdown** on the left and see it on the right.

- Lists
- [Links](https://example.com)
- \`inline code\`

\`\`\`js
console.log('code blocks too')
\`\`\`
`

export default function MarkdownPreview() {
  const [md, setMd] = useState(SAMPLE)
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(md, { async: false, gfm: true, breaks: true })), [md])
  const preview = useRef<HTMLDivElement>(null)

  // Patch only the blocks that changed, so the preview never flashes and new blocks can rise in.
  useLayoutEffect(() => {
    const root = preview.current
    if (!root) return
    const tpl = document.createElement('template')
    tpl.innerHTML = html
    const next = [...tpl.content.childNodes].filter((n) => n.nodeType === 1 || n.textContent?.trim())
    const first = root.childNodes.length === 0
    next.forEach((node, i) => {
      const old = root.childNodes[i]
      if (old && (old as Element).outerHTML === (node as Element).outerHTML) return
      if (!first && node instanceof HTMLElement) node.classList.add(old ? 'md-changed' : 'md-new')
      if (old) root.replaceChild(node, old)
      else root.appendChild(node)
    })
    while (root.childNodes.length > next.length) root.lastChild!.remove()
  }, [html])

  return (
    <div>
      <div className="two-col">
        <div>
          <label htmlFor="md-in">Markdown</label>
          <textarea id="md-in" value={md} onChange={(e) => setMd(e.target.value)} style={{ minHeight: 360 }} spellCheck={false} />
        </div>
        <div>
          <label>Preview</label>
          <div ref={preview} className="markdown-body output" style={{ minHeight: 360, fontFamily: 'inherit', wordBreak: 'normal' }} />
        </div>
      </div>
      <div className="row">
        <CopyButton text={html} label="Copy HTML" />
      </div>
    </div>
  )
}
