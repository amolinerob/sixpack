import type { AccentColor } from './types'

export type Theme = {
  id: AccentColor
  label: string
  background: string
  green: string
  greenStrong: string
  greenSoft: string
  sageLight: string
  icon: string
  accent: string
}

export const ACCENT_COLORS: Record<AccentColor, Theme> = {
  green: {
    id: 'green',
    label: 'Verde',
    background: '#eef3ee',
    green: '#8fb58f',
    greenStrong: '#153a2f',
    greenSoft: '#dae7dc',
    sageLight: '#edf7ee',
    icon: '#153a2f',
    accent: '#8fb58f',
  },
  turquoise: {
    id: 'turquoise', label: 'Turquesa', background: '#eef7f5',
    green: '#279c8e', greenStrong: '#17594f', greenSoft: '#d4ece6',
    sageLight: '#eaf7f3', icon: '#17594f', accent: '#279c8e',
  },
  blue: {
    id: 'blue', label: 'Azul', background: '#f0f5fb',
    green: '#4a90d2', greenStrong: '#234e78', greenSoft: '#d9e7f6',
    sageLight: '#edf4fc', icon: '#234e78', accent: '#4a90d2',
  },
  violet: {
    id: 'violet', label: 'Violeta', background: '#f5f2fa',
    green: '#8b6fd8', greenStrong: '#513c7d', greenSoft: '#e7ddf5',
    sageLight: '#f3eefb', icon: '#513c7d', accent: '#8b6fd8',
  },
  pink: {
    id: 'pink',
    label: 'Rosa',
    background: '#fcf3f6',
    green: '#d4a0ad',
    greenStrong: '#6b4055',
    greenSoft: '#f8dbe4',
    sageLight: '#f9eef2',
    icon: '#a46b80',
    accent: '#d4a0ad',
  },
  orange: {
    id: 'orange', label: 'Naranja', background: '#fcf5ee',
    green: '#dc9146', greenStrong: '#784519', greenSoft: '#f6e2cb',
    sageLight: '#fcf1e5', icon: '#784519', accent: '#dc9146',
  },
}

export function isAccentColor(value: unknown): value is AccentColor {
  return typeof value === 'string' && Object.hasOwn(ACCENT_COLORS, value)
}

// Solo compatibilidad con la identidad antigua; nunca depende del nombre visible.
export function getDefaultAccentColor(legacyUserKey: string | null): AccentColor {
  return legacyUserKey === 'aurora' ? 'pink' : 'green'
}

export function applyThemeToRoot(theme: Theme) {
  const root = document.documentElement
  root.style.setProperty('--background', theme.background)
  root.style.setProperty('--green', theme.green)
  root.style.setProperty('--green-strong', theme.greenStrong)
  root.style.setProperty('--green-soft', theme.greenSoft)
  root.style.setProperty('--sage-light', theme.sageLight)
  root.style.setProperty('--accent', theme.accent)
  root.style.setProperty('--accent-strong', theme.greenStrong)
  root.style.setProperty('--accent-soft', theme.greenSoft)
  root.style.setProperty('--accent-light', theme.sageLight)
}
