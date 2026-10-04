/** Flexbox container state and its CSS serialisation. */

export type Direction = 'row' | 'row-reverse' | 'column' | 'column-reverse'
export type Wrap = 'nowrap' | 'wrap' | 'wrap-reverse'
export type Justify = 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly'
export type AlignItems = 'stretch' | 'flex-start' | 'flex-end' | 'center' | 'baseline'
export type AlignContent = 'stretch' | 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around'

export interface FlexState {
  direction: Direction
  wrap: Wrap
  justify: Justify
  alignItems: AlignItems
  alignContent: AlignContent
  gap: number
  items: number
}

export const MIN_ITEMS = 1
export const MAX_ITEMS = 12

export const FLEX_DEFAULTS: FlexState = {
  direction: 'row',
  wrap: 'wrap',
  justify: 'flex-start',
  alignItems: 'stretch',
  alignContent: 'stretch',
  gap: 12,
  items: 6,
}

/** Every value offered by the controls, in the order they should be shown. */
export const OPTIONS = {
  direction: ['row', 'row-reverse', 'column', 'column-reverse'] as Direction[],
  wrap: ['nowrap', 'wrap', 'wrap-reverse'] as Wrap[],
  justify: ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'] as Justify[],
  alignItems: ['stretch', 'flex-start', 'flex-end', 'center', 'baseline'] as AlignItems[],
  alignContent: ['stretch', 'flex-start', 'flex-end', 'center', 'space-between', 'space-around'] as AlignContent[],
}

const clampGap = (n: number) => (Number.isFinite(n) ? Math.min(120, Math.max(0, Math.round(n))) : 0)

/** The container's CSS declarations, one per line. `align-content` only matters when wrapping. */
export function flexCss(state: FlexState): string {
  const lines = [
    'display: flex;',
    `flex-direction: ${state.direction};`,
    `flex-wrap: ${state.wrap};`,
    `justify-content: ${state.justify};`,
    `align-items: ${state.alignItems};`,
  ]
  if (state.wrap !== 'nowrap') lines.push(`align-content: ${state.alignContent};`)
  lines.push(`gap: ${clampGap(state.gap)}px;`)
  return lines.join('\n')
}

export function addItem(state: FlexState): FlexState {
  return { ...state, items: Math.min(MAX_ITEMS, state.items + 1) }
}

export function removeItem(state: FlexState): FlexState {
  return { ...state, items: Math.max(MIN_ITEMS, state.items - 1) }
}
