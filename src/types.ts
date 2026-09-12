export type Screen = 'hoy' | 'alimentos' | 'progreso'

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
  foodId: string
  date: string
  meal: MealName
  quantityGrams: number
  quantityUnit: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  createdAt: string
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

export type UserProfile = {
  id: string
  name: string
  weight?: number
  waist?: number
  goals?: string[]
}
