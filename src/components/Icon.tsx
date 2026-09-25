import icons from 'virtual:majesticons'

/**
 * A Majesticons icon drawn duotone: the solid shape as a soft back layer and the
 * line icon on top. Colours come from --icon-1 (line) and --icon-2 (fill) in CSS.
 */
export default function Icon({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) {
  const layers = icons[name]
  if (!layers) return null
  return (
    <svg className={`mj ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      {layers[0] && <g className="mj-back" dangerouslySetInnerHTML={{ __html: layers[0] }} />}
      <g className="mj-line" dangerouslySetInnerHTML={{ __html: layers[1] }} />
    </svg>
  )
}
