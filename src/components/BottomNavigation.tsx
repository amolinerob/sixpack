import type { Screen } from '../types'

type Props = {
  activeScreen: Screen
  onNavigate: (screen: Screen) => void
}

const navigationItems: Array<{ id: Screen; label: string; icon: string }> = [
  { id: 'hoy', label: 'HOY', icon: '☀' },
  { id: 'comidas', label: 'COMIDAS', icon: '☕' },
  { id: 'alimentos', label: 'ALIMENTOS', icon: '≡' },
  { id: 'progreso', label: 'PROGRESO', icon: '◌' },
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
            {item.icon}
          </span>
          <span className="nav-item__label">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
