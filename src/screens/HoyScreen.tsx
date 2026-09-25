import { formatDisplayNumber } from '../displayNumber'
import { DailyBalanceBars } from '../components/DailyBalanceBars'
import { normalizeSearchText } from '../searchText'
import { FoodMacroSummary } from '../components/FoodMacroSummary'
import { parseDecimalFromSpanishInput } from '../numericInput'
import { useEffect, useMemo, useState } from 'react'
import { calculateDailyEnergyBalance, getActiveKcalForDate } from '../energy'
import type { FoodItem } from '../data/foods'
import { activitiesRepository, diaryRepository, foodsRepository, goalsRepository, measurementsRepository, mealsRepository, profileRepository } from '../data/cloud/repositories'
import { ACTIVITY_TYPES, MEALS, type ActivityEntry, type ActivityType, type BodyMeasurement, type FoodDiaryEntry, type Meal, type MealDiarySnapshot, type MealIngredient, type MealName, type User, type UserGoals } from '../types'
import { ScreenHeader } from '../components/ScreenHeader'
import { GoalProgressRing } from '../components/GoalProgressRing'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { IconActionButton } from '../components/ActionIcon'
import { MealSnapshotEditor } from '../components/MealSnapshotEditor'
import { getGoalPercentage, getGoalStatus } from '../goalStatus'
import { calculateDynamicDailyTargets } from '../dynamicDailyTargets'
import { useDailyActivityIntentions } from '../useDailyActivityIntentions'
import { DailyActivityPlan } from '../components/DailyActivityPlan'
import { DynamicGoalInfo } from '../components/DynamicGoalInfo'
import { calculateAdaptiveMacroTargets } from '../smartRemainingMacros'

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

function getServingGramsInitial(food: FoodItem) {
  if (food.servingUnit === 'g' && food.servingGrams !== null) {
    return food.servingGrams
  }

  return null
}

function getFoodById(foodId: string, foods: FoodItem[]) {
  return foods.find((food) => food.id === foodId) ?? foods[0]
}

function mealNutrition(ingredients: MealIngredient[], availableFoods: FoodItem[]) {
  return ingredients.reduce((total, ingredient) => {
    const food = availableFoods.find((item) => item.id === ingredient.foodId)
    if (!food) return total
    const grams = ingredient.unit === 'unidad' ? ingredient.quantity * (food.servingGrams ?? 0) : ingredient.quantity
    const factor = grams / 100
    return {
      kcal: total.kcal + food.kcal100g * factor,
      protein: total.protein + food.protein100g * factor,
      carbs: total.carbs + food.carbs100g * factor,
      fat: total.fat + food.fat100g * factor,
    }
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 })
}

function createMealSnapshot(meal: Meal, foods: FoodItem[]): MealDiarySnapshot {
  const nutrition = mealNutrition(meal.ingredients, foods)
  return {
    mealId: meal.id,
    name: meal.name,
    ingredients: meal.ingredients.map((ingredient) => ({
      ...ingredient,
      foodName: foods.find((food) => food.id === ingredient.foodId)?.name ?? 'Alimento no disponible',
    })),
    kcal: round(nutrition.kcal),
    protein: round(nutrition.protein),
    carbs: round(nutrition.carbs),
    fat: round(nutrition.fat),
  }
}

export function HoyScreen({ activeUser, onUserClick, onGoToUser }: { activeUser: User; onUserClick: () => void; onGoToUser: () => void }) {
  const [foods, setFoods] = useState<FoodItem[]>([])
  const [sharedMeals, setSharedMeals] = useState<Meal[]>([])
  const [selectedDate, setSelectedDate] = useState(todayIsoLocal())
  const activityPlan = useDailyActivityIntentions(activeUser.id, selectedDate)
  const [entries, setEntries] = useState<FoodDiaryEntry[]>([])
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [goals, setGoals] = useState<UserGoals>({})
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [activityModalOpen, setActivityModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)
  const [searchName, setSearchName] = useState('')
  const [selectedFoodId, setSelectedFoodId] = useState('')
  const [selectedMealId, setSelectedMealId] = useState('')
  const [entryKind, setEntryKind] = useState<'food' | 'meal'>('food')
  const [quantityDraft, setQuantityDraft] = useState('100')
  const [quantityError, setQuantityError] = useState('')
  const parsedQuantity = parseDecimalFromSpanishInput(quantityDraft)
  const quantityGrams = Number.isFinite(parsedQuantity) ? parsedQuantity : 0
  const [draftMeal, setDraftMeal] = useState<MealName>('Desayuno')
  const [activityType, setActivityType] = useState<ActivityType>('CrossFit')
  const [activityMinutes, setActivityMinutes] = useState('60')
  const [activityCalories, setActivityCalories] = useState('0')
  const [activityError, setActivityError] = useState('')
  const [activityNotes, setActivityNotes] = useState('')
  const [pendingDelete, setPendingDelete] = useState<{ type: 'entry' | 'activity'; id: string; name?: string } | null>(null)
  const [mealSnapshotDraft, setMealSnapshotDraft] = useState<{ mealId: string; name: string; ingredients: MealIngredient[]; editingEntry?: FoodDiaryEntry } | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([foodsRepository.list(activeUser.id), mealsRepository.list(activeUser.id), diaryRepository.list(activeUser.id), activitiesRepository.list(activeUser.id), goalsRepository.get(activeUser.id), measurementsRepository.list(activeUser.id), profileRepository.get(activeUser.id)])
      .then(([nextFoods, nextMeals, nextEntries, nextActivities, nextGoals, nextMeasurements, profile]) => {
        if (!active) return
        setFoods(nextFoods); setSharedMeals(nextMeals); setEntries(nextEntries); setActivities(nextActivities); setGoals({ ...nextGoals, sex: profile.sex, birthDate: profile.birthDate, heightCm: profile.heightCm }); setMeasurements(nextMeasurements)
        setSelectedFoodId((current) => current || nextFoods[0]?.id || ''); setSelectedMealId((current) => current || nextMeals[0]?.id || ''); setLoadError('')
      })
      .catch((reason: unknown) => { if (active) setLoadError(reason instanceof Error ? reason.message : 'No se pudieron cargar los datos de hoy.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [activeUser.id])

  const selectedFood = useMemo(
    () => getFoodById(selectedFoodId, foods),
    [foods, selectedFoodId],
  )

  const selectedSharedMeal = useMemo(
    () => sharedMeals.find((meal) => meal.id === selectedMealId) ?? sharedMeals[0],
    [selectedMealId, sharedMeals],
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
    return getActiveKcalForDate(activities, selectedDate)
  }, [activities, selectedDate])

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

  const dynamicTargets = useMemo(() => calculateDynamicDailyTargets({
    baseGoals: goals, intentions: activityPlan.ready ? activityPlan.values : [],
    activities: activityPlan.ready ? activities : [], date: selectedDate,
    measurements: activityPlan.ready ? measurements : [],
  }), [goals, activityPlan.ready, activityPlan.values, activities, measurements, selectedDate])

  const adaptiveTargets = useMemo(() => !loading && !loadError && activityPlan.ready
    ? calculateAdaptiveMacroTargets({ dynamicTargets, consumedCalories: totals.kcal,
      consumedProtein: totals.protein, consumedCarbs: totals.carbs, consumedFat: totals.fat }) : undefined,
  [loading, loadError, activityPlan.ready, dynamicTargets, totals])

  const dailyMacroComparisons = useMemo(() => {
    return [
      { label: 'Proteínas', consumed: totals.protein, target: dynamicTargets.proteinG, unit: 'g' },
      { label: 'Hidratos', consumed: totals.carbs, target: adaptiveTargets?.carbsTargetG ?? dynamicTargets.carbsG, unit: 'g' },
      { label: 'Grasas', consumed: totals.fat, target: adaptiveTargets?.fatTargetG ?? dynamicTargets.fatG, unit: 'g' },
    ].filter((comparison): comparison is DailyGoalComparison => (
      comparison.target !== undefined && comparison.target >= 0
    ))
  }, [adaptiveTargets, dynamicTargets, totals])

  const balanceToday = todayIsoLocal()
  const dailyEnergyBalance = useMemo(() => {
    return calculateDailyEnergyBalance({
      goals,
      measurements,
      referenceDate: selectedDate,
      consumedCalories: totals.kcal,
      activityCalories: selectedDate >= balanceToday && activityPlan.ready
        ? dynamicTargets.effectiveActivityKcal ?? activityTotal : activityTotal,
    })
  }, [activityTotal, goals, measurements, selectedDate, totals.kcal, balanceToday, activityPlan.ready, dynamicTargets.effectiveActivityKcal])
  const dailyGoals = goals
  const deficitProgress = useMemo(() => {
    const target = dailyGoals.targetDeficitKcal
    if (!dailyEnergyBalance || target === undefined || target <= 0) return undefined
    const current = Math.max(0, dailyEnergyBalance.estimatedDeficit)
    const percentage = getGoalPercentage(current, target)
    return { current, target, percentage, status: getGoalStatus(percentage) }
  }, [dailyEnergyBalance, dailyGoals.targetDeficitKcal])

  function openSelector(meal: MealName) {
    const food = foods[0]
    const firstQuantity = getServingGramsInitial(food)
    setDraftMeal(meal)
    setEntryKind('food')
    setSelectedFoodId(food.id)
    setSelectedMealId(sharedMeals[0]?.id ?? '')
    setQuantityDraft(String(firstQuantity ?? 100))
    setQuantityError('')
    setSearchName('')
    setEditingId(null)
    setSelectorOpen(true)
  }

  function openEditor(entry: FoodDiaryEntry) {
    if (entry.entryType === 'meal' && entry.mealSnapshot) {
      setMealSnapshotDraft({ mealId: entry.mealSnapshot.mealId, name: entry.mealSnapshot.name, ingredients: entry.mealSnapshot.ingredients, editingEntry: entry })
      return
    }
    setEditingId(entry.id)
    setDraftMeal(entry.meal)
    if (entry.entryType === 'meal' && entry.mealSnapshot) {
      setEntryKind('meal')
      setSelectedMealId(entry.mealSnapshot.mealId)
    } else {
      const food = getFoodById(entry.foodId ?? '', foods)
      setEntryKind('food')
      setSelectedFoodId(food.id)
      setQuantityDraft(String(entry.quantityGrams))
    }
    setQuantityError('')
    setSelectorOpen(true)
  }

  function closeSelector() {
    setSelectorOpen(false)
    setSearchName('')
  }

  function syncQuantityToSelectedFood(foodId: string, fallbackQuantity = 100) {
    const food = getFoodById(foodId, foods)
    const serving = getServingGramsInitial(food)
    setSelectedFoodId(food.id)
    setQuantityDraft(String(serving ?? fallbackQuantity))
    setQuantityError('')
  }

  async function confirmEntry() {
    try {
    if (entryKind === 'meal') {
      if (!selectedSharedMeal) return
      closeSelector()
      setMealSnapshotDraft({ mealId: selectedSharedMeal.id, name: selectedSharedMeal.name, ingredients: selectedSharedMeal.ingredients })
      return
    }

    const food = getFoodById(selectedFoodId, foods)
    if (!food) return
    const enteredQuantity = parseDecimalFromSpanishInput(quantityDraft)
    if (quantityDraft.trim() === '' || !Number.isFinite(enteredQuantity) || enteredQuantity < 0) {
      setQuantityError('Introduce una cantidad válida mayor o igual que cero.')
      return
    }
    const quantity = Math.max(0, enteredQuantity)
    const kcal = (food.kcal100g / 100) * quantity
    const protein = (food.protein100g / 100) * quantity
    const carbs = (food.carbs100g / 100) * quantity
    const fat = (food.fat100g / 100) * quantity

    if (editingId) {
      const target = entries.find((entry) => entry.id === editingId)
      if (!target) {
        return
      }

      const next: FoodDiaryEntry[] = entries.map((entry) => {
        if (entry.id !== editingId) {
          return entry
        }

        return {
          ...entry,
          entryType: 'food' as const,
          foodId: food.id,
          meal: draftMeal,
          quantityGrams: quantity,
          quantityUnit: food.servingUnit ?? 'g',
          kcal: round(kcal),
          protein: round(protein),
          carbs: round(carbs),
          fat: round(fat),
          nameSnapshot: food.name,
          mealSnapshot: undefined,
        }
      })

      const saved = await diaryRepository.save(activeUser.id, next.find((entry) => entry.id === editingId)!, editingId)
      setEntries((current) => current.map((entry) => entry.id === saved.id ? saved : entry))
    } else {
      const next: FoodDiaryEntry = {
        id: `${Date.now()}-${Math.round(Math.random() * 10000)}`,
        entryType: 'food',
        foodId: food.id,
        date: selectedDate,
        meal: draftMeal,
        quantityGrams: quantity,
        quantityUnit: food.servingUnit ?? 'g',
        kcal: round(kcal),
        protein: round(protein),
        carbs: round(carbs),
        fat: round(fat),
        nameSnapshot: food.name,
        createdAt: new Date().toISOString(),
      }

      const { id: _id, ...values } = next
      const saved = await diaryRepository.save(activeUser.id, values)
      setEntries((current) => [...current, saved])
    }

    closeSelector()
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : 'No se pudo guardar la entrada del diario.')
    }
  }

  async function deleteEntry(entryId: string) {
    try { await diaryRepository.remove(entryId); setEntries((current) => current.filter((entry) => entry.id !== entryId)); return true } catch (reason) { setLoadError(reason instanceof Error ? reason.message : 'No se pudo eliminar la entrada del diario.'); return false }
  }

  function openActivityEditor(activity: ActivityEntry) {
    setEditingActivityId(activity.id)
    setActivityType(activity.type)
    setActivityMinutes(String(activity.durationMinutes))
    setActivityCalories(String(activity.calories))
    setActivityError('')
    setActivityNotes(activity.notes)
    setActivityModalOpen(true)
  }

  async function deleteActivity(activityId: string) {
    try {
      await activitiesRepository.remove(activityId)
      setActivities((current) => current.filter((activity) => activity.id !== activityId))
      return true
    } catch (reason) { setLoadError(reason instanceof Error ? reason.message : 'No se pudo eliminar la actividad.'); return false }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const target = pendingDelete
    const deleted = target.type === 'entry' ? await deleteEntry(target.id) : await deleteActivity(target.id)
    if (deleted) setPendingDelete(null)
  }

  async function saveMealSnapshot(ingredients: MealIngredient[]) {
    if (!mealSnapshotDraft) return
    const nutrition = mealNutrition(ingredients, foods)
    const snapshot: MealDiarySnapshot = {
      mealId: mealSnapshotDraft.mealId,
      name: mealSnapshotDraft.name,
      ingredients: ingredients.map((ingredient) => ({ ...ingredient, foodName: foods.find((food) => food.id === ingredient.foodId)?.name ?? 'Alimento no disponible' })),
      kcal: round(nutrition.kcal), protein: round(nutrition.protein), carbs: round(nutrition.carbs), fat: round(nutrition.fat),
    }
    const mealValues = { entryType: 'meal' as const, foodId: undefined, quantityGrams: 1, quantityUnit: 'comida', meal: mealSnapshotDraft.editingEntry?.meal ?? draftMeal, kcal: snapshot.kcal, protein: snapshot.protein, carbs: snapshot.carbs, fat: snapshot.fat, nameSnapshot: snapshot.name, mealSnapshot: snapshot }
    try {
      if (mealSnapshotDraft.editingEntry) {
        const saved = await diaryRepository.save(activeUser.id, { ...mealSnapshotDraft.editingEntry, ...mealValues }, mealSnapshotDraft.editingEntry.id)
        setEntries((current) => current.map((entry) => entry.id === saved.id ? saved : entry))
      } else {
        const next: FoodDiaryEntry = { id: '', date: selectedDate, createdAt: new Date().toISOString(), ...mealValues }
        const { id: _id, ...values } = next
        const saved = await diaryRepository.save(activeUser.id, values)
        setEntries((current) => [...current, saved])
      }
      setMealSnapshotDraft(null)
    } catch (reason) { setLoadError(reason instanceof Error ? reason.message : 'No se pudo guardar la comida del día.') }
  }

  async function confirmActivity() {
    const cleanMinutes = parseDecimalFromSpanishInput(activityMinutes)
    const cleanCalories = parseDecimalFromSpanishInput(activityCalories)

    if ([cleanMinutes, cleanCalories].some((value) => !Number.isFinite(value) || value < 0)) {
      setActivityError('La duración y las calorías deben ser números positivos o cero.')
      return
    }
    setActivityError('')

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

      const saved = await activitiesRepository.save(activeUser.id, next.find((activity) => activity.id === editingActivityId)!, editingActivityId)
      setActivities((current) => current.map((activity) => activity.id === saved.id ? saved : activity))
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

      const { id: _id, createdAt: _createdAt, ...values } = next
      const saved = await activitiesRepository.save(activeUser.id, values)
      setActivities((current) => [...current, saved])
    }

    setActivityModalOpen(false)
  }

  const visibleFoods = foods.filter((food) => {
    return normalizeSearchText(food.name).includes(normalizeSearchText(searchName))
  })

  return (
    <section className="screen screen-hoy">
      <ScreenHeader title="HOY" user={activeUser} onUserClick={onUserClick} />
      {loading && <span className="progress-card__empty">Cargando datos…</span>}
      {loadError && <span className="error-text">{loadError}</span>}
      <section className="today-date-header">
        <div className="date-nav">
          <button className="date-nav__chevron" onClick={() => setSelectedDate(dateOffset(selectedDate, -1))}>‹</button>
          <span className="today-date">{formatDisplayDate(selectedDate)}</span>
          <button className="date-nav__chevron" onClick={() => setSelectedDate(dateOffset(selectedDate, 1))}>›</button>
        </div>
      </section>

      <section className="daily-goals-card" aria-labelledby="daily-goals-title">
        <span className="daily-goals-card__title" id="daily-goals-title">Balance del día</span>
        {loading ? (
          <span className="daily-goals-card__empty">Cargando balance…</span>
        ) : dailyEnergyBalance ? (
          <>
            <DailyBalanceBars
              expenditure={dailyEnergyBalance.estimatedDailyExpenditure}
              consumed={totals.kcal}
              deficit={dailyEnergyBalance.estimatedDeficit}
              target={dailyGoals.targetDeficitKcal}
              status={deficitProgress?.status}
            />
            {dailyGoals.targetDeficitKcal === undefined && <ProgressLink onClick={onGoToUser}>Configura un déficit objetivo en Usuario</ProgressLink>}
          </>
        ) : (
          <ProgressLink onClick={onGoToUser}>Completa tus datos físicos en Usuario para calcular tu gasto diario.</ProgressLink>
        )}

        <DailyActivityPlan plan={activityPlan} targets={dynamicTargets} loading={loading || Boolean(loadError)} />
        {!activityPlan.loading && !loading && dailyMacroComparisons.length > 0 && (
          <div className="daily-goals-card__macros">
            <div className="daily-goals-card__macro-heading">
              <span className="daily-goals-card__subtitle">{!dynamicTargets.calculationValid ? 'Objetivos base' : selectedDate === todayIsoLocal() ? 'Objetivo de hoy' : 'Objetivo del día'}</span>
              <DynamicGoalInfo targetDeficitKcal={goals.targetDeficitKcal} />
            </div>
            <div className="daily-goals-card__macro-rings">
              {dailyMacroComparisons.map((comparison) => <DailyGoalRing key={comparison.label} comparison={comparison} />)}
            </div>
          </div>
        )}
        <div className="daily-goals-card__separator" aria-hidden="true" />
      </section>

      <section className="meal-card">
        <div className="section-title">
          <span className="section-title__text">Comidas del día</span>
        </div>

        <div className="meal-list">
          {MEALS.map((meal) => {
            const mealEntries = dateEntries.filter((entry) => entry.meal === meal)
            const mealTotals = mealEntries.reduce((total, entry) => ({
              kcal: total.kcal + entry.kcal,
              protein: total.protein + entry.protein,
              carbs: total.carbs + entry.carbs,
              fat: total.fat + entry.fat,
            }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
            return (
              <article className="meal-group" key={meal}>
                <div className="meal-row">
                  <div className="meal-row__left">
                    <span className="meal-row__label">{meal}</span>
                    <span className="meal-row__macros">
                      {formatMealMacro(mealTotals.kcal)}kcal · {formatMealMacro(mealTotals.protein)} P · {formatMealMacro(mealTotals.carbs)} HC · {formatMealMacro(mealTotals.fat)} G
                    </span>
                  </div>
                  <button className="meal-row__add" aria-label={`Añadir ${meal}`} onClick={() => openSelector(meal)}>
                    +
                  </button>
                </div>
                <div className="meal-row__entries">
                  {mealEntries.length === 0 && <span className="meal-row__empty">Sin alimentos</span>}
                  {mealEntries.map((entry) => {
                    const mealSnapshot = entry.entryType === 'meal' ? entry.mealSnapshot : undefined
                    const isMealEntry = mealSnapshot !== undefined
                    const food = isMealEntry ? undefined : getFoodById(entry.foodId ?? '', foods)
                    return (
                      <article className="meal-entry" key={entry.id}>
                        <button className="meal-entry__content" type="button" onClick={() => openEditor(entry)} aria-label={`Editar ${entry.nameSnapshot ?? entry.mealSnapshot?.name ?? 'entrada del diario'}`}>
                          <span className="meal-entry__details">
                            <span className="meal-entry__food">{mealSnapshot ? mealSnapshot.name : food?.name}</span>
                            <span className="meal-entry__meta">{round(entry.kcal)} kcal · {round(entry.protein)} P · {round(entry.carbs)} HC · {round(entry.fat)} G</span>
                          </span>
                        </button>
                        <span className="row-actions">
                          <IconActionButton name="edit" ariaLabel="Editar entrada del diario" onClick={() => openEditor(entry)} />
                          <IconActionButton name="delete" ariaLabel="Eliminar entrada del diario" onClick={() => setPendingDelete({ type: 'entry', id: entry.id, name: entry.nameSnapshot ?? entry.mealSnapshot?.name })} />
                        </span>
                      </article>
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
            setActivityMinutes('60')
            setActivityCalories('0')
            setActivityError('')
            setActivityNotes('')
            setActivityModalOpen(true)
          }}>+</button>
        </div>

        <div className="activity-list">
          {dateActivities.length === 0 && (
            <span className="meal-row__empty">Sin actividad</span>
          )}

          {dateActivities.map((activity) => (
            <article className="activity-row" key={activity.id}>
              <div className="activity-row__main">
                <span className="activity-row__type">{activity.type}</span>
                <span className="activity-row__meta">{formatDuration(activity.durationMinutes)} · {formatDisplayNumber(activity.calories)} kcal</span>
                {activity.notes && <span className="activity-row__notes">{activity.notes}</span>}
              </div>
              <div className="row-actions">
                <IconActionButton name="edit" ariaLabel="Editar actividad" onClick={() => openActivityEditor(activity)} />
                <IconActionButton name="delete" ariaLabel="Eliminar actividad" onClick={() => setPendingDelete({ type: 'activity', id: activity.id })} />
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
                <input type="text" inputMode="decimal" value={activityMinutes} onChange={(event) => setActivityMinutes(event.target.value)} />
              </div>

              <div className="activity-form__field">
                <label className="food-modal__label">Calorías de actividad</label>
                <input type="text" inputMode="decimal" value={activityCalories} onChange={(event) => setActivityCalories(event.target.value)} />
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
            {activityError && <span className="error-text" role="alert">{activityError}</span>}
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

            <div className="entry-kind-selector" role="group" aria-label="Tipo de registro">
              <button className={`entry-kind-selector__button ${entryKind === 'food' ? 'is-selected' : ''}`} type="button" onClick={() => setEntryKind('food')}>Alimento</button>
              <button className={`entry-kind-selector__button ${entryKind === 'meal' ? 'is-selected' : ''}`} type="button" onClick={() => setEntryKind('meal')}>Comida</button>
            </div>

            {entryKind === 'food' && <>
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
                    <FoodMacroSummary food={food} />
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

                <FoodMacroSummary food={selectedFood} />

                <div className="food-modal__input-area">
                  <label className="food-modal__label">Cantidad consumida (<span style={{ textTransform: 'none' }}>{selectedFood.servingUnit === 'g' && selectedFood.servingGrams ? 'g' : selectedFood.servingUnit ?? 'unidad'}</span>)</label>
                  <input className="food-modal__quantity"
                    type="text"
                    inputMode="decimal"
                    value={quantityDraft}
                    onChange={(event) => { setQuantityDraft(event.target.value); setQuantityError('') }}
                  />
                  {quantityError && <span className="error-text" role="alert">{quantityError}</span>}
                  {selectedFood.servingUnit && selectedFood.servingUnit !== 'g' && selectedFood.servingGrams == null ? (
                    <span className="food-modal__equivalence">Ración sin conversión fiable: {selectedFood.servingHabitual}</span>
                  ) : null}
                </div>

                <div className="food-modal__macro-preview">
                  <div className="food-macro-table">
                    <div className="food-macro-table__row food-macro-table__row--head">
                      <span>Resultado</span>
                      <span style={{ textTransform: 'none' }}>{round(quantityGrams)} g</span>
                    </div>
                    <div className="food-macro-table__row">
                      <span>kcal</span>
                      <span>{formatDisplayNumber((selectedFood.kcal100g / 100) * quantityGrams)} kcal</span>
                    </div>
                    <div className="food-macro-table__row">
                      <span>Proteína</span>
                      <span>{formatDisplayNumber((selectedFood.protein100g / 100) * quantityGrams)} g</span>
                    </div>
                    <div className="food-macro-table__row">
                      <span>Hidratos</span>
                      <span>{formatDisplayNumber((selectedFood.carbs100g / 100) * quantityGrams)} g</span>
                    </div>
                    <div className="food-macro-table__row">
                      <span>Grasa</span>
                      <span>{formatDisplayNumber((selectedFood.fat100g / 100) * quantityGrams)} g</span>
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
            </>}

            {entryKind === 'meal' && <div className="food-modal__layout">
              <div className="food-modal__list">
                {sharedMeals.length === 0 && <span className="meal-row__empty">No hay comidas creadas.</span>}
                {sharedMeals.map((meal) => (
                  <button key={meal.id} className={`food-modal__row ${meal.id === selectedSharedMeal?.id ? 'is-selected' : ''}`} onClick={() => setSelectedMealId(meal.id)}>
                    <span className="food-modal__name">{meal.name}</span>
                    <span className="food-modal__serving">{meal.ingredients.length} ingredientes</span>
                  </button>
                ))}
              </div>

              {selectedSharedMeal && <div className="food-modal__detail">
                <span className="food-detail-panel__category">Comida</span>
                <div className="food-detail__head">
                  <div>
                    <span className="food-detail__name">{selectedSharedMeal.name}</span>
                    {selectedSharedMeal.description && <span className="food-detail__brand">{selectedSharedMeal.description}</span>}
                  </div>
                </div>
                <div className="food-macro-table">
                  <div className="food-macro-table__row food-macro-table__row--head"><span>Ingredientes</span><span>{selectedSharedMeal.ingredients.length}</span></div>
                  <div className="food-macro-table__row"><span>kcal</span><span>{createMealSnapshot(selectedSharedMeal, foods).kcal} kcal</span></div>
                  <div className="food-macro-table__row"><span>Proteína</span><span>{createMealSnapshot(selectedSharedMeal, foods).protein} g</span></div>
                  <div className="food-macro-table__row"><span>Hidratos</span><span>{createMealSnapshot(selectedSharedMeal, foods).carbs} g</span></div>
                  <div className="food-macro-table__row"><span>Grasa</span><span>{createMealSnapshot(selectedSharedMeal, foods).fat} g</span></div>
                </div>
                <div className="food-modal__choice">
                  <label className="food-modal__label">Añadir a</label>
                  <select value={draftMeal} onChange={(event) => setDraftMeal(event.target.value as MealName)}>{MEALS.map((meal) => <option key={meal} value={meal}>{meal}</option>)}</select>
                </div>
                <div className="food-modal__confirm"><button className="secondary-button" onClick={closeSelector}>Cancelar</button><button className="primary-button" onClick={confirmEntry}>Confirmar</button></div>
              </div>}
            </div>}
          </div>
        </div>
      )}
      {pendingDelete && <ConfirmDialog
        title="Confirmar eliminación"
        message={pendingDelete.type === 'entry'
          ? `¿Seguro que quieres eliminar${pendingDelete.name ? ` “${pendingDelete.name}”` : ''} del día?`
          : '¿Seguro que quieres eliminar esta actividad?'}
        error={loadError}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />}
      {mealSnapshotDraft && <MealSnapshotEditor
        key={`${mealSnapshotDraft.mealId}-${mealSnapshotDraft.editingEntry?.id ?? 'new'}`}
        name={mealSnapshotDraft.name}
        foods={foods}
        initialIngredients={mealSnapshotDraft.ingredients}
        calculateNutrition={(ingredients) => mealNutrition(ingredients, foods)}
        onCancel={() => setMealSnapshotDraft(null)}
        onConfirm={(ingredients) => void saveMealSnapshot(ingredients)}
      />}
    </section>
  )
}

type DailyGoalComparison = {
  label: string
  consumed: number
  target: number
  unit: string
}

function ProgressLink({ children, onClick }: { children: string; onClick: () => void }) {
  return <div className="daily-goals-card__empty"><span>{children}</span><button type="button" onClick={onClick}>Ir a Usuario</button></div>
}

function DailyGoalRing({ comparison }: { comparison: DailyGoalComparison }) {
  const percentage = getGoalPercentage(comparison.consumed, comparison.target)
  const value = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })

  return (
    <div className="daily-goals-card__macro-ring">
      <span>{comparison.label}</span>
      <GoalProgressRing label={comparison.label} percentage={comparison.target === 0 && comparison.consumed > 0 ? 100 : percentage}
        percentageLabel={comparison.target === 0 ? comparison.consumed > 0 ? 'Exceso' : '—' : undefined}
        status={comparison.target === 0 ? 'red' : getGoalStatus(percentage)} />
      <strong>{value.format(comparison.consumed)} / {value.format(comparison.target)} {comparison.unit}</strong>
      <small className="daily-goals-card__macro-difference">
        ({comparison.consumed > comparison.target ? '+' : ''}{value.format(Math.abs(comparison.target - comparison.consumed))} {comparison.unit})
      </small>
    </div>
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

function formatMealMacro(value: number) {
  return formatDisplayNumber(value)
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
