const decimal = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })

/** Display only: never use for arithmetic, input values or persisted snapshots. */
export function formatDisplayNumber(value: number) {
  return Number.isFinite(value) ? decimal.format(value) : '—'
}
