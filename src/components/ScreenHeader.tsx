import type { User } from '../types'

type Props = {
  title: 'HOY' | 'COMIDAS' | 'ALIMENTOS' | 'PROGRESO' | 'USUARIO'
  user: User
  onUserClick?: () => void
}

/** Cabecera compartida de las pantallas principales. */
export function ScreenHeader({ title, user, onUserClick }: Props) {
  return (
    <header className="screen-header">
      <h1 className="screen-header__title">{title.charAt(0) + title.slice(1).toLocaleLowerCase('es-ES')}</h1>
      <button
        className="screen-header__user"
        onClick={onUserClick}
        type="button"
        aria-label="Cambiar usuario activo"
      >
        {user.name}
      </button>
    </header>
  )
}
