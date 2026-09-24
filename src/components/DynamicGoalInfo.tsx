import { useState } from 'react'
import { InfoDialog } from './InfoDialog'

/** Local UI state keeps opening the explanation independent of Hoy's calculations. */
export function DynamicGoalInfo() {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className="goal-info-button"
      aria-label="Información sobre el objetivo dinámico"
      title="Cómo funciona el objetivo dinámico"
      onClick={() => setOpen(true)}><span aria-hidden="true">i</span></button>
    {open && <InfoDialog title="Cómo funciona el objetivo dinámico" onClose={() => setOpen(false)}>
      <p>Tu gasto previsto combina el gasto base (metabolismo basal × 1,2) con la actividad del día.</p>
      <p>La actividad prevista se estima con tu historial personal. Si aún no tienes registros válidos, se usa un valor inicial de referencia.</p>
      <p>Cuando registras una actividad real, sustituye la estimación del mismo tipo, sin contarla dos veces. La actividad real no prevista también cuenta.</p>
      <p><strong>Objetivo energético = Gasto previsto − Déficit objetivo</strong></p>
      <p>La proteína y las grasas mantienen tus objetivos configurados. Los hidratos se calculan con las calorías restantes: pueden aumentar con más actividad o disminuir con un déficit mayor.</p>
      <p><strong>Balance del día</strong> utiliza solo actividad realmente registrada, nunca la prevista.</p>
    </InfoDialog>}
  </>
}
