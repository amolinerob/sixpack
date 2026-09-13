import type { BodyMeasurement } from './types'

export type ProgressPeriod = '1w' | '1m' | '6m' | 'all'

export type ProgressPoint = {
  date: string
  value: number
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00`)
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function subtractMonths(dateKey: string, months: number) {
  const date = new Date(`${dateKey}T12:00:00`)
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() - months)
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, lastDayOfMonth))
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const resultDay = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${resultDay}`
}

export function getMeasurementPoints(measurements: BodyMeasurement[], field: 'weightKg' | 'waistCm'): ProgressPoint[] {
  return measurements
    .filter((measurement): measurement is BodyMeasurement & Required<Pick<BodyMeasurement, typeof field>> => measurement[field] !== undefined)
    .map((measurement) => ({ date: measurement.date, value: measurement[field] }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function filterPointsByPeriod(points: ProgressPoint[], period: ProgressPeriod, referenceDate: string): ProgressPoint[] {
  if (period === 'all') return points.filter((point) => point.date <= referenceDate)
  const startDate = period === '1w'
    ? addDays(referenceDate, -6)
    : subtractMonths(referenceDate, period === '1m' ? 1 : 6)
  return points.filter((point) => point.date >= startDate && point.date <= referenceDate)
}

export function calculateMovingAverage(points: ProgressPoint[]): ProgressPoint[] {
  return points.map((point) => {
    const startDate = addDays(point.date, -6)
    const window = points.filter((candidate) => candidate.date >= startDate && candidate.date <= point.date)
    return { date: point.date, value: window.reduce((sum, candidate) => sum + candidate.value, 0) / window.length }
  })
}

export function calculatePeriodChange(points: ProgressPoint[], trend: ProgressPoint[]): number | undefined {
  const comparison = trend.length >= 2 ? trend : points
  if (comparison.length < 2) return undefined
  return comparison[comparison.length - 1].value - comparison[0].value
}

export function getChartDomain(points: ProgressPoint[], trend: ProgressPoint[], target?: number) {
  const values = [...points, ...trend].map((point) => point.value)
  if (target !== undefined) values.push(target)
  if (values.length === 0) return undefined

  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const spread = maximum - minimum
  const padding = spread > 0 ? spread * 0.18 : Math.max(Math.abs(minimum) * 0.03, 1)
  return { min: minimum - padding, max: maximum + padding }
}
