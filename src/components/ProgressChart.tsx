import { getChartDomain, type ProgressPoint } from '../progressSeries'
import { chartLayout } from '../chartTheme'

type Props = {
  points: ProgressPoint[]
  trend: ProgressPoint[]
  target?: number
  unit: string
}

function formatShortDate(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`)
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export function ProgressChart({ points, trend, target, unit }: Props) {
  if (points.length < 2) return null

  const domain = getChartDomain(points, trend, target)!
  const { width, height, inset } = chartLayout
  const chartWidth = width - inset.left - inset.right
  const chartHeight = height - inset.top - inset.bottom
  const firstDate = points[0].date
  const lastDate = points[points.length - 1].date
  const firstTime = new Date(`${firstDate}T12:00:00`).getTime()
  const lastTime = new Date(`${lastDate}T12:00:00`).getTime()
  const x = (date: string) => lastTime === firstTime ? inset.left + chartWidth / 2 : inset.left + ((new Date(`${date}T12:00:00`).getTime() - firstTime) / (lastTime - firstTime)) * chartWidth
  const y = (value: number) => inset.top + ((domain.max - value) / (domain.max - domain.min)) * chartHeight
  const path = (series: ProgressPoint[]) => series.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.date).toFixed(2)} ${y(point.value).toFixed(2)}`).join(' ')

  return (
    <svg className="progress-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Evolución en ${unit}`}>
      <line className="progress-chart__guide" x1={inset.left} x2={width - inset.right} y1={y(domain.max)} y2={y(domain.max)} />
      <line className="progress-chart__guide" x1={inset.left} x2={width - inset.right} y1={y(domain.min)} y2={y(domain.min)} />
      {target !== undefined && <><line className="progress-chart__target" x1={inset.left} x2={width - inset.right} y1={y(target)} y2={y(target)} /><text className="progress-chart__target-label" x={width - inset.right} y={y(target) - 4} textAnchor="end">Objetivo</text></>}
      <path className="progress-chart__actual-line" d={path(points)} />
      {trend.length >= 2 && <path className="progress-chart__trend-line" d={path(trend)} />}
      {points.map((point) => <circle className="progress-chart__point" cx={x(point.date)} cy={y(point.value)} r={chartLayout.pointRadius} key={`${point.date}-${point.value}`} />)}
      <text className="progress-chart__axis-label" x="0" y="13">{unit}</text>
      <text className="progress-chart__axis-label" x={inset.left - 7} textAnchor="end" y={y(domain.max) + 4}>{new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(domain.max)}</text>
      <text className="progress-chart__axis-label" x={inset.left - 7} textAnchor="end" y={y(domain.min) + 4}>{new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(domain.min)}</text>
      <text className="progress-chart__date-label" x={inset.left} y={height - 6}>{formatShortDate(firstDate)}</text>
      <text className="progress-chart__date-label" x={width - inset.right} y={height - 6} textAnchor="end">{formatShortDate(lastDate)}</text>
    </svg>
  )
}
