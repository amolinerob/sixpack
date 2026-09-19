import { useEffect, useState } from 'react'
import { calculateBmr, getAgeAtDate, getLatestWeightForDate } from '../energy'
import { goalsRepository, measurementsRepository, profileRepository } from '../data/cloud/repositories'
import type { BodyMeasurement, User, UserGoals } from '../types'
import { ScreenHeader } from '../components/ScreenHeader'
import { UserPreferencesSection } from '../components/UserPreferencesSection'
import type { useUserPreferences } from '../useUserPreferences'

function todayIsoLocal() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function formatDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString('es-ES') }
function format(value: number, unit: string) { return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(value)} ${unit}` }
type EditorMode = 'physical' | 'goals'
const goalFields = [
  ['targetWeightKg', 'Peso objetivo (kg)'],
  ['targetWaistCm', 'Cintura objetivo (cm)'],
  ['targetDeficitKcal', 'Déficit objetivo (kcal/día)'],
  ['targetProteinG', 'Proteínas diarias (g)'],
  ['targetCarbsG', 'Hidratos diarios (g)'],
  ['targetFatG', 'Grasas diarias (g)'],
] as const

function parse(value: string) { return value.trim() === '' ? undefined : Number(value.trim().replace(',', '.')) }

export function UsuarioScreen({ activeUser, onUserClick, onSignOut, preferences }: { activeUser: User; onUserClick: () => void; onSignOut: () => void; preferences: ReturnType<typeof useUserPreferences> }) {
  const [goals, setGoals] = useState<UserGoals>({})
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EditorMode | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<Record<string, string>>({})
  const today = todayIsoLocal()
  const weight = getLatestWeightForDate(measurements, today)
  const age = getAgeAtDate(goals.birthDate, today)
  const bmr = weight !== undefined && age !== undefined && goals.heightCm !== undefined ? calculateBmr({ sex: goals.sex, weightKg: weight, heightCm: goals.heightCm, age }) : undefined
  const rows = (items: Array<[string, string | undefined]>) => items.map(([label, value]) => value && <div className="goals-card__row" key={label}><span>{label}</span><strong>{value}</strong></div>)
  useEffect(() => {
    let active = true
    Promise.all([goalsRepository.get(activeUser.id), measurementsRepository.list(activeUser.id), profileRepository.get(activeUser.id)])
      .then(([cloudGoals, cloudMeasurements, cloudProfile]) => { if (active) { setGoals({ ...cloudGoals, sex: cloudProfile.sex, birthDate: cloudProfile.birthDate, heightCm: cloudProfile.heightCm }); setMeasurements(cloudMeasurements) } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los datos del usuario.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [activeUser.id])
  function openEdit(mode: EditorMode) {
    setForm(mode === 'physical'
      ? { sex: goals.sex ?? '', birthDate: goals.birthDate ?? '', heightCm: goals.heightCm?.toString() ?? '' }
      : Object.fromEntries(goalFields.map(([key]) => [key, goals[key]?.toString() ?? ''])))
    setError('')
    setEditing(mode)
  }
  function closeEdit() { setEditing(null); setError('') }
  async function save() {
    if (!editing || saving) return
    const next: UserGoals = editing === 'physical'
      ? { sex: form.sex as UserGoals['sex'] || undefined, birthDate: form.birthDate || undefined, heightCm: parse(form.heightCm) }
      : Object.fromEntries(goalFields.map(([key]) => [key, parse(form[key])]))
    const values = editing === 'physical' ? [next.heightCm] : goalFields.map(([key]) => next[key])
    if (values.some((value) => value !== undefined && (!Number.isFinite(value) || value <= 0))) { setError('Introduce valores positivos válidos.'); return }
    if (editing === 'physical' && next.birthDate && getAgeAtDate(next.birthDate, today) === undefined) { setError('La fecha de nacimiento debe ser válida y anterior a hoy.'); return }
    setSaving(true)
    setError('')
    try {
      if (editing === 'physical') {
        await profileRepository.update(activeUser.id, { sex: next.sex, birthDate: next.birthDate, heightCm: next.heightCm })
      } else {
        await goalsRepository.save(activeUser.id, next)
      }
      setGoals((current) => ({ ...current, ...next }))
      closeEdit()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudieron guardar los datos.') }
    finally { setSaving(false) }
  }
  return <section className="screen screen-usuario">
    <ScreenHeader title="USUARIO" user={activeUser} onUserClick={onUserClick} />{loading && <span className="progress-card__empty">Cargando usuario…</span>}
    <section className="physical-data-card"><div className="goals-card__top"><span className="goals-card__title">Datos físicos</span><button className="goals-card__edit" disabled={loading} onClick={() => openEdit('physical')}>Editar datos físicos</button></div><div className="goals-card__list">{rows([['Sexo', goals.sex === 'male' ? 'Hombre' : goals.sex === 'female' ? 'Mujer' : undefined], ['Fecha nacimiento', goals.birthDate ? formatDate(goals.birthDate) : undefined], ['Altura', goals.heightCm !== undefined ? format(goals.heightCm, 'cm') : undefined], ['Peso actual', weight !== undefined ? format(weight, 'kg') : undefined], ['Metabolismo basal', bmr !== undefined ? format(Math.round(bmr), 'kcal/día') : undefined]])}</div></section>
    <section className="goals-card"><div className="goals-card__top"><span className="goals-card__title">Objetivos</span><button className="goals-card__edit" disabled={loading} onClick={() => openEdit('goals')}>Editar objetivos</button></div><div className="goals-card__list">{rows([['Peso', goals.targetWeightKg !== undefined ? format(goals.targetWeightKg, 'kg') : undefined], ['Cintura', goals.targetWaistCm !== undefined ? format(goals.targetWaistCm, 'cm') : undefined], ['Déficit', goals.targetDeficitKcal !== undefined ? format(goals.targetDeficitKcal, 'kcal/día') : undefined], ['Proteína', goals.targetProteinG !== undefined ? format(goals.targetProteinG, 'g/día') : undefined], ['Hidratos', goals.targetCarbsG !== undefined ? format(goals.targetCarbsG, 'g/día') : undefined], ['Grasas', goals.targetFatG !== undefined ? format(goals.targetFatG, 'g/día') : undefined]])}</div></section>
    <UserPreferencesSection preferences={preferences} />
    <button className="secondary-button usuario-signout" onClick={onSignOut}>Cerrar sesión</button>
    {editing && <div className="food-modal-backdrop">
      <div className="food-modal goals-modal">
        <div className="food-modal__top">
          <span className="food-modal__title">{editing === 'physical' ? 'Editar datos físicos' : 'Editar objetivos'}</span>
          <button className="food-modal__close" disabled={saving} onClick={closeEdit}>×</button>
        </div>
        <div className="food-modal__form goals-form">
          {editing === 'physical' ? <>
            <label className="food-modal__label" htmlFor="physical-sex">Sexo</label>
            <select id="physical-sex" className="food-modal__quantity" disabled={saving} value={form.sex} onChange={(event) => setForm({ ...form, sex: event.target.value })}>
              <option value="">Opcional</option><option value="male">Hombre</option><option value="female">Mujer</option>
            </select>
            <label className="food-modal__label" htmlFor="physical-birth-date">Fecha de nacimiento</label>
            <input id="physical-birth-date" className="food-modal__quantity" type="date" disabled={saving} value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} />
            <label className="food-modal__label" htmlFor="physical-height">Altura (cm)</label>
            <input id="physical-height" className="food-modal__quantity" inputMode="decimal" disabled={saving} value={form.heightCm} onChange={(event) => setForm({ ...form, heightCm: event.target.value })} />
          </> : goalFields.map(([key, label]) => <label key={key} className="usuario-form__field">
            <span className="food-modal__label">{label}</span>
            <input className="food-modal__quantity" inputMode="decimal" disabled={saving} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
          </label>)}
          {error && <span className="error-text">{error}</span>}
          <div className="food-modal__confirm">
            <button className="secondary-button" disabled={saving} onClick={closeEdit}>Cancelar</button>
            <button className="primary-button" disabled={saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </div>
      </div>
    </div>}
  </section>
}
