import { getGoalStatus, type GoalStatus } from '../goalStatus'

type GoalProgressRingProps = {
  label: string
  percentage: number
  status?: GoalStatus
  size?: 'compact' | 'large'
}

export function GoalProgressRing({ label, percentage, status = getGoalStatus(percentage), size = 'compact' }: GoalProgressRingProps) {
  const visualPercentage = Math.min(Math.max(percentage, 0), 100)
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - visualPercentage / 100)
  const displayedPercentage = Math.round(Math.max(percentage, 0))

  return <div className={`goal-progress-ring goal-progress-ring--${size} goal-progress-ring--${status}`} aria-label={`${label}: ${displayedPercentage}%`}>
    <svg viewBox="0 0 100 100" role="img" aria-hidden="true">
      <circle className="goal-progress-ring__track" cx="50" cy="50" r={radius} />
      <circle className="goal-progress-ring__value" cx="50" cy="50" r={radius} strokeDasharray={circumference} strokeDashoffset={offset} />
    </svg>
    <strong>{displayedPercentage}%</strong>
  </div>
}
