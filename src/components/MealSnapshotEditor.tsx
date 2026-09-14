import { useMemo, useState } from 'react'
import type { FoodItem } from '../data/foods'
import type { MealIngredient, MealIngredientUnit } from '../types'
import { IconActionButton } from './ActionIcon'

type Nutrition = { kcal: number; protein: number; carbs: number; fat: number }
type DraftIngredient = { foodId: string; quantity: string; unit: MealIngredientUnit }

type MealSnapshotEditorProps = {
  name: string
  foods: FoodItem[]
  initialIngredients: MealIngredient[]
  calculateNutrition: (ingredients: MealIngredient[]) => Nutrition
  onCancel: () => void
  onConfirm: (ingredients: MealIngredient[]) => void
}

function decimal(value: string) { return Number(value.trim().replace(',', '.')) }
function round(value: number) { return Math.round(value * 10) / 10 }

/** Ajusta únicamente una copia diaria de una comida; nunca modifica su receta maestra. */
export function MealSnapshotEditor({ name, foods, initialIngredients, calculateNutrition, onCancel, onConfirm }: MealSnapshotEditorProps) {
  const [ingredients, setIngredients] = useState<DraftIngredient[]>(() => initialIngredients.map((item) => ({ ...item, quantity: String(item.quantity) })))
  const [error, setError] = useState('')
  const validIngredients = useMemo(() => ingredients.flatMap((item): MealIngredient[] => {
    const quantity = decimal(item.quantity)
    return item.foodId && Number.isFinite(quantity) && quantity > 0 ? [{ foodId: item.foodId, quantity, unit: item.unit }] : []
  }), [ingredients])
  const nutrition = useMemo(() => calculateNutrition(validIngredients), [calculateNutrition, validIngredients])

  function update(index: number, changes: Partial<DraftIngredient>) { setIngredients((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item)) }
  function remove(index: number) { setIngredients((current) => current.filter((_, itemIndex) => itemIndex !== index)) }
  function add() { setIngredients((current) => [...current, { foodId: foods[0]?.id ?? '', quantity: '', unit: 'g' }]) }
  function confirm() {
    if (!validIngredients.length || validIngredients.length !== ingredients.length) { setError('Introduce cantidades válidas mayores que cero para todos los ingredientes.'); return }
    onConfirm(validIngredients)
  }

  return <div className="food-modal-backdrop">
    <div className="food-modal meal-snapshot-editor">
      <div className="food-modal__top"><span className="food-modal__title">Ajustar comida</span><button className="food-modal__close" type="button" onClick={onCancel}>×</button></div>
      <div className="food-modal__form">
        <span className="meal-snapshot-editor__name">{name}</span>
        <div className="meal-form__ingredients-header"><span className="food-modal__label">Ingredientes</span><button className="secondary-button" type="button" onClick={add}>+ Añadir ingrediente</button></div>
        {ingredients.map((ingredient, index) => <div className="meal-form__ingredient" key={`${ingredient.foodId}-${index}`}>
          <select className="food-modal__quantity" value={ingredient.foodId} onChange={(event) => update(index, { foodId: event.target.value })} aria-label={`Ingrediente ${index + 1}`}>{foods.map((food) => <option value={food.id} key={food.id}>{food.name}</option>)}</select>
          <div className="meal-form__ingredient-controls"><input className="food-modal__quantity" value={ingredient.quantity} inputMode="decimal" onChange={(event) => update(index, { quantity: event.target.value })} placeholder="Cantidad" aria-label={`Cantidad del ingrediente ${index + 1}`} /><select className="food-modal__quantity" value={ingredient.unit} onChange={(event) => update(index, { unit: event.target.value as MealIngredientUnit })}><option value="g">g</option><option value="ml">ml</option><option value="unidad">unidad</option></select><IconActionButton name="delete" ariaLabel={`Eliminar ingrediente ${index + 1}`} onClick={() => remove(index)} /></div>
        </div>)}
        <div className="meal-form__totals"><span className="meal-form__totals-title">Macros de esta comida</span><div className="meal-recipe-card__macros"><span>{round(nutrition.kcal)} kcal</span><span>P {round(nutrition.protein)} g</span><span>H {round(nutrition.carbs)} g</span><span>G {round(nutrition.fat)} g</span></div></div>
        {error && <span className="error-text">{error}</span>}
        <div className="food-modal__confirm"><button className="secondary-button" type="button" onClick={onCancel}>Cancelar</button><button className="primary-button" type="button" onClick={confirm}>Añadir al día</button></div>
      </div>
    </div>
  </div>
}
