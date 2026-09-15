export function parseDecimalFromSpanishInput(value: string): number {
  const normalized = value.trim().replace(',', '.')
  return normalized === '' ? 0 : Number(normalized)
}
