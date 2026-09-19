import { ACCENT_COLORS } from '../theme'
import type { useUserPreferences } from '../useUserPreferences'

export function UserPreferencesSection({ preferences }: { preferences: ReturnType<typeof useUserPreferences> }) {
  return <section className="goals-card user-preferences" aria-labelledby="preferences-title">
    <h2 id="preferences-title" className="goals-card__title">Preferencias</h2>
    <div role="group" aria-labelledby="user-color-label">
      <p id="user-color-label" className="user-preferences__label">Color de usuario</p>
      <div className="user-preferences__colors" aria-busy={preferences.saving}>
        {Object.values(ACCENT_COLORS).map((color) => {
          const selected = preferences.accentColor === color.id
          return <button key={color.id} type="button" className="user-preferences__color"
            aria-label={color.label} aria-pressed={selected} title={color.label}
            disabled={preferences.loading}
            onClick={() => void preferences.changeAccentColor(color.id)}>
            <span className="user-preferences__swatch" style={{ backgroundColor: color.accent, color: color.greenStrong }} aria-hidden="true">
              {selected && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>}
            </span>
            <span className="user-preferences__color-name">{color.label}</span>
          </button>
        })}
      </div>
    </div>
    <span className="user-preferences__status" role="status">
      {preferences.loading ? 'Cargando preferencia…' : preferences.saving ? 'Guardando color…' : `Color actual: ${ACCENT_COLORS[preferences.accentColor].label}`}
    </span>
    {preferences.error && <span className="error-text" role="alert">{preferences.error}</span>}
  </section>
}
