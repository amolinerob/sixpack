import { useEffect, useState } from 'react'
import { calculateBmr, getAgeAtDate, getLatestWeightForDate } from '../energy'
import { goalsRepository, measurementsRepository, profileRepository } from '../data/cloud/repositories'
import type { BodyMeasurement, User, UserGoals } from '../types'
import { ScreenHeader } from '../components/ScreenHeader'
import { useAuth } from '../auth/AuthProvider'
import { migrateLocalData, reviewLocalMigration, type MigrationResult, type MigrationReview } from '../migration/localToSupabase'
import { UserPreferencesSection } from '../components/UserPreferencesSection'
import type { useUserPreferences } from '../useUserPreferences'

function todayIsoLocal() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function formatDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString('es-ES') }
function format(value: number, unit: string) { return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(value)} ${unit}` }
function parse(value: string) { return value.trim() === '' ? undefined : Number(value.trim().replace(',', '.')) }

export function UsuarioScreen({ activeUser, onUserClick, onSignOut, preferences }: { activeUser: User; onUserClick: () => void; onSignOut: () => void; preferences: ReturnType<typeof useUserPreferences> }) {
  const [goals, setGoals] = useState<UserGoals>({})
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<Record<string, string>>({})
  const [migrationReview, setMigrationReview] = useState<MigrationReview | null>(null)
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null)
  const [migrationError, setMigrationError] = useState<string | null>(null)
  const [migrating, setMigrating] = useState(false)
  const { profile, legacyUserKey } = useAuth()
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
  function openEdit() { setForm({ sex: goals.sex ?? '', birthDate: goals.birthDate ?? '', heightCm: goals.heightCm?.toString() ?? '', targetWeightKg: goals.targetWeightKg?.toString() ?? '', targetWaistCm: goals.targetWaistCm?.toString() ?? '', targetDeficitKcal: goals.targetDeficitKcal?.toString() ?? '', targetProteinG: goals.targetProteinG?.toString() ?? '', targetCarbsG: goals.targetCarbsG?.toString() ?? '', targetFatG: goals.targetFatG?.toString() ?? '' }); setError(''); setEditing(true) }
  async function save() {
    const next: UserGoals = { ...goals, sex: form.sex as UserGoals['sex'] || undefined, birthDate: form.birthDate || undefined, heightCm: parse(form.heightCm), targetWeightKg: parse(form.targetWeightKg), targetWaistCm: parse(form.targetWaistCm), targetDeficitKcal: parse(form.targetDeficitKcal), targetProteinG: parse(form.targetProteinG), targetCarbsG: parse(form.targetCarbsG), targetFatG: parse(form.targetFatG) }
    const values = [next.heightCm, next.targetWeightKg, next.targetWaistCm, next.targetDeficitKcal, next.targetProteinG, next.targetCarbsG, next.targetFatG]
    if (values.some((value) => value !== undefined && (!Number.isFinite(value) || value <= 0))) { setError('Introduce valores positivos válidos.'); return }
    if (next.birthDate && getAgeAtDate(next.birthDate, today) === undefined) { setError('La fecha de nacimiento debe ser válida y anterior a hoy.'); return }
    try {
      await Promise.all([profileRepository.update(activeUser.id, { sex: next.sex, birthDate: next.birthDate, heightCm: next.heightCm }), goalsRepository.save(activeUser.id, next)])
      setGoals(next); setEditing(false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudieron guardar los datos.') }
  }
  function reviewMigration() { setMigrationReview(reviewLocalMigration(legacyUserKey ?? activeUser.id)); setMigrationResult(null); setMigrationError(null) }
  async function runMigration() {
    if (!profile?.id || !legacyUserKey || !window.confirm('Se copiarán los datos locales a Supabase. Los datos locales no se borrarán. ¿Continuar?')) return
    setMigrating(true); setMigrationError(null)
    try { setMigrationResult(await migrateLocalData({ userId: profile.id, legacyUserKey })) } catch { setMigrationError('No se pudo iniciar la migración.') } finally { setMigrating(false) }
  }
  return <section className="screen screen-usuario">
    <ScreenHeader title="USUARIO" user={activeUser} onUserClick={onUserClick} />{loading && <span className="progress-card__empty">Cargando usuario…</span>}
    <section className="physical-data-card"><div className="goals-card__top"><span className="goals-card__title">Datos físicos</span><button className="goals-card__edit" onClick={openEdit}>Editar datos físicos</button></div><div className="goals-card__list">{rows([['Sexo', goals.sex === 'male' ? 'Hombre' : goals.sex === 'female' ? 'Mujer' : undefined], ['Fecha nacimiento', goals.birthDate ? formatDate(goals.birthDate) : undefined], ['Altura', goals.heightCm !== undefined ? format(goals.heightCm, 'cm') : undefined], ['Peso actual', weight !== undefined ? format(weight, 'kg') : undefined], ['Metabolismo basal', bmr !== undefined ? format(Math.round(bmr), 'kcal/día') : undefined]])}</div></section>
    <section className="goals-card"><div className="goals-card__top"><span className="goals-card__title">Objetivos</span><button className="goals-card__edit" onClick={openEdit}>Editar objetivos</button></div><div className="goals-card__list">{rows([['Peso', goals.targetWeightKg !== undefined ? format(goals.targetWeightKg, 'kg') : undefined], ['Cintura', goals.targetWaistCm !== undefined ? format(goals.targetWaistCm, 'cm') : undefined], ['Déficit', goals.targetDeficitKcal !== undefined ? format(goals.targetDeficitKcal, 'kcal/día') : undefined], ['Proteína', goals.targetProteinG !== undefined ? format(goals.targetProteinG, 'g/día') : undefined], ['Hidratos', goals.targetCarbsG !== undefined ? format(goals.targetCarbsG, 'g/día') : undefined], ['Grasas', goals.targetFatG !== undefined ? format(goals.targetFatG, 'g/día') : undefined]])}</div></section>
    <UserPreferencesSection preferences={preferences} />
    <section className="goals-card cloud-migration">
      <span className="goals-card__title">Datos en la nube</span>
      {!migrationReview && <><span className="goals-card__empty">Datos locales pendientes de sincronizar.</span><button className="secondary-button" onClick={reviewMigration}>Revisar migración</button></>}
      {migrationReview && !migrationResult && <><div className="goals-card__list">{rows([['Perfil', 'Pendiente'], ['Objetivos', 'Pendiente'], ['Mediciones', String(migrationReview.measurements)], ['Actividades', String(migrationReview.activities)], ['Entradas de diario', String(migrationReview.diary)], ['Alimentos', String(migrationReview.foods)], ['Comidas', String(migrationReview.meals)]])}</div><button className="primary-button" disabled={migrating} onClick={() => void runMigration()}>{migrating ? 'Migrando…' : 'Migrar datos a Supabase'}</button></>}
      {migrationResult && <div className="goals-card__list"><strong>Migración completada</strong>{rows([['Perfil', 'OK'], ['Objetivos', 'OK'], ['Mediciones', String(migrationResult.measurements)], ['Actividades', String(migrationResult.activities)], ['Diario', String(migrationResult.diary)], ['Alimentos', String(migrationResult.foods)], ['Comidas', String(migrationResult.meals)]])}{migrationResult.errors.map((item) => <span className="error-text" key={item}>{item}</span>)}</div>}
      {migrationError && <span className="error-text">{migrationError}</span>}
    </section>
    <button className="secondary-button usuario-signout" onClick={onSignOut}>Cerrar sesión</button>
    {editing && <div className="food-modal-backdrop"><div className="food-modal goals-modal"><div className="food-modal__top"><span className="food-modal__title">Editar usuario</span><button className="food-modal__close" onClick={() => setEditing(false)}>×</button></div><div className="food-modal__form goals-form"><span className="goals-form__section-title">Datos físicos</span><label className="food-modal__label">Sexo</label><select className="food-modal__quantity" value={form.sex} onChange={(event) => setForm({ ...form, sex: event.target.value })}><option value="">Opcional</option><option value="male">Hombre</option><option value="female">Mujer</option></select><label className="food-modal__label">Fecha de nacimiento</label><input className="food-modal__quantity" type="date" value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} /><label className="food-modal__label">Altura (cm)</label><input className="food-modal__quantity" inputMode="decimal" value={form.heightCm} onChange={(event) => setForm({ ...form, heightCm: event.target.value })} /><span className="goals-form__section-title">Objetivos</span>{[['targetWeightKg','Peso objetivo (kg)'],['targetWaistCm','Cintura objetivo (cm)'],['targetDeficitKcal','Déficit objetivo (kcal/día)'],['targetProteinG','Proteínas diarias (g)'],['targetCarbsG','Hidratos diarios (g)'],['targetFatG','Grasas diarias (g)']].map(([key,label]) => <label key={key} className="usuario-form__field"><span className="food-modal__label">{label}</span><input className="food-modal__quantity" inputMode="decimal" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>)}{error && <span className="error-text">{error}</span>}<div className="food-modal__confirm"><button className="secondary-button" onClick={() => setEditing(false)}>Cancelar</button><button className="primary-button" onClick={save}>Guardar</button></div></div></div></div>}
  </section>
}
