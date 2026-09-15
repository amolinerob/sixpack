import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { FoodItem } from '../data/foods'
import { foodsRepository, mealsRepository } from '../data/cloud/repositories'
import type { Meal, MealIngredient, MealIngredientUnit, User } from '../types'
import { ScreenHeader } from '../components/ScreenHeader'
import { IconActionButton } from '../components/ActionIcon'

type IngredientForm = { foodId: string; quantity: string; unit: MealIngredientUnit }
type MealForm = { name: string; description: string; ingredients: IngredientForm[] }
type MealNutrition = { kcal: number; protein: number; carbs: number; fat: number }

const emptyNutrition: MealNutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

function emptyForm(): MealForm {
  return { name: '', description: '', ingredients: [] }
}

function parseDecimal(value: string) {
  return Number(value.trim().replace(',', '.'))
}

function nutritionFor(ingredients: MealIngredient[], foods: FoodItem[]): MealNutrition {
  return ingredients.reduce<MealNutrition>((total, ingredient) => {
    const food = foods.find((item) => item.id === ingredient.foodId)
    if (!food) return total
    const grams = ingredient.unit === 'unidad' ? ingredient.quantity * (food.servingGrams ?? 0) : ingredient.quantity
    const factor = grams / 100
    return {
      kcal: total.kcal + food.kcal100g * factor,
      protein: total.protein + food.protein100g * factor,
      carbs: total.carbs + food.carbs100g * factor,
      fat: total.fat + food.fat100g * factor,
    }
  }, emptyNutrition)
}

function round(value: number) {
  return Math.round(value * 10) / 10
}

function ingredientSummary(ingredient: MealIngredient, foods: FoodItem[]) {
  const food = foods.find((item) => item.id === ingredient.foodId)
  return `${round(ingredient.quantity)} ${ingredient.unit} ${food?.name ?? 'Alimento no disponible'}`
}

function MacroSummary({ nutrition }: { nutrition: MealNutrition }) {
  return <div className="meal-recipe-card__macros">
    <span>{round(nutrition.kcal)} kcal</span>
    <span>P {round(nutrition.protein)} g</span>
    <span>H {round(nutrition.carbs)} g</span>
    <span>G {round(nutrition.fat)} g</span>
  </div>
}

export function ComidasScreen({ activeUser, onUserClick }: { activeUser: User; onUserClick: () => void }) {
  const [foods, setFoods] = useState<FoodItem[]>([])
  const [meals, setMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<MealForm>(emptyForm)
  const [error, setError] = useState('')
  const [deleteMealId, setDeleteMealId] = useState<string | null>(null)
  const [deleteConfirmationStep, setDeleteConfirmationStep] = useState<1 | 2>(1)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([foodsRepository.list(activeUser.id), mealsRepository.list(activeUser.id)])
      .then(([nextFoods, nextMeals]) => { if (active) { setFoods(nextFoods); setMeals(nextMeals); setLoadError('') } })
      .catch((reason: unknown) => { if (active) setLoadError(reason instanceof Error ? reason.message : 'No se pudieron cargar las comidas.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [activeUser.id])

  const previewNutrition = useMemo(() => {
    const ingredients = form.ingredients.flatMap((ingredient): MealIngredient[] => {
      const quantity = parseDecimal(ingredient.quantity)
      return Number.isFinite(quantity) && quantity > 0 ? [{ foodId: ingredient.foodId, quantity, unit: ingredient.unit }] : []
    })
    return nutritionFor(ingredients, foods)
  }, [form.ingredients, foods])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setError('')
    setModalOpen(true)
  }

  function openEdit(meal: Meal) {
    setEditingId(meal.id)
    setForm({ name: meal.name, description: meal.description ?? '', ingredients: meal.ingredients.map((ingredient) => ({ ...ingredient, quantity: String(ingredient.quantity) })) })
    setError('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setError('')
  }

  function addIngredient() {
    setForm((current) => ({ ...current, ingredients: [...current.ingredients, { foodId: foods[0]?.id ?? '', quantity: '', unit: 'g' }] }))
  }

  function updateIngredient(index: number, changes: Partial<IngredientForm>) {
    setForm((current) => ({ ...current, ingredients: current.ingredients.map((ingredient, itemIndex) => itemIndex === index ? { ...ingredient, ...changes } : ingredient) }))
  }

  function removeIngredient(index: number) {
    setForm((current) => ({ ...current, ingredients: current.ingredients.filter((_, itemIndex) => itemIndex !== index) }))
  }

  async function saveMeal(event?: FormEvent) {
    event?.preventDefault()
    const ingredients = form.ingredients.map<MealIngredient | null>((ingredient) => {
      const quantity = parseDecimal(ingredient.quantity)
      return ingredient.foodId && Number.isFinite(quantity) && quantity > 0 ? { foodId: ingredient.foodId, quantity, unit: ingredient.unit } : null
    })

    if (!form.name.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    if (ingredients.length === 0 || ingredients.some((ingredient) => ingredient === null)) {
      setError('Añade al menos un alimento con una cantidad válida.')
      return
    }

    const meal = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      ingredients: ingredients as MealIngredient[],
    }
    try {
      const saved = await mealsRepository.save(activeUser.id, meal, editingId ?? undefined)
      setMeals((current) => editingId ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved])
      closeModal()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar la comida.') }
  }

  function requestDelete(mealId: string) {
    setDeleteConfirmationStep(1)
    setDeleteMealId(mealId)
  }

  function cancelDelete() {
    setDeleteMealId(null)
    setDeleteConfirmationStep(1)
  }

  async function confirmDelete() {
    if (!deleteMealId || deleteConfirmationStep !== 2) return
    try { await mealsRepository.remove(deleteMealId); setMeals((current) => current.filter((meal) => meal.id !== deleteMealId)); cancelDelete() } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo eliminar la comida.') }
  }

  return <section className="screen screen-comidas">
    <ScreenHeader title="COMIDAS" user={activeUser} onUserClick={onUserClick} />
    <section className="meals-panel">
      <div className="meals-panel__header"><span className="meals-panel__title">Mis comidas</span><button className="primary-button" onClick={openCreate}>+ Añadir comida</button></div>
      {loadError && <span className="error-text">{loadError}</span>}<div className="meals-list">
        {loading && <span className="progress-card__empty">Cargando comidas…</span>}
        {meals.length === 0 ? <div className="empty-state-block"><div className="empty-state-block__icon">+</div><div className="empty-state-block__body"><span className="empty-state-block__title">Sin comidas</span><span className="empty-state-block__text">Crea una receta reutilizable con tus alimentos.</span></div></div> : meals.map((meal) => {
          const nutrition = nutritionFor(meal.ingredients, foods)
          return <article className="meal-recipe-card" key={meal.id}>
            <div className="meal-recipe-card__top"><div><span className="meal-recipe-card__name">{meal.name}</span>{meal.description && <span className="meal-recipe-card__description">{meal.description}</span>}</div><span className="row-actions"><IconActionButton name="edit" ariaLabel="Editar comida" onClick={() => openEdit(meal)} /><IconActionButton name="delete" ariaLabel="Eliminar comida" onClick={() => requestDelete(meal.id)} /></span></div>
            <span className="meal-recipe-card__ingredients">{meal.ingredients.map((ingredient) => ingredientSummary(ingredient, foods)).join(' · ')}</span>
            <MacroSummary nutrition={nutrition} />
          </article>
        })}
      </div>
    </section>

    {modalOpen && <div className="food-modal-backdrop"><div className="food-modal"><div className="food-modal__top"><span className="food-modal__title">{editingId ? 'Editar comida' : 'Añadir comida'}</span><button className="food-modal__close" onClick={closeModal} type="button">×</button></div><form className="food-modal__form" onSubmit={saveMeal}>
      <label className="food-modal__label">Nombre *</label><input className="food-modal__quantity" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Por ejemplo, Tortilla de queso" />
      <label className="food-modal__label">Descripción</label><input className="food-modal__quantity" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Opcional" />
      <div className="meal-form__ingredients-header"><span className="food-modal__label">Ingredientes</span><button className="secondary-button" type="button" onClick={addIngredient}>+ Añadir alimento</button></div>
      {form.ingredients.map((ingredient, index) => <div className="meal-form__ingredient" key={`${ingredient.foodId}-${index}`}><select className="food-modal__quantity" value={ingredient.foodId} onChange={(event) => updateIngredient(index, { foodId: event.target.value })} aria-label={`Alimento ${index + 1}`}>{foods.map((food) => <option key={food.id} value={food.id}>{food.name}</option>)}</select><div className="meal-form__ingredient-controls"><input className="food-modal__quantity" type="text" inputMode="decimal" value={ingredient.quantity} onChange={(event) => updateIngredient(index, { quantity: event.target.value })} placeholder="Cantidad" aria-label={`Cantidad de ingrediente ${index + 1}`} /><select className="food-modal__quantity" value={ingredient.unit} onChange={(event) => updateIngredient(index, { unit: event.target.value as MealIngredientUnit })} aria-label={`Unidad de ingrediente ${index + 1}`}><option value="g">g</option><option value="ml">ml</option><option value="unidad">unidad</option></select><IconActionButton name="delete" ariaLabel={`Eliminar ingrediente ${index + 1}`} onClick={() => removeIngredient(index)} /></div></div>)}
      {form.ingredients.length === 0 && <span className="meal-form__empty">Añade los alimentos que forman esta comida.</span>}
      <div className="meal-form__totals"><span className="meal-form__totals-title">Totales de la receta</span><MacroSummary nutrition={previewNutrition} /></div>
      {error && <span className="error-text">{error}</span>}<div className="food-modal__confirm"><button className="secondary-button" type="button" onClick={closeModal}>Cancelar</button><button className="primary-button" type="submit">Guardar</button></div>
    </form></div></div>}

    {deleteMealId && <div className="food-modal-backdrop"><div className="food-modal"><div className="food-modal__top"><span className="food-modal__title">{deleteConfirmationStep === 1 ? '¿Quieres eliminar esta comida?' : 'Esta acción no se puede deshacer. ¿Eliminar definitivamente?'}</span><button className="food-modal__close" onClick={cancelDelete} type="button">×</button></div><div className="food-modal__confirm"><button className="secondary-button" onClick={cancelDelete} type="button">Cancelar</button>{deleteConfirmationStep === 1 ? <button className="primary-button" onClick={() => setDeleteConfirmationStep(2)} type="button">Eliminar</button> : <button className="primary-button" onClick={confirmDelete} type="button">Eliminar definitivamente</button>}</div></div></div>}
  </section>
}
