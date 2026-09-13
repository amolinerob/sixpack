export type Screen = 'hoy' | 'alimentos' | 'comidas' | 'progreso' | 'usuario'

export type User = {
  id: string
  name: string
}

export const USERS = [
  { id: 'angel', name: 'Ángel' },
  { id: 'aurora', name: 'Aurora' },
] satisfies User[]

export const MEALS = ['Desayuno', 'Comida', 'Merienda', 'Cena', 'Extras'] as const
export const ACTIVITY_TYPES = ['CrossFit', 'Bicicleta', 'Caminata', 'Carrera', 'Otra'] as const

export type MealName = (typeof MEALS)[number]
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export type FoodDiaryEntry = {
  id: string
  entryType?: 'food' | 'meal'
  foodId?: string
  date: string
  meal: MealName
  quantityGrams: number
  quantityUnit: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  /** Nombre congelado al registrar la entrada; no debe cambiar con el catálogo. */
  nameSnapshot?: string
  createdAt: string
  mealSnapshot?: MealDiarySnapshot
}

export type MealDiarySnapshot = {
  mealId: string
  name: string
  ingredients: MealDiaryIngredientSnapshot[]
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export type MealDiaryIngredientSnapshot = MealIngredient & {
  foodName: string
}

export type ActivityEntry = {
  id: string
  date: string
  type: ActivityType
  durationMinutes: number
  calories: number
  notes: string
  createdAt: string
}

export type DiaryDraft = {
  foodId: string
  meal: MealName
  quantityGrams: number
  date: string
}

export type BodyMeasurement = {
  id: string
  userId: string
  date: string
  weightKg?: number
  waistCm?: number
  createdAt: string
}

export type UserGoals = {
  targetWeightKg?: number
  targetWaistCm?: number
  /** Campo legado: se conserva en almacenamiento, pero ya no se usa como objetivo de ingesta. */
  targetCaloriesKcal?: number
  targetProteinG?: number
  targetCarbsG?: number
  targetFatG?: number
  sex?: 'male' | 'female'
  birthDate?: string
  heightCm?: number
  targetDeficitKcal?: number
}

export type UserProfile = {
  id: string
  name: string
  weight?: number
  waist?: number
  goals?: string[]
}

export type MealIngredientUnit = 'g' | 'ml' | 'unidad'

export type MealIngredient = {
  foodId: string
  quantity: number
  unit: MealIngredientUnit
}

export type Meal = {
  id: string
  name: string
  description?: string
  ingredients: MealIngredient[]
}
