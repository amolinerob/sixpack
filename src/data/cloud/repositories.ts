import { supabase } from '../../lib/supabase'
import type { FoodItem } from '../foods'
import type { AccentColor, ActivityEntry, BodyMeasurement, FoodDiaryEntry, Meal, MealIngredient, UserGoals, UserPreferences } from '../../types'
import { isAccentColor } from '../../theme'

type ProfileData = { id: string; displayName: string; sex?: UserGoals['sex']; birthDate?: string; heightCm?: number }

function optionalNumber(value: unknown) { return value === null || value === undefined ? undefined : Number(value) }
function requireData<T>(data: T | null, error: { message: string } | null, message: string): T {
  if (error) throw new Error(error.message)
  if (!data) throw new Error(message)
  return data
}

export async function getHouseholdId(userId: string) {
  const response = await supabase.from('household_members').select('household_id').eq('user_id', userId).limit(1).single()
  return requireData(response.data?.household_id ?? null, response.error, 'No se encontró el hogar del usuario.')
}

export const profileRepository = {
  async get(userId: string): Promise<ProfileData> {
    const response = await supabase.from('profiles').select('id, display_name, sex, birth_date, height_cm').eq('id', userId).single()
    const row = requireData(response.data, response.error, 'No se encontró el perfil.')
    return { id: row.id, displayName: row.display_name ?? '', sex: row.sex ?? undefined, birthDate: row.birth_date ?? undefined, heightCm: optionalNumber(row.height_cm) }
  },
  async update(userId: string, data: Pick<ProfileData, 'sex' | 'birthDate' | 'heightCm'>) {
    const response = await supabase.from('profiles').update({ sex: data.sex ?? null, birth_date: data.birthDate ?? null, height_cm: data.heightCm ?? null }).eq('id', userId)
    if (response.error) throw new Error(response.error.message)
  },
}

function preferencesError(operation: 'leer' | 'guardar', error: { code?: string; message: string; details?: string | null; hint?: string | null }): never {
  console.error(`Error al ${operation} user_preferences`, {
    code: error.code, message: error.message, details: error.details, hint: error.hint,
  })
  if (error.code === 'PGRST205' || error.code === '42P01') {
    throw new Error('Supabase no encuentra la tabla user_preferences. Ejecuta la migración 202609190001_user_preferences.sql en el proyecto configurado.')
  }
  if (error.code === '42501') {
    throw new Error('Supabase ha denegado el acceso a user_preferences. Revisa los permisos y las policies RLS del usuario autenticado.')
  }
  throw new Error(`No se pudo ${operation} la preferencia de color${error.code ? ` (${error.code})` : ''}. ${error.message}`)
}

export const userPreferencesRepository = {
  async get(userId: string): Promise<UserPreferences | null> {
    const { data, error } = await supabase.from('user_preferences').select('accent_color').eq('user_id', userId).maybeSingle()
    if (error) preferencesError('leer', error)
    if (!data) return null
    if (!isAccentColor(data.accent_color)) throw new Error('El color guardado no es válido.')
    return { accentColor: data.accent_color }
  },
  async upsert(userId: string, accentColor: AccentColor): Promise<UserPreferences> {
    if (!isAccentColor(accentColor)) throw new Error('Elige un color de la paleta.')
    const response = await supabase.from('user_preferences')
      .upsert({ user_id: userId, accent_color: accentColor }, { onConflict: 'user_id' })
      .select('accent_color').single()
    if (response.error) preferencesError('guardar', response.error)
    const row = requireData(response.data, response.error, 'No se pudo guardar el color.')
    if (!isAccentColor(row.accent_color)) throw new Error('El color guardado no es válido.')
    return { accentColor: row.accent_color }
  },
}

export const goalsRepository = {
  async get(userId: string): Promise<UserGoals> {
    const response = await supabase.from('user_goals').select('*').eq('user_id', userId).maybeSingle()
    if (response.error) throw new Error(response.error.message)
    const row = response.data
    if (!row) return {}
    return { targetWeightKg: optionalNumber(row.target_weight_kg), targetWaistCm: optionalNumber(row.target_waist_cm), targetDeficitKcal: optionalNumber(row.target_deficit_kcal), targetProteinG: optionalNumber(row.target_protein_g), targetCarbsG: optionalNumber(row.target_carbs_g), targetFatG: optionalNumber(row.target_fat_g) }
  },
  async save(userId: string, goals: UserGoals) {
    const response = await supabase.from('user_goals').upsert({ user_id: userId, target_weight_kg: goals.targetWeightKg ?? null, target_waist_cm: goals.targetWaistCm ?? null, target_deficit_kcal: goals.targetDeficitKcal ?? null, target_protein_g: goals.targetProteinG ?? null, target_carbs_g: goals.targetCarbsG ?? null, target_fat_g: goals.targetFatG ?? null }, { onConflict: 'user_id' })
    if (response.error) throw new Error(response.error.message)
  },
}

function foodFromRow(row: any): FoodItem {
  const servingGrams = optionalNumber(row.usual_serving_g)
  return { id: row.id, name: row.name, brand: row.brand ?? '', servingHabitual: servingGrams === undefined ? '' : `${servingGrams} g`, servingUnit: servingGrams === undefined ? null : 'g', servingGrams: servingGrams ?? null, kcal100g: Number(row.kcal_per_100g), protein100g: Number(row.protein_per_100g), carbs100g: Number(row.carbs_per_100g), fat100g: Number(row.fat_per_100g) }
}

export const foodsRepository = {
  async list(userId: string) {
    const householdId = await getHouseholdId(userId)
    const response = await supabase.from('foods').select('*').or(`scope.eq.system,and(scope.eq.household,household_id.eq.${householdId})`).order('name')
    if (response.error) throw new Error(response.error.message)
    return (response.data ?? []).map(foodFromRow)
  },
  async save(userId: string, food: Omit<FoodItem, 'id'>, id?: string) {
    if (id) {
      const response = await supabase.from('foods').update({ name: food.name, brand: food.brand || null, usual_serving_g: food.servingGrams, kcal_per_100g: food.kcal100g, protein_per_100g: food.protein100g, carbs_per_100g: food.carbs100g, fat_per_100g: food.fat100g }).eq('id', id).eq('scope', 'household').select('*').single()
      return foodFromRow(requireData(response.data, response.error, 'No se pudo actualizar el alimento.'))
    }
    const householdId = await getHouseholdId(userId)
    const response = await supabase.from('foods').insert({ household_id: householdId, scope: 'household', created_by: userId, name: food.name, brand: food.brand || null, usual_serving_g: food.servingGrams, kcal_per_100g: food.kcal100g, protein_per_100g: food.protein100g, carbs_per_100g: food.carbs100g, fat_per_100g: food.fat100g }).select('*').single()
    return foodFromRow(requireData(response.data, response.error, 'No se pudo crear el alimento.'))
  },
  async remove(id: string) { const response = await supabase.from('foods').delete().eq('id', id).eq('scope', 'household'); if (response.error) throw new Error(response.error.message) },
}

export const mealsRepository = {
  async list(userId: string): Promise<Meal[]> {
    const householdId = await getHouseholdId(userId)
    const meals = await supabase.from('meals').select('id, name, description, meal_ingredients(food_id, quantity, unit, sort_order)').eq('household_id', householdId).order('name')
    if (meals.error) throw new Error(meals.error.message)
    return (meals.data ?? []).map((row: any) => ({ id: row.id, name: row.name, description: row.description ?? undefined, ingredients: (row.meal_ingredients ?? []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((item: any): MealIngredient => ({ foodId: item.food_id, quantity: Number(item.quantity), unit: item.unit })) }))
  },
  async save(userId: string, meal: Omit<Meal, 'id'>, id?: string): Promise<Meal> {
    const householdId = await getHouseholdId(userId)
    let mealId = id
    if (id) {
      const response = await supabase.from('meals').update({ name: meal.name, description: meal.description ?? null }).eq('id', id).select('id').single()
      mealId = requireData(response.data, response.error, 'No se pudo actualizar la comida.').id
      const remove = await supabase.from('meal_ingredients').delete().eq('meal_id', mealId)
      if (remove.error) throw new Error(remove.error.message)
    } else {
      const response = await supabase.from('meals').insert({ household_id: householdId, created_by: userId, name: meal.name, description: meal.description ?? null }).select('id').single()
      mealId = requireData(response.data, response.error, 'No se pudo crear la comida.').id
    }
    if (meal.ingredients.length) {
      const response = await supabase.from('meal_ingredients').insert(meal.ingredients.map((item, sortOrder) => ({ meal_id: mealId, food_id: item.foodId, quantity: item.quantity, unit: item.unit, sort_order: sortOrder })))
      if (response.error) throw new Error(response.error.message)
    }
    return { id: mealId!, ...meal }
  },
  async remove(id: string) { const response = await supabase.from('meals').delete().eq('id', id); if (response.error) throw new Error(response.error.message) },
}

function diaryFromRow(row: any): FoodDiaryEntry {
  return { id: row.id, entryType: row.entry_type ?? 'food', foodId: row.food_id ?? undefined, date: row.entry_date, meal: row.meal_slot, quantityGrams: Number(row.quantity ?? 0), quantityUnit: row.unit ?? 'g', kcal: Number(row.kcal_snapshot), protein: Number(row.protein_snapshot), carbs: Number(row.carbs_snapshot), fat: Number(row.fat_snapshot), nameSnapshot: row.name_snapshot, createdAt: row.created_at ?? row.entry_date, mealSnapshot: row.meal_id || row.ingredients_snapshot ? { mealId: row.meal_id ?? '', name: row.name_snapshot, ingredients: row.ingredients_snapshot ?? [], kcal: Number(row.kcal_snapshot), protein: Number(row.protein_snapshot), carbs: Number(row.carbs_snapshot), fat: Number(row.fat_snapshot) } : undefined }
}
export const diaryRepository = {
  async list(userId: string) { const response = await supabase.from('diary_entries').select('*').eq('user_id', userId).order('entry_date'); if (response.error) throw new Error(response.error.message); return (response.data ?? []).map(diaryFromRow) },
  async save(userId: string, entry: Omit<FoodDiaryEntry, 'id'>, id?: string) {
    const isMeal = entry.entryType === 'meal'
    const values = { user_id: userId, entry_date: entry.date, meal_slot: entry.meal, entry_type: isMeal ? 'meal' : 'food', food_id: isMeal ? null : entry.foodId ?? null, meal_id: isMeal ? entry.mealSnapshot?.mealId || null : null, name_snapshot: entry.nameSnapshot ?? entry.mealSnapshot?.name ?? 'Alimento', quantity: isMeal ? null : entry.quantityGrams, unit: isMeal ? null : entry.quantityUnit, kcal_snapshot: entry.kcal, protein_snapshot: entry.protein, carbs_snapshot: entry.carbs, fat_snapshot: entry.fat, ingredients_snapshot: isMeal ? entry.mealSnapshot?.ingredients ?? [] : null }
    const response = id ? await supabase.from('diary_entries').update(values).eq('id', id).select('*').single() : await supabase.from('diary_entries').insert(values).select('*').single()
    if (response.error) {
      console.error('Error al guardar diary_entries', { code: response.error.code, message: response.error.message, details: response.error.details, hint: response.error.hint })
      throw new Error(response.error.message)
    }
    return diaryFromRow(requireData(response.data, null, 'No se pudo guardar la entrada.'))
  },
  async remove(id: string) { const response = await supabase.from('diary_entries').delete().eq('id', id); if (response.error) throw new Error(response.error.message) },
}

function measurementFromRow(row: any): BodyMeasurement { return { id: row.id, userId: row.user_id, date: row.measurement_date, weightKg: optionalNumber(row.weight_kg), waistCm: optionalNumber(row.waist_cm), createdAt: row.created_at ?? row.measurement_date } }
export const measurementsRepository = {
  async list(userId: string) { const response = await supabase.from('body_measurements').select('*').eq('user_id', userId).order('measurement_date'); if (response.error) throw new Error(response.error.message); return (response.data ?? []).map(measurementFromRow) },
  async save(userId: string, measurement: Omit<BodyMeasurement, 'id' | 'userId' | 'createdAt'>, id?: string) { const values = { user_id: userId, measurement_date: measurement.date, weight_kg: measurement.weightKg ?? null, waist_cm: measurement.waistCm ?? null }; const response = id ? await supabase.from('body_measurements').update(values).eq('id', id).select('*').single() : await supabase.from('body_measurements').insert(values).select('*').single(); return measurementFromRow(requireData(response.data, response.error, 'No se pudo guardar la medición.')) },
  async remove(id: string) { const response = await supabase.from('body_measurements').delete().eq('id', id); if (response.error) throw new Error(response.error.message) },
}

function activityFromRow(row: any): ActivityEntry { return { id: row.id, date: row.activity_date, type: row.activity_type, durationMinutes: Number(row.duration_minutes ?? 0), calories: Number(row.active_kcal), notes: row.name ?? '', createdAt: row.created_at ?? row.activity_date } }
export const activitiesRepository = {
  async list(userId: string) { const response = await supabase.from('activities').select('*').eq('user_id', userId).order('activity_date'); if (response.error) throw new Error(response.error.message); return (response.data ?? []).map(activityFromRow) },
  async save(userId: string, activity: Omit<ActivityEntry, 'id' | 'createdAt'>, id?: string) { const values = { user_id: userId, activity_date: activity.date, activity_type: activity.type, name: activity.notes || activity.type, active_kcal: activity.calories, duration_minutes: activity.durationMinutes, source: 'manual' }; const response = id ? await supabase.from('activities').update(values).eq('id', id).select('*').single() : await supabase.from('activities').insert(values).select('*').single(); return activityFromRow(requireData(response.data, response.error, 'No se pudo guardar la actividad.')) },
  async remove(id: string) { const response = await supabase.from('activities').delete().eq('id', id); if (response.error) throw new Error(response.error.message) },
}
