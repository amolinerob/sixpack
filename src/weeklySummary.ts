import { calculateDailyEnergyBalance, calculateEstimatedDeficit, getActiveKcalForDate } from './energy'
import type { ActivityEntry, BodyMeasurement, FoodDiaryEntry, UserGoals } from './types'

export type WeekSummary = ReturnType<typeof createWeeklySummary>

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(dateKeyValue: string, days: number) {
  const date = new Date(`${dateKeyValue}T12:00:00`)
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

export function getWeekRange(referenceDate: string, offset: number) {
  const date = new Date(`${referenceDate}T12:00:00`)
  const mondayOffset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - mondayOffset + offset * 7)
  const start = dateKey(date)
  return { start, end: addDays(start, 6) }
}

export function createWeeklySummary({ range, today, entries, activities, measurements, goals }: {
  range: { start: string; end: string }
  today: string
  entries: FoodDiaryEntry[]
  activities: ActivityEntry[]
  measurements: BodyMeasurement[]
  goals: UserGoals
}) {
  const activeEnd = range.end > today ? today : range.end
  const days = range.start > today ? [] : Array.from({ length: 7 }, (_, index) => addDays(range.start, index))
    .filter((date) => date <= activeEnd)
  const daily = days.map((date) => {
    const intake = entries.filter((entry) => entry.date === date).reduce((total, entry) => ({
      kcal: total.kcal + entry.kcal,
      protein: total.protein + entry.protein,
      carbs: total.carbs + entry.carbs,
      fat: total.fat + entry.fat,
    }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
    const dayActivities = activities.filter((activity) => activity.date === date)
    const activeCalories = getActiveKcalForDate(activities, date)
    const energy = calculateDailyEnergyBalance({ goals, measurements, referenceDate: date, consumedCalories: intake.kcal, activityCalories: activeCalories })
    return { date, intake, activities: dayActivities, activeCalories, energy }
  })
  const sum = daily.reduce((total, day) => ({
    kcal: total.kcal + day.intake.kcal, protein: total.protein + day.intake.protein, carbs: total.carbs + day.intake.carbs, fat: total.fat + day.intake.fat,
    activeCalories: total.activeCalories + day.activeCalories,
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0, activeCalories: 0 })
  const calculated = daily.filter((day) => day.energy !== undefined)
  const totalExpenditure = calculated.reduce((total, day) => total + day.energy!.estimatedDailyExpenditure, 0)
  const totalDeficit = calculateEstimatedDeficit(totalExpenditure, sum.kcal)
  // Un balance parcial no representa el déficit de todos los días incluidos.
  const energyComplete = daily.length > 0 && calculated.length === daily.length
  const weekMeasurements = measurements.filter((measurement) => measurement.date >= range.start && measurement.date <= activeEnd)
  return { range, activeEnd, days: daily, dayCount: daily.length, sum, calculated, totalExpenditure, totalDeficit, energyComplete, weekMeasurements }
}
