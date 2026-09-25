import { useRef, type TextareaHTMLAttributes } from 'react'
import { useReplay, REPLAYS } from './useReplay'
import { useSettled } from './useSettled'

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string; motion?: keyof typeof REPLAYS; delay?: number }

/** A read-only result box that plays a short "fresh result" animation once its value stops changing. */
export default function SettleOutput({ value, motion = 'refresh', delay = 220, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const settled = useSettled(value, delay)
  useReplay(ref, value ? settled : 0, motion)
  return <textarea ref={ref} readOnly value={value} spellCheck={false} {...rest} />
}
