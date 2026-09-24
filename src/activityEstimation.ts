import { isValidActiveKcal } from './energy'
import { ACTIVITY_TYPES, type ActivityEntry, type ActivityIntentionType, type ActivityType, type PlannedActivityType } from './types'

export const PLANNED_ACTIVITY_TYPES = ['CrossFit', 'Caminata', 'Carrera', 'Bicicleta'] as const satisfies readonly PlannedActivityType[]
export const ACTIVITY_INTENTION_TYPES = [...PLANNED_ACTIVITY_TYPES, 'Descanso'] as const
export const ACTIVITY_FALLBACK_KCAL: Record<PlannedActivityType, number> = { CrossFit: 450, Caminata: 250, Carrera: 380, Bicicleta: 400 }
export type ActivityEstimateSource = 'fallback' | 'historical-provisional' | 'historical'

export function normalizeActivityType(value: unknown): ActivityType | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLocaleLowerCase('es-ES')
  if (normalized === 'correr' || normalized === 'running') return 'Carrera'
  return ACTIVITY_TYPES.find((type) => type.toLocaleLowerCase('es-ES') === normalized)
}

export function isActivityIntentionType(value: unknown): value is ActivityIntentionType {
  return ACTIVITY_INTENTION_TYPES.some((type) => type === value)
}

export function toggleActivityIntention(current: ActivityIntentionType[], type: ActivityIntentionType): ActivityIntentionType[] {
  if (current.includes(type)) return current.filter((item) => item !== type)
  if (type === 'Descanso') return ['Descanso']
  return [...current.filter((item) => item !== 'Descanso'), type]
}

export function isValidActivityDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(`${value}T12:00:00`)
  return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day
}

export function estimateActivityKcal(activities: ActivityEntry[], type: PlannedActivityType, date: string): {
  type: PlannedActivityType; kcal: number; source: ActivityEstimateSource; sampleCount: number
} {
  const samples = activities.filter((item) => isValidActivityDate(item.date) && item.date < date
    && normalizeActivityType(item.type) === type && isValidActiveKcal(item.calories) && item.calories > 0)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || (b.id ?? '').localeCompare(a.id ?? ''))
    .slice(0, 8).map((item) => item.calories).sort((a, b) => a - b)
  const count = samples.length
  if (!count) return { type, kcal: ACTIVITY_FALLBACK_KCAL[type], source: 'fallback', sampleCount: 0 }
  // Divide before summing to avoid overflow with otherwise finite anomalous input.
  const kcal = count < 3 ? samples.reduce((sum, value) => sum + value / count, 0)
    : count % 2 ? samples[Math.floor(count / 2)] : samples[count / 2 - 1] / 2 + samples[count / 2] / 2
  return { type, kcal, source: count < 3 ? 'historical-provisional' : 'historical', sampleCount: count }
}
