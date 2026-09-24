import { ACTIVITY_INTENTION_TYPES } from '../activityEstimation'
import type { calculateDynamicDailyTargets } from '../dynamicDailyTargets'
import type { useDailyActivityIntentions } from '../useDailyActivityIntentions'
import { SixPackIcon, type SixPackIconName } from './SixPackIcon'
import type { ActivityIntentionType } from '../types'

const activityIcons: Record<ActivityIntentionType, SixPackIconName> = {
  CrossFit: 'dumbbell', Caminata: 'walking', Carrera: 'running', Bicicleta: 'bicycle', Descanso: 'rest',
}

const sourceLabels = { real: 'real', historical: 'histórico', 'historical-provisional': 'histórico provisional', fallback: 'estimación inicial' }
const format = (value: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(value)

export function DailyActivityPlan({ plan, targets, loading }: {
  plan: ReturnType<typeof useDailyActivityIntentions>
  targets: ReturnType<typeof calculateDynamicDailyTargets>
  loading: boolean
}) {
  return <section className="daily-activity-plan" aria-label="Actividad prevista">
    <span className="daily-goals-card__subtitle">Actividad prevista</span>
    <div className="daily-activity-plan__choices" role="group" aria-label="Planificación del día" aria-busy={plan.loading || plan.saving}>
      {ACTIVITY_INTENTION_TYPES.map((type) => <button key={type} type="button" aria-pressed={plan.values.includes(type)}
        aria-label={type} title={type}
        disabled={loading || !plan.ready || plan.saving} onClick={() => plan.toggle(type)}><SixPackIcon name={activityIcons[type]} /></button>)}
    </div>
    <span className="daily-activity-plan__status" role="status">
      {loading || plan.loading ? 'Cargando planificación…' : plan.saving ? 'Guardando planificación…'
        : !plan.ready ? 'Objetivos base hasta que pueda cargarse la planificación.'
          : !targets.calculationValid || targets.effectiveActivityKcal === undefined ? 'Datos insuficientes para el objetivo dinámico. Se mantienen los objetivos base.'
            : `Actividad efectiva: ${format(targets.effectiveActivityKcal)} kcal`}
    </span>
    {plan.ready && !loading && targets.activityBreakdown.length > 0 && <details className="daily-activity-plan__detail">
      <summary>Ver detalle</summary>
      <ul>{targets.activityBreakdown.map((item) => <li key={item.type}>{item.type}: {Number.isFinite(item.kcal) ? `${format(item.kcal)} kcal` : 'Dato inválido'} · {sourceLabels[item.source]}</li>)}</ul>
    </details>}
    {plan.error && <div className="daily-activity-plan__error"><span className="error-text" role="alert">{plan.error}</span>
      <button className="secondary-button" type="button" disabled={plan.loading || plan.saving} onClick={plan.retry}>Reintentar</button>
    </div>}
  </section>
}
