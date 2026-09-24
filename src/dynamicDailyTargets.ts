import { calculateDailyEnergyBalance, calculateEstimatedDeficit, getActiveKcalForDate, isValidActiveKcal } from './energy'
import { estimateActivityKcal, isValidActivityDate, normalizeActivityType, PLANNED_ACTIVITY_TYPES, type ActivityEstimateSource } from './activityEstimation'
import type { ActivityEntry, ActivityIntentionType, ActivityType, BodyMeasurement, UserGoals } from './types'

export type EffectiveActivity = { type: ActivityType; kcal: number; source: ActivityEstimateSource | 'real'; sampleCount: number }

function validTarget(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined
}

/** Activities must be the current user's repository data. History and actuals are split by date here. */
export function calculateDynamicDailyTargets({ baseGoals, intentions, activities, measurements, date }: {
  baseGoals: UserGoals; intentions: ActivityIntentionType[]; activities: ActivityEntry[]; measurements: BodyMeasurement[]; date: string
}) {
  const validDate = isValidActivityDate(date)
  const actual = activities.filter((item) => validDate && item.date === date && isValidActiveKcal(item.calories))
  const groups = new Map<ActivityType, ActivityEntry[]>()
  for (const item of actual) {
    const type = normalizeActivityType(item.type) ?? 'Otra'
    groups.set(type, [...(groups.get(type) ?? []), item])
  }
  const activityBreakdown: EffectiveActivity[] = [...groups].map(([type, items]) => ({
    type, kcal: getActiveKcalForDate(items, date), source: 'real', sampleCount: items.length,
  }))
  if (validDate && !intentions.includes('Descanso')) {
    for (const type of PLANNED_ACTIVITY_TYPES) {
      if (intentions.includes(type) && !groups.has(type)) activityBreakdown.push(estimateActivityKcal(activities, type, date))
    }
  }
  const total = activityBreakdown.reduce((sum, item) => sum + item.kcal, 0)
  const effectiveActivityKcal = Number.isFinite(total) && total >= 0 ? total : undefined
  const proteinG = validTarget(baseGoals.targetProteinG)
  const fatG = validTarget(baseGoals.targetFatG)
  const targetDeficitKcal = validTarget(baseGoals.targetDeficitKcal)
  const baseCarbsG = validTarget(baseGoals.targetCarbsG)

  // Forecast only. Hoy computes its actual energy balance separately using real activity.
  const forecast = validDate && effectiveActivityKcal !== undefined ? calculateDailyEnergyBalance({
    goals: baseGoals, measurements, referenceDate: date, consumedCalories: 0, activityCalories: effectiveActivityKcal,
  }) : undefined
  const expenditure = forecast?.estimatedDailyExpenditure
  const estimatedExpenditureKcal = expenditure !== undefined && Number.isFinite(expenditure) && expenditure > 0 ? expenditure : undefined
  const targetCalories = estimatedExpenditureKcal !== undefined && targetDeficitKcal !== undefined
    ? calculateEstimatedDeficit(estimatedExpenditureKcal, targetDeficitKcal) : undefined
  const availableCarbCalories = targetCalories !== undefined && proteinG !== undefined && fatG !== undefined
    ? targetCalories - proteinG * 4 - fatG * 9 : undefined
  const calculationValid = availableCarbCalories !== undefined && Number.isFinite(availableCarbCalories)
  const incompatibleTargets = calculationValid && availableCarbCalories < 0
  const carbsG = calculationValid ? Math.round(Math.max(0, availableCarbCalories / 4) / 5) * 5 : baseCarbsG
  return {
    proteinG, carbsG, fatG, baseCarbsG, effectiveActivityKcal, activityBreakdown,
    estimatedExpenditureKcal, targetDeficitKcal, targetCalories, calculationValid, incompatibleTargets,
  }
}
