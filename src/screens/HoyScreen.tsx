import { useEffect, useMemo, useState } from 'react'
import { foods } from '../data/foods'
import { loadActivities, loadEntries, saveActivities, saveEntries } from '../storage'
import { ACTIVITY_TYPES, MEALS, type ActivityEntry, type ActivityType, type FoodDiaryEntry, type MealName, type User } from '../types'

function todayIsoLocal(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateOffset(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00`)
  date.setDate(date.getDate() + days)
  return todayIsoLocal(date)
}

function getServingGramsInitial(food: (typeof foods)[number]) {
  if (food.servingUnit === 'g' && food.servingGrams !== null) {
    return food.servingGrams
  }

  return null
}

function getFoodById(foodId: string) {
  return foods.find((food) => food.id === foodId) ?? foods[0]
}

export function HoyScreen({ activeUser }: { activeUser: User }) {
  const [selectedDate, setSelectedDate] = useState(todayIsoLocal())
  const [entries, setEntries] = useState<FoodDiaryEntry[]>(() => loadEntries(activeUser.id))
  const [activities, setActivities] = useState<ActivityEntry[]>(() => loadActivities(activeUser.id))
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [activityModalOpen, setActivityModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)
  const [searchName, setSearchName] = useState('')
  const [selectedFoodId, setSelectedFoodId] = useState(foods[0]?.id ?? '')
  const [quantityGrams, setQuantityGrams] = useState<number>(
    getServingGramsInitial(getFoodById(foods[0]?.id ?? '')) ?? 100,
  )
  const [draftMeal, setDraftMeal] = useState<MealName>('Desayuno')
  const [activityType, setActivityType] = useState<ActivityType>('CrossFit')
  const [activityMinutes, setActivityMinutes] = useState<number>(60)
  const [activityCalories, setActivityCalories] = useState<number>(0)
  const [activityNotes, setActivityNotes] = useState('')

  useEffect(() => {
    setEntries(loadEntries(activeUser.id))
    setActivities(loadActivities(activeUser.id))
  }, [activeUser.id])

  const selectedFood = useMemo(
    () => foods.find((food) => food.id === selectedFoodId) ?? foods[0],
    [selectedFoodId],
  )

  const dateEntries = useMemo(
    () => entries.filter((entry) => entry.date === selectedDate),
    [entries, selectedDate],
  )

  const dateActivities = useMemo(
    () => activities.filter((activity) => activity.date === selectedDate),
    [activities, selectedDate],
  )

  const activityTotal = useMemo(() => {
    return dateActivities.reduce((sum, activity) => sum + activity.calories, 0)
  }, [dateActivities])

  const totals = useMemo(() => {
    return dateEntries.reduce(
      (acc, entry) => {
        acc.kcal += entry.kcal
        acc.protein += entry.protein
        acc.carbs += entry.carbs
        acc.fat += entry.fat
        return acc
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    )
  }, [dateEntries])

  function openSelector(meal: MealName) {
    const food = foods[0]
    const firstQuantity = getServingGramsInitial(food)
    setDraftMeal(meal)
    setSelectedFoodId(food.id)
    setQuantityGrams(firstQuantity ?? 100)
    setSearchName('')
    setEditingId(null)
    setSelectorOpen(true)
  }

  function openEditor(entry: FoodDiaryEntry) {
    const food = getFoodById(entry.foodId)
    setEditingId(entry.id)
    setDraftMeal(entry.meal)
    setSelectedFoodId(food.id)
    setQuantityGrams(entry.quantityGrams)
    setSelectorOpen(true)
  }

  function closeSelector() {
    setSelectorOpen(false)
    setSearchName('')
  }

  function syncQuantityToSelectedFood(foodId: string, fallbackQuantity = 100) {
    const food = getFoodById(foodId)
    const serving = getServingGramsInitial(food)
    setSelectedFoodId(food.id)
    setQuantityGrams(serving ?? fallbackQuantity)
  }

  function confirmEntry() {
    const food = getFoodById(selectedFoodId)
    const quantity = Math.max(0, quantityGrams)
    const kcal = (food.kcal100g / 100) * quantity
    const protein = (food.protein100g / 100) * quantity
    const carbs = (food.carbs100g / 100) * quantity
    const fat = (food.fat100g / 100) * quantity

    if (editingId) {
      const target = entries.find((entry) => entry.id === editingId)
      if (!target) {
        return
      }

      const next = entries.map((entry) => {
        if (entry.id !== editingId) {
          return entry
        }

        return {
          ...entry,
          foodId: food.id,
          meal: draftMeal,
          quantityGrams: quantity,
          quantityUnit: food.servingUnit ?? 'g',
          kcal: round(kcal),
          protein: round(protein),
          carbs: round(carbs),
          fat: round(fat),
        }
      })

      setEntries(next)
      saveEntries(activeUser.id, next)
    } else {
      const next: FoodDiaryEntry = {
        id: `${Date.now()}-${Math.round(Math.random() * 10000)}`,
        foodId: food.id,
        date: selectedDate,
        meal: draftMeal,
        quantityGrams: quantity,
        quantityUnit: food.servingUnit ?? 'g',
        kcal: round(kcal),
        protein: round(protein),
        carbs: round(carbs),
        fat: round(fat),
        createdAt: new Date().toISOString(),
      }

      const nextEntries = [...entries, next]
      setEntries(nextEntries)
      saveEntries(activeUser.id, nextEntries)
    }

    closeSelector()
  }

  function deleteEntry(entryId: string) {
    const next = entries.filter((entry) => entry.id !== entryId)
    setEntries(next)
    saveEntries(activeUser.id, next)
  }

  function openActivityEditor(activity: ActivityEntry) {
    setEditingActivityId(activity.id)
    setActivityType(activity.type)
    setActivityMinutes(activity.durationMinutes)
    setActivityCalories(activity.calories)
    setActivityNotes(activity.notes)
    setActivityModalOpen(true)
  }

  function deleteActivity(activityId: string) {
    const next = activities.filter((activity) => activity.id !== activityId)
    setActivities(next)
    saveActivities(activeUser.id, next)
  }

  function confirmActivity() {
    const cleanMinutes = Math.max(0, activityMinutes)
    const cleanCalories = Math.max(0, activityCalories)

    if (editingActivityId) {
      const next = activities.map((activity) => {
        if (activity.id !== editingActivityId) {
          return activity
        }

        return {
          ...activity,
          date: selectedDate,
          type: activityType,
          durationMinutes: cleanMinutes,
          calories: cleanCalories,
          notes: activityNotes.trim(),
        }
      })

      setActivities(next)
      saveActivities(activeUser.id, next)
    } else {
      const next: ActivityEntry = {
        id: `${Date.now()}-${Math.round(Math.random() * 10000)}`,
        date: selectedDate,
        type: activityType,
        durationMinutes: cleanMinutes,
        calories: cleanCalories,
        notes: activityNotes.trim(),
        createdAt: new Date().toISOString(),
      }

      const nextActivities = [...activities, next]
      setActivities(nextActivities)
      saveActivities(activeUser.id, nextActivities)
    }

    setActivityModalOpen(false)
  }

  const visibleFoods = foods.filter((food) => {
    return food.name.toLowerCase().includes(searchName.toLowerCase())
  })

  return (
    <section className="screen screen-hoy">
      <section className="app-header app-header--today">
        <div className="date-nav">
          <button className="date-nav__chevron" onClick={() => setSelectedDate(dateOffset(selectedDate, -1))}>‹</button>
          <span className="today-date">{formatDisplayDate(selectedDate)}</span>
          <button className="date-nav__chevron" onClick={() => setSelectedDate(dateOffset(selectedDate, 1))}>›</button>
        </div>
      </section>

      <section className="summary-card">
        <div className="summary-card__top">
          <span className="summary-label">Resumen del día</span>
          <span className="summary-total">{round(totals.kcal)} kcal</span>
        </div>

        <div className="macro-grid">
          <div className="macro-item">
            <span className="macro-label">Proteína</span>
            <span className="macro-value">{round(totals.protein)} g</span>
          </div>
          <div className="macro-item">
            <span className="macro-label">Hidratos</span>
            <span className="macro-value">{round(totals.carbs)} g</span>
          </div>
          <div className="macro-item">
            <span className="macro-label">Grasas</span>
            <span className="macro-value">{round(totals.fat)} g</span>
          </div>
        </div>
      </section>

      <section className="meal-card">
        <div className="section-title">
          <span className="section-title__text">Comidas del día</span>
        </div>

        <div className="meal-list">
          {MEALS.map((meal) => {
            const mealEntries = dateEntries.filter((entry) => entry.meal === meal)
            return (
              <article className="meal-group" key={meal}>
                <div className="meal-row">
                  <div className="meal-row__left">
                    <span className="meal-row__label">{meal}</span>
                  </div>
                  <button className="meal-row__add" aria-label={`Añadir ${meal}`} onClick={() => openSelector(meal)}>
                    +
                  </button>
                </div>
                <div className="meal-row__entries">
                  {mealEntries.length === 0 && <span className="meal-row__empty">Sin alimentos</span>}
                  {mealEntries.map((entry) => {
                    const food = getFoodById(entry.foodId)
                    return (
                      <button className="meal-entry" key={entry.id} type="button" onClick={() => openEditor(entry)}>
                        <span className="meal-entry__food">{food.name}</span>
                        <span className="meal-entry__meta"> · {round(entry.quantityGrams)} g · {round(entry.kcal)} kcal</span>
                        <span className="meal-entry__action-strip">
                          <span className="meal-entry__edit" aria-label="Editar alimento" title="Editar">✎</span>
                          <span className="meal-entry__delete" aria-label="Eliminar alimento" title="Eliminar" onClick={(clickEvent) => {
                            clickEvent.stopPropagation()
                            deleteEntry(entry.id)
                          }}>🗑</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="activity-card">
        <div className="section-title">
          <span className="section-title__text">Actividad</span>
          <button className="activity-card__add" onClick={() => {
            setEditingActivityId(null)
            setActivityType('CrossFit')
            setActivityMinutes(60)
            setActivityCalories(0)
            setActivityNotes('')
            setActivityModalOpen(true)
          }}>+</button>
        </div>

        <div className="activity-list">
          {dateActivities.length === 0 && (
            <div className="activity-empty">
              <span className="activity-empty__icon">+</span>
              <span className="activity-empty__text">Añadir actividad</span>
            </div>
          )}

          {dateActivities.map((activity) => (
            <article className="activity-row" key={activity.id}>
              <div className="activity-row__main">
                <span className="activity-row__type">{activity.type}</span>
                <span className="activity-row__meta">{formatDuration(activity.durationMinutes)} · {activity.calories} kcal</span>
                {activity.notes && <span className="activity-row__notes">{activity.notes}</span>}
              </div>
              <div className="activity-row__actions">
                <button className="activity-row__action" onClick={() => openActivityEditor(activity)}>Editar</button>
                <button className="activity-row__action" onClick={() => deleteActivity(activity.id)}>Eliminar</button>
              </div>
            </article>
          ))}
        </div>

        <div className="activity-total">
          <span className="activity-total__label">Actividad total</span>
          <span className="activity-total__value">{activityTotal} kcal</span>
        </div>
      </section>

      {activityModalOpen && (
        <div className="food-modal-backdrop">
          <div className="food-modal activity-modal">
            <div className="food-modal__top">
              <span className="food-modal__title">{editingActivityId ? 'Editar actividad' : 'Añadir actividad'}</span>
              <button className="food-modal__close" onClick={() => setActivityModalOpen(false)}>×</button>
            </div>

            <div className="activity-form">
              <div className="activity-form__field">
                <label className="food-modal__label">Tipo de actividad</label>
                <select value={activityType} onChange={(event) => setActivityType(event.target.value as ActivityType)}>
                  {ACTIVITY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>

              <div className="activity-form__field">
                <label className="food-modal__label">Duración en minutos</label>
                <input type="number" min="0" value={activityMinutes} onChange={(event) => setActivityMinutes(Number(event.target.value))} />
              </div>

              <div className="activity-form__field">
                <label className="food-modal__label">Calorías de actividad</label>
                <input type="number" min="0" value={activityCalories} onChange={(event) => setActivityCalories(Number(event.target.value))} />
              </div>

              <div className="activity-form__field activity-form__field--full">
                <label className="food-modal__label">Notas opcionales</label>
                <textarea value={activityNotes} onChange={(event) => setActivityNotes(event.target.value)} placeholder="Notas" />
              </div>
            </div>

            <div className="food-modal__confirm">
              <button className="secondary-button" onClick={() => setActivityModalOpen(false)}>Cancelar</button>
              <button className="primary-button" onClick={confirmActivity}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {selectorOpen && (
        <div className="food-modal-backdrop">
          <div className="food-modal">
            <div className="food-modal__top">
              <span className="food-modal__title">{editingId ? 'Editar alimento' : 'Añadir alimento'}</span>
              <button className="food-modal__close" onClick={closeSelector}>×</button>
            </div>

            <div className="food-modal__search">
              <div className="search-box">
                <span className="search-icon">⌕</span>
                <input value={searchName} onChange={(event) => setSearchName(event.target.value)} placeholder="Buscar por nombre" aria-label="Buscar por nombre" />
              </div>
            </div>

            <div className="food-modal__layout">
              <div className="food-modal__list">
                {visibleFoods.map((food) => (
                  <button key={food.id} className={`food-modal__row ${food.id === selectedFood.id ? 'is-selected' : ''}`}
                    onClick={() => syncQuantityToSelectedFood(food.id)}>
                    <span className="food-modal__name">{food.name}</span>
                    <span className="food-modal__brand">{food.brand}</span>
                    <span className="food-modal__serving">{food.servingHabitual}</span>
                  </button>
                ))}
              </div>

              <div className="food-modal__detail">
                <span className="food-detail-panel__category">Alimento</span>
                <div className="food-detail__head">
                  <div>
                    <span className="food-detail__name">{selectedFood.name}</span>
                    <span className="food-detail__brand">{selectedFood.brand}</span>
                  </div>
                  <span className="food-detail__serving">{selectedFood.servingHabitual}</span>
                </div>

                <div className="food-macro-table">
                  <div className="food-macro-table__row food-macro-table__row--head">
                    <span>{selectedFood.servingUnit === 'g' && selectedFood.servingGrams ? 'Ración habitual' : 'Ración'}</span>
                    <span>{selectedFood.servingHabitual}</span>
                  </div>
                  <div className="food-macro-table__row">
                    <span>Kcal / 100 g</span>
                    <span>{selectedFood.kcal100g}</span>
                  </div>
                  <div className="food-macro-table__row">
                    <span>Proteína / 100 g</span>
                    <span>{selectedFood.protein100g} g</span>
                  </div>
                  <div className="food-macro-table__row">
                    <span>Hidratos / 100 g</span>
                    <span>{selectedFood.carbs100g} g</span>
                  </div>
                  <div className="food-macro-table__row">
                    <span>Grasa / 100 g</span>
                    <span>{selectedFood.fat100g} g</span>
                  </div>
                </div>

                <div className="food-modal__input-area">
                  <label className="food-modal__label">Cantidad consumida ({selectedFood.servingUnit === 'g' && selectedFood.servingGrams ? 'g' : selectedFood.servingUnit ?? 'unidad'})</label>
                  <input className="food-modal__quantity"
                    type="number"
                    min="0"
                    value={quantityGrams}
                    onChange={(event) => setQuantityGrams(Number(event.target.value))}
                  />
                  {selectedFood.servingUnit === 'g' && selectedFood.servingGrams ? (
                    <span className="food-modal__equivalence">{selectedFood.servingGrams} g = {selectedFood.servingHabitual}</span>
                  ) : null}
                  {selectedFood.servingUnit && selectedFood.servingUnit !== 'g' && selectedFood.servingGrams == null ? (
                    <span className="food-modal__equivalence">Ración sin conversión fiable: {selectedFood.servingHabitual}</span>
                  ) : null}
                </div>

                <div className="food-modal__macro-preview">
                  <div className="food-macro-table">
                    <div className="food-macro-table__row food-macro-table__row--head">
                      <span>Resultado</span>
                      <span>{round(quantityGrams)} g</span>
                    </div>
                    <div className="food-macro-table__row">
                      <span>Kcal</span>
                      <span>{round((selectedFood.kcal100g / 100) * quantityGrams)} kcal</span>
                    </div>
                    <div className="food-macro-table__row">
                      <span>Proteína</span>
                      <span>{round((selectedFood.protein100g / 100) * quantityGrams)} g</span>
                    </div>
                    <div className="food-macro-table__row">
                      <span>Hidratos</span>
                      <span>{round((selectedFood.carbs100g / 100) * quantityGrams)} g</span>
                    </div>
                    <div className="food-macro-table__row">
                      <span>Grasa</span>
                      <span>{round((selectedFood.fat100g / 100) * quantityGrams)} g</span>
                    </div>
                  </div>
                </div>

                <div className="food-modal__choice">
                  <label className="food-modal__label">Añadir a</label>
                  <select value={draftMeal} onChange={(event) => setDraftMeal(event.target.value as MealName)}>
                    {MEALS.map((meal) => <option key={meal} value={meal}>{meal}</option>)}
                  </select>
                </div>

                <div className="food-modal__confirm">
                  <button className="secondary-button" onClick={closeSelector}>Cancelar</button>
                  <button className="primary-button" onClick={confirmEntry}>Confirmar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`
  }

  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining > 0 ? `${hours} h ${remaining} min` : `${hours} h`
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function formatDisplayDate(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`)
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
