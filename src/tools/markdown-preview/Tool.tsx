import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useMemo, useState } from 'react'
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

  return (
    <div>
      <div className="two-col">
        <div>
          <label htmlFor="md-in">Markdown</label>
          <textarea id="md-in" value={md} onChange={(e) => setMd(e.target.value)} style={{ minHeight: 360 }} spellCheck={false} />
        </div>
        <div>
          <label>Preview</label>
          <div className="markdown-body output" style={{ minHeight: 360, fontFamily: 'inherit', wordBreak: 'normal' }} dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
      <div className="row">
        <CopyButton text={html} label="Copy HTML" />
      </div>
    </div>
  )
}
