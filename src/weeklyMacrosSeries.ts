import type { UserGoals } from './types'
import type { WeekSummary } from './weeklySummary'

const macros = [
  { key: 'protein', target: 'targetProteinG', label: 'Proteína', color: '#2874c6' },
  { key: 'carbs', target: 'targetCarbsG', label: 'Hidratos', color: '#bc690e' },
  { key: 'fat', target: 'targetFatG', label: 'Grasas', color: '#9456bd' },
] as const

export function getWeeklyMacrosSeries(summary: WeekSummary, goals: UserGoals) {
  return macros.map((macro) => ({
    ...macro,
    points: summary.days.map((day, index) => ({ date: day.date, index, value: day.intake[macro.key] })),
    // Same denominator as WeeklyNutritionCard, including elapsed days without entries.
    average: summary.sum[macro.key] / (summary.dayCount || 1),
    targetValue: goals[macro.target],
  }))
}
