import type { Screen } from '../types'
import { SixPackIcon, type SixPackIconName } from './SixPackIcon'

type Props = {
  activeScreen: Screen
  onNavigate: (screen: Screen) => void
}

const navigationItems: Array<{ id: Screen; label: string; icon: SixPackIconName }> = [
  { id: 'hoy', label: 'HOY', icon: 'today' },
  { id: 'comidas', label: 'COMIDAS', icon: 'meals' },
  { id: 'alimentos', label: 'ALIMENTOS', icon: 'foods' },
  { id: 'progreso', label: 'PROGRESO', icon: 'progress' },
]

export function BottomNavigation({ activeScreen, onNavigate }: Props) {
  return (
    <nav className="bottom-navigation" aria-label="Navegación principal">
      {navigationItems.map((item) => (
        <button
          className={`nav-item ${activeScreen === item.id ? 'is-active' : ''}`}
          key={item.id}
          onClick={() => onNavigate(item.id)}
          type="button"
        >
          <span className="nav-item__icon" aria-hidden="true">
            <SixPackIcon name={item.icon} />
          </span>
          <span className="nav-item__label">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
