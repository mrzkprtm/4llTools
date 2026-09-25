import { useEffect, useState } from 'react'

/** The site's colour tokens, read from CSS so canvases match light and dark mode. */
export interface Theme {
  bg: string
  surface: string
  sunken: string
  text: string
  muted: string
  border: string
  accent: string
  ok: string
  danger: string
  dark: boolean
}

const FALLBACK: Theme = {
  bg: '#f3f0e8',
  surface: '#fcfbf7',
  sunken: '#ece8de',
  text: '#1b1a17',
  muted: '#676357',
  border: '#d8d2c3',
  accent: '#c2410c',
  ok: '#17703a',
  danger: '#b42318',
  dark: false,
}

export function readTheme(): Theme {
  if (typeof document === 'undefined') return FALLBACK
  const s = getComputedStyle(document.documentElement)
  const v = (name: string, fb: string) => s.getPropertyValue(name).trim() || fb
  return {
    bg: v('--bg', FALLBACK.bg),
    surface: v('--surface', FALLBACK.surface),
    sunken: v('--sunken', FALLBACK.sunken),
    text: v('--text', FALLBACK.text),
    muted: v('--muted', FALLBACK.muted),
    border: v('--border', FALLBACK.border),
    accent: v('--accent', FALLBACK.accent),
    ok: v('--ok', FALLBACK.ok),
    danger: v('--danger', FALLBACK.danger),
    dark: window.matchMedia('(prefers-color-scheme: dark)').matches,
  }
}

/** Current theme colours, updated when the visitor switches between light and dark. */
export function useTheme(): Theme {
  const [theme, setTheme] = useState(readTheme)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => setTheme(readTheme())
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return theme
}

/** A colour with transparency, from #rgb, #rrggbb or rgb()/rgba() input. */
export function alpha(color: string, a: number): string {
  const c = color.trim()
  if (c.startsWith('#')) {
    const hex = c.length === 4 ? [...c.slice(1)].map((x) => x + x).join('') : c.slice(1, 7)
    const n = parseInt(hex, 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
  }
  const m = c.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const [r, g, b] = m[1].split(/[\s,/]+/).filter(Boolean)
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }
  return c
}

/** Evenly spaced, readable hues for series i of n. */
export function hue(i: number, n = 6, l = 55, s = 70, a = 1): string {
  return `hsl(${Math.round((i * 360) / n + 25) % 360} ${s}% ${l}% / ${a})`
}

/** A fixed categorical palette that reads well on both paper and dark backgrounds. */
export const PALETTE = ['#e8590c', '#1c7ed6', '#2f9e44', '#ae3ec9', '#f59f00', '#0ca678', '#e03131', '#5c7cfa']
