import { normalizeActivityType } from './activityEstimation'
import { getMeasurementPoints, calculatePeriodChange } from './progressSeries'
import { createWeeklySummary, getWeekRange, type WeekSummary } from './weeklySummary'
import type { ActivityEntry, BodyMeasurement, FoodDiaryEntry, UserGoals } from './types'

export const COACH_DEFICIT_TOLERANCE = 0.20
const finite = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value)
const positive = (value: number | undefined): value is number => finite(value) && value > 0
const safe = (value: number | undefined) => finite(value) ? value : undefined
export function isCoachDeficitAdherent(deficit: number | undefined, target: number | undefined) {
  return finite(deficit) && finite(target) && target >= 0 && deficit >= 0
    && deficit >= target * (1 - COACH_DEFICIT_TOLERANCE) && deficit <= target * (1 + COACH_DEFICIT_TOLERANCE)
}

function body(summary: WeekSummary, field: 'weightKg' | 'waistCm') {
  const points = getMeasurementPoints(summary.weekMeasurements, field).filter((point) => positive(point.value))
  return { count: points.length, initial: points[0]?.value, final: points.at(-1)?.value,
    mean: points.length ? safe(points.reduce((sum, point) => sum + point.value / points.length, 0)) : undefined,
    change: safe(calculatePeriodChange(points, [])) }
}

function sectionData(summary: WeekSummary, goals: UserGoals, entries: FoodDiaryEntry[]) {
  const recordedDates = new Set(entries.filter((entry) => summary.days.some((day) => day.date === entry.date)).map((entry) => entry.date))
  const count = summary.dayCount
  const average = (total: number) => count ? safe(total / count) : undefined
  const proteinTarget = positive(goals.targetProteinG) ? goals.targetProteinG : undefined
  const fatTarget = positive(goals.targetFatG) ? goals.targetFatG : undefined
  const deficitTarget = finite(goals.targetDeficitKcal) && goals.targetDeficitKcal >= 0 ? goals.targetDeficitKcal : undefined
  const sessions = { CrossFit: 0, Caminata: 0, Carrera: 0, Bicicleta: 0 }
  for (const day of summary.days) for (const activity of day.activities) {
    const type = normalizeActivityType(activity.type)
    if (type && type in sessions) sessions[type as keyof typeof sessions] += 1
  }
  const protein = recordedDates.size ? average(summary.sum.protein) : undefined
  return {
    anthropometry: { weight: body(summary, 'weightKg'), waist: body(summary, 'waistCm') },
    nutrition: {
      recordedDays: recordedDates.size,
      calories: recordedDates.size ? average(summary.sum.kcal) : undefined,
      expenditure: summary.energyComplete ? average(summary.totalExpenditure) : undefined,
      deficit: summary.energyComplete && recordedDates.size ? average(summary.totalDeficit) : undefined,
      deficitTarget, protein, proteinTarget,
      proteinCompliance: protein !== undefined && proteinTarget !== undefined ? safe(protein / proteinTarget * 100) : undefined,
      carbs: recordedDates.size ? average(summary.sum.carbs) : undefined,
      fat: recordedDates.size ? average(summary.sum.fat) : undefined,
    },
    activity: { sessions, totalCalories: safe(summary.sum.activeCalories), averageCalories: average(summary.sum.activeCalories) },
    adherence: {
      days: count,
      protein: proteinTarget === undefined || !recordedDates.size ? undefined : summary.days.filter((day) => finite(day.intake.protein) && day.intake.protein >= proteinTarget * 0.9).length,
      deficit: deficitTarget === undefined || !recordedDates.size || !summary.energyComplete ? undefined : summary.days.filter((day) => recordedDates.has(day.date) && isCoachDeficitAdherent(day.energy?.estimatedDeficit, deficitTarget)).length,
      fat: fatTarget === undefined || !recordedDates.size ? undefined : summary.days.filter((day) => finite(day.intake.fat) && day.intake.fat > fatTarget * 1.1).length,
    },
  }
}

export function buildWeeklyCoachReportData({ summary, goals, entries, activities, measurements }: {
  summary: WeekSummary; goals: UserGoals; entries: FoodDiaryEntry[]; activities: ActivityEntry[]; measurements: BodyMeasurement[]
}) {
  const previousSummary = createWeeklySummary({ range: getWeekRange(summary.range.start, -1), today: summary.activeEnd, entries, activities, measurements, goals })
  const current = sectionData(summary, goals, entries)
  const previous = sectionData(previousSummary, goals, entries)
  const difference = (a: number | undefined, b: number | undefined) => finite(a) && finite(b) ? safe(a - b) : undefined
  // Only compare nutrition when both periods have a food log for every included day.
  const nutritionComparable = summary.dayCount > 0 && current.nutrition.recordedDays === summary.dayCount
    && previous.nutrition.recordedDays === previousSummary.dayCount
  const previousHasData = previous.nutrition.recordedDays > 0 || previousSummary.days.some((day) => day.activities.length > 0) || previousSummary.weekMeasurements.length > 0
  return {
    period: { ...summary.range, activeEnd: summary.activeEnd, days: summary.dayCount, previousDays: previousSummary.dayCount },
    ...current,
    comparison: {
      weightMean: difference(current.anthropometry.weight.mean, previous.anthropometry.weight.mean),
      waistMean: difference(current.anthropometry.waist.mean, previous.anthropometry.waist.mean),
      deficitMean: nutritionComparable ? difference(current.nutrition.deficit, previous.nutrition.deficit) : undefined,
      proteinMean: nutritionComparable ? difference(current.nutrition.protein, previous.nutrition.protein) : undefined,
      crossFit: previousHasData && summary.dayCount > 0 ? { current: current.activity.sessions.CrossFit, previous: previous.activity.sessions.CrossFit } : undefined,
    },
  }
}

export type WeeklyCoachReportData = ReturnType<typeof buildWeeklyCoachReportData>

export function formatWeeklyCoachReport(data: WeeklyCoachReportData) {
  const number = (value: number, digits = 1, signed = false) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: digits, signDisplay: signed ? 'exceptZero' : 'auto' }).format(value)
  const metric = (label: string, value: number | undefined, unit: string, digits = 1, signed = false) => `${label}: ${finite(value) ? `${number(value, digits, signed)}${unit ? ` ${unit}` : ''}` : 'Sin datos'}`
  const date = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  const { period, anthropometry: a, nutrition: n, activity, adherence, comparison: c } = data
  const lines = ['INFORME SEMANAL SIX PACK', `Semana: ${date(period.start)} – ${date(period.end)}`,
    `Periodo incluido: ${period.days} días${period.days < 7 ? ` (semana parcial, hasta ${date(period.activeEnd)})` : ''}`,
    '', 'ANTROPOMETRÍA', metric('Peso inicial', a.weight.initial, 'kg'), metric('Peso final', a.weight.final, 'kg'), metric('Peso medio', a.weight.mean, 'kg')]
  if (a.weight.count > 1) lines.push(metric('Variación semanal', a.weight.change, 'kg', 1, true))
  lines.push(metric('Cintura inicial', a.waist.initial, 'cm'), metric('Cintura final', a.waist.final, 'cm'))
  if (a.waist.count > 1) lines.push(metric('Variación cintura', a.waist.change, 'cm', 1, true))
  lines.push('', 'NUTRICIÓN', metric('Kcal ingeridas medias', n.calories, 'kcal/día', 0), metric('Gasto medio', n.expenditure, 'kcal/día', 0),
    metric('Déficit medio', n.deficit, 'kcal/día', 0), metric('Déficit objetivo', n.deficitTarget, 'kcal/día', 0),
    metric('Proteína media', n.protein, 'g/día'), metric('Objetivo proteína', n.proteinTarget, 'g/día'), metric('Cumplimiento proteína', n.proteinCompliance, '%', 0),
    metric('Hidratos medios', n.carbs, 'g/día'), metric('Grasas medias', n.fat, 'g/día'),
    `Días con registros de alimentación: ${n.recordedDays}/${period.days}. Las medias siguen el resumen semanal: los días sin registros aportan 0, no ingesta confirmada.`,
    '', 'ACTIVIDAD', ...Object.entries(activity.sessions).map(([type, count]) => `${type}: ${count} sesiones`),
    metric('Kcal activas totales', activity.totalCalories, 'kcal', 0), metric('Kcal activas medias', activity.averageCalories, 'kcal/día', 0),
    'Solo actividad real registrada; no incluye actividad prevista.', '', 'ADHERENCIA')
  for (const [label, value] of [['Proteína >=90%', adherence.protein], ['Déficit dentro de objetivo ±20%', adherence.deficit], ['Grasas >110% objetivo', adherence.fat]] as const) {
    lines.push(`${label}: ${value === undefined ? 'Sin datos' : `${value}/${adherence.days} días`}`)
  }
  lines.push('Referencia: objetivos base configurados actualmente, sin reconstruir objetivos adaptativos históricos.', '', 'EVOLUCIÓN VS SEMANA ANTERIOR')
  const comparisons: string[] = []
  for (const [label, value, unit, digits] of [['Peso medio', c.weightMean, 'kg', 1], ['Cintura media', c.waistMean, 'cm', 1], ['Déficit medio', c.deficitMean, 'kcal/día', 0], ['Proteína media', c.proteinMean, 'g/día', 1]] as const) {
    if (finite(value)) comparisons.push(metric(label, value, unit, digits, true))
  }
  if (c.crossFit) comparisons.push(`CrossFit: ${c.crossFit.current} vs ${c.crossFit.previous} sesiones`)
  lines.push(...(comparisons.length ? [`Periodos comparados: ${period.days} vs ${period.previousDays} días.`, ...comparisons] : ['Sin datos suficientes para comparar con la semana anterior.']),
    '', 'CONTEXTO', 'Objetivo principal: reducir grasa abdominal manteniendo la mayor cantidad posible de masa muscular y mejorando el rendimiento en CrossFit.',
    '', 'Analiza esta semana como coach deportivo y nutricional. Prioriza tendencias, adherencia, rendimiento y sostenibilidad. Detecta patrones positivos y negativos y propón ajustes concretos para la próxima semana.')
  return lines.join('\n')
}
