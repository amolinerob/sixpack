export const MAX_REMAINING_FAT_CALORIE_SHARE = 0.30

import type { calculateDynamicDailyTargets } from './dynamicDailyTargets'

type Inputs = {
  targetCalories: number | undefined
  consumedCalories: number
  proteinTarget: number | undefined
  fatTarget: number | undefined
  consumedProtein: number
  consumedFat: number
}

/** One-way adjustment: never feeds the adapted macros back into the energy budget. */
export function calculateAdaptiveMacroTargets({ dynamicTargets, consumedCalories, consumedProtein, consumedCarbs, consumedFat }: {
  dynamicTargets: ReturnType<typeof calculateDynamicDailyTargets>
  consumedCalories: number
  consumedProtein: number
  consumedCarbs: number
  consumedFat: number
}) {
  const { proteinG, carbsG, fatG, targetCalories } = dynamicTargets
  if (!dynamicTargets.calculationValid || proteinG === undefined || carbsG === undefined || fatG === undefined
    || targetCalories === undefined || !Number.isFinite(carbsG) || carbsG < 0
    || !Number.isFinite(consumedCarbs) || consumedCarbs < 0) return undefined
  const remaining = calculateSmartRemainingMacros({ targetCalories, consumedCalories,
    proteinTarget: proteinG, fatTarget: fatG, consumedProtein, consumedFat })
  if (!remaining) return undefined

  const dayNotStarted = consumedCalories === 0 && consumedProtein === 0 && consumedCarbs === 0 && consumedFat === 0
  // Keep the signed budget here: clamping it first would hide excess behind a 100% ring.
  // This also preserves the difference between stored kcal and macro-derived kcal.
  const compatibleCarbs = Math.max(0, consumedCarbs + (targetCalories - consumedCalories) / 4 - remaining.proteinRemainingG)
  const carbsTargetG = dayNotStarted ? carbsG : remaining.carbsRemainingG > 0
    ? consumedCarbs + remaining.carbsRemainingG
    : Math.min(carbsG, compatibleCarbs)
  const fatTargetG = dayNotStarted || consumedFat >= fatG ? fatG
    : Math.min(fatG, consumedFat + remaining.fatRemainingG)
  if (![carbsTargetG, fatTargetG].every(Number.isFinite)) return undefined
  return { proteinTargetG: proteinG, carbsTargetG, fatTargetG,
    remainingCalories: remaining.remainingCalories, remainingProteinG: remaining.proteinRemainingG,
    remainingCarbsG: remaining.carbsRemainingG, remainingFatG: remaining.fatRemainingG,
    isEnergyTargetExceeded: remaining.isEnergyTargetExceeded,
    insufficientCaloriesForProtein: remaining.insufficientCaloriesForProtein }
}

/** Nutrition still pending is independent of the energy budget; protein is never reduced. */
export function calculateSmartRemainingMacros(input: Inputs) {
  const { targetCalories, consumedCalories, proteinTarget, fatTarget, consumedProtein, consumedFat } = input
  if (targetCalories === undefined || proteinTarget === undefined || fatTarget === undefined
    || ![targetCalories, consumedCalories, proteinTarget, fatTarget, consumedProtein, consumedFat]
      .every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0)) return undefined

  const remainingCalories = Math.max(0, targetCalories - consumedCalories)
  const proteinRemainingG = Math.max(0, proteinTarget - consumedProtein)
  const proteinCalories = proteinRemainingG * 4
  const fatCalories = Math.max(0, fatTarget - consumedFat) * 9
  if (!Number.isFinite(proteinCalories) || !Number.isFinite(fatCalories)) return undefined
  const afterProtein = Math.max(0, remainingCalories - proteinCalories)
  const reservedFatCalories = Math.min(fatCalories, afterProtein * MAX_REMAINING_FAT_CALORIE_SHARE)

  return {
    remainingCalories,
    proteinRemainingG,
    carbsRemainingG: Math.round((afterProtein - reservedFatCalories) / 4 / 5) * 5,
    fatRemainingG: reservedFatCalories / 9,
    isEnergyTargetExceeded: consumedCalories >= targetCalories,
    proteinStillBelowTarget: proteinRemainingG > 0,
    insufficientCaloriesForProtein: proteinCalories > remainingCalories,
  }
}
