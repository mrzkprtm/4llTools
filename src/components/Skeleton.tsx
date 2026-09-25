/** Placeholder shown while a tool's code is loading. */
export default function Skeleton({ label }: { label: string }) {
  return (
    <div className="skeleton" role="status" aria-label={label}>
      <span className="sk sk-label" />
      <span className="sk sk-box" />
      <span className="sk-row">
        <span className="sk sk-btn" />
        <span className="sk sk-btn" />
      </span>
    </div>
  )
}
