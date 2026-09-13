import { useMemo, useState } from 'react'
import { calculateBmr, getAgeAtDate, getLatestWeightForDate } from '../energy'
import { ProgressChart } from '../components/ProgressChart'
import { calculateMovingAverage, calculatePeriodChange, filterPointsByPeriod, getMeasurementPoints, type ProgressPeriod } from '../progressSeries'
import { loadBodyMeasurements, loadUserGoals, saveBodyMeasurements, saveUserGoals } from '../storage'
import type { BodyMeasurement, User, UserGoals } from '../types'
import { ScreenHeader } from '../components/ScreenHeader'

function todayIsoLocal(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDate(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`)
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function roundValue(value: number | undefined) {
  if (value === undefined) {
    return null
  }

  return Math.round(value * 10) / 10
}

function formatGoalValue(value: number, unit: string, minimumFractionDigits = 0) {
  return `${new Intl.NumberFormat('es-ES', { minimumFractionDigits, maximumFractionDigits: 1 }).format(value)} ${unit}`
}

function goalValueToInput(value: number | undefined) {
  return value?.toString() ?? ''
}

function parseGoalValue(value: string) {
  const trimmed = value.trim()
  return trimmed === '' ? undefined : Number(trimmed.replace(',', '.'))
}

export function ProgresoScreen({ activeUser, onUserClick }: { activeUser: User; onUserClick: () => void }) {
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>(() => loadBodyMeasurements(activeUser.id))
  const [goals, setGoals] = useState<UserGoals>(() => loadUserGoals(activeUser.id))
  const [modalOpen, setModalOpen] = useState(false)
  const [goalsModalOpen, setGoalsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [date, setDate] = useState(todayIsoLocal())
  const [weightKg, setWeightKg] = useState('')
  const [waistCm, setWaistCm] = useState('')
  const [error, setError] = useState('')
  const [goalsError, setGoalsError] = useState('')
  const [targetWeightKg, setTargetWeightKg] = useState('')
  const [targetWaistCm, setTargetWaistCm] = useState('')
  const [targetProteinG, setTargetProteinG] = useState('')
  const [targetCarbsG, setTargetCarbsG] = useState('')
  const [targetFatG, setTargetFatG] = useState('')
  const [sex, setSex] = useState<UserGoals['sex'] | ''>('')
  const [birthDate, setBirthDate] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [targetDeficitKcal, setTargetDeficitKcal] = useState('')
  const [evolutionPeriod, setEvolutionPeriod] = useState<ProgressPeriod>('1m')

  const sorted = useMemo(() => {
    return [...measurements].sort((a, b) => b.date.localeCompare(a.date))
  }, [measurements])

  const latestWeight = sorted.find((m) => m.weightKg !== undefined)
  const latestWaist = sorted.find((m) => m.waistCm !== undefined)
  const firstWeight = sorted.find((m) => m.weightKg !== undefined)
  const firstWaist = sorted.find((m) => m.waistCm !== undefined)
  const physicalReferenceDate = todayIsoLocal()
  const physicalWeight = getLatestWeightForDate(measurements, physicalReferenceDate)
  const physicalAge = getAgeAtDate(goals.birthDate, physicalReferenceDate)
  const physicalBmr = physicalWeight !== undefined && physicalAge !== undefined && goals.heightCm !== undefined
    ? calculateBmr({ sex: goals.sex, weightKg: physicalWeight, heightCm: goals.heightCm, age: physicalAge })
    : undefined
  const hasVisibleGoals = [goals.targetWeightKg, goals.targetWaistCm, goals.targetDeficitKcal, goals.targetProteinG, goals.targetCarbsG, goals.targetFatG]
    .some((value) => value !== undefined)
  const evolutionReferenceDate = todayIsoLocal()
  const weightEvolution = useMemo(() => {
    const points = filterPointsByPeriod(getMeasurementPoints(measurements, 'weightKg'), evolutionPeriod, evolutionReferenceDate)
    const trend = calculateMovingAverage(points)
    return { points, trend, change: calculatePeriodChange(points, trend) }
  }, [evolutionPeriod, evolutionReferenceDate, measurements])
  const waistEvolution = useMemo(() => {
    const points = filterPointsByPeriod(getMeasurementPoints(measurements, 'waistCm'), evolutionPeriod, evolutionReferenceDate)
    const trend = calculateMovingAverage(points)
    return { points, trend, change: calculatePeriodChange(points, trend) }
  }, [evolutionPeriod, evolutionReferenceDate, measurements])

  function openCreate() {
    setEditingId(null)
    setDate(todayIsoLocal())
    setWeightKg('')
    setWaistCm('')
    setError('')
    setModalOpen(true)
  }

  function openEdit(item: BodyMeasurement) {
    setEditingId(item.id)
    setDate(item.date)
    setWeightKg(item.weightKg?.toString() ?? '')
    setWaistCm(item.waistCm?.toString() ?? '')
    setError('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setError('')
  }

  function openGoalsModal() {
    setTargetWeightKg(goalValueToInput(goals.targetWeightKg))
    setTargetWaistCm(goalValueToInput(goals.targetWaistCm))
    setTargetProteinG(goalValueToInput(goals.targetProteinG))
    setTargetCarbsG(goalValueToInput(goals.targetCarbsG))
    setTargetFatG(goalValueToInput(goals.targetFatG))
    setSex(goals.sex ?? '')
    setBirthDate(goals.birthDate ?? '')
    setHeightCm(goalValueToInput(goals.heightCm))
    setTargetDeficitKcal(goalValueToInput(goals.targetDeficitKcal))
    setGoalsError('')
    setGoalsModalOpen(true)
  }

  function saveGoals() {
    const nextGoals: UserGoals = {
      targetWeightKg: parseGoalValue(targetWeightKg),
      targetWaistCm: parseGoalValue(targetWaistCm),
      targetCaloriesKcal: goals.targetCaloriesKcal,
      targetProteinG: parseGoalValue(targetProteinG),
      targetCarbsG: parseGoalValue(targetCarbsG),
      targetFatG: parseGoalValue(targetFatG),
      sex: sex || undefined,
      birthDate: birthDate || undefined,
      heightCm: parseGoalValue(heightCm),
      targetDeficitKcal: parseGoalValue(targetDeficitKcal),
    }
    const validations: Array<[number | undefined, number, string]> = [
      [nextGoals.targetWeightKg, 500, 'El peso objetivo debe ser un número positivo razonable.'],
      [nextGoals.targetWaistCm, 250, 'La cintura objetivo debe ser un número positivo razonable.'],
      [nextGoals.targetProteinG, 2000, 'Las proteínas diarias deben ser un valor positivo razonable.'],
      [nextGoals.targetCarbsG, 2000, 'Los hidratos diarios deben ser un valor positivo razonable.'],
      [nextGoals.targetFatG, 2000, 'Las grasas diarias deben ser un valor positivo razonable.'],
      [nextGoals.heightCm, 300, 'La altura debe ser un valor positivo razonable.'],
      [nextGoals.targetDeficitKcal, 5000, 'El déficit objetivo debe ser un valor positivo razonable.'],
    ]
    const invalid = validations.find(([value, maximum]) => value !== undefined && (Number.isNaN(value) || value <= 0 || value > maximum))
    if (invalid) {
      setGoalsError(invalid[2])
      return
    }

    if (nextGoals.birthDate && getAgeAtDate(nextGoals.birthDate, todayIsoLocal()) === undefined) {
      setGoalsError('La fecha de nacimiento debe ser válida y anterior a hoy.')
      return
    }

    setGoals(nextGoals)
    saveUserGoals(activeUser.id, nextGoals)
    setGoalsModalOpen(false)
  }

  function saveMeasurement() {
    const weightValue = weightKg.trim() === '' ? undefined : Number(weightKg)
    const waistValue = waistCm.trim() === '' ? undefined : Number(waistCm)

    if (weightValue === undefined && waistValue === undefined) {
      setError('Introduce al menos un valor de peso o cintura.')
      return
    }

    if (weightValue !== undefined && (Number.isNaN(weightValue) || weightValue <= 0 || weightValue > 500)) {
      setError('El peso debe ser un número positivo razonable.')
      return
    }

    if (waistValue !== undefined && (Number.isNaN(waistValue) || waistValue <= 0 || waistValue > 250)) {
      setError('La cintura debe ser un número positivo razonable.')
      return
    }

    const payload: BodyMeasurement = {
      id: editingId ?? `${Date.now()}-${Math.round(Math.random() * 10000)}`,
      userId: activeUser.id,
      date,
      weightKg: weightValue,
      waistCm: waistValue,
      createdAt: new Date().toISOString(),
    }

    const next = editingId ? measurements.map((item) => item.id === editingId ? payload : item) : [...measurements, payload]
    setMeasurements(next)
    saveBodyMeasurements(activeUser.id, next)
    closeModal()
  }

  function deleteMeasurement(id: string) {
    const next = measurements.filter((item) => item.id !== id)
    setMeasurements(next)
    saveBodyMeasurements(activeUser.id, next)
  }

  return (
    <section className="screen screen-progreso">
      <ScreenHeader title="PROGRESO" user={activeUser} onUserClick={onUserClick} />

      <section className="goals-card">
        <div className="goals-card__top">
          <span className="goals-card__title">Objetivos</span>
          <button className="goals-card__edit" type="button" onClick={openGoalsModal}>✎ Editar</button>
        </div>
        <div className="goals-card__list">
          {goals.targetWeightKg !== undefined && <GoalRow label="Peso" value={formatGoalValue(goals.targetWeightKg, 'kg', 1)} />}
          {goals.targetWaistCm !== undefined && <GoalRow label="Cintura" value={formatGoalValue(goals.targetWaistCm, 'cm', 1)} />}
          {goals.targetDeficitKcal !== undefined && <GoalRow label="Déficit objetivo" value={formatGoalValue(goals.targetDeficitKcal, 'kcal/día')} />}
          {goals.targetProteinG !== undefined && <GoalRow label="Proteínas" value={formatGoalValue(goals.targetProteinG, 'g')} />}
          {goals.targetCarbsG !== undefined && <GoalRow label="Hidratos" value={formatGoalValue(goals.targetCarbsG, 'g')} />}
          {goals.targetFatG !== undefined && <GoalRow label="Grasas" value={formatGoalValue(goals.targetFatG, 'g')} />}
          {!hasVisibleGoals && <span className="goals-card__empty">Configura tus objetivos diarios.</span>}
        </div>
      </section>

      <section className="physical-data-card">
        <div className="goals-card__top">
          <span className="goals-card__title">Datos físicos</span>
          <button className="goals-card__edit" type="button" onClick={openGoalsModal}>✎ Editar</button>
        </div>
        <div className="goals-card__list">
          {goals.sex !== undefined && <GoalRow label="Sexo" value={goals.sex === 'male' ? 'Hombre' : 'Mujer'} />}
          {goals.birthDate && <GoalRow label="Fecha nacimiento" value={formatDate(goals.birthDate)} />}
          {goals.heightCm !== undefined && <GoalRow label="Altura" value={formatGoalValue(goals.heightCm, 'cm', 1)} />}
          {physicalWeight !== undefined && <GoalRow label="Peso actual" value={formatGoalValue(physicalWeight, 'kg', 1)} />}
          {physicalBmr !== undefined && <GoalRow label="Metabolismo basal" value={formatGoalValue(Math.round(physicalBmr), 'kcal/día')} />}
          {!goals.sex && !goals.birthDate && goals.heightCm === undefined && physicalWeight === undefined && <span className="goals-card__empty">Completa tus datos físicos para calcular tu gasto diario.</span>}
        </div>
      </section>

      <span className="progress-section-label">Estado actual</span>
      <section className="progress-summary">
        <article className="progress-card">
          <div className="progress-card__top">
            <span className="progress-card__title">Peso</span>
            <span className="progress-card__icon">kg</span>
          </div>
          <div className="progress-card__body">
            {latestWeight ? (
              <>
                <span className="progress-card__value">{roundValue(latestWeight.weightKg)} kg</span>
                <span className="progress-card__delta">
                  {firstWeight && latestWeight && firstWeight.weightKg !== undefined && latestWeight.weightKg !== undefined
                    ? `${roundValue(latestWeight.weightKg! - firstWeight.weightKg!)} kg`
                    : 'Sin comparación'}
                </span>
              </>
            ) : (
              <span className="progress-card__empty">Sin datos</span>
            )}
          </div>
        </article>

        <article className="progress-card">
          <div className="progress-card__top">
            <span className="progress-card__title">Cintura</span>
            <span className="progress-card__icon">cm</span>
          </div>
          <div className="progress-card__body">
            {latestWaist ? (
              <>
                <span className="progress-card__value">{roundValue(latestWaist.waistCm)} cm</span>
                <span className="progress-card__delta">
                  {firstWaist && latestWaist && firstWaist.waistCm !== undefined && latestWaist.waistCm !== undefined
                    ? `${roundValue(latestWaist.waistCm! - firstWaist.waistCm!)} cm`
                    : 'Sin comparación'}
                </span>
              </>
            ) : (
              <span className="progress-card__empty">Sin datos</span>
            )}
          </div>
        </article>
      </section>

      <span className="progress-section-label">Evolución</span>
      <section className="evolution-section">
        <button className="primary-button evolution-register-button" onClick={openCreate}>Registrar medición</button>
        <div className="evolution-period-selector" role="group" aria-label="Periodo de evolución">
          <PeriodButton label="1 semana" value="1w" selected={evolutionPeriod} onSelect={setEvolutionPeriod} />
          <PeriodButton label="1 mes" value="1m" selected={evolutionPeriod} onSelect={setEvolutionPeriod} />
          <PeriodButton label="6 meses" value="6m" selected={evolutionPeriod} onSelect={setEvolutionPeriod} />
          <PeriodButton label="Todo" value="all" selected={evolutionPeriod} onSelect={setEvolutionPeriod} />
        </div>
        <EvolutionCard title="Peso" unit="kg" period={evolutionPeriod} points={weightEvolution.points} trend={weightEvolution.trend} change={weightEvolution.change} target={goals.targetWeightKg} />
        <EvolutionCard title="Cintura" unit="cm" period={evolutionPeriod} points={waistEvolution.points} trend={waistEvolution.trend} change={waistEvolution.change} target={goals.targetWaistCm} />
      </section>

      <section className="progress-history">
        <div className="section-title">
          <span className="section-title__text">Historial</span>
        </div>
        <div className="progress-history__list">
          {sorted.length === 0 ? (
            <span className="progress-card__empty">Sin mediciones</span>
          ) : (
            sorted.map((item) => (
              <div className="progress-history__row" key={item.id}>
                <span className="progress-history__date">{formatDate(item.date)}</span>
                <span className="progress-history__value">{item.weightKg ? `${roundValue(item.weightKg)} kg` : '—'}</span>
                <span className="progress-history__value">{item.waistCm ? `${roundValue(item.waistCm)} cm` : '—'}</span>
                <span className="progress-history__actions">
                  <button className="icon-button" onClick={() => openEdit(item)} aria-label="Editar medición" title="Editar">✎</button>
                  <button className="icon-button icon-button--danger" onClick={() => deleteMeasurement(item.id)} aria-label="Eliminar medición" title="Eliminar">🗑</button>
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {modalOpen && (
        <div className="food-modal-backdrop">
          <div className="food-modal">
            <div className="food-modal__top">
              <span className="food-modal__title">Registrar medición</span>
              <button className="food-modal__close" onClick={closeModal}>×</button>
            </div>

            <div className="food-modal__form measurement-form">
              <div className="measurement-form__field">
                <label className="food-modal__label">Fecha</label>
                <input className="food-modal__quantity" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </div>

              <div className="measurement-form__field">
                <label className="food-modal__label">Peso (kg)</label>
                <input className="food-modal__quantity" type="number" min="0" step="0.1" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} placeholder="Opcional" />
              </div>

              <div className="measurement-form__field">
                <label className="food-modal__label">Cintura (cm)</label>
                <input className="food-modal__quantity" type="number" min="0" step="0.1" value={waistCm} onChange={(event) => setWaistCm(event.target.value)} placeholder="Opcional" />
              </div>

              {error && <span className="error-text">{error}</span>}

              <div className="food-modal__confirm">
                <button className="secondary-button" onClick={closeModal}>Cancelar</button>
                <button className="primary-button" onClick={saveMeasurement}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {goalsModalOpen && (
        <div className="food-modal-backdrop">
          <div className="food-modal goals-modal">
            <div className="food-modal__top">
              <span className="food-modal__title">Editar objetivos</span>
              <button className="food-modal__close" onClick={() => setGoalsModalOpen(false)}>×</button>
            </div>
            <div className="food-modal__form goals-form">
              <span className="goals-form__section-title">Datos físicos</span>
              <label className="food-modal__label">Sexo</label>
              <select className="food-modal__quantity" value={sex} onChange={(event) => setSex(event.target.value as UserGoals['sex'] | '')}>
                <option value="">Opcional</option>
                <option value="male">Hombre</option>
                <option value="female">Mujer</option>
              </select>
              <label className="food-modal__label">Fecha de nacimiento</label>
              <input className="food-modal__quantity" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
              <label className="food-modal__label">Altura (cm)</label>
              <input className="food-modal__quantity" inputMode="decimal" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} placeholder="Opcional" />

              <span className="goals-form__section-title">Objetivos</span>
              <label className="food-modal__label">Peso objetivo (kg)</label>
              <input className="food-modal__quantity" inputMode="decimal" value={targetWeightKg} onChange={(event) => setTargetWeightKg(event.target.value)} placeholder="Opcional" />
              <label className="food-modal__label">Cintura objetivo (cm)</label>
              <input className="food-modal__quantity" inputMode="decimal" value={targetWaistCm} onChange={(event) => setTargetWaistCm(event.target.value)} placeholder="Opcional" />
              <label className="food-modal__label">Déficit objetivo (kcal/día)</label>
              <input className="food-modal__quantity" inputMode="decimal" value={targetDeficitKcal} onChange={(event) => setTargetDeficitKcal(event.target.value)} placeholder="Opcional" />
              <label className="food-modal__label">Proteínas diarias (g)</label>
              <input className="food-modal__quantity" inputMode="decimal" value={targetProteinG} onChange={(event) => setTargetProteinG(event.target.value)} placeholder="Opcional" />
              <label className="food-modal__label">Hidratos diarios (g)</label>
              <input className="food-modal__quantity" inputMode="decimal" value={targetCarbsG} onChange={(event) => setTargetCarbsG(event.target.value)} placeholder="Opcional" />
              <label className="food-modal__label">Grasas diarias (g)</label>
              <input className="food-modal__quantity" inputMode="decimal" value={targetFatG} onChange={(event) => setTargetFatG(event.target.value)} placeholder="Opcional" />
              {goalsError && <span className="error-text">{goalsError}</span>}
              <div className="food-modal__confirm">
                <button className="secondary-button" onClick={() => setGoalsModalOpen(false)}>Cancelar</button>
                <button className="primary-button" onClick={saveGoals}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function GoalRow({ label, value }: { label: string; value: string }) {
  return <div className="goals-card__row"><span>{label}</span><strong>{value}</strong></div>
}

function PeriodButton({ label, value, selected, onSelect }: { label: string; value: ProgressPeriod; selected: ProgressPeriod; onSelect: (period: ProgressPeriod) => void }) {
  return <button className={selected === value ? 'is-selected' : ''} type="button" onClick={() => onSelect(value)}>{label}</button>
}

function EvolutionCard({ title, unit, period, points, trend, change, target }: {
  title: string
  unit: string
  period: ProgressPeriod
  points: ReturnType<typeof getMeasurementPoints>
  trend: ReturnType<typeof calculateMovingAverage>
  change: number | undefined
  target: number | undefined
}) {
  const latest = points.at(-1)
  const periodLabel = period === 'all' ? 'Desde inicio' : period === '1w' ? '1 semana' : period === '1m' ? '1 mes' : '6 meses'
  return (
    <article className="evolution-card">
      <span className="evolution-card__title">{title}</span>
      {points.length === 0 ? <span className="evolution-card__empty">Aún no hay datos suficientes.</span> : <>
        <div className="evolution-card__summary">
          <EvolutionMetric label="Actual" value={formatGoalValue(latest!.value, unit, 1)} />
          <EvolutionMetric label={periodLabel} value={change === undefined ? '—' : formatSignedValue(change, unit)} />
          <EvolutionMetric label="Objetivo" value={target === undefined ? '—' : formatGoalValue(target, unit, 1)} />
        </div>
        {points.length > 1 && <ProgressChart points={points} trend={trend} target={target} unit={unit} />}
      </>}
    </article>
  )
}

function EvolutionMetric({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>
}

function formatSignedValue(value: number, unit: string) {
  const formatted = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(value))
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatted} ${unit}`
}
