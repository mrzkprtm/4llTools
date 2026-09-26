/** ANSI 104-key layout data and the key-state reducer for the keyboard tester. */

export interface KeyDef {
  code: string
  label: string
  /** Position and size in key units (1u = one letter key). */
  x: number
  y: number
  w: number
  h: number
  numpad?: boolean
}

type Row = [code: string, label: string, w?: number][]

function row(y: number, x0: number, keys: Row, numpad = false): KeyDef[] {
  let x = x0
  return keys.map(([code, label, w = 1]) => {
    const k: KeyDef = { code, label, x, y, w, h: 1, numpad }
    x += w
    return k
  })
}

const letters = (s: string) => [...s].map((c) => [`Key${c}`, c] as [string, string])
const at = (code: string, label: string, x: number, y: number, w = 1, h = 1, numpad = false): KeyDef => ({ code, label, x, y, w, h, numpad })

export const LAYOUT: KeyDef[] = [
  at('Escape', 'Esc', 0, 0),
  ...row(0, 2, [['F1', 'F1'], ['F2', 'F2'], ['F3', 'F3'], ['F4', 'F4']]),
  ...row(0, 6.5, [['F5', 'F5'], ['F6', 'F6'], ['F7', 'F7'], ['F8', 'F8']]),
  ...row(0, 11, [['F9', 'F9'], ['F10', 'F10'], ['F11', 'F11'], ['F12', 'F12']]),
  ...row(0, 15.25, [['PrintScreen', 'PrtSc'], ['ScrollLock', 'ScrLk'], ['Pause', 'Pause']]),

  ...row(1.5, 0, [['Backquote', '`'], ...Array.from({ length: 10 }, (_, i) => [`Digit${(i + 1) % 10}`, String((i + 1) % 10)] as [string, string]), ['Minus', '-'], ['Equal', '='], ['Backspace', 'Backspace', 2]]),
  ...row(2.5, 0, [['Tab', 'Tab', 1.5], ...letters('QWERTYUIOP'), ['BracketLeft', '['], ['BracketRight', ']'], ['Backslash', '\\', 1.5]]),
  ...row(3.5, 0, [['CapsLock', 'Caps', 1.75], ...letters('ASDFGHJKL'), ['Semicolon', ';'], ['Quote', "'"], ['Enter', 'Enter', 2.25]]),
  ...row(4.5, 0, [['ShiftLeft', 'Shift', 2.25], ...letters('ZXCVBNM'), ['Comma', ','], ['Period', '.'], ['Slash', '/'], ['ShiftRight', 'Shift', 2.75]]),
  ...row(5.5, 0, [['ControlLeft', 'Ctrl', 1.25], ['MetaLeft', 'Win', 1.25], ['AltLeft', 'Alt', 1.25], ['Space', '', 6.25], ['AltRight', 'Alt', 1.25], ['MetaRight', 'Win', 1.25], ['ContextMenu', 'Menu', 1.25], ['ControlRight', 'Ctrl', 1.25]]),

  ...row(1.5, 15.25, [['Insert', 'Ins'], ['Home', 'Home'], ['PageUp', 'PgUp']]),
  ...row(2.5, 15.25, [['Delete', 'Del'], ['End', 'End'], ['PageDown', 'PgDn']]),
  at('ArrowUp', '↑', 16.25, 4.5),
  ...row(5.5, 15.25, [['ArrowLeft', '←'], ['ArrowDown', '↓'], ['ArrowRight', '→']]),

  ...row(1.5, 18.5, [['NumLock', 'Num'], ['NumpadDivide', '/'], ['NumpadMultiply', '*'], ['NumpadSubtract', '-']], true),
  ...row(2.5, 18.5, [['Numpad7', '7'], ['Numpad8', '8'], ['Numpad9', '9']], true),
  at('NumpadAdd', '+', 21.5, 2.5, 1, 2, true),
  ...row(3.5, 18.5, [['Numpad4', '4'], ['Numpad5', '5'], ['Numpad6', '6']], true),
  ...row(4.5, 18.5, [['Numpad1', '1'], ['Numpad2', '2'], ['Numpad3', '3']], true),
  at('NumpadEnter', 'Ent', 21.5, 4.5, 1, 2, true),
  at('Numpad0', '0', 18.5, 5.5, 2, 1, true),
  at('NumpadDecimal', '.', 20.5, 5.5, 1, 1, true),
]

export const FULL_WIDTH = 22.5
export const TKL_WIDTH = 18.25
export const HEIGHT = 6.5

/** Keys whose default action would scroll or move focus while the tester has focus. */
export const NAV_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', 'Tab', 'Backspace', 'Slash', 'Quote', 'F1', 'F3', 'F6', 'F7', 'F10', 'AltLeft', 'AltRight', 'ContextMenu'])

export const STUCK_MS = 3000

export interface KeyInfo {
  key: string
  code: string
  keyCode: number
  location: number
  repeat: boolean
}

export interface KbState {
  /** Codes currently held, with the time they went down. */
  down: Record<string, number>
  tested: Record<string, true>
  maxHeld: number
  last: KeyInfo | null
  presses: number
}

export type KbAction =
  | { type: 'down'; info: KeyInfo; t: number }
  | { type: 'up'; code: string }
  | { type: 'release-all' }
  | { type: 'reset' }

export const initKb = (): KbState => ({ down: {}, tested: {}, maxHeld: 0, last: null, presses: 0 })

export function kbReducer(s: KbState, a: KbAction): KbState {
  switch (a.type) {
    case 'down': {
      const code = a.info.code || a.info.key
      const fresh = !(code in s.down)
      const down = fresh ? { ...s.down, [code]: a.t } : s.down
      const held = Object.keys(down).length
      return { down, tested: s.tested[code] ? s.tested : { ...s.tested, [code]: true }, maxHeld: Math.max(s.maxHeld, held), last: a.info, presses: s.presses + (a.info.repeat ? 0 : 1) }
    }
    case 'up': {
      // Some keys (Print Screen on Windows) only ever send keyup, so count those too.
      const down = { ...s.down }
      delete down[a.code]
      return { ...s, down, tested: s.tested[a.code] ? s.tested : { ...s.tested, [a.code]: true } }
    }
    case 'release-all':
      return { ...s, down: {} }
    case 'reset':
      return initKb()
  }
}

/** Keys held longer than STUCK_MS without a keyup. */
export function stuckKeys(s: KbState, now: number): string[] {
  return Object.entries(s.down).filter(([, t]) => now - t > STUCK_MS).map(([c]) => c)
}

/** How many of the given layout keys have been tested. */
export function testedCount(s: KbState, keys: readonly KeyDef[]): number {
  return keys.reduce((n, k) => n + (s.tested[k.code] ? 1 : 0), 0)
}

export const LOCATION = ['Standard', 'Left', 'Right', 'Numpad'] as const
