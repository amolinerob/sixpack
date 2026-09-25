import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(file, imports = {}) {
  const exports = {}
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } })
  vm.runInNewContext(outputText, { exports, require: (name) => {
    assert.ok(name in imports, name)
    return imports[name]
  } })
  return exports
}
const energy = load('energy.ts')
const weekly = load('weeklySummary.ts', { './energy': energy })
const activity = load('activityEstimation.ts', { './types': load('types.ts'), './energy': energy })
const report = load('weeklyCoachReport.ts', { './activityEstimation': activity, './progressSeries': load('progressSeries.ts'), './weeklySummary': weekly })
const goals = { sex: 'male', birthDate: '1990-01-01', heightCm: 178, targetDeficitKcal: 400, targetProteinG: 165, targetFatG: 65 }
const measurements = [{ date: '2026-09-14', weightKg: 80, waistCm: 94 }, { date: '2026-09-21', weightKg: 80, waistCm: 93 }, { date: '2026-09-27', weightKg: 79, waistCm: 92 }, { date: '2026-10-01', weightKg: 70, waistCm: 80 }]
const entries = Array.from({ length: 7 }, (_, index) => ({ date: `2026-09-${21 + index}`, kcal: 1685, protein: index === 6 ? 100 : 165, carbs: 180, fat: index === 6 ? 80 : 60 }))
const activities = [{ date: '2026-09-23', type: 'Running', calories: 350 }, { date: '2026-09-24', type: 'CrossFit', calories: 500 }]
function run(overrides = {}) {
  const args = { range: { start: '2026-09-21', end: '2026-09-27' }, today: '2026-09-28', entries, activities, measurements, goals, ...overrides }
  const summary = weekly.createWeeklySummary(args)
  const data = report.buildWeeklyCoachReportData({ ...args, summary })
  return { data, text: report.formatWeeklyCoachReport(data), summary }
}
const full = run()
assert.equal(full.data.period.days, 7)
assert.equal(full.data.anthropometry.weight.mean, 79.5)
assert.equal(full.data.anthropometry.weight.change, -1)
assert.equal(full.data.anthropometry.waist.change, -1)
assert.equal(full.data.nutrition.calories, full.summary.sum.kcal / 7)
assert.equal(full.data.nutrition.deficit, full.summary.totalDeficit / 7)
assert.equal(full.data.activity.sessions.Carrera, 1)
assert.equal(full.data.activity.sessions.CrossFit, 1)
assert.equal(full.data.activity.totalCalories, 850)
assert.equal(full.data.adherence.protein, 6)
assert.equal(full.data.adherence.fat, 1)
assert.equal(full.data.adherence.deficit, 5)
const partial = run({ today: '2026-09-23' })
assert.equal(partial.data.period.days, 3)
assert.equal(partial.data.adherence.protein, 3)
assert.equal(partial.data.activity.sessions.CrossFit, 0)
assert.equal(partial.data.anthropometry.weight.count, 1)
assert.equal(partial.data.anthropometry.weight.change, undefined)
assert.ok(!partial.text.includes('Variación semanal'))
assert.equal(run({ measurements: measurements.map(({ date, waistCm }) => ({ date, waistCm })) }).data.anthropometry.weight.mean, undefined)
assert.equal(run({ measurements: measurements.map(({ date, weightKg }) => ({ date, weightKg })) }).data.anthropometry.waist.mean, undefined)
const none = run({ activities: [], measurements: [] })
assert.equal(none.data.activity.totalCalories, 0)
assert.ok(none.text.includes('Sin datos suficientes para comparar con la semana anterior.'))
for (const value of [320, 400, 480]) assert.equal(report.isCoachDeficitAdherent(value, 400), true)
for (const value of [319, 481, -50, NaN, Infinity]) assert.equal(report.isCoachDeficitAdherent(value, 400), false)
assert.equal(report.isCoachDeficitAdherent(0, 0), true)
assert.equal(report.isCoachDeficitAdherent(-1, 0), false)
// Intention records are not an input to the report or weekly energy engine.
assert.equal(run({ intentions: ['CrossFit', 'Carrera'] }).text, full.text)
assert.equal(run({ entries: [] }).data.nutrition.protein, undefined)
const invalid = run({ entries: [{ ...entries[0], kcal: NaN, protein: Infinity }], measurements: [{ date: '2026-09-21', weightKg: NaN, waistCm: Infinity }] })
for (const value of [full, partial, none, invalid]) {
  assert.ok(!/NaN|Infinity|undefined|null/.test(value.text))
  assert.ok(value.text.startsWith('INFORME SEMANAL SIX PACK\nSemana:'))
  for (const heading of ['ANTROPOMETRÍA', 'NUTRICIÓN', 'ACTIVIDAD', 'ADHERENCIA', 'EVOLUCIÓN VS SEMANA ANTERIOR', 'CONTEXTO']) assert.ok(value.text.includes(`\n\n${heading}\n`))
}
assert.equal(full.text, run().text)
const previousEntries = entries.map((entry) => ({ ...entry, date: entry.date.replace(/\d{2}$/, (day) => String(Number(day) - 7)), protein: 150 }))
const compared = run({ entries: [...previousEntries, ...entries] })
assert.equal(compared.data.comparison.weightMean, -0.5)
assert.ok(compared.data.comparison.proteinMean > 0)
assert.equal(compared.data.comparison.waistMean, -1.5)
console.log('Weekly coach report: A–L, full/partial weeks, missing/invalid data, 6/7 adherence, tolerance boundaries, real-only activity, comparisons and stable text passed.')
