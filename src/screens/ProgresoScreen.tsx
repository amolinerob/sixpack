import { useMemo, useState } from 'react'
import { loadBodyMeasurements, saveBodyMeasurements } from '../storage'
import type { BodyMeasurement, User } from '../types'

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

export function ProgresoScreen({ activeUser }: { activeUser: User }) {
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>(() => loadBodyMeasurements(activeUser.id))
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [date, setDate] = useState(todayIsoLocal())
  const [weightKg, setWeightKg] = useState('')
  const [waistCm, setWaistCm] = useState('')
  const [error, setError] = useState('')

  const sorted = useMemo(() => {
    return [...measurements].sort((a, b) => b.date.localeCompare(a.date))
  }, [measurements])

  const latestWeight = sorted.find((m) => m.weightKg !== undefined)
  const latestWaist = sorted.find((m) => m.waistCm !== undefined)
  const firstWeight = sorted.find((m) => m.weightKg !== undefined)
  const firstWaist = sorted.find((m) => m.waistCm !== undefined)

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
      <section className="app-header app-header--simple">
        <div>
          <span className="app-kicker">Progreso</span>
          <h1 className="app-title">Progreso</h1>
        </div>
      </section>

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

      <section className="progress-controls">
        <button className="primary-button" onClick={openCreate}>+ Registrar medición</button>
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

            <div className="food-modal__form">
              <label className="food-modal__label">Fecha</label>
              <input className="food-modal__quantity" type="date" value={date} onChange={(event) => setDate(event.target.value)} />

              <label className="food-modal__label">Peso (kg)</label>
              <input className="food-modal__quantity" type="number" min="0" step="0.1" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} placeholder="Opcional" />

              <label className="food-modal__label">Cintura (cm)</label>
              <input className="food-modal__quantity" type="number" min="0" step="0.1" value={waistCm} onChange={(event) => setWaistCm(event.target.value)} placeholder="Opcional" />

              {error && <span className="error-text">{error}</span>}

              <div className="food-modal__confirm">
                <button className="secondary-button" onClick={closeModal}>Cancelar</button>
                <button className="primary-button" onClick={saveMeasurement}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
