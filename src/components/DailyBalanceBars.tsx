import type { GoalStatus } from '../goalStatus'

type DailyBalanceBarsProps = {
  expenditure: number
  consumed: number
  deficit: number
  target?: number
  status?: GoalStatus
}

const kcalFormatter = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })

export function DailyBalanceBars({ expenditure, consumed, deficit, target, status }: DailyBalanceBarsProps) {
  const balanceColor = deficit <= 0 ? 'red' : status ?? 'neutral'
  const rows = [
    { label: 'Gasto', value: expenditure, color: 'expenditure', anchorToExpenditure: false },
    { label: 'Ingeridas', value: consumed, color: balanceColor, anchorToExpenditure: false },
    { label: deficit < 0 ? 'Exceso' : 'Déficit', value: Math.abs(deficit), color: balanceColor, anchorToExpenditure: true },
    ...(target !== undefined ? [{ label: 'Objetivo', value: target, color: 'target', anchorToExpenditure: true }] : []),
  ]
  // Una misma escala conserva la proporción incluso cuando las ingeridas superan el gasto.
  const maximum = Math.max(1, ...rows.map((row) => row.value))

  return <div className="daily-balance-bars">
    {rows.map(({ label, value, color, anchorToExpenditure }) => <div className="daily-balance-bars__row" key={label}>
      <div className="daily-balance-bars__track" aria-hidden="true">
        <div className={`daily-balance-bars__fill daily-balance-bars__fill--${color}`} style={{
          width: `${Math.max(0, value) / maximum * 100}%`,
          // Exceso empieza al final de Gasto; las demás barras conservan su anclaje.
          marginLeft: label === 'Exceso'
            ? `${expenditure / maximum * 100}%`
            : anchorToExpenditure ? `${(expenditure - Math.max(0, value)) / maximum * 100}%` : undefined,
        }} />
      </div>
      <span className="daily-balance-bars__label">{label}</span>
      <strong className="daily-balance-bars__value">{kcalFormatter.format(Math.round(value))} kcal</strong>
    </div>)}
  </div>
}
