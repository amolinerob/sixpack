export type GoalStatus = 'red' | 'yellow' | 'green'

/** Estado visual común para cualquier objetivo expresado como porcentaje. */
export function getGoalStatus(percent: number): GoalStatus {
  if (!Number.isFinite(percent) || percent < 50 || percent > 110) return 'red'
  if (percent < 90) return 'yellow'
  return 'green'
}

export function getGoalPercentage(current: number, target: number) {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return 0
  return Math.max(0, (current / target) * 100)
}
