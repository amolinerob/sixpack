import { useState } from 'react'
import { BottomNavigation } from './components/BottomNavigation'
import { AlimentosScreen } from './screens/AlimentosScreen'
import { HoyScreen } from './screens/HoyScreen'
import { ProgresoScreen } from './screens/ProgresoScreen'
import type { Screen } from './types'

function App() {
  const [activeScreen, setActiveScreen] = useState<Screen>('hoy')

  return (
    <div className="app-shell">
      <main className="app-main">
        {activeScreen === 'hoy' && <HoyScreen />}
        {activeScreen === 'alimentos' && <AlimentosScreen />}
        {activeScreen === 'progreso' && <ProgresoScreen />}
      </main>

      <BottomNavigation activeScreen={activeScreen} onNavigate={setActiveScreen} />
    </div>
  )
}

export default App
