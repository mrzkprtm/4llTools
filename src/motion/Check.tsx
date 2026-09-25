/** A check mark that draws itself in, for "done" moments. */
export default function Check({ size = 18 }: { size?: number }) {
  return (
    <svg className="draw check-mark" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
    </svg>
  )
}
