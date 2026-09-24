import { useEffect, useRef, useState } from 'react'
import { dailyActivityIntentionsRepository } from './data/cloud/repositories'
import { toggleActivityIntention } from './activityEstimation'
import type { ActivityIntentionType } from './types'

type PlanState = { key: string; values: ActivityIntentionType[]; status: 'loading' | 'ready' | 'saving' | 'error'; error: string }

export function useDailyActivityIntentions(userId: string, date: string) {
  const [state, setState] = useState<PlanState>({ key: '', values: [], status: 'loading', error: '' })
  const [revision, setRevision] = useState(0)
  const key = `${userId}:${date}:${revision}`
  const generation = useRef(0)
  const pendingSave = useRef<Promise<void> | null>(null)

  // Reset on a changed identity before painting; never flash another day's plan.
  if (state.key !== key) setState({ key, values: [], status: 'loading', error: '' })

  useEffect(() => {
    const request = ++generation.current
    async function load() {
      // Reopening a date must not read its previous plan while a save is still pending.
      await pendingSave.current
      try {
        const values = await dailyActivityIntentionsRepository.get(userId, date)
        if (request === generation.current) setState({ key, values, status: 'ready', error: '' })
      } catch (reason) {
        if (request === generation.current) setState({ key, values: [], status: 'error', error: reason instanceof Error ? reason.message : 'No se pudo cargar la planificación.' })
      }
    }
    void load()
    return () => { generation.current = request + 1 }
  }, [userId, date, key])

  function toggle(type: ActivityIntentionType) {
    if (state.key !== key || state.status !== 'ready' || pendingSave.current) return
    const request = generation.current
    const next = toggleActivityIntention(state.values, type)
    setState({ ...state, status: 'saving', error: '' })
    const save = async () => {
      try {
        const values = await dailyActivityIntentionsRepository.save(userId, date, next)
        if (request === generation.current) setState({ key, values, status: 'ready', error: '' })
      } catch (reason) {
        if (request === generation.current) setState({ ...state, status: 'ready', error: reason instanceof Error ? reason.message : 'No se pudo guardar la planificación.' })
      }
    }
    pendingSave.current = save().finally(() => { pendingSave.current = null })
  }

  const sameDate = state.key === key
  return {
    values: sameDate ? state.values : [],
    loading: !sameDate || state.status === 'loading',
    saving: sameDate && state.status === 'saving',
    ready: sameDate && (state.status === 'ready' || state.status === 'saving'),
    error: sameDate ? state.error : '',
    toggle,
    retry: () => setRevision((value) => value + 1),
  }
}
