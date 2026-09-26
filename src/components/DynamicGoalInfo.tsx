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
      <p>Six Pack calcula el objetivo energético del día a partir del gasto previsto menos el déficit configurado.</p>
      {deficit !== undefined && <p className="dynamic-goal-info__deficit"><strong>Ajustado para mantener ≈ {deficit} kcal de déficit</strong></p>}
      <p>La proteína y las grasas mantienen los objetivos definidos por el usuario.</p>
      <p>Los hidratos se calculan con las calorías restantes, por lo que aumentan en días con más actividad y disminuyen si se selecciona un déficit mayor.</p>
      <p>Lo que ya has consumido no modifica los objetivos del día: únicamente cambia el porcentaje de cumplimiento o exceso.</p>
      <p>La actividad prevista se sustituye por la actividad real cuando se registra.</p>
      <p><strong>Balance del día:</strong> hoy y en fechas futuras, el gasto incluye la actividad prevista pendiente. Al registrar la actividad realizada, su valor real sustituye a la estimación del mismo tipo. El déficit mostrado es una proyección mientras haya actividad prevista pendiente.</p>
      <p>En fechas pasadas, el Balance utiliza solo actividad real; las intenciones no realizadas no aumentan el gasto histórico.</p>
    </InfoDialog>}
  </>
}
