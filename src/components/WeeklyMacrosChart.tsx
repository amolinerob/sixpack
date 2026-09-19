import { chartLayout } from '../chartTheme'
import { useId } from 'react'
import type { UserGoals } from '../types'
import type { WeekSummary } from '../weeklySummary'
import { getWeeklyMacrosSeries } from '../weeklyMacrosSeries'

const dayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const number = (value: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(value)
const valid = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value) && value >= 0

export function WeeklyMacrosChart({ summary, goals }: { summary: WeekSummary; goals: UserGoals }) {
  const titleId = useId()
  const descriptionId = useId()
  const series = getWeeklyMacrosSeries(summary, goals)
  const values = series.flatMap((macro) => [macro.average, macro.targetValue, ...macro.points.map((point) => point.value)]).filter(valid)
  const maximum = Math.max(20, ...values)
  const step = Math.pow(10, Math.floor(Math.log10(maximum))) / 2
  const ceiling = Math.ceil(maximum * 1.1 / step) * step
  const { width, height, inset } = chartLayout
  const left = inset.left
  const right = width - inset.right
  const top = inset.top
  const bottom = height - inset.bottom
  const x = (index: number) => left + index * (right - left) / 6
  const y = (value: number) => bottom - value / ceiling * (bottom - top)

  return <article className="weekly-card weekly-macros">
    <span className="weekly-card__title" id={titleId}>Macros semanales</span>
    <div className="weekly-macros__legend" aria-label="Colores de las macros">
      {series.map((macro) => <span key={macro.key}><i style={{ background: macro.color }} aria-hidden="true" />{macro.label}</span>)}
    </div>
    <div className="weekly-macros__legend weekly-macros__styles" aria-label="Tipos de línea">
      <span><i className="weekly-macros__solid" aria-hidden="true" />Diario</span>
      <span><i className="weekly-macros__dashed" aria-hidden="true" />Media</span>
      <span><i className="weekly-macros__dotted" aria-hidden="true" />Objetivo</span>
    </div>
    <svg className="weekly-macros__chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
      <desc id={descriptionId}>Consumo diario en gramos del {summary.range.start} al {summary.range.end}. {series.map((macro) => `${macro.label}: media ${number(macro.average)} g; objetivo ${valid(macro.targetValue) ? `${number(macro.targetValue)} g` : 'sin definir'}. ${macro.points.map((point) => `${point.date}: ${number(point.value)} g`).join(', ')}.`).join(' ')}</desc>
      <text className="weekly-macros__axis" x="0" y="13">g</text>
      {[0, ceiling / 2, ceiling].map((tick) => <g key={tick}>
        <line className="weekly-macros__grid" x1={left} x2={right} y1={y(tick)} y2={y(tick)} />
        <text className="weekly-macros__axis" x={left - 7} y={y(tick) + 4} textAnchor="end">{number(tick)}</text>
      </g>)}
      {series.map((macro) => <g key={macro.key} stroke={macro.color}>
        {summary.dayCount > 0 && valid(macro.average) && <line className="weekly-macros__reference" strokeDasharray="7 5" x1={left} x2={right} y1={y(macro.average)} y2={y(macro.average)}><title>{`${macro.label}: media ${number(macro.average)} g`}</title></line>}
        {valid(macro.targetValue) && <line className="weekly-macros__reference" strokeDasharray="1 5" strokeLinecap="round" x1={left} x2={right} y1={y(macro.targetValue)} y2={y(macro.targetValue)}><title>{`${macro.label}: objetivo ${number(macro.targetValue)} g`}</title></line>}
      </g>)}
      {series.map((macro) => <g key={macro.key} stroke={macro.color}>
        <path className="weekly-macros__line" d={macro.points.map((point, index) => valid(point.value) ? `${index === 0 || !valid(macro.points[index - 1].value) ? 'M' : 'L'} ${x(point.index)} ${y(point.value)}` : '').join(' ')} />
        {macro.points.filter((point) => valid(point.value)).map((point) => <circle key={point.date} cx={x(point.index)} cy={y(point.value)} r={chartLayout.pointRadius} fill={macro.color}><title>{`${macro.label} - ${point.date}: ${number(point.value)} g`}</title></circle>)}
      </g>)}
      {dayLabels.map((label, index) => <text className="weekly-macros__axis" key={label} x={x(index)} y={height - 7} textAnchor="middle">{label}</text>)}
    </svg>
    {series.some((macro) => !valid(macro.targetValue)) && <span className="weekly-macros__note">Las líneas de objetivo aparecen cuando hay un objetivo definido.</span>}
  </article>
}
