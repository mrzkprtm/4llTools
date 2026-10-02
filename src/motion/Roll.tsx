import { Children, type CSSProperties, type ReactNode } from 'react'

/**
 * Odometer text: every digit sits in a 0–9 column that scrolls to its value
 * with a spring when the value changes. Other characters render as plain text.
 * Screen readers get the plain value.
 */
export interface RollProps {
  children?: ReactNode
  value?: any
  className?: string
  style?: CSSProperties
}

export function Roll({ children, value, className, style }: RollProps) {
  const text = Children.toArray(children ?? value ?? '').join('')
  const chars = [...text]
  return (
    <span className={`roll ${className ?? ''}`} aria-label={text} style={style}>
      {chars.map((ch, i) => {
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

export default Roll
