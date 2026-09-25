import type { FoodItem } from '../data/foods'

const number = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })

export function FoodMacroSummary({ food }: { food: FoodItem }) {
  return <span className="food-macro-summary">P {number.format(food.protein100g)} · HC {number.format(food.carbs100g)} · G {number.format(food.fat100g)} · {number.format(food.kcal100g)} kcal / 100 g</span>
}
