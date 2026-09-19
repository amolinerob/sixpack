import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Ejecuta los módulos reales sin navegador ni peticiones a Supabase.
function loadModule(path, imports = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  })
  const exports = {}
  vm.runInNewContext(outputText, {
    exports,
    Error,
    console: imports.console ?? console,
    require(name) {
      assert.ok(name in imports, `Import no previsto: ${name}`)
      return imports[name]
    },
  })
  return exports
}

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = () => new Promise((resolve) => setImmediate(resolve))

// Simula el ciclo de hooks; conserva el estado y limpia los efectos al cambiar de usuario.
function mountPreferences(repository) {
  const slots = []
  let cursor = 0
  let effects = []
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [slots[index], (value) => { slots[index] = value }]
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: initial }
      return slots[index]
    },
    useEffect(effect, dependencies) {
      const index = cursor++
      const previous = slots[index]
      if (!previous || dependencies.some((value, i) => value !== previous.dependencies[i])) {
        effects.push(() => {
          previous?.cleanup?.()
          slots[index] = { dependencies, cleanup: effect() }
        })
      }
    },
  }
  const { useUserPreferences } = loadModule('src/useUserPreferences.ts', {
    react,
    './data/cloud/repositories': { userPreferencesRepository: repository },
  })
  return (userId, defaultColor = 'green') => {
    cursor = 0
    effects = []
    const result = useUserPreferences(userId, defaultColor)
    effects.forEach((effect) => effect())
    return result
  }
}

const theme = loadModule('src/theme.ts')
assert.equal(theme.getDefaultAccentColor('angel'), 'green')
assert.equal(theme.getDefaultAccentColor('aurora'), 'pink')
assert.equal(theme.getDefaultAccentColor(null), 'green')
assert.equal(theme.getDefaultAccentColor('Aurora'), 'green')
assert.equal(theme.ACCENT_COLORS.green.accent, '#8fb58f')
assert.equal(theme.ACCENT_COLORS.pink.accent, '#d4a0ad')
assert.equal(Object.keys(theme.ACCENT_COLORS).length, 6)
assert.equal(theme.isAccentColor('#123456'), false)
assert.equal(theme.isAccentColor('toString'), false)
assert.equal(theme.isAccentColor('blue'), true)
console.log('OK: seis presets, defaults estables y sin HEX arbitrarios.')

const writes = new Map()
const { applyThemeToRoot } = (() => {
  const source = readFileSync(new URL('../src/theme.ts', import.meta.url), 'utf8')
  const exports = {}
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, document: { documentElement: { style: { setProperty: (key, value) => writes.set(key, value) } } },
  })
  return exports
})()
for (const color of Object.values(theme.ACCENT_COLORS)) applyThemeToRoot(color)
assert.deepEqual([...writes.keys()].sort(), [
  '--background', '--green', '--green-strong', '--green-soft', '--sage-light',
  '--accent', '--accent-strong', '--accent-soft', '--accent-light',
].sort())
console.log('OK: solo se aplican variables del tema personal; ninguna variable semántica.')

const load = deferred()
let save = deferred()
let saves = 0
const render = mountPreferences({
  get: () => load.promise,
  upsert: (_userId, accentColor) => { saves++; assert.equal(accentColor, 'blue'); return save.promise },
})
assert.equal(render('user-a').accentColor, 'green')
assert.equal(render('user-a').loading, true)
load.resolve(null)
await flush()
assert.equal(render('user-a').loading, false)
const saving = render('user-a').changeAccentColor('blue')
assert.equal(render('user-a').accentColor, 'blue')
assert.equal(render('user-a').saving, true)
await flush()
assert.equal(saves, 1)
save.reject(new Error('Sin conexión'))
await saving
assert.equal(render('user-a').accentColor, 'green')
assert.equal(render('user-a').saving, false)
assert.match(render('user-a').error, /No se pudo guardar/)
save = deferred()
const retry = render('user-a').changeAccentColor('blue')
save.resolve({ accentColor: 'blue' })
await retry
assert.equal(render('user-a').accentColor, 'blue')
assert.equal(render('user-a').error, '')
console.log('OK: cambio inmediato, rollback y reintento.')

const oldLoad = deferred()
const newLoad = deferred()
const switched = mountPreferences({ get: (id) => id === 'user-a' ? oldLoad.promise : newLoad.promise })
switched('user-a')
assert.equal(switched('user-b', 'pink').accentColor, 'pink')
newLoad.resolve({ accentColor: 'violet' })
await flush()
oldLoad.resolve({ accentColor: 'orange' })
await flush()
assert.equal(switched('user-b', 'pink').accentColor, 'violet')
console.log('OK: una carga tardía de otro usuario no cambia la preferencia actual.')

const pendingSave = deferred()
const switchedWhileSaving = mountPreferences({
  get: async () => null,
  upsert: () => pendingSave.promise,
})
switchedWhileSaving('user-a')
await flush()
const oldSave = switchedWhileSaving('user-a').changeAccentColor('orange')
await flush()
switchedWhileSaving('user-b', 'pink')
await flush()
pendingSave.resolve({ accentColor: 'orange' })
await oldSave
assert.equal(switchedWhileSaving('user-b', 'pink').accentColor, 'pink')
console.log('OK: un guardado tardío de otro usuario tampoco altera el color actual.')

const failedLoad = mountPreferences({ get: async () => { throw new Error('Tabla no disponible') } })
failedLoad('user-a', 'pink')
await flush()
assert.equal(failedLoad('user-a', 'pink').accentColor, 'pink')
assert.equal(failedLoad('user-a', 'pink').loading, false)
assert.match(failedLoad('user-a', 'pink').error, /No se pudo cargar/)
console.log('OK: fallo de carga mantiene el default y muestra error sin bloquear la app.')

const persisted = new Map()
const repository = {
  get: async (id) => persisted.has(id) ? { accentColor: persisted.get(id) } : null,
  upsert: async (id, color) => { persisted.set(id, color); return { accentColor: color } },
}
for (const [id, fallback, selection] of [['angel-uuid', 'green', 'blue'], ['aurora-uuid', 'pink', 'violet']]) {
  const instance = mountPreferences(repository)
  instance(id, fallback)
  await flush()
  await instance(id, fallback).changeAccentColor(selection)
  const reloaded = mountPreferences(repository)
  reloaded(id, fallback)
  await flush()
  assert.equal(reloaded(id, fallback).accentColor, selection)
  reloaded(undefined)
  reloaded(id, fallback)
  await flush()
  assert.equal(reloaded(id, fallback).accentColor, selection)
}
assert.equal(persisted.get('angel-uuid'), 'blue')
assert.equal(persisted.get('aurora-uuid'), 'violet')
console.log('OK: Ángel azul y Aurora violeta sobreviven a recarga y cambio de sesión (repository simulado).')

const responses = [deferred(), deferred(), deferred()]
const requestedColors = []
const rapid = mountPreferences({
  get: async () => ({ accentColor: 'green' }),
  upsert: async (_id, color) => {
    const index = requestedColors.length
    requestedColors.push(color)
    await responses[index].promise
    return { accentColor: color }
  },
})
rapid('user-a')
await flush()
const first = rapid('user-a').changeAccentColor('blue')
const second = rapid('user-a').changeAccentColor('pink')
const third = rapid('user-a').changeAccentColor('violet')
assert.equal(rapid('user-a').accentColor, 'violet')
await flush()
assert.deepEqual(requestedColors, ['blue'])
responses[0].resolve()
await first
assert.equal(rapid('user-a').accentColor, 'violet')
await flush()
assert.deepEqual(requestedColors, ['blue', 'pink'])
responses[1].resolve()
await second
assert.equal(rapid('user-a').accentColor, 'violet')
await flush()
responses[2].resolve()
await third
assert.deepEqual(requestedColors, ['blue', 'pink', 'violet'])
assert.equal(rapid('user-a').accentColor, 'violet')
assert.equal(rapid('user-a').saving, false)
console.log('OK: clics rápidos reflejan el último color y se guardan en orden.')

const logs = []
let response = { data: null, error: null }
let payload, conflict, filter
const chain = {
  select: () => chain,
  eq: (key, value) => { filter = [key, value]; return chain },
  maybeSingle: async () => response,
  upsert: (value, options) => { payload = value; conflict = options.onConflict; return chain },
  single: async () => response,
}
const cloud = loadModule('src/data/cloud/repositories.ts', {
  '../../lib/supabase': { supabase: { from: (table) => { assert.equal(table, 'user_preferences'); return chain } } },
  '../../theme': theme,
  console: { error: (...args) => logs.push(args) },
}).userPreferencesRepository
await cloud.get('authenticated-uuid')
assert.deepEqual(filter, ['user_id', 'authenticated-uuid'])
response = { data: { accent_color: 'blue' }, error: null }
assert.equal((await cloud.upsert('authenticated-uuid', 'blue')).accentColor, 'blue')
assert.equal(payload.user_id, 'authenticated-uuid')
assert.equal(payload.accent_color, 'blue')
assert.equal(conflict, 'user_id')
for (const code of ['PGRST205', '42501']) {
  response = { data: null, error: { code, message: 'Test error', details: 'Test details', hint: 'Test hint' } }
  await assert.rejects(cloud.get('authenticated-uuid'), code === 'PGRST205' ? /Ejecuta la migración/ : /RLS/)
  await assert.rejects(cloud.upsert('authenticated-uuid', 'blue'), code === 'PGRST205' ? /Ejecuta la migración/ : /RLS/)
  const logged = logs.at(-1)[1]
  assert.deepEqual(Object.keys(logged).sort(), ['code', 'details', 'hint', 'message'])
  assert.equal(logged.code, code)
}
console.log('OK: UUID, key y onConflict correctos; errores de tabla/RLS conservan el diagnóstico sin credenciales.')
