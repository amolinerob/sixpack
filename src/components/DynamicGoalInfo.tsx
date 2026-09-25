import { useState } from 'react'
import { InfoDialog } from './InfoDialog'

/** Local UI state keeps opening the explanation independent of Hoy's calculations. */
export function DynamicGoalInfo({ targetDeficitKcal }: { targetDeficitKcal: number | undefined }) {
  const [open, setOpen] = useState(false)
  const deficit = targetDeficitKcal !== undefined && Number.isFinite(targetDeficitKcal) && targetDeficitKcal >= 0
    ? new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(targetDeficitKcal) : undefined
  return <>
    <button type="button" className="goal-info-button"
      aria-label="Información sobre el objetivo dinámico"
      title="Cómo funciona el objetivo dinámico"
      onClick={() => setOpen(true)}><span aria-hidden="true">i</span></button>
    {open && <InfoDialog title="Cómo funciona el objetivo dinámico" onClose={() => setOpen(false)}>
      <p>{deficit !== undefined
        ? `Six Pack adapta tus objetivos del día para mantener aproximadamente ${deficit} kcal de déficit.`
        : 'Configura tu déficit objetivo en Usuario para adaptar los objetivos del día.'}</p>
      {deficit !== undefined && <p className="dynamic-goal-info__deficit"><strong>Ajustado para mantener ≈ {deficit} kcal de déficit</strong></p>}
      <p>El objetivo energético es el gasto previsto del día menos el déficit que has configurado.</p>
      <p>La proteína mantiene su objetivo. Las grasas y los hidratos se adaptan según lo que vas consumiendo.</p>
      <p>Si consumes más grasa de la prevista, quedan menos calorías para hidratos y su objetivo se reduce. Lo mismo ocurre a la inversa cuando corresponde.</p>
      <p>La actividad prevista permite calcular el objetivo desde el inicio del día. Al registrar la actividad real, esta sustituye a la estimación del mismo tipo para evitar contarla dos veces.</p>
      <p>Si se agotan las kcal, no es necesario seguir comiendo para completar los macros.</p>
      <p><strong>Balance del día:</strong> hoy y en fechas futuras, el gasto incluye la actividad prevista pendiente. Al registrar la actividad realizada, su valor real sustituye a la estimación del mismo tipo. El déficit mostrado es una proyección mientras haya actividad prevista pendiente.</p>
      <p>En fechas pasadas, el Balance utiliza solo actividad real; las intenciones no realizadas no aumentan el gasto histórico.</p>
    </InfoDialog>}
  </>
}
