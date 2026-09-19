import { useLayoutEffect, useMemo, useState } from 'react'
import { useAuth } from './auth/AuthProvider'
import { BottomNavigation } from './components/BottomNavigation'
import { AlimentosScreen } from './screens/AlimentosScreen'
import { ComidasScreen } from './screens/ComidasScreen'
import { HoyScreen } from './screens/HoyScreen'
import { LoginScreen } from './screens/LoginScreen'
import { ProgresoScreen } from './screens/ProgresoScreen'
import { UsuarioScreen } from './screens/UsuarioScreen'
import { type Screen, type User } from './types'
import { ACCENT_COLORS, applyThemeToRoot, getDefaultAccentColor } from './theme'
import { useUserPreferences } from './useUserPreferences'

function App() {
  const [activeScreen, setActiveScreen] = useState<Screen>('hoy')
  const { user, profile, legacyUserKey, loading, error, signOut } = useAuth()
  const activeUser = useMemo<User | undefined>(() => {
    if (!profile) return undefined
    return { id: profile.id, name: profile.display_name ?? 'Usuario' }
  }, [profile])

  const preferences = useUserPreferences(activeUser?.id, getDefaultAccentColor(legacyUserKey))
  const theme = ACCENT_COLORS[preferences.accentColor]

  useLayoutEffect(() => {
    applyThemeToRoot(theme)
  }, [theme])

  if (loading) return <main className="auth-screen"><span className="auth-loading">Comprobando sesión…</span></main>
  if (!user) return <LoginScreen />
  if (error || !activeUser) return <main className="auth-screen"><div className="auth-card"><span className="auth-card__brand">SIX PACK</span><span className="error-text">{error ?? 'El perfil autenticado no está asociado a un usuario local válido.'}</span><button className="primary-button" onClick={() => void signOut()}>Cerrar sesión</button></div></main>

  return (
    <div className="app-shell">
      <main className="app-main">
        {activeScreen === 'hoy' && <HoyScreen activeUser={activeUser} onUserClick={() => undefined} onGoToUser={() => setActiveScreen('usuario')} />}
        {activeScreen === 'alimentos' && <AlimentosScreen activeUser={activeUser} onUserClick={() => undefined} />}
        {activeScreen === 'comidas' && <ComidasScreen activeUser={activeUser} onUserClick={() => undefined} />}
        {activeScreen === 'progreso' && <ProgresoScreen activeUser={activeUser} onUserClick={() => undefined} />}
        {activeScreen === 'usuario' && <UsuarioScreen activeUser={activeUser} onUserClick={() => undefined} onSignOut={() => void signOut()} preferences={preferences} />}
      </main>

      <BottomNavigation activeScreen={activeScreen} onNavigate={setActiveScreen} />
    </div>
  )
}

export default App
