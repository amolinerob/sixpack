import { supabase } from '../lib/supabase'
import { getCombinedFoods, loadActivities, loadBodyMeasurements, loadEntries, loadSharedMeals, loadUserGoals } from '../storage'

const SOURCE = 'sixpack-local'

export type MigrationReview = { profile: number; goals: number; measurements: number; activities: number; diary: number; foods: number; meals: number }
export type MigrationResult = MigrationReview & { errors: string[] }

export function reviewLocalMigration(legacyUserKey: string): MigrationReview {
  return {
    profile: 1,
    goals: 1,
    measurements: loadBodyMeasurements(legacyUserKey).length,
    activities: loadActivities(legacyUserKey).length,
    diary: loadEntries(legacyUserKey).length,
    foods: getCombinedFoods().length,
    meals: loadSharedMeals().length,
  }
}

async function householdForUser(userId: string) {
  const { data, error } = await supabase.from('household_members').select('household_id').eq('user_id', userId).limit(1).single()
  if (error || !data?.household_id) throw new Error('No se encontró un hogar para el perfil autenticado.')
  return data.household_id as string
}

export async function migrateLocalData({ userId, legacyUserKey }: { userId: string; legacyUserKey: string }): Promise<MigrationResult> {
  const review = reviewLocalMigration(legacyUserKey)
  const result: MigrationResult = { ...review, errors: [] }
  const goals = loadUserGoals(legacyUserKey)
  const measurements = loadBodyMeasurements(legacyUserKey)
  const activities = loadActivities(legacyUserKey)
  const entries = loadEntries(legacyUserKey)
  // Es la misma fuente efectiva que ve la pantalla Alimentos: base, overrides y manuales.
  const foods = getCombinedFoods()
  const meals = loadSharedMeals()
  try {
    const householdId = await householdForUser(userId)
    const profileUpdate = await supabase.from('profiles').update({ sex: goals.sex ?? null, birth_date: goals.birthDate ?? null, height_cm: goals.heightCm ?? null }).eq('id', userId)
    if (profileUpdate.error) throw profileUpdate.error
    const goalsUpsert = await supabase.from('user_goals').upsert({ user_id: userId, target_weight_kg: goals.targetWeightKg ?? null, target_waist_cm: goals.targetWaistCm ?? null, target_deficit_kcal: goals.targetDeficitKcal ?? null, target_protein_g: goals.targetProteinG ?? null, target_carbs_g: goals.targetCarbsG ?? null, target_fat_g: goals.targetFatG ?? null }, { onConflict: 'user_id' })
    if (goalsUpsert.error) throw goalsUpsert.error
    const foodIdMap = new Map<string, string>()
    for (const food of foods) {
      const existing = await supabase
        .from('foods')
        .select('id')
        .eq('household_id', householdId)
        .eq('legacy_source', SOURCE)
        .eq('legacy_local_id', food.id)
        .maybeSingle()
      if (existing.error) throw existing.error

      if (existing.data?.id) {
        foodIdMap.set(food.id, existing.data.id)
        continue
      }

      const inserted = await supabase
        .from('foods')
        .insert({
          household_id: householdId,
          created_by: userId,
          scope: 'household',
          legacy_source: SOURCE,
          legacy_local_id: food.id,
          name: food.name,
          brand: food.brand ?? null,
          usual_serving_g: food.servingGrams ?? null,
          kcal_per_100g: food.kcal100g,
          protein_per_100g: food.protein100g,
          carbs_per_100g: food.carbs100g,
          fat_per_100g: food.fat100g,
        })
        .select('id')
        .single()
      if (inserted.error || !inserted.data) throw inserted.error ?? new Error('No se pudo crear un alimento migrado.')
      foodIdMap.set(food.id, inserted.data.id)
    }

    // El mapa de alimentos está completo antes de intentar resolver recetas.
    const mealIdMap = new Map<string, string>()
    for (const meal of meals) {
      const missingIngredient = meal.ingredients.find((ingredient) => !foodIdMap.has(ingredient.foodId))
      if (missingIngredient) {
        result.errors.push(`La receta \"${meal.name}\" no se migró porque el alimento local \"${missingIngredient.foodId}\" no existe en el catálogo combinado.`)
        continue
      }
      const { data, error } = await supabase.from('meals').upsert({ household_id: householdId, created_by: userId, legacy_source: SOURCE, legacy_local_id: meal.id, name: meal.name, description: meal.description ?? null }, { onConflict: 'household_id,legacy_source,legacy_local_id' }).select('id').single()
      if (error || !data) throw error ?? new Error('No se pudo resolver una comida migrada.')
      mealIdMap.set(meal.id, data.id)
      const ingredients = meal.ingredients.map((ingredient, position) => {
        const foodId = foodIdMap.get(ingredient.foodId)
        if (!foodId) throw new Error(`La receta “${meal.name}” usa un alimento base sin ID de Supabase. Importa o mapea primero el catálogo base.`)
        return { meal_id: data.id, food_id: foodId, quantity: ingredient.quantity, unit: ingredient.unit, sort_order: position, legacy_source: SOURCE, legacy_local_id: `${meal.id}:${position}` }
      })
      if (ingredients.length) { const response = await supabase.from('meal_ingredients').upsert(ingredients, { onConflict: 'meal_id,legacy_source,legacy_local_id' }); if (response.error) throw response.error }
    }
    const measurementRows = measurements.map((item) => ({ user_id: userId, measurement_date: item.date, weight_kg: item.weightKg ?? null, waist_cm: item.waistCm ?? null, legacy_source: SOURCE, legacy_local_id: item.id }))
    if (measurementRows.length) { const response = await supabase.from('body_measurements').upsert(measurementRows, { onConflict: 'user_id,legacy_source,legacy_local_id' }); if (response.error) throw response.error }
    const activityRows = activities.map((item) => ({ user_id: userId, activity_date: item.date, activity_type: item.type, name: item.notes || item.type, active_kcal: item.calories, duration_minutes: item.durationMinutes, source: 'manual', legacy_source: SOURCE, legacy_local_id: item.id }))
    if (activityRows.length) { const response = await supabase.from('activities').upsert(activityRows, { onConflict: 'user_id,legacy_source,legacy_local_id' }); if (response.error) throw response.error }
    const diaryRows = entries.map((item) => ({
      user_id: userId,
      entry_date: item.date,
      legacy_source: SOURCE,
      legacy_local_id: item.id,
      food_id: item.foodId ? foodIdMap.get(item.foodId) ?? null : null,
      meal_id: item.mealSnapshot?.mealId ? mealIdMap.get(item.mealSnapshot.mealId) ?? null : null,
      meal_slot: item.meal,
      entry_type: item.entryType ?? (item.mealSnapshot ? 'meal' : 'food'),
      name_snapshot: item.mealSnapshot?.name ?? foods.find((food) => food.id === item.foodId)?.name ?? 'Alimento',
      quantity: item.quantityGrams,
      unit: item.quantityUnit,
      kcal_snapshot: item.kcal,
      protein_snapshot: item.protein,
      carbs_snapshot: item.carbs,
      fat_snapshot: item.fat,
      ingredients_snapshot: item.mealSnapshot?.ingredients ?? null,
    }))
    if (diaryRows.length) { const response = await supabase.from('diary_entries').upsert(diaryRows, { onConflict: 'user_id,legacy_source,legacy_local_id' }); if (response.error) throw response.error }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Error desconocido durante la migración.')
    console.error('Error de migración local a Supabase', error)
  }
  return result
}
