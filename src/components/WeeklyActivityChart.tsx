import { chartLayout } from '../chartTheme'
import { useId, useState } from 'react'
import type { WeeklyActivitySeries } from '../weeklyActivitySeries'

const shortLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const format = (value: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(value)

export function WeeklyActivityChart({ data }: { data: WeeklyActivitySeries }) {
  const titleId = useId()
  const descriptionId = useId()
  const [selected, setSelected] = useState<number | null>(null)
  const maximum = Math.max(100, ...data.days.map((day) => day.value ?? 0))
  const step = Math.pow(10, Math.floor(Math.log10(maximum))) / 2
  const ceiling = Math.ceil(maximum * 1.1 / step) * step
  const { width, height, inset } = chartLayout
  const left = inset.left
  const right = width - inset.right
  const top = inset.top
  const bottom = height - inset.bottom
  const column = (right - left) / 7
  const x = (index: number) => left + (index + 0.5) * column
  const y = (value: number) => bottom - value / ceiling * (bottom - top)
  const detail = (index: number) => {
    const day = data.days[index]
    return `${day.label}: ${day.value === undefined ? 'sin dato (día futuro)' : `${format(day.value)} kcal activas`}`
  }

  return <article className="weekly-card weekly-activity-chart">
    <span className="weekly-card__title" id={titleId}>Actividad semanal</span>
    <div className="weekly-macros__legend weekly-macros__styles"><span><i className="weekly-macros__dashed" aria-hidden="true" />Media: {data.average === undefined ? '—' : `${format(data.average)} kcal/día`}</span></div>
    <svg className="weekly-macros__chart" viewBox={`0 0 ${width} ${height}`} role="group" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <desc id={descriptionId}>Kcal activas por día. Cero indica un día sin actividad registrada; el guion indica un día futuro, excluido de la media.</desc>
      <text className="weekly-macros__axis" x="0" y="13">kcal activas</text>
      {[0, ceiling / 2, ceiling].map((tick) => <g key={tick}>
        <line className="weekly-macros__grid" x1={left} x2={right} y1={y(tick)} y2={y(tick)} />
        <text className="weekly-macros__axis" x={left - 6} y={y(tick) + 4} textAnchor="end">{format(tick)}</text>
      </g>)}
      {data.days.map((day) => <g key={day.label}>
        {day.value !== undefined && day.value > 0 && <rect className="weekly-activity-chart__bar" x={x(day.index) - 12} y={y(day.value)} width="24" height={bottom - y(day.value)} rx="3" />}
        {(day.value === undefined || day.value === 0) && <text className="weekly-macros__axis" x={x(day.index)} y={bottom - 7} textAnchor="middle">{day.value === undefined ? '—' : '0'}</text>}
        <text className="weekly-macros__axis" x={x(day.index)} y={height - 7} textAnchor="middle">{shortLabels[day.index]}</text>
      </g>)}
      {data.average !== undefined && <line className="weekly-activity-chart__average" x1={left} x2={right} y1={y(data.average)} y2={y(data.average)} strokeDasharray="7 5" />}
      {data.days.map((day) => <rect key={day.label} className="weekly-activity-chart__hit" x={left + day.index * column} y={top} width={column} height={height - top} tabIndex={0} role="button" aria-label={detail(day.index)} aria-pressed={selected === day.index} onClick={() => setSelected(day.index)} onMouseEnter={() => setSelected(day.index)} onFocus={() => setSelected(day.index)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(day.index) } }}><title>{detail(day.index)}</title></rect>)}
    </svg>
    <span className="weekly-macros__note weekly-activity-chart__detail" aria-live="polite">{selected === null ? 'Toca un día para ver las kcal activas. — Día futuro.' : detail(selected)}</span>
  </article>
}
