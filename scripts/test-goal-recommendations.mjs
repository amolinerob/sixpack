import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function loadModule(path, imports = {}, extension = 'ts') {
  const source = readFileSync(new URL(`../src/${path}.${extension}`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  })
  const exports = {}
  vm.runInNewContext(outputText, { exports, require: (name) => {
    assert.ok(name in imports, `Unexpected import: ${name}`)
    return imports[name]
  } })
  return exports
}
const energy = loadModule('energy')
const weekly = loadModule('weeklySummary', { './energy': energy })
const { calculateGoalRecommendations: calculate, roundRecommendation: round } = loadModule('goalRecommendations', {
  './energy': energy, './weeklySummary': weekly,
})
const measurement = (date, weightKg) => ({ id: date, userId: 'test', date, weightKg, createdAt: date })
const activity = (date, calories) => ({ id: date, date, calories, type: 'Otra', durationMinutes: 30, notes: '', createdAt: date })
const profile = { sex: 'male', birthDate: '1990-01-01', heightCm: 180 }
const input = { today: '2026-09-19', profile, measurements: [measurement('2026-09-01', 82)], activities: [] }
const base = energy.calculateDailyEnergyBalance({ goals: profile, measurements: input.measurements, referenceDate: '2026-09-12', consumedCalories: 0, activityCalories: 0 }).estimatedDailyExpenditure
input.activities = Array.from({ length: 7 }, (_, i) => activity(`2026-09-${12 + i}`, 2600 - base))
const result = calculate(input)
assert.equal(result.range.start, '2026-09-12')
assert.equal(result.range.end, '2026-09-18')
assert.equal(result.validDayCount, 7)
assert.equal(result.averageExpenditure, 2600)
assert.equal(result.recommendedCalories, 2210)
assert.equal(round(result.recommendedDeficit, 10), 390)
assert.equal(round(result.recommendedProtein, 5), 165)
assert.equal(round(result.recommendedFat, 5), 65)
assert.equal(round(result.recommendedCarbs, 5), 240)
assert.equal(result.recommendedProtein, 164)

// Today and future activities do not enter the window; future weights are never used.
const excluded = calculate({ ...input, measurements: [...input.measurements, measurement('2026-09-20', 150)], activities: [...input.activities, activity('2026-09-19', 5000), activity('2026-09-20', 8000)] })
assert.equal(excluded.averageExpenditure, 2600)
assert.equal(excluded.currentWeightKg, 82)
const updated = calculate({ ...input, activities: [...input.activities, activity('2026-09-18', 700)] })
assert.equal(updated.averageExpenditure, 2700)
const partial = calculate({ ...input, measurements: [measurement('2026-09-14', 82)] })
assert.equal(partial.validDayCount, 5)
assert.equal(partial.averageExpenditure, 2600)
const todayWeight = calculate({ ...input, measurements: [...input.measurements, measurement('2026-09-19', 80)] })
assert.equal(todayWeight.averageExpenditure, 2600)
assert.equal(todayWeight.recommendedProtein, 160)
for (const measurements of [[], [measurement('2026-09-20', 82)], [measurement('2026-09-01', NaN)]]) {
  const missing = calculate({ ...input, measurements })
  assert.equal(missing.validDayCount, 0)
  assert.equal(missing.recommendedProtein, undefined)
  assert.equal(missing.recommendedDeficit, undefined)
}
assert.equal(calculate({ ...input, profile: {} }).recommendedProtein, undefined)
assert.equal(calculate({ ...input, profile: { ...profile, heightCm: Infinity } }).recommendedDeficit, undefined)
assert.equal(calculate({ ...input, measurements: [...input.measurements, measurement('2026-09-19', 500)] }).recommendedCarbs, undefined)
assert.equal(calculate({ ...input, activities: [activity('2026-09-18', Infinity)] }).validDayCount, 6)
for (const value of [NaN, Infinity, -5, 0, undefined]) assert.equal(round(value, 5), undefined)
const changedGoals = calculate({ ...input, profile: { ...profile, targetProteinG: 180, targetWeightKg: 50 } })
assert.equal(changedGoals.recommendedProtein, 164)
const boundary = calculate({ ...input, today: '2026-01-03' })
assert.equal(boundary.range.start, '2025-12-27')
assert.equal(boundary.range.end, '2026-01-02')
console.log('Goal recommendations: calculation, rounding, history, partial data and invalid data checks passed.')

// Exercise the actual editor handlers with isolated hooks and repositories, without cloud writes.
const slots = []
let cursor = 0
let effects = []
const react = {
  useState(initial) {
    const index = cursor++
    if (!(index in slots)) slots[index] = initial
    return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
  },
  useEffect(effect, dependencies) {
    const index = cursor++
    const previous = slots[index]
    if (!previous || dependencies.some((value, i) => value !== previous.dependencies[i])) {
      effects.push(() => { previous?.cleanup?.(); slots[index] = { dependencies, cleanup: effect() } })
    }
  },
}
let saved
let activityReads = 0
let profileWrites = 0
const { UsuarioScreen } = loadModule('screens/UsuarioScreen', {
  react,
  'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' },
  '../energy': energy,
  '../goalRecommendations': { calculateGoalRecommendations: () => result, roundRecommendation: round },
  '../data/cloud/repositories': {
    goalsRepository: { get: async () => ({ targetProteinG: 175 }), save: async (_, value) => { saved = value } },
    profileRepository: { get: async () => profile, update: async () => { profileWrites++ } },
    measurementsRepository: { list: async () => input.measurements },
    activitiesRepository: { list: async () => { activityReads++; return input.activities } },
  },
  '../components/ScreenHeader': { ScreenHeader: 'header' },
  '../components/InfoDialog': { InfoDialog: 'info-dialog' },
  '../components/UserPreferencesSection': { UserPreferencesSection: 'preferences' },
}, 'tsx')
function render() {
  cursor = 0
  effects = []
  const tree = UsuarioScreen({ activeUser: { id: 'test', name: 'Test' }, preferences: {}, onUserClick() {}, onSignOut() {} })
  effects.forEach((effect) => effect())
  const nodes = []
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!node || typeof node !== 'object') return
    nodes.push(node)
    visit(node.props?.children)
  }
  visit(tree)
  return nodes
}
const flush = () => new Promise((resolve) => setImmediate(resolve))
const button = (nodes, title) => nodes.find((node) => node.type === 'button' && node.props.children === title)
render()
await flush()
button(render(), 'Editar objetivos').props.onClick()
assert.ok(render().some((node) => node.props?.children === 'Calculando…'))
await flush()
let nodes = render()
assert.equal(activityReads, 1)
assert.equal(nodes.find((node) => node.props?.id === 'goal-targetProteinG').props.value, '175')
nodes.find((node) => node.props?.id === 'goal-targetProteinG').props.onChange({ target: { value: '180' } })
nodes = render()
assert.ok(nodes.some((node) => node.props?.children === '165 g'))
await button(nodes, 'Guardar').props.onClick()
assert.equal(saved.targetProteinG, 180)
assert.equal('sex' in saved, false)
assert.equal('heightCm' in saved, false)
assert.equal(profileWrites, 0)
render()
button(render(), 'Editar objetivos').props.onClick()
render()
await flush()
assert.equal(activityReads, 2)
nodes = render()
nodes.find((node) => node.props?.id === 'goal-targetProteinG').props.onChange({ target: { value: '190' } })
button(render(), 'Cancelar').props.onClick()
assert.equal(saved.targetProteinG, 180)
console.log('Goal editor: loading, independent manual values, isolated saves, cancel and refresh on reopen passed.')
