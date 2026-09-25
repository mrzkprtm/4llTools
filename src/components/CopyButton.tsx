import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

export default function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(0)

  useEffect(() => () => clearTimeout(timer.current), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button type="button" className={`btn btn-icon ${copied ? 'is-done' : ''}`} onClick={copy} disabled={!text}>
      <Icon key={copied ? 'done' : 'idle'} name={copied ? 'clipboard-check' : 'clipboard'} size={18} />
      <span aria-live="polite">{copied ? 'Copied!' : label}</span>
    </button>
  )
}
