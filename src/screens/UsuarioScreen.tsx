import { useState } from 'react'
import { calculateBmr, getAgeAtDate, getLatestWeightForDate } from '../energy'
import { loadBodyMeasurements, loadUserGoals, saveUserGoals } from '../storage'
import type { User, UserGoals } from '../types'
import { ScreenHeader } from '../components/ScreenHeader'

function todayIsoLocal() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function formatDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString('es-ES') }
function format(value: number, unit: string) { return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(value)} ${unit}` }
function parse(value: string) { return value.trim() === '' ? undefined : Number(value.trim().replace(',', '.')) }

export function UsuarioScreen({ activeUser, onUserClick }: { activeUser: User; onUserClick: () => void }) {
  const [goals, setGoals] = useState<UserGoals>(() => loadUserGoals(activeUser.id))
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<Record<string, string>>({})
  const today = todayIsoLocal()
  const weight = getLatestWeightForDate(loadBodyMeasurements(activeUser.id), today)
  const age = getAgeAtDate(goals.birthDate, today)
  const bmr = weight !== undefined && age !== undefined && goals.heightCm !== undefined ? calculateBmr({ sex: goals.sex, weightKg: weight, heightCm: goals.heightCm, age }) : undefined
  const rows = (items: Array<[string, string | undefined]>) => items.map(([label, value]) => value && <div className="goals-card__row" key={label}><span>{label}</span><strong>{value}</strong></div>)
  function openEdit() { setForm({ sex: goals.sex ?? '', birthDate: goals.birthDate ?? '', heightCm: goals.heightCm?.toString() ?? '', targetWeightKg: goals.targetWeightKg?.toString() ?? '', targetWaistCm: goals.targetWaistCm?.toString() ?? '', targetDeficitKcal: goals.targetDeficitKcal?.toString() ?? '', targetProteinG: goals.targetProteinG?.toString() ?? '', targetCarbsG: goals.targetCarbsG?.toString() ?? '', targetFatG: goals.targetFatG?.toString() ?? '' }); setError(''); setEditing(true) }
  function save() {
    const next: UserGoals = { ...goals, sex: form.sex as UserGoals['sex'] || undefined, birthDate: form.birthDate || undefined, heightCm: parse(form.heightCm), targetWeightKg: parse(form.targetWeightKg), targetWaistCm: parse(form.targetWaistCm), targetDeficitKcal: parse(form.targetDeficitKcal), targetProteinG: parse(form.targetProteinG), targetCarbsG: parse(form.targetCarbsG), targetFatG: parse(form.targetFatG) }
    const values = [next.heightCm, next.targetWeightKg, next.targetWaistCm, next.targetDeficitKcal, next.targetProteinG, next.targetCarbsG, next.targetFatG]
    if (values.some((value) => value !== undefined && (!Number.isFinite(value) || value <= 0))) { setError('Introduce valores positivos válidos.'); return }
    if (next.birthDate && getAgeAtDate(next.birthDate, today) === undefined) { setError('La fecha de nacimiento debe ser válida y anterior a hoy.'); return }
    setGoals(next); saveUserGoals(activeUser.id, next); setEditing(false)
  }
  return <section className="screen screen-usuario">
    <ScreenHeader title="USUARIO" user={activeUser} onUserClick={onUserClick} />
    <section className="physical-data-card"><div className="goals-card__top"><span className="goals-card__title">Datos físicos</span><button className="goals-card__edit" onClick={openEdit}>Editar datos físicos</button></div><div className="goals-card__list">{rows([['Sexo', goals.sex === 'male' ? 'Hombre' : goals.sex === 'female' ? 'Mujer' : undefined], ['Fecha nacimiento', goals.birthDate ? formatDate(goals.birthDate) : undefined], ['Altura', goals.heightCm !== undefined ? format(goals.heightCm, 'cm') : undefined], ['Peso actual', weight !== undefined ? format(weight, 'kg') : undefined], ['Metabolismo basal', bmr !== undefined ? format(Math.round(bmr), 'kcal/día') : undefined]])}</div></section>
    <section className="goals-card"><div className="goals-card__top"><span className="goals-card__title">Objetivos</span><button className="goals-card__edit" onClick={openEdit}>Editar objetivos</button></div><div className="goals-card__list">{rows([['Peso', goals.targetWeightKg !== undefined ? format(goals.targetWeightKg, 'kg') : undefined], ['Cintura', goals.targetWaistCm !== undefined ? format(goals.targetWaistCm, 'cm') : undefined], ['Déficit', goals.targetDeficitKcal !== undefined ? format(goals.targetDeficitKcal, 'kcal/día') : undefined], ['Proteína', goals.targetProteinG !== undefined ? format(goals.targetProteinG, 'g/día') : undefined], ['Hidratos', goals.targetCarbsG !== undefined ? format(goals.targetCarbsG, 'g/día') : undefined], ['Grasas', goals.targetFatG !== undefined ? format(goals.targetFatG, 'g/día') : undefined]])}</div></section>
    {editing && <div className="food-modal-backdrop"><div className="food-modal goals-modal"><div className="food-modal__top"><span className="food-modal__title">Editar usuario</span><button className="food-modal__close" onClick={() => setEditing(false)}>×</button></div><div className="food-modal__form goals-form"><span className="goals-form__section-title">Datos físicos</span><label className="food-modal__label">Sexo</label><select className="food-modal__quantity" value={form.sex} onChange={(event) => setForm({ ...form, sex: event.target.value })}><option value="">Opcional</option><option value="male">Hombre</option><option value="female">Mujer</option></select><label className="food-modal__label">Fecha de nacimiento</label><input className="food-modal__quantity" type="date" value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} /><label className="food-modal__label">Altura (cm)</label><input className="food-modal__quantity" inputMode="decimal" value={form.heightCm} onChange={(event) => setForm({ ...form, heightCm: event.target.value })} /><span className="goals-form__section-title">Objetivos</span>{[['targetWeightKg','Peso objetivo (kg)'],['targetWaistCm','Cintura objetivo (cm)'],['targetDeficitKcal','Déficit objetivo (kcal/día)'],['targetProteinG','Proteínas diarias (g)'],['targetCarbsG','Hidratos diarios (g)'],['targetFatG','Grasas diarias (g)']].map(([key,label]) => <label key={key} className="usuario-form__field"><span className="food-modal__label">{label}</span><input className="food-modal__quantity" inputMode="decimal" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>)}{error && <span className="error-text">{error}</span>}<div className="food-modal__confirm"><button className="secondary-button" onClick={() => setEditing(false)}>Cancelar</button><button className="primary-button" onClick={save}>Guardar</button></div></div></div></div>}
  </section>
}
