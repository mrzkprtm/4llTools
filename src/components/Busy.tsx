/** A small animated "working on it" line for tools that take a moment. */
export default function Busy({ label = 'Working…' }: { label?: string }) {
  return (
    <p className="busy" role="status">
      <span className="busy-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {label}
    </p>
  )
}
