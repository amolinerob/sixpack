import type { WeekSummary } from './weeklySummary'

const labels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function getWeeklyActivitySeries(summary: WeekSummary) {
  return {
    days: labels.map((label, index) => ({ label, index, value: summary.days[index]?.activeCalories })),
    average: summary.dayCount ? summary.sum.activeCalories / summary.dayCount : undefined,
  }
}

export type WeeklyActivitySeries = ReturnType<typeof getWeeklyActivitySeries>
