import type { User } from './types'

export type ThemeId = 'green' | 'rose'

export type Theme = {
  id: ThemeId
  background: string
  green: string
  greenStrong: string
  greenSoft: string
  sageLight: string
  icon: string
  accent: string
}

export const THEMES: Record<ThemeId, Theme> = {
  green: {
    id: 'green',
    background: '#eef3ee',
    green: '#8fb58f',
    greenStrong: '#153a2f',
    greenSoft: '#dae7dc',
    sageLight: '#edf7ee',
    icon: '#153a2f',
    accent: '#8fb58f',
  },
  rose: {
    id: 'rose',
    background: '#fcf3f6',
    green: '#d4a0ad',
    greenStrong: '#6b4055',
    greenSoft: '#f8dbe4',
    sageLight: '#f9eef2',
    icon: '#a46b80',
    accent: '#d4a0ad',
  },
}

export const USER_THEME_BY_ID: Record<string, ThemeId> = {
  angel: 'green',
  aurora: 'rose',
}

export function getThemeForUser(user: User | undefined): Theme {
  const id = user ? USER_THEME_BY_ID[user.id] ?? 'green' : 'green'
  return THEMES[id]
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
