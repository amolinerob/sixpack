import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as react from 'react'
import * as jsx from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'

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
const { createWeeklySummary } = load('weeklySummary.ts', { './energy': energy })
const data = load('weeklyMacrosSeries.ts')
const { WeeklyMacrosChart } = load('components/WeeklyMacrosChart.tsx', { '../chartTheme': load('chartTheme.ts'), react, 'react/jsx-runtime': jsx, '../weeklyMacrosSeries': data })
const goals = { targetProteinG: 165, targetCarbsG: 220, targetFatG: 65 }
const args = {
  range: { start: '2026-09-14', end: '2026-09-20' }, today: '2026-09-16', goals, activities: [], measurements: [],
  entries: [
    { date: '2026-09-14', kcal: 1000, protein: 100, carbs: 150, fat: 40 },
    { date: '2026-09-14', kcal: 400, protein: 20, carbs: 30, fat: 10 },
    { date: '2026-09-16', kcal: 1400, protein: 180, carbs: 240, fat: 70 },
    { date: '2026-09-18', kcal: 1000, protein: 999, carbs: 999, fat: 999 },
  ],
}
const summary = createWeeklySummary(args)
const series = data.getWeeklyMacrosSeries(summary, goals)
assert.equal(series.length, 3)
assert.equal(new Set(series.map((macro) => macro.color)).size, 3)
for (const macro of series) {
  assert.equal(macro.points.length, 3)
  assert.equal(macro.points[1].value, 0)
  assert.equal(macro.average, summary.sum[macro.key] / summary.dayCount)
  assert.equal(macro.targetValue, goals[macro.target])
}
assert.equal(series[0].average, 100)
assert.equal(series[1].average, 140)
assert.equal(series[2].average, 40)
const markup = renderToStaticMarkup(react.createElement(WeeklyMacrosChart, { summary, goals }))
assert.equal((markup.match(/<path /g) ?? []).length, 3)
assert.equal((markup.match(/<circle /g) ?? []).length, 9)
assert.equal((markup.match(/stroke-dasharray="7 5"/g) ?? []).length, 3)
assert.equal((markup.match(/stroke-dasharray="1 5"/g) ?? []).length, 3)
assert.ok(!markup.includes('NaN'))
const noTargets = renderToStaticMarkup(react.createElement(WeeklyMacrosChart, { summary, goals: {} }))
assert.ok(!noTargets.includes('stroke-dasharray="1 5"'))
const fullWeek = data.getWeeklyMacrosSeries(createWeeklySummary({ ...args, today: '2026-09-21' }), goals)
assert.equal(fullWeek[0].points.length, 7)
console.log('Weekly macros: summary consistency, partial/full weeks, three daily series, averages and optional targets passed.')
