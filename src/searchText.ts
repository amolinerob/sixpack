/** Search-only normalization; never changes displayed or stored names. */
export function normalizeSearchText(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}
