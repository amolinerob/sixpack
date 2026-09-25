import { useEffect, useMemo, useState } from 'react'
import { ProgressChart } from '../components/ProgressChart'
import { WeeklyMacrosChart } from '../components/WeeklyMacrosChart'
import { WeeklyActivityChart } from '../components/WeeklyActivityChart'
import { WeeklyCoachReport } from '../components/WeeklyCoachReport'
import { getWeeklyActivitySeries } from '../weeklyActivitySeries'
import { calculateMovingAverage, calculatePeriodChange, filterPointsByPeriod, getMeasurementPoints, type ProgressPeriod } from '../progressSeries'
import { createWeeklySummary, getWeekRange, type WeekSummary } from '../weeklySummary'
import { activitiesRepository, diaryRepository, goalsRepository, measurementsRepository, profileRepository } from '../data/cloud/repositories'
import type { ActivityEntry, BodyMeasurement, FoodDiaryEntry, User, UserGoals } from '../types'
import { ScreenHeader } from '../components/ScreenHeader'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { IconActionButton } from '../components/ActionIcon'

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

function formatMonth(monthKey: string) {
  const label = new Date(`${monthKey}-01T12:00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
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

export function ProgresoScreen({ activeUser, onUserClick }: { activeUser: User; onUserClick: () => void }) {
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([])
  const [goals, setGoals] = useState<UserGoals>({})
  const [entries, setEntries] = useState<FoodDiaryEntry[]>([])
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [date, setDate] = useState(todayIsoLocal())
  const [weightKg, setWeightKg] = useState('')
  const [waistCm, setWaistCm] = useState('')
  const [error, setError] = useState('')
  const [evolutionPeriod, setEvolutionPeriod] = useState<ProgressPeriod>('1w')
  const [weekOffset, setWeekOffset] = useState(0)
  const [historyMonth, setHistoryMonth] = useState(() => todayIsoLocal().slice(0, 7))
  const [pendingMeasurementDeleteId, setPendingMeasurementDeleteId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([measurementsRepository.list(activeUser.id), goalsRepository.get(activeUser.id), diaryRepository.list(activeUser.id), activitiesRepository.list(activeUser.id), profileRepository.get(activeUser.id)])
      .then(([nextMeasurements, nextGoals, nextEntries, nextActivities, profile]) => {
        if (active) {
          setMeasurements(nextMeasurements)
          setGoals({ ...nextGoals, sex: profile.sex, birthDate: profile.birthDate, heightCm: profile.heightCm })
          setEntries(nextEntries)
          setActivities(nextActivities)
          setLoadError('')
        }
      })
      .catch((reason: unknown) => { if (active) setLoadError(reason instanceof Error ? reason.message : 'No se pudo cargar el progreso.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [activeUser.id])

  const sorted = useMemo(() => {
    return [...measurements].sort((a, b) => b.date.localeCompare(a.date))
  }, [measurements])

  const currentMonth = todayIsoLocal().slice(0, 7)
  const historyMonths = [...new Set([currentMonth, historyMonth, ...measurements.map((item) => item.date.slice(0, 7))])]
    .sort((a, b) => b.localeCompare(a))
  const historyMeasurements = sorted.filter((item) => item.date.slice(0, 7) === historyMonth)

  const latestWeight = sorted.find((m) => m.weightKg !== undefined)
  const latestWaist = sorted.find((m) => m.waistCm !== undefined)
  const firstWeight = [...sorted].reverse().find((m) => m.weightKg !== undefined)
  const firstWaist = [...sorted].reverse().find((m) => m.waistCm !== undefined)
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
  const weeklySummary = useMemo(() => {
    const today = todayIsoLocal()
    return createWeeklySummary({
      range: getWeekRange(today, weekOffset),
      today,
      entries,
      activities,
      measurements,
      goals,
    })
  }, [activities, entries, goals, measurements, weekOffset])

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

  async function saveMeasurement() {
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

    const payload = {
      date,
      weightKg: weightValue,
      waistCm: waistValue,
    }
    try {
      const saved = await measurementsRepository.save(activeUser.id, payload, editingId ?? undefined)
      setMeasurements((current) => editingId ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved])
      closeModal()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar la medición.') }
  }

  async function deleteMeasurement(id: string) {
    try {
      await measurementsRepository.remove(id)
      setMeasurements((current) => current.filter((item) => item.id !== id))
      return true
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo eliminar la medición.'); return false }
  }

  async function confirmMeasurementDelete() {
    if (!pendingMeasurementDeleteId) return
    if (await deleteMeasurement(pendingMeasurementDeleteId)) setPendingMeasurementDeleteId(null)
  }

  return (
    <section className="screen screen-progreso">
      <ScreenHeader title="PROGRESO" user={activeUser} onUserClick={onUserClick} />
      {loading && <span className="progress-card__empty">Cargando progreso…</span>}
      {loadError && <span className="error-text">{loadError}</span>}

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

      <span className="progress-section-label">Resumen semanal</span>
      <section className="weekly-summary">
        <div className="weekly-summary__navigation">
          <button type="button" onClick={() => setWeekOffset((offset) => offset - 1)} aria-label="Semana anterior">‹</button>
          <span>{formatWeekRange(weeklySummary.range)}</span>
          <button type="button" onClick={() => setWeekOffset((offset) => Math.min(0, offset + 1))} disabled={weekOffset === 0} aria-label="Semana siguiente">›</button>
        </div>
        <WeeklyEnergyCard summary={weeklySummary} goals={goals} />
        <WeeklyNutritionCard summary={weeklySummary} goals={goals} />
        <WeeklyMacrosChart summary={weeklySummary} goals={goals} />
        <WeeklyActivityCard summary={weeklySummary} />
        <WeeklyActivityChart key={weeklySummary.range.start} data={getWeeklyActivitySeries(weeklySummary)} />
        <WeeklyBodyCard summary={weeklySummary} />
        <WeeklyDays summary={weeklySummary} />
        {!loading && !loadError && <WeeklyCoachReport key={`${activeUser.id}:${weeklySummary.range.start}`} summary={weeklySummary} goals={goals} entries={entries} activities={activities} measurements={measurements} />}
      </section>

      <section className="progress-history">
        <div className="section-title progress-history__header">
          <span className="section-title__text">Historial</span>
          <select className="progress-history__month" aria-label="Mes del historial" value={historyMonth} onChange={(event) => setHistoryMonth(event.target.value)}>
            {historyMonths.map((month) => <option key={month} value={month}>{formatMonth(month)}</option>)}
          </select>
        </div>
        <div className="progress-history__list">
          {historyMeasurements.length === 0 ? (
            <span className="progress-card__empty">Sin registros este mes</span>
          ) : (
            historyMeasurements.map((item) => (
              <div className="progress-history__row" key={item.id}>
                <div className="progress-history__content">
                <span className="progress-history__date">{formatDate(item.date)}</span>
                <span className="progress-history__value">{item.weightKg ? `${roundValue(item.weightKg)} kg` : '—'}</span>
                <span className="progress-history__value">{item.waistCm ? `${roundValue(item.waistCm)} cm` : '—'}</span>
                </div>
                <span className="row-actions">
                  <IconActionButton name="edit" ariaLabel="Editar medición" onClick={() => openEdit(item)} />
                  <IconActionButton name="delete" ariaLabel="Eliminar medición" onClick={() => { setError(''); setPendingMeasurementDeleteId(item.id) }} />
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
      {pendingMeasurementDeleteId && <ConfirmDialog
        title="Confirmar eliminación"
        message="¿Seguro que quieres eliminar esta medición de peso/cintura?"
        error={error}
        onCancel={() => setPendingMeasurementDeleteId(null)}
        onConfirm={() => void confirmMeasurementDelete()}
      />}

    </section>
  )
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

function formatWeekRange(range: { start: string; end: string }) {
  const start = new Date(`${range.start}T12:00:00`)
  const end = new Date(`${range.end}T12:00:00`)
  const startLabel = start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  const endLabel = end.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  return `${startLabel}–${endLabel}`
}

function WeeklyEnergyCard({ summary, goals }: { summary: WeekSummary; goals: UserGoals }) {
  const target = goals.targetDeficitKcal === undefined ? undefined : goals.targetDeficitKcal * summary.dayCount
  const percentage = summary.energyComplete && target && target > 0 ? (summary.totalDeficit / target) * 100 : undefined
  return <article className="weekly-card">
    <span className="weekly-card__title">Balance energético</span>
    <WeeklyRow label="Ingerido" value={formatKcal(summary.sum.kcal)} />
    <WeeklyRow label="Gasto estimado" value={summary.calculated.length ? `${formatKcal(summary.totalExpenditure)}${summary.energyComplete ? '' : ' (incompleto)'}` : '—'} />
    <WeeklyRow label={!summary.energyComplete || summary.totalDeficit >= 0 ? 'Déficit acumulado' : 'Superávit acumulado'} value={summary.energyComplete ? formatKcal(Math.abs(summary.totalDeficit)) : '—'} />
    <WeeklyRow label="Media diaria" value={summary.energyComplete ? formatKcal(summary.totalDeficit / summary.dayCount) : '—'} />
    {target !== undefined && <><WeeklyRow label="Objetivo semanal" value={formatKcal(target)} /><div className="weekly-progress"><span style={{ width: `${Math.min(Math.max(percentage ?? 0, 0), 100)}%` }} /><strong>{percentage === undefined ? '—' : `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(percentage)}%`}</strong></div></>}
  </article>
}

function WeeklyNutritionCard({ summary, goals }: { summary: WeekSummary; goals: UserGoals }) {
  const divisor = summary.dayCount || 1
  return <article className="weekly-card"><span className="weekly-card__title">Nutrición</span>
    <WeeklyMacro label="Proteína" value={summary.sum.protein / divisor} target={goals.targetProteinG} />
    <WeeklyMacro label="Hidratos" value={summary.sum.carbs / divisor} target={goals.targetCarbsG} />
    <WeeklyMacro label="Grasas" value={summary.sum.fat / divisor} target={goals.targetFatG} />
  </article>
}

function WeeklyActivityCard({ summary }: { summary: WeekSummary }) {
  const activityCount = summary.days.reduce((total, day) => total + day.activities.length, 0)
  const types = summary.days.flatMap((day) => day.activities).reduce<Record<string, number>>((total, activity) => ({ ...total, [activity.type]: (total[activity.type] ?? 0) + 1 }), {})
  return <article className="weekly-card"><span className="weekly-card__title">Actividad</span>
    <WeeklyRow label="Kcal activas" value={formatKcal(summary.sum.activeCalories)} /><WeeklyRow label="Media diaria" value={formatKcal(summary.sum.activeCalories / (summary.dayCount || 1))} /><WeeklyRow label="Actividades" value={String(activityCount)} />
    {Object.entries(types).map(([type, count]) => <WeeklyRow key={type} label={type} value={`${count} sesiones`} />)}
  </article>
}

function WeeklyBodyCard({ summary }: { summary: WeekSummary }) {
  const values = (field: 'weightKg' | 'waistCm') => summary.weekMeasurements.filter((measurement) => measurement[field] !== undefined).sort((a, b) => a.date.localeCompare(b.date))
  const weight = values('weightKg')
  const waist = values('waistCm')
  return <article className="weekly-card"><span className="weekly-card__title">Cambio corporal</span>
    <WeeklyBodyRow label="Peso" values={weight.map((item) => item.weightKg!)} unit="kg" /><WeeklyBodyRow label="Cintura" values={waist.map((item) => item.waistCm!)} unit="cm" />
  </article>
}

function WeeklyDays({ summary }: { summary: WeekSummary }) {
  const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
  return <article className="weekly-card weekly-days"><span className="weekly-card__title">Días</span><div>{labels.map((label, index) => {
    const day = summary.days[index]
    const balance = day?.energy?.estimatedDeficit
    return <span key={label}><b>{label}</b><small>{balance === undefined ? '—' : `${balance >= 0 ? '-' : '+'}${Math.round(Math.abs(balance))}`}</small></span>
  })}</div></article>
}

function WeeklyRow({ label, value }: { label: string; value: string }) { return <div className="weekly-card__row"><span>{label}</span><strong>{value}</strong></div> }
function WeeklyMacro({ label, value, target }: { label: string; value: number; target?: number }) { const percent = target ? Math.round((value / target) * 100) : undefined; return <WeeklyRow label={label} value={target ? `${formatGoalValue(value, 'g')} / ${formatGoalValue(target, 'g')} · ${percent}%` : `${formatGoalValue(value, 'g')}/día`} /> }
function WeeklyBodyRow({ label, values, unit }: { label: string; values: number[]; unit: string }) { if (!values.length) return <WeeklyRow label={label} value="Sin mediciones esta semana" />; if (values.length === 1) return <WeeklyRow label={label} value={formatGoalValue(values[0], unit, 1)} />; return <WeeklyRow label={label} value={`${formatGoalValue(values[0], unit, 1)} → ${formatGoalValue(values.at(-1)!, unit, 1)} · ${formatSignedValue(values.at(-1)! - values[0], unit)}`} /> }
function formatKcal(value: number) { return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(Math.round(value))} kcal` }
