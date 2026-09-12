import type { ActivityEntry, BodyMeasurement, FoodDiaryEntry, User } from './types'
import { USERS } from './types'

const ACTIVE_USER_KEY = 'sixpack.active.user.v1'
const MIGRATION_DONE_KEY = 'sixpack.legacy.migration.v1'
const LEGACY_ENTRIES_KEY = 'sixpack.diary.entries.v1'
const LEGACY_ACTIVITIES_KEY = 'sixpack.activities.entries.v1'

export const DEFAULT_USER_ID = 'angel'

export function getEntriesStorageKey(userId: string) {
  return `sixpack.diary.entries.v1.${userId}`
}

export function getActivitiesStorageKey(userId: string) {
  return `sixpack.activities.entries.v1.${userId}`
}

export function getBodyMeasurementsStorageKey(userId: string) {
  return `sixpack.body.measurements.v1.${userId}`
}

export function getUserById(userId: string | null | undefined): User | undefined {
  return USERS.find((user) => user.id === userId)
}

export function getActiveUserId(): string | null {
  const raw = localStorage.getItem(ACTIVE_USER_KEY)
  if (!raw) {
    return null
  }

  return getUserById(raw)?.id ?? null
}

export function setActiveUserId(userId: string) {
  if (!getUserById(userId)) {
    return
  }

  localStorage.setItem(ACTIVE_USER_KEY, userId)
}

export function clearActiveUserId() {
  localStorage.removeItem(ACTIVE_USER_KEY)
}

export function getActiveUser(): User | undefined {
  const userId = getActiveUserId()
  return getUserById(userId)
}

export function loadEntries(userId: string): FoodDiaryEntry[] {
  const raw = localStorage.getItem(getEntriesStorageKey(userId))
  if (!raw) {
    return []
  }

  try {
    return JSON.parse(raw) as FoodDiaryEntry[]
  } catch {
    return []
  }
}

export function saveEntries(userId: string, entries: FoodDiaryEntry[]) {
  localStorage.setItem(getEntriesStorageKey(userId), JSON.stringify(entries))
}

export function loadActivities(userId: string): ActivityEntry[] {
  const raw = localStorage.getItem(getActivitiesStorageKey(userId))
  if (!raw) {
    return []
  }

  try {
    return JSON.parse(raw) as ActivityEntry[]
  } catch {
    return []
  }
}

export function saveActivities(userId: string, activities: ActivityEntry[]) {
  localStorage.setItem(getActivitiesStorageKey(userId), JSON.stringify(activities))
}

export function loadBodyMeasurements(userId: string): BodyMeasurement[] {
  const raw = localStorage.getItem(getBodyMeasurementsStorageKey(userId))
  if (!raw) {
    return []
  }

  try {
    return JSON.parse(raw) as BodyMeasurement[]
  } catch {
    return []
  }
}

export function saveBodyMeasurements(userId: string, measurements: BodyMeasurement[]) {
  localStorage.setItem(getBodyMeasurementsStorageKey(userId), JSON.stringify(measurements))
}

export function migrateLegacyDataToAngel() {
  if (localStorage.getItem(MIGRATION_DONE_KEY) === '1') {
    return
  }

  const legacyEntriesRaw = localStorage.getItem(LEGACY_ENTRIES_KEY)
  if (legacyEntriesRaw) {
    try {
      const legacyEntries = JSON.parse(legacyEntriesRaw) as FoodDiaryEntry[]
      const storedEntries = loadEntries(DEFAULT_USER_ID)
      const mergedEntries = [...storedEntries, ...legacyEntries]
      saveEntries(DEFAULT_USER_ID, mergedEntries)
    } catch {
      // silent migration fallback
    }
  }

  const legacyActivitiesRaw = localStorage.getItem(LEGACY_ACTIVITIES_KEY)
  if (legacyActivitiesRaw) {
    try {
      const legacyActivities = JSON.parse(legacyActivitiesRaw) as ActivityEntry[]
      const storedActivities = loadActivities(DEFAULT_USER_ID)
      const mergedActivities = [...storedActivities, ...legacyActivities]
      saveActivities(DEFAULT_USER_ID, mergedActivities)
    } catch {
      // silent migration fallback
    }
  }

  localStorage.setItem(MIGRATION_DONE_KEY, '1')
}
