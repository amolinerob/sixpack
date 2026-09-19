import type { ActivityEntry, BodyMeasurement, UserGoals } from './types'

export function isValidWeight(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0
}

export function isValidActiveKcal(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

export function getActiveKcalForDate(activities: ActivityEntry[], referenceDate: string): number {
  return activities.reduce((total, activity) =>
    activity.date === referenceDate && isValidActiveKcal(activity.calories)
      ? total + activity.calories : total, 0)
}

export function getAgeAtDate(birthDate: string | undefined, referenceDate: string): number | undefined {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return undefined

  const birth = new Date(`${birthDate}T12:00:00`)
  const reference = new Date(`${referenceDate}T12:00:00`)
  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number)
  if (
    Number.isNaN(birth.getTime())
    || Number.isNaN(reference.getTime())
    || birth.getFullYear() !== birthYear
    || birth.getMonth() !== birthMonth - 1
    || birth.getDate() !== birthDay
    || birth >= reference
  ) return undefined

  let age = reference.getFullYear() - birth.getFullYear()
  const birthdayReached = reference.getMonth() > birth.getMonth()
    || (reference.getMonth() === birth.getMonth() && reference.getDate() >= birth.getDate())
  if (!birthdayReached) age -= 1
  return age >= 0 ? age : undefined
}

export function getLatestWeightForDate(measurements: BodyMeasurement[], referenceDate: string): number | undefined {
  return measurements
    .filter((measurement) => measurement.date <= referenceDate && isValidWeight(measurement.weightKg))
    .sort((a, b) => b.date.localeCompare(a.date))[0]
    ?.weightKg
}

export function calculateBmr({ sex, weightKg, heightCm, age }: {
  sex: UserGoals['sex']
  weightKg: number
  heightCm: number
  age: number
}): number | undefined {
  if (!sex || weightKg <= 0 || heightCm <= 0 || age < 0) return undefined
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161)
}

export function calculateBaseDailyExpenditure(bmr: number) {
  return bmr * 1.2
}

export function calculateEstimatedDailyExpenditure(baseDailyExpenditure: number, activityCalories: number) {
  return baseDailyExpenditure + activityCalories
}

export function calculateEstimatedDeficit(estimatedDailyExpenditure: number, consumedCalories: number) {
  return estimatedDailyExpenditure - consumedCalories
}

export function calculateDailyEnergyBalance({
  goals,
  measurements,
  referenceDate,
  consumedCalories,
  activityCalories,
}: {
  goals: UserGoals
  measurements: BodyMeasurement[]
  referenceDate: string
  consumedCalories: number
  activityCalories: number
}) {
  const weightKg = getLatestWeightForDate(measurements, referenceDate)
  const age = getAgeAtDate(goals.birthDate, referenceDate)
  if (weightKg === undefined || age === undefined || !goals.heightCm || !goals.sex) return undefined

  const bmr = calculateBmr({ sex: goals.sex, weightKg, heightCm: goals.heightCm, age })
  if (bmr === undefined) return undefined

  const baseDailyExpenditure = calculateBaseDailyExpenditure(bmr)
  const estimatedDailyExpenditure = calculateEstimatedDailyExpenditure(baseDailyExpenditure, activityCalories)
  return {
    weightKg,
    age,
    bmr,
    baseDailyExpenditure,
    estimatedDailyExpenditure,
    estimatedDeficit: calculateEstimatedDeficit(estimatedDailyExpenditure, consumedCalories),
  }
}
