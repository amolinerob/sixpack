import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as jsx from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'

function load(file, imports = {}) {
  const exports = {}
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX } })
  vm.runInNewContext(outputText, { exports, require: (name) => {
    assert.ok(name in imports, name)
    return imports[name]
  } })
  return exports
}
const { calculateSmartRemainingMacros: calculate, calculateAdaptiveMacroTargets: adapt } = load('smartRemainingMacros.ts')
const base = Object.freeze({ targetCalories: 2620, consumedCalories: 2327, proteinTarget: 170, fatTarget: 65, consumedProtein: 157.1, consumedFat: 97.8 })
const run = (changes = {}) => calculate({ ...base, ...changes })
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`)
// A: enough calories, fat is capped at 30% after protein.
const allBelow = run({ consumedCalories: 1000, consumedProtein: 100, consumedFat: 20 })
close(allBelow.proteinRemainingG, 70)
close(allBelow.fatRemainingG, 402 / 9)
assert.equal(allBelow.carbsRemainingG, 235)
// B/J: real example; excess fat receives no further calories.
const real = run()
assert.equal(real.remainingCalories, 293)
close(real.proteinRemainingG, 12.9)
assert.equal(real.carbsRemainingG, 60)
assert.equal(real.fatRemainingG, 0)
// C: consumed carbs and initial carb target do not determine the recommendation.
const highCarbs = run({ consumedCalories: 2400, consumedProtein: 170, consumedFat: 65, consumedCarbs: 400, carbTarget: 340 })
assert.equal(highCarbs.carbsRemainingG, 55)
// D/E: protein remains pending even if it cannot fit; fulfilled protein reserves nothing.
const limited = run({ consumedCalories: 2610 })
close(limited.proteinRemainingG, 12.9)
assert.equal(limited.carbsRemainingG, 0)
assert.equal(limited.fatRemainingG, 0)
assert.equal(limited.insufficientCaloriesForProtein, true)
assert.equal(run({ consumedProtein: 170 }).carbsRemainingG, 75)
assert.equal(run({ consumedProtein: 180 }).proteinRemainingG, 0)
// F/G: equality and excess both exhaust energy, without hiding pending protein.
for (const consumedCalories of [2620, 2700]) {
  const result = run({ consumedCalories })
  assert.equal(result.remainingCalories, 0)
  assert.equal(result.carbsRemainingG, 0)
  assert.equal(result.fatRemainingG, 0)
  assert.equal(result.isEnergyTargetExceeded, true)
  assert.equal(result.proteinStillBelowTarget, true)
}
// H/I: use the real dynamic engine, rest and a changed activity target.
const energy = load('energy.ts')
const estimation = load('activityEstimation.ts', { './types': load('types.ts'), './energy': energy })
const { calculateDynamicDailyTargets } = load('dynamicDailyTargets.ts', { './energy': energy, './activityEstimation': estimation })
const args = { baseGoals: { sex: 'male', birthDate: '1990-01-01', heightCm: 180, targetProteinG: 165, targetFatG: 65, targetCarbsG: 220, targetDeficitKcal: 350 }, intentions: [], activities: [], measurements: [{ date: '2026-09-01', weightKg: 80 }], date: '2026-09-22' }
const rest = calculateDynamicDailyTargets(args)
assert.equal(rest.targetCalories, 1750)
const remainingRest = run({ targetCalories: rest.targetCalories, consumedCalories: 1000 })
const active = calculateDynamicDailyTargets({ ...args, intentions: ['CrossFit'] })
const remainingActive = run({ targetCalories: active.targetCalories, consumedCalories: 1000 })
assert.equal(remainingActive.remainingCalories - remainingRest.remainingCalories, 450)
assert.ok(remainingActive.carbsRemainingG > remainingRest.carbsRemainingG)
// Missing/invalid/overflow inputs cannot leak NaN, Infinity or negative output.
for (const key of Object.keys(base)) {
  for (const value of [undefined, null, NaN, Infinity, -1, '100']) assert.equal(run({ [key]: value }), undefined)
  const missing = { ...base }
  delete missing[key]
  assert.equal(calculate(missing), undefined)
}
assert.equal(run({ proteinTarget: Number.MAX_VALUE }), undefined)
assert.equal(run({ fatTarget: Number.MAX_VALUE }), undefined)
const hoy = readFileSync(new URL('../src/screens/HoyScreen.tsx', import.meta.url), 'utf8')
assert.ok(hoy.includes('consumedCalories: totals.kcal'))
assert.ok(hoy.includes('consumed={totals.kcal}'))
assert.ok(hoy.includes('<DailyGoalRing'))
console.log('Smart remaining macros: A–J, invalid inputs, dynamic target updates, energy exhaustion UI and shared Balance source passed.')

const initial = Object.freeze({ proteinG: 170, carbsG: 340, fatG: 65, targetCalories: 2620, calculationValid: true })
const intake = { consumedCalories: 2327, consumedProtein: 157.1, consumedCarbs: 190.5, consumedFat: 97.8 }
const adaptive = (changes = {}, dynamicTargets = initial) => adapt({ dynamicTargets, ...intake, ...changes })
const start = adaptive({ consumedCalories: 0, consumedProtein: 0, consumedCarbs: 0, consumedFat: 0 })
assert.equal(start.proteinTargetG, 170)
assert.equal(start.carbsTargetG, 340)
assert.equal(start.fatTargetG, 65)
const balanced = adaptive({ consumedCalories: 1310, consumedProtein: 85, consumedCarbs: 170, consumedFat: 32.5 })
assert.equal(balanced.carbsTargetG, 340)
close(balanced.fatTargetG, 64.83333333333333)
const adjusted = adaptive()
assert.equal(adjusted.proteinTargetG, 170)
assert.equal(adjusted.carbsTargetG, 250.5)
assert.equal(adjusted.fatTargetG, 65)
assert.equal(adjusted.remainingCalories, 293)
assert.equal(adjusted.remainingCarbsG, 60)
const excessCarbs = adaptive({ consumedCalories: 2550, consumedProtein: 170, consumedCarbs: 400, consumedFat: 30 })
assert.ok(excessCarbs.fatTargetG < 65)
assert.equal(adaptive({ consumedProtein: 180 }).remainingProteinG, 0)
assert.ok(adaptive({ consumedProtein: 180 }).carbsTargetG > adjusted.carbsTargetG)
assert.equal(adaptive({}, { ...initial, targetCalories: 2720 }).carbsTargetG, 275.5)
assert.equal(adaptive({}, { ...initial, targetCalories: 2520 }).carbsTargetG, 225.5)
for (const consumedCalories of [2620, 2700, 4000]) {
  const result = adaptive({ consumedCalories, consumedCarbs: 400 })
  assert.equal(result.isEnergyTargetExceeded, true)
  assert.ok(result.carbsTargetG < 400)
  assert.ok(result.carbsTargetG <= initial.carbsG)
  assert.equal(result.fatTargetG, 65)
  assert.equal(result.remainingCarbsG, 0)
}
assert.equal(adaptive({ consumedCalories: 4000 }).carbsTargetG, 0)
for (const value of [NaN, Infinity, -1, undefined]) assert.equal(adaptive({ consumedCarbs: value }), undefined)
assert.equal(adaptive({}, { ...initial, calculationValid: false }), undefined)
const restAdapted = adaptive({ consumedCalories: 1000 }, rest)
const activeAdapted = adaptive({ consumedCalories: 1000 }, active)
assert.ok(activeAdapted.carbsTargetG > restAdapted.carbsTargetG)
// Real replaces planned: 600 actual kcal, not 450 + 600.
const replaced = calculateDynamicDailyTargets({ ...args, intentions: ['CrossFit'], activities: [{ type: 'CrossFit', date: args.date, calories: 600 }] })
assert.equal(replaced.effectiveActivityKcal, 600)
assert.equal(replaced.targetCalories - active.targetCalories, 150)
assert.ok(!hoy.includes('<SmartRemainingMacros'))
const status = load('goalStatus.ts')
const { GoalProgressRing } = load('components/GoalProgressRing.tsx', { '../goalStatus': status, 'react/jsx-runtime': jsx })
const fatRing = renderToStaticMarkup(GoalProgressRing({ label: 'Grasas', percentage: 97.8 / adjusted.fatTargetG * 100 }))
assert.ok(fatRing.includes('150%'))
assert.ok(fatRing.includes('goal-progress-ring--red'))
const zeroRing = renderToStaticMarkup(GoalProgressRing({ label: 'Hidratos', percentage: 100, percentageLabel: 'Exceso', status: 'red' }))
assert.ok(zeroRing.includes('Exceso'))
assert.ok(!zeroRing.includes('Infinity'))
console.log('Adaptive targets: A–K, zero denominators, excess visibility, deficit 300/500, fallback and unchanged initial budget passed.')
