import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(file, imports = {}) {
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX } })
  const exports = {}
  vm.runInNewContext(outputText, { exports, require: (name) => {
    assert.ok(name in imports, name)
    return imports[name]
  } })
  return exports
}
const energy = load('energy.ts')
const weekly = load('weeklySummary.ts', { './energy': energy })
const recommendations = load('goalRecommendations.ts', { './energy': energy, './weeklySummary': weekly })
const goals = { sex: 'male', birthDate: '1990-01-01', heightCm: 180 }
const measurements = [{ date: '2026-09-12', weightKg: 83 }, { date: '2026-09-16', weightKg: 82 }, { date: '2026-09-20', weightKg: 99 }]
const activities = [{ date: '2026-09-16', calories: 420 }, { date: '2026-09-16', calories: 180 }, { date: '2026-09-17', calories: 999 }]
const entries = [{ date: '2026-09-16', kcal: 2000, protein: 160, carbs: 200, fat: 60 }]
const source = readFileSync(new URL('../src/screens/HoyScreen.tsx', import.meta.url), 'utf8')
const snippet = source.slice(source.indexOf('  const dateEntries ='), source.indexOf('  const dynamicTargets =')) + source.slice(source.indexOf('  const dailyEnergyBalance ='), source.indexOf('  const dailyGoals =')) + '\nresult = { ...dailyEnergyBalance, activityTotal };'
function compare(testMeasurements, testActivities) {
  const context = { balanceToday: '2026-09-25', activityPlan: { ready: true }, dynamicTargets: { effectiveActivityKcal: 9999 }, goals, measurements: testMeasurements, activities: testActivities, entries, selectedDate: '2026-09-16', useMemo: (fn) => fn(), ...energy }
  vm.runInNewContext(snippet, context)
  const summary = weekly.createWeeklySummary({ goals, measurements: testMeasurements, activities: testActivities, entries, today: '2026-09-19', range: { start: '2026-09-14', end: '2026-09-20' } })
  const day = summary.days.find((item) => item.date === context.selectedDate)
  for (const key of Object.keys(day.energy)) assert.equal(context.result[key], day.energy[key])
  assert.equal(context.result.activityTotal, day.activeCalories)
  assert.equal(day.energy.weightKg, 82)
  assert.equal(day.energy.bmr, 1770)
  assert.equal(day.energy.baseDailyExpenditure, 2124)
  assert.equal(day.activeCalories, 600)
  assert.equal(day.energy.estimatedDailyExpenditure, 2724)
  assert.equal(day.energy.estimatedDeficit, 724)
  return recommendations.calculateGoalRecommendations({ today: '2026-09-19', profile: goals, measurements: testMeasurements, activities: testActivities })
}
const normal = compare(measurements, activities)
const dirtyWeights = [NaN, Infinity, -20, 0].map((weightKg) => ({ date: '2026-09-16', weightKg }))
const dirtyActivities = [NaN, Infinity, -200, 0].map((calories) => ({ date: '2026-09-16', calories }))
const robust = compare([...dirtyWeights, ...measurements], [...activities, ...dirtyActivities])
assert.equal(JSON.stringify(robust), JSON.stringify(normal))
for (const weightKg of [NaN, Infinity, -20, 0]) {
  assert.equal(energy.getLatestWeightForDate([{ date: '2026-09-17', weightKg }, ...measurements], '2026-09-18'), 82)
}
assert.equal(energy.getLatestWeightForDate(measurements, '2026-09-15'), 83)
assert.equal(energy.getLatestWeightForDate(measurements, '2026-09-11'), undefined)
assert.equal(energy.isValidActiveKcal(0), true)
assert.equal(energy.getActiveKcalForDate(dirtyActivities, '2026-09-16'), 0)
assert.equal(energy.calculateEstimatedDeficit(2000, 2500), -500)
console.log('Energy robustness: actual Hoy calculation matches weeklySummary; BMR 1770, base 2124, activity 600, expenditure 2724. Invalid weights/activities ignored; recommendation results unchanged.')
