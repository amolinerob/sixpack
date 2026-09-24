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
  vm.runInNewContext(outputText, { exports, Error, require: (name) => {
    assert.ok(name in imports, `Unexpected import: ${name}`)
    return imports[name]
  } })
  return exports
}
const types = load('types.ts')
const energy = load('energy.ts')
const estimation = load('activityEstimation.ts', { './types': types, './energy': energy })
const { calculateDynamicDailyTargets: calculate } = load('dynamicDailyTargets.ts', { './energy': energy, './activityEstimation': estimation })
const baseGoals = Object.freeze({ sex: 'male', birthDate: '1990-01-01', heightCm: 180, targetProteinG: 165, targetCarbsG: 220, targetFatG: 65, targetDeficitKcal: 350 })
const measurements = [{ date: '2026-09-01', weightKg: 80 }]
const date = '2026-09-22'
let id = 0
const entry = (type, calories, activityDate = date) => ({ id: String(++id), date: activityDate, type, calories, createdAt: `${activityDate}T12:00:00`, durationMinutes: 60, notes: '' })
const history = [entry('CrossFit', 430, '2026-09-21'), entry('Caminata', 240, '2026-09-20')]
function run(intentions = [], activities = [], goals = baseGoals, viewedDate = date) {
  return calculate({ baseGoals: goals, intentions, activities, measurements, date: viewedDate })
}
assert.equal(run().targetCalories, 1750) // A: base 2100 minus deficit 350
assert.equal(run().carbsG, 125)
assert.equal(run(['CrossFit'], history).carbsG, 235) // B
assert.equal(run(['CrossFit', 'Caminata'], history).effectiveActivityKcal, 670) // C
assert.equal(run(['Caminata'], [...history, entry('Caminata', 225)]).effectiveActivityKcal, 225) // D
assert.equal(run(['CrossFit'], [...history, entry('Caminata', 200)]).effectiveActivityKcal, 630) // E
assert.equal(run(['Caminata'], [...history, entry('Caminata', 120), entry('Caminata', 90)]).effectiveActivityKcal, 210) // F
assert.equal(run(['Descanso'], history).carbsG, 125) // G: rest is also dynamic
assert.equal(run(['Descanso'], [...history, entry('CrossFit', 450)]).effectiveActivityKcal, 450) // H
assert.equal(run(['CrossFit'], [NaN, -100, Infinity, 0].map((value) => entry('CrossFit', value, '2026-09-21'))).effectiveActivityKcal, 450) // I
const provisional = estimation.estimateActivityKcal([entry('CrossFit', 400, '2026-09-20'), entry('crossfit', 460, '2026-09-21')], 'CrossFit', date)
assert.equal(provisional.kcal, 430)
assert.equal(provisional.source, 'historical-provisional') // J
const historical = estimation.estimateActivityKcal([100, 430, 999].map((kcal) => entry('CrossFit', kcal, '2026-09-21')), 'CrossFit', date)
assert.equal(historical.kcal, 430)
assert.equal(historical.source, 'historical') // K
assert.equal(run(['CrossFit'], [...history, entry('CrossFit', 9999, '2026-09-23')]).effectiveActivityKcal, 430) // L
const eight = estimation.estimateActivityKcal(Array.from({ length: 10 }, (_, i) => entry('CrossFit', i * 100 + 100, `2026-09-${String(i + 1).padStart(2, '0')}`)), 'CrossFit', date)
assert.equal(eight.sampleCount, 8)
assert.equal(eight.kcal, 650)
const example = run([], [entry('Carrera', 600)])
assert.equal(example.carbsG, 275)
assert.equal(example.proteinG, 165)
assert.equal(example.fatG, 65)
assert.equal(example.targetCalories, 2350)
assert.equal(baseGoals.targetCarbsG, 220)
const actualZero = run(['CrossFit'], [entry('CrossFit', 0)])
assert.equal(actualZero.effectiveActivityKcal, 0)
assert.equal(actualZero.activityBreakdown[0].source, 'real')
assert.equal(run(['CrossFit'], [entry(' CrossFIT ', 225)]).effectiveActivityKcal, 225)
assert.equal(run(['CrossFit', 'CrossFit']).effectiveActivityKcal, 450)
assert.equal(run(['Descanso', 'CrossFit']).effectiveActivityKcal, 0)
assert.equal(run(['Caminata']).effectiveActivityKcal, 250)
assert.equal(run(['Bicicleta']).effectiveActivityKcal, 400)
assert.equal(run(['CrossFit'], [entry('CrossFit', -1), entry('CrossFit', NaN)]).effectiveActivityKcal, 450)
assert.equal(run([], [], { targetCarbsG: 222 }).carbsG, 222)
assert.equal(run([], [entry('Otra', 1)], { targetCarbsG: 222 }).carbsG, 222) // Incomplete physical data: manual fallback.
assert.equal(run(['CrossFit'], [], {}).carbsG, undefined)
for (const invalid of [NaN, Infinity, -20]) {
  const result = run(['CrossFit'], [], { targetCarbsG: invalid, targetProteinG: invalid, targetFatG: invalid })
  assert.equal(result.carbsG, undefined)
  assert.equal(result.proteinG, undefined)
  assert.equal(result.fatG, undefined)
}
assert.equal(estimation.estimateActivityKcal([entry('CrossFit', 9999, '2026-02-31')], 'CrossFit', date).source, 'fallback')
assert.equal(run(['CrossFit'], [], baseGoals, '2026-02-31').effectiveActivityKcal, 0)
assert.equal(run([], [entry('Otra', Number.MAX_VALUE), entry('Otra', Number.MAX_VALUE)]).carbsG, 220)
assert.equal(estimation.toggleActivityIntention(['CrossFit', 'Caminata'], 'Descanso').join(), 'Descanso')
assert.equal(estimation.toggleActivityIntention(['Descanso'], 'Caminata').join(), 'Caminata')
assert.equal(estimation.toggleActivityIntention(['CrossFit'], 'CrossFit').length, 0)

// Deficit-based dynamic targets and running regression cases.
const deficit350 = run(['CrossFit'], history)
const deficit450 = run(['CrossFit'], history, { ...baseGoals, targetDeficitKcal: 450 })
assert.equal(deficit350.estimatedExpenditureKcal, 2530)
assert.equal(deficit350.targetDeficitKcal, 350)
assert.equal(deficit350.targetCalories, 2180)
assert.equal(deficit350.carbsG - deficit450.carbsG, 25)
assert.equal(deficit350.proteinG, deficit450.proteinG)
assert.equal(deficit350.fatG, deficit450.fatG)
assert.ok(run([], [], { ...baseGoals, targetDeficitKcal: 250 }).carbsG > run([], [], { ...baseGoals, targetDeficitKcal: 500 }).carbsG)
assert.equal(run(['CrossFit'], [...history, entry('CrossFit', 470)]).effectiveActivityKcal, 470)
const runningHistory = [
  entry('Carrera', 400, '2026-09-19'), entry(' Correr ', 480, '2026-09-20'), entry('RUNNING', 900, '2026-09-21'),
]
const running = run(['Carrera'], runningHistory)
assert.equal(running.effectiveActivityKcal, 480)
assert.equal(running.activityBreakdown[0].source, 'historical')
assert.equal(run(['Carrera']).effectiveActivityKcal, 380)
assert.equal(run(['Carrera']).activityBreakdown[0].source, 'fallback')
assert.equal(run(['Carrera']).estimatedExpenditureKcal, 2480)
assert.equal(run(['Carrera'], [entry('Carrera', 420)]).effectiveActivityKcal, 420)
assert.equal(run(['Carrera'], [entry('Carrera', 220), entry('Running', 180)]).effectiveActivityKcal, 400)
assert.equal(run(['CrossFit'], [...history, entry('Running', 420)]).effectiveActivityKcal, 850)
const repeatedRuns = run(['Carrera'], [...runningHistory, entry('Correr', 250), entry('CARRERA', 180)])
assert.equal(repeatedRuns.effectiveActivityKcal, 430)
assert.equal(repeatedRuns.activityBreakdown.length, 1)
assert.equal(repeatedRuns.activityBreakdown[0].source, 'real')
assert.equal(run(['Caminata', 'Carrera', 'CrossFit'], [...history, ...runningHistory]).effectiveActivityKcal, 1150)
assert.equal(run(['Descanso']).targetCalories, 1750)
assert.equal(run(['Descanso'], [entry('Carrera', 420)]).effectiveActivityKcal, 420)
assert.equal(run(['Carrera'], [...runningHistory, entry('Carrera', 9999, '2026-09-23')]).effectiveActivityKcal, 480)
assert.equal(estimation.estimateActivityKcal(runningHistory.slice(0, 2), 'Carrera', date).kcal, 440)
assert.equal(estimation.estimateActivityKcal(runningHistory.slice(0, 2), 'Carrera', date).source, 'historical-provisional')
for (const name of ['Carrera', 'correr', ' Running ', 'CARRERA']) assert.equal(estimation.normalizeActivityType(name), 'Carrera')
assert.equal(estimation.ACTIVITY_INTENTION_TYPES.join(','), 'CrossFit,Caminata,Carrera,Bicicleta,Descanso')
assert.equal(run([], [], { ...baseGoals, targetCarbsG: undefined }).carbsG, 125) // Manual carbs no longer required.
assert.equal(run([], [], { ...baseGoals, targetCarbsG: 999 }).carbsG, 125) // No base floor.
const incompatible = run([], [], { ...baseGoals, targetDeficitKcal: 1000 })
assert.equal(incompatible.carbsG, 0)
assert.equal(incompatible.incompatibleTargets, true)
assert.equal(incompatible.calculationValid, true)
for (const key of ['sex', 'birthDate', 'heightCm', 'targetDeficitKcal', 'targetProteinG', 'targetFatG']) {
  const fallback = run([], [], { ...baseGoals, [key]: undefined })
  assert.equal(fallback.carbsG, 220)
  assert.equal(fallback.calculationValid, false)
}
for (const targetDeficitKcal of [NaN, Infinity, -100]) assert.equal(run([], [], { ...baseGoals, targetDeficitKcal }).calculationValid, false)
const futureWeight = calculate({ baseGoals, intentions: [], activities: [], measurements: [...measurements, { date: '2026-09-23', weightKg: 200 }], date })
assert.equal(futureWeight.estimatedExpenditureKcal, 2100)
const noPastWeight = calculate({ baseGoals, intentions: [], activities: [], measurements: [{ date: '2026-09-23', weightKg: 80 }], date })
assert.equal(noPastWeight.calculationValid, false)
assert.equal(noPastWeight.carbsG, 220)

const migration = readFileSync(new URL('../supabase/migrations/202609240002_daily_activity_intentions_running.sql', import.meta.url), 'utf8')
assert.ok(migration.includes('alter table public.daily_activity_intentions'))
assert.equal((migration.match(/'CrossFit', 'Caminata', 'Carrera', 'Bicicleta', 'Descanso'/g) ?? []).length, 2)
assert.ok(!migration.includes('create table'))
assert.ok(migration.includes('security invoker'))

// Persistence contract, including missing-table detection and no writes to user_goals.
const calls = []
let response = { data: [{ activity_type: 'CrossFit' }], error: null }
const supabase = {
  from(table) {
    assert.equal(table, 'daily_activity_intentions')
    const query = { select(value) { calls.push(['select', value]); return query }, eq(key, value) { calls.push([key, value]); return query }, then(resolve) { return Promise.resolve(response).then(resolve) } }
    return query
  },
  async rpc(name, args) { calls.push([name, args]); return response },
}
const { dailyActivityIntentionsRepository: repository } = load('data/cloud/repositories.ts', {
  '../../lib/supabase': { supabase }, '../../activityEstimation': estimation, '../../theme': {},
})
assert.equal((await repository.get('user-a', date)).join(), 'CrossFit')
assert.ok(calls.some(([key, value]) => key === 'user_id' && value === 'user-a'))
assert.ok(calls.some(([key, value]) => key === 'intention_date' && value === date))
await repository.save('user-a', date, ['CrossFit'])
assert.equal(calls.at(-1)[0], 'set_daily_activity_intentions')
assert.equal(calls.at(-1)[1].p_date, date)
assert.equal(calls.at(-1)[1].p_user_id, 'user-a')
await assert.rejects(repository.save('user-a', date, ['Descanso', 'CrossFit']))
response = { data: null, error: { code: 'PGRST205', message: 'missing table' } }
await assert.rejects(repository.get('user-a', date), /202609240001_daily_activity_intentions.sql/)
response = { data: null, error: { code: 'PGRST202', message: 'missing function' } }
await assert.rejects(repository.save('user-a', date, []), /202609240001_daily_activity_intentions.sql/)
for (const code of ['22023', '23514']) {
  response = { data: null, error: { code, message: 'Old schema rejects Carrera' } }
  await assert.rejects(repository.save('user-a', date, ['Carrera']), /202609240002_daily_activity_intentions_running.sql/)
}
response = { data: [{ activity_type: 'Carrera' }], error: null }
assert.equal((await repository.save('user-a', date, ['Carrera'])).join(), 'Carrera')
assert.equal(calls.at(-1)[1].p_types.join(), 'Carrera')
assert.equal((await repository.get('user-a', date)).join(), 'Carrera')
console.log('Dynamic targets: deficit formula, running A-L, aliases, sources, date limits, 8-sample limit, replacement, manual fallback, zero clamp and repository contract passed.')

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = () => new Promise((resolve) => setImmediate(resolve))
function mount(repository) {
  const slots = []
  let cursor = 0
  let effects = []
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: initial }
      return slots[index]
    },
    useEffect(effect, dependencies) {
      const index = cursor++
      const previous = slots[index]
      if (!previous || dependencies.some((value, i) => value !== previous.dependencies[i])) effects.push(() => {
        previous?.cleanup?.()
        slots[index] = { dependencies, cleanup: effect() }
      })
    },
  }
  const { useDailyActivityIntentions } = load('useDailyActivityIntentions.ts', {
    react, './data/cloud/repositories': { dailyActivityIntentionsRepository: repository }, './activityEstimation': estimation,
  })
  return (user, date) => {
    cursor = 0
    effects = []
    const result = useDailyActivityIntentions(user, date)
    effects.forEach((effect) => effect())
    return result
  }
}
const firstLoad = deferred()
const reads = []
const writes = []
let saveResponse = deferred()
const persisted = new Map()
let failLoad = false
const render = mount({
  async get(user, day) {
    reads.push(`${user}:${day}`)
    if (failLoad) throw new Error('Table missing')
    if (day === '2026-09-20') return firstLoad.promise
    return persisted.get(`${user}:${day}`) ?? []
  },
  async save(user, day, values) {
    writes.push({ user, day, values })
    await saveResponse.promise
    persisted.set(`${user}:${day}`, values)
    return values
  },
})
assert.equal(render('a', '2026-09-20').loading, true)
await flush()
assert.equal(render('a', date).loading, true)
await flush()
assert.equal(render('a', date).ready, true)
firstLoad.resolve(['Descanso'])
await flush()
assert.equal(render('a', date).values.length, 0) // Late response from another date ignored.
const plan = render('a', date)
plan.toggle('CrossFit')
plan.toggle('Caminata') // Prevent concurrent saves, even before React rerenders.
assert.equal(writes.length, 1)
assert.equal(render('a', date).saving, true)
assert.equal(render('a', date).values.length, 0) // Only confirmed plans affect goals.
saveResponse.resolve()
await flush()
assert.equal(render('a', date).values.join(), 'CrossFit')
saveResponse = deferred()
render('a', date).toggle('Descanso')
saveResponse.reject(new Error('Network failure'))
await flush()
assert.equal(render('a', date).values.join(), 'CrossFit')
assert.match(render('a', date).error, /Network failure/)
saveResponse = deferred()
render('a', date).toggle('Caminata')
render('b', date)
await flush()
saveResponse.resolve()
await flush()
assert.equal(render('b', date).values.length, 0) // Late save cannot replace another user's plan.
assert.equal(writes.at(-1).user, 'a')
render('a', date)
await flush()
assert.equal(render('a', date).values.join(), 'CrossFit,Caminata') // Persisted and reloaded.
failLoad = true
render('a', '2026-09-23')
await flush()
assert.equal(render('a', '2026-09-23').ready, false)
assert.match(render('a', '2026-09-23').error, /Table missing/)
failLoad = false
render('a', '2026-09-23').retry()
render('a', '2026-09-23')
await flush()
assert.equal(render('a', '2026-09-23').ready, true)
console.log('Intention lifecycle: loading, date/user races, persistence, save failure, concurrent-click guard and migration retry passed.')

// Execute the real Hoy target/denominator and energy fragments together.
const hoySource = readFileSync(new URL('../src/screens/HoyScreen.tsx', import.meta.url), 'utf8')
const hoySnippet = hoySource.slice(hoySource.indexOf('  const dynamicTargets ='), hoySource.indexOf('  const dailyGoals ='))
  + '\nresult = { dynamicTargets, dailyMacroComparisons, dailyEnergyBalance };'
function hoy(plan, actual, overrides = {}) {
  const context = { result: null, goals: { ...baseGoals, sex: 'male', birthDate: '1990-01-01', heightCm: 180, ...overrides },
    activityPlan: plan, activities: actual, selectedDate: date,
    totals: { kcal: 2000, protein: 120, carbs: 180, fat: 50 },
    measurements: [{ date: '2026-09-01', weightKg: 82 }],
    activityTotal: energy.getActiveKcalForDate(actual, date),
    useMemo: (fn) => fn(), calculateDynamicDailyTargets: calculate, ...energy,
  }
  const { outputText } = ts.transpileModule(hoySnippet, { compilerOptions: { target: ts.ScriptTarget.ES2023 } })
  vm.runInNewContext(outputText, context)
  return context.result
}
const withForecast = hoy({ ready: true, values: ['CrossFit'] }, history)
const withoutForecast = hoy({ ready: true, values: [] }, history)
assert.equal(withForecast.dailyMacroComparisons[1].target, 240)
assert.equal(withoutForecast.dailyMacroComparisons[1].target, 130)
assert.equal(withForecast.dailyEnergyBalance.estimatedDailyExpenditure, withoutForecast.dailyEnergyBalance.estimatedDailyExpenditure)
assert.equal(withForecast.dailyEnergyBalance.estimatedDeficit, withoutForecast.dailyEnergyBalance.estimatedDeficit)
const afterActual = hoy({ ready: true, values: ['CrossFit'] }, [...history, entry('CrossFit', 600)])
assert.equal(afterActual.dailyMacroComparisons[1].target, 280)
assert.equal(afterActual.dailyEnergyBalance.estimatedDailyExpenditure, withoutForecast.dailyEnergyBalance.estimatedDailyExpenditure + 600)
assert.equal(hoy({ ready: false, values: [] }, history).dailyMacroComparisons[1].target, 220)
assert.equal(hoy({ ready: true, values: ['CrossFit'] }, history, { targetDeficitKcal: 450 }).dailyMacroComparisons[1].target, withForecast.dailyMacroComparisons[1].target - 25)
assert.equal(hoy({ ready: true, values: [] }, [], { targetDeficitKcal: 2000 }).dailyMacroComparisons[1].target, 0)
console.log('Hoy integration: dynamic denominator, actual replacement and unchanged real-only energy balance passed.')

// Every icon preserves the canonical click value and accessible name.
const iconModule = load('components/SixPackIcon.tsx', { 'react/jsx-runtime': jsx })
const { DailyActivityPlan } = load('components/DailyActivityPlan.tsx', {
  '../activityEstimation': estimation, './SixPackIcon': iconModule, 'react/jsx-runtime': jsx,
})
const clicked = []
const iconTree = DailyActivityPlan({
  plan: { values: ['Carrera'], ready: true, loading: false, saving: false, error: '', toggle: (type) => clicked.push(type) },
  targets: run(['Carrera']), loading: false,
})
const markup = renderToStaticMarkup(iconTree)
assert.equal((markup.match(/<button/g) ?? []).length, 5)
assert.equal((markup.match(/<svg/g) ?? []).length, 5)
for (const buttonMarkup of markup.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)) {
  assert.equal(buttonMarkup[1].replace(/<[^>]*>/g, '').trim(), '')
}
for (const name of estimation.ACTIVITY_INTENTION_TYPES) {
  assert.ok(markup.includes(`aria-label="${name}"`))
  assert.ok(markup.includes(`title="${name}"`))
}
function clickButtons(node) {
  if (Array.isArray(node)) return node.forEach(clickButtons)
  if (!node || typeof node !== 'object') return
  if (node.type === 'button') node.props.onClick()
  clickButtons(node.props?.children)
}
clickButtons(iconTree)
assert.equal(clicked.join(), estimation.ACTIVITY_INTENTION_TYPES.join())

// Persist all four sports, reload Carrera, then enforce exclusive rest and toggle back.
for (const type of estimation.PLANNED_ACTIVITY_TYPES) {
  render('a', '2026-09-23').toggle(type)
  await flush()
  assert.ok(render('a', '2026-09-23').values.includes(type))
}
render('a', date)
await flush()
render('a', '2026-09-23')
await flush()
assert.ok(render('a', '2026-09-23').values.includes('Carrera'))
render('a', '2026-09-23').toggle('Descanso')
await flush()
assert.equal(render('a', '2026-09-23').values.join(), 'Descanso')
render('a', '2026-09-23').toggle('Carrera')
await flush()
assert.equal(render('a', '2026-09-23').values.join(), 'Carrera')
console.log('Activity icons: five accessible icon-only buttons, canonical clicks, Carrera save/reload and exclusive rest passed.')
