const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

export function MenuIcon() {
  return (
    <svg {...base}>
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg {...base}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function SearchIcon() {
  return (
    <svg {...base} width={16} height={16}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4-4" />
    </svg>
  )
}
