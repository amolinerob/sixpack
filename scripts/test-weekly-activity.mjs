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
const { getWeeklyActivitySeries } = load('weeklyActivitySeries.ts')
const { WeeklyActivityChart } = load('components/WeeklyActivityChart.tsx', { '../chartTheme': load('chartTheme.ts'), react, 'react/jsx-runtime': jsx })
const activities = [500, 600, 0, 300, 700, 200, 0].flatMap((calories, i) => [
  { date: `2026-09-${14 + i}`, calories: calories * 0.6 },
  { date: `2026-09-${14 + i}`, calories: calories * 0.4 },
])
const args = { range: { start: '2026-09-14', end: '2026-09-20' }, today: '2026-09-21', entries: [], activities, measurements: [], goals: {} }
const full = getWeeklyActivitySeries(createWeeklySummary(args))
assert.equal(full.days.length, 7)
assert.equal(full.days.map((day) => day.value).join(','), '500,600,0,300,700,200,0')
assert.equal(Math.round(full.average), 329)
const partial = getWeeklyActivitySeries(createWeeklySummary({ ...args, today: '2026-09-16' }))
assert.equal(Math.round(partial.average), 367)
assert.equal(partial.days[2].value, 0)
assert.ok(partial.days.slice(3).every((day) => day.value === undefined))
const markup = renderToStaticMarkup(react.createElement(WeeklyActivityChart, { data: partial }))
assert.equal((markup.match(/class="weekly-activity-chart__bar"/g) ?? []).length, 2)
assert.equal((markup.match(/role="button"/g) ?? []).length, 7)
assert.ok(markup.includes('stroke-dasharray="7 5"'))
assert.ok(markup.includes('367 kcal/d'))
assert.ok(!markup.includes('NaN'))
const empty = getWeeklyActivitySeries(createWeeklySummary({ ...args, activities: [] }))
assert.equal(empty.average, 0)
assert.ok(empty.days.every((day) => day.value === 0))
const emptyMarkup = renderToStaticMarkup(react.createElement(WeeklyActivityChart, { data: empty }))
assert.ok(!emptyMarkup.includes('NaN'))
console.log('Weekly activity: daily aggregation, full/partial means, rest versus future days, empty week and chart rendering passed.')
