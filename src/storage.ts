import type { ActivityEntry, BodyMeasurement, FoodDiaryEntry, Meal, User, UserGoals } from './types'
import { USERS } from './types'
import type { FoodItem } from './data/foods'
import { foods as baseFoods } from './data/foods'

const ACTIVE_USER_KEY = 'sixpack.active.user.v1'
const MIGRATION_DONE_KEY = 'sixpack.legacy.migration.v1'
const LEGACY_ENTRIES_KEY = 'sixpack.diary.entries.v1'
const LEGACY_ACTIVITIES_KEY = 'sixpack.activities.entries.v1'
const SHARED_FOODS_KEY = 'sixpack.shared.foods.v1'
const SHARED_MEALS_KEY = 'sixpack.shared.meals.v1'

export const DEFAULT_USER_ID = 'angel'

export function getEntriesStorageKey(userId: string) {
  return `sixpack.diary.entries.v1.${userId}`
}

export function getActivitiesStorageKey(userId: string) {
  return `sixpack.activities.entries.v1.${userId}`
}

export function getBodyMeasurementsStorageKey(userId: string) {
  return `sixpack.body.measurements.v1.${userId}`
}

export function getUserGoalsStorageKey(userId: string) {
  return `sixpack.user.goals.v1.${userId}`
}

export function getSharedFoodsStorageKey() {
  return SHARED_FOODS_KEY
}

export function getSharedMealsStorageKey() {
  return SHARED_MEALS_KEY
}

export function getUserById(userId: string | null | undefined): User | undefined {
  return USERS.find((user) => user.id === userId)
}

export function getActiveUserId(): string | null {
  const raw = localStorage.getItem(ACTIVE_USER_KEY)
  if (!raw) {
    return null
  }

  return getUserById(raw)?.id ?? null
}

export function setActiveUserId(userId: string) {
  if (!getUserById(userId)) {
    return
  }

  localStorage.setItem(ACTIVE_USER_KEY, userId)
}

export function clearActiveUserId() {
  localStorage.removeItem(ACTIVE_USER_KEY)
}

export function getActiveUser(): User | undefined {
  const userId = getActiveUserId()
  return getUserById(userId)
}

export function loadEntries(userId: string): FoodDiaryEntry[] {
  const raw = localStorage.getItem(getEntriesStorageKey(userId))
  if (!raw) {
    return []
  }

  try {
    return JSON.parse(raw) as FoodDiaryEntry[]
  } catch {
    return []
  }
}

export function saveEntries(userId: string, entries: FoodDiaryEntry[]) {
  localStorage.setItem(getEntriesStorageKey(userId), JSON.stringify(entries))
}

export function loadActivities(userId: string): ActivityEntry[] {
  const raw = localStorage.getItem(getActivitiesStorageKey(userId))
  if (!raw) {
    return []
  }

  try {
    return JSON.parse(raw) as ActivityEntry[]
  } catch {
    return []
  }
}

export function saveActivities(userId: string, activities: ActivityEntry[]) {
  localStorage.setItem(getActivitiesStorageKey(userId), JSON.stringify(activities))
}

export function loadBodyMeasurements(userId: string): BodyMeasurement[] {
  const raw = localStorage.getItem(getBodyMeasurementsStorageKey(userId))
  if (!raw) {
    return []
  }

  try {
    return JSON.parse(raw) as BodyMeasurement[]
  } catch {
    return []
  }
}

export function saveBodyMeasurements(userId: string, measurements: BodyMeasurement[]) {
  localStorage.setItem(getBodyMeasurementsStorageKey(userId), JSON.stringify(measurements))
}

export function loadUserGoals(userId: string): UserGoals {
  const raw = localStorage.getItem(getUserGoalsStorageKey(userId))
  if (!raw) {
    return {}
  }

  try {
    return JSON.parse(raw) as UserGoals
  } catch {
    return {}
  }
}

export function saveUserGoals(userId: string, goals: UserGoals) {
  localStorage.setItem(getUserGoalsStorageKey(userId), JSON.stringify(goals))
}

export function loadSharedFoods(): FoodItem[] {
  const raw = localStorage.getItem(getSharedFoodsStorageKey())
  if (!raw) {
    return []
  }

  try {
    return JSON.parse(raw) as FoodItem[]
  } catch {
    return []
  }
}

export function saveSharedFoods(items: FoodItem[]) {
  localStorage.setItem(getSharedFoodsStorageKey(), JSON.stringify(items))
}

export function getCombinedFoods(): FoodItem[] {
  const shared = loadSharedFoods()
  const baseMap = new Map(baseFoods.map((food) => [food.id, food]))
  const overrideMap = new Map(shared.map((food) => [food.id, food]))

  const mergedBase = baseFoods.map((food) => {
    return { ...food, ...(overrideMap.get(food.id) ?? {}) }
  })

  const customFoods = shared.filter((food) => !baseMap.has(food.id))

  return [...mergedBase, ...customFoods]
}

export function saveFoodToShared(food: FoodItem) {
  const shared = loadSharedFoods()
  const index = shared.findIndex((item) => item.id === food.id)
  if (index >= 0) {
    shared[index] = food
  } else {
    shared.push(food)
  }

  saveSharedFoods(shared)
}

export function deleteSharedFood(foodId: string) {
  const shared = loadSharedFoods()
  const next = shared.filter((food) => food.id !== foodId)
  saveSharedFoods(next)
}

export function getFoodByIdFromCombined(foodId: string): FoodItem | undefined {
  return getCombinedFoods().find((food) => food.id === foodId)
}

export function loadSharedMeals(): Meal[] {
  const raw = localStorage.getItem(getSharedMealsStorageKey())
  if (!raw) {
    return []
  }

  try {
    return JSON.parse(raw) as Meal[]
  } catch {
    return []
  }
}

export function saveSharedMeals(meals: Meal[]) {
  localStorage.setItem(getSharedMealsStorageKey(), JSON.stringify(meals))
}

export function createSharedMeal(meal: Meal) {
  saveSharedMeals([...loadSharedMeals(), meal])
}

export function updateSharedMeal(meal: Meal) {
  const meals = loadSharedMeals()
  saveSharedMeals(meals.map((item) => item.id === meal.id ? meal : item))
}

export function deleteSharedMeal(mealId: string) {
  saveSharedMeals(loadSharedMeals().filter((meal) => meal.id !== mealId))
}

export function migrateLegacyDataToAngel() {
  if (localStorage.getItem(MIGRATION_DONE_KEY) === '1') {
    return
  }

  const legacyEntriesRaw = localStorage.getItem(LEGACY_ENTRIES_KEY)
  if (legacyEntriesRaw) {
    try {
      const legacyEntries = JSON.parse(legacyEntriesRaw) as FoodDiaryEntry[]
      const storedEntries = loadEntries(DEFAULT_USER_ID)
      const mergedEntries = [...storedEntries, ...legacyEntries]
      saveEntries(DEFAULT_USER_ID, mergedEntries)
    } catch {
      // silent migration fallback
    }
  }

  const legacyActivitiesRaw = localStorage.getItem(LEGACY_ACTIVITIES_KEY)
  if (legacyActivitiesRaw) {
    try {
      const legacyActivities = JSON.parse(legacyActivitiesRaw) as ActivityEntry[]
      const storedActivities = loadActivities(DEFAULT_USER_ID)
      const mergedActivities = [...storedActivities, ...legacyActivities]
      saveActivities(DEFAULT_USER_ID, mergedActivities)
    } catch {
      // silent migration fallback
    }
  }

  localStorage.setItem(MIGRATION_DONE_KEY, '1')
}
