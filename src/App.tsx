import { useEffect, useMemo, useState } from 'react'
import { BottomNavigation } from './components/BottomNavigation'
import { AlimentosScreen } from './screens/AlimentosScreen'
import { HoyScreen } from './screens/HoyScreen'
import { ProgresoScreen } from './screens/ProgresoScreen'
import { getActiveUser, migrateLegacyDataToAngel, setActiveUserId } from './storage'
import { USERS, type Screen, type User } from './types'
import { applyThemeToRoot, getThemeForUser } from './theme'

function App() {
  const [activeScreen, setActiveScreen] = useState<Screen>('hoy')
  const [activeUser, setActiveUser] = useState<User | undefined>(() => getActiveUser())
  const [showUserSelector, setShowUserSelector] = useState(false)

  useEffect(() => {
    migrateLegacyDataToAngel()
    const storedUser = getActiveUser()
    if (!storedUser) {
      setShowUserSelector(true)
    } else {
      setActiveUser(storedUser)
    }
  }, [])

  const theme = useMemo(() => getThemeForUser(activeUser), [activeUser])

  useEffect(() => {
    applyThemeToRoot(theme)
  }, [theme])

  function selectUser(user: User) {
    setActiveUser(user)
    setActiveUserId(user.id)
    setShowUserSelector(false)
  }

  return (
    <div className="app-shell">
      {activeUser && (
        <section className="app-user-strip">
          <button className="app-user-switch" onClick={() => setShowUserSelector(true)}>
            <span className="app-user-switch__icon">👤</span>
            <span className="app-user-switch__name">{activeUser.name}</span>
          </button>
        </section>
      )}

      <main className="app-main">
        {showUserSelector || !activeUser ? (
          <section className="user-picker">
            <div className="user-picker__card">
              <span className="user-picker__title">¿Quién está usando Six Pack?</span>
              <div className="user-picker__list">
                {USERS.map((user) => (
                  <button className="user-picker__item" key={user.id} onClick={() => selectUser(user)}>
                    <span className="user-picker__name">{user.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <>
            {activeScreen === 'hoy' && <HoyScreen activeUser={activeUser} />}
            {activeScreen === 'alimentos' && <AlimentosScreen />}
            {activeScreen === 'progreso' && <ProgresoScreen activeUser={activeUser} />}
          </>
        )}
      </main>

      {activeUser && !showUserSelector && (
        <BottomNavigation activeScreen={activeScreen} onNavigate={setActiveScreen} />
      )}
    </div>
  )
}

export default App
