import { getLatestWeightForDate } from './energy'
import { createWeeklySummary } from './weeklySummary'
import type { ActivityEntry, BodyMeasurement, UserGoals } from './types'

function daysBefore(today: string, count: number) {
  const date = new Date(`${today}T12:00:00`)
  date.setDate(date.getDate() - count)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function positive(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0
}

export function calculateGoalRecommendations({ today, profile, measurements, activities }: {
  today: string
  profile: Pick<UserGoals, 'sex' | 'birthDate' | 'heightCm'>
  measurements: BodyMeasurement[]
  activities: ActivityEntry[]
}) {
  const range = { start: daysBefore(today, 7), end: daysBefore(today, 1) }
  const validMeasurements = measurements.filter((measurement) => positive(measurement.weightKg))
  const currentWeightKg = getLatestWeightForDate(validMeasurements, today)
  // Reuse both historical daily energy and activity aggregation, without changing either.
  const summary = createWeeklySummary({ range, today, goals: profile, measurements: validMeasurements, activities, entries: [] })
  const validDays = summary.days.filter((day) =>
    positive(day.energy?.estimatedDailyExpenditure)
    && day.activities.every((activity) => Number.isFinite(activity.calories) && activity.calories >= 0))
  const averageExpenditure = validDays.length
    ? validDays.reduce((sum, day) => sum + day.energy!.estimatedDailyExpenditure, 0) / validDays.length
    : undefined
  const available = positive(averageExpenditure) && positive(currentWeightKg)
    && positive(profile.heightCm) && (profile.sex === 'male' || profile.sex === 'female')
  const recommendedDeficit = available ? averageExpenditure * 0.15 : undefined
  const recommendedCalories = available ? averageExpenditure * 0.85 : undefined
  const recommendedProtein = available ? currentWeightKg * 2 : undefined
  const recommendedFat = available ? currentWeightKg * 0.8 : undefined
  const carbs = recommendedCalories !== undefined && recommendedProtein !== undefined && recommendedFat !== undefined
    ? (recommendedCalories - recommendedProtein * 4 - recommendedFat * 9) / 4 : undefined
  const recommendedCarbs = positive(carbs) ? carbs : undefined
  return {
    range, validDayCount: validDays.length, currentWeightKg, averageExpenditure,
    recommendedCalories, recommendedDeficit, recommendedProtein, recommendedFat, recommendedCarbs,
  }
}

export type GoalRecommendations = ReturnType<typeof calculateGoalRecommendations>

// Round only for presentation; the energy allocation above retains full precision.
export function roundRecommendation(value: number | undefined, step: 5 | 10) {
  if (!positive(value)) return undefined
  const rounded = Math.round(value / step) * step
  return positive(rounded) ? rounded : undefined
}
