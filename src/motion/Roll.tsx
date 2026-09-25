import { Children, type ReactNode } from 'react'

/**
 * Odometer text: every digit sits in a 0–9 column that scrolls to its value
 * with a spring when the value changes. Other characters render as plain text.
 * Screen readers get the plain value.
 */
export default function Roll({ children, className }: { children: ReactNode; className?: string }) {
  const text = Children.toArray(children).join('')
  const chars = [...text]
  return (
    <span className={`roll ${className ?? ''}`} aria-label={text}>
      {chars.map((ch, i) => {
        // Key digits by their place from the right, so "99" → "100" rolls the right columns.
        const key = chars.length - i
        return /\d/.test(ch) ? (
          <span key={key} className="roll-col" aria-hidden="true">
            <span className="roll-strip" style={{ transform: `translateY(${-Number(ch) * 10}%)` }}>
              0<br />1<br />2<br />3<br />4<br />5<br />6<br />7<br />8<br />9
            </span>
          </span>
        ) : (
          <span key={`c${key}`} aria-hidden="true">{ch}</span>
        )
      })}
    </span>
  )
}
