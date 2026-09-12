import { useMemo, useState } from 'react'
import { foods } from '../data/foods'

export function AlimentosScreen() {
  const [searchName, setSearchName] = useState('')
  const [selectedFoodId, setSelectedFoodId] = useState(foods[0]?.id ?? '')

  const filteredFoods = useMemo(() => {
    return foods.filter((food) => {
      return food.name.toLowerCase().includes(searchName.toLowerCase())
    })
  }, [searchName])

  const selectedFood =
    foods.find((food) => food.id === selectedFoodId) ?? filteredFoods[0] ?? foods[0]

  return (
    <section className="screen screen-alimentos">
      <section className="app-header app-header--simple">
        <span className="app-kicker">Alimentos</span>
      </section>

      <section className="food-panel">
        <section className="food-search">
          <div className="search-box">
            <span className="search-icon">⌕</span>
            <input
              type="search"
              value={searchName}
              onChange={(event) => setSearchName(event.target.value)}
              placeholder="Buscar por nombre"
              aria-label="Buscar por nombre"
            />
          </div>
        </section>

        <section className="food-layout">
          <section className="food-list-panel">
            <div className="food-list-panel__header">
              <span className="food-list-panel__title">Lista</span>
              <span className="food-list-panel__count">{filteredFoods.length}</span>
            </div>

            <div className="food-list">
              {filteredFoods.length === 0 && (
                <div className="empty-state-block">
                  <div className="empty-state-block__icon">+</div>
                  <div className="empty-state-block__body">
                    <span className="empty-state-block__title">Sin alimentos</span>
                    <span className="empty-state-block__text">No hay alimentos disponibles</span>
                  </div>
                </div>
              )}

              {filteredFoods.map((food) => (
                <button
                  className={`food-row ${food.id === selectedFood.id ? 'is-selected' : ''}`}
                  key={food.id}
                  type="button"
                  onClick={() => setSelectedFoodId(food.id)}
                >
                  <span className="food-row__name">{food.name}</span>
                  {food.brand && <span className="food-row__brand">{food.brand}</span>}
                </button>
              ))}
            </div>
          </section>

          <aside className="food-detail-panel">
            {selectedFood && (
              <>
                <div className="food-detail-panel__top">
                  <span className="food-detail-panel__category">Alimento</span>
                </div>

                <div className="food-detail-panel__content">
                  <div className="food-detail__head">
                    <div>
                      <span className="food-detail__name">{selectedFood.name}</span>
                      <span className="food-detail__brand">{selectedFood.brand}</span>
                    </div>
                    <span className="food-detail__serving">{selectedFood.servingHabitual}</span>
                  </div>

                  <div className="food-macro-table">
                    <div className="food-macro-table__row food-macro-table__row--head">
                      <span>100 g</span>
                      <span>Valor</span>
                    </div>
                    <div className="food-macro-table__row">
                      <span>Kcal</span>
                      <span>{selectedFood.kcal100g} kcal</span>
                    </div>
                    <div className="food-macro-table__row">
                      <span>Proteína</span>
                      <span>{selectedFood.protein100g} g</span>
                    </div>
                    <div className="food-macro-table__row">
                      <span>Hidratos</span>
                      <span>{selectedFood.carbs100g} g</span>
                    </div>
                    <div className="food-macro-table__row">
                      <span>Grasas</span>
                      <span>{selectedFood.fat100g} g</span>
                    </div>
                  </div>

                  <div className="food-detail__note">
                    <span>Valores nutricionales por 100 g</span>
                  </div>
                </div>
              </>
            )}
          </aside>
        </section>
      </section>
    </section>
  )
}
