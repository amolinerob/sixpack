import { useEffect, useRef, useState } from 'react'
import { userPreferencesRepository } from './data/cloud/repositories'
import type { AccentColor } from './types'

type PreferencesState = {
  userId: string
  accentColor: AccentColor
  saving: boolean
  error: string
}

type PreferencesSession = {
  userId: string
  active: boolean
  revision: number
  confirmedColor: AccentColor
  queue: Promise<void>
}

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Comprueba la conexión e inténtalo de nuevo.'
}

export function useUserPreferences(userId: string | undefined, defaultColor: AccentColor) {
  const [state, setState] = useState<PreferencesState | null>(null)
  const sessionRef = useRef<PreferencesSession | null>(null)
  const current = state?.userId === userId ? state : null

  useEffect(() => {
    if (!userId) return
    const session: PreferencesSession = {
      userId, active: true, revision: 0, confirmedColor: defaultColor, queue: Promise.resolve(),
    }
    sessionRef.current = session
    userPreferencesRepository.get(userId).then((preferences) => {
      if (!session.active || session.revision !== 0) return
      session.confirmedColor = preferences?.accentColor ?? defaultColor
      setState({ userId, accentColor: session.confirmedColor, saving: false, error: '' })
    }).catch((reason: unknown) => {
      if (!session.active || session.revision !== 0) return
      setState({ userId, accentColor: defaultColor, saving: false, error: `No se pudo cargar tu color. ${errorMessage(reason)}` })
    })
    return () => { session.active = false }
  }, [userId, defaultColor])

  async function changeAccentColor(accentColor: AccentColor) {
    const session = sessionRef.current
    if (!userId || !current || !session?.active || session.userId !== userId) return
    const revision = ++session.revision
    // Actualiza App y el selector antes de iniciar la escritura.
    setState({ userId, accentColor, saving: true, error: '' })
    // El último clic también debe ser la última escritura en Supabase.
    const task = session.queue.then(async () => {
      if (!session.active) return
      try {
        const saved = await userPreferencesRepository.upsert(userId, accentColor)
        if (!session.active) return
        session.confirmedColor = saved.accentColor
        if (session.revision !== revision) return
        setState({ userId, accentColor: saved.accentColor, saving: false, error: '' })
      } catch (reason) {
        if (!session.active || session.revision !== revision) return
        setState({ userId, accentColor: session.confirmedColor, saving: false,
          error: `No se pudo guardar el color. ${errorMessage(reason)} Se ha restaurado el último color confirmado.` })
      }
    })
    session.queue = task
    await task
  }

  return {
    accentColor: current?.accentColor ?? defaultColor,
    loading: Boolean(userId) && !current,
    saving: current?.saving ?? false,
    error: current?.error ?? '',
    changeAccentColor,
  }
}
