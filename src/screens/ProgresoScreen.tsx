const measures = ['Peso', 'Cintura', 'Evolución']

export function ProgresoScreen() {
  return (
    <section className="screen screen-progreso">
      <section className="app-header app-header--simple">
        <div>
          <span className="app-kicker">Progreso</span>
          <h1 className="app-title">Progreso</h1>
        </div>
      </section>

      <section className="progress-list">
        {measures.map((measure) => (
          <article className="progress-card" key={measure}>
            <div className="progress-card__top">
              <span className="progress-card__title">{measure}</span>
              <span className="progress-card__icon">—</span>
            </div>
            <div className="progress-card__body">
              <span className="progress-card__empty">Sin datos</span>
            </div>
          </article>
        ))}
      </section>
    </section>
  )
}
