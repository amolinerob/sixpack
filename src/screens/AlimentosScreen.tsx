import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { foods as baseFoods, type FoodItem } from '../data/foods'
import { deleteSharedFood, getCombinedFoods, saveFoodToShared } from '../storage'
import type { User } from '../types'
import { ScreenHeader } from '../components/ScreenHeader'

function normalizeFoodName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function emptyForm() {
  return {
    name: '',
    brand: '',
    servingHabitual: '',
    kcal100g: '0',
    protein100g: '0',
    carbs100g: '0',
    fat100g: '0',
  }
}

function parseDecimalFromSpanishInput(value: string): number {
  const normalized = value.trim().replace(',', '.')
  return Number(normalized)
}

export function AlimentosScreen({ activeUser, onUserClick }: { activeUser: User; onUserClick: () => void }) {
  const [foods, setFoods] = useState<FoodItem[]>(() => getCombinedFoods())
  const [searchName, setSearchName] = useState('')
  const [selectedFoodId, setSelectedFoodId] = useState(() => getCombinedFoods()[0]?.id ?? '')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [deleteConfirmationStep, setDeleteConfirmationStep] = useState<1 | 2>(1)
  const [duplicateExistingId, setDuplicateExistingId] = useState<string | null>(null)
  const [duplicateMessage, setDuplicateMessage] = useState('')
  const [form, setForm] = useState(emptyForm)

  const filteredFoods = useMemo(() => {
    return foods.filter((food) => food.name.toLowerCase().includes(searchName.toLowerCase()))
  }, [foods, searchName])

  const selectedFood = foods.find((food) => food.id === selectedFoodId) ?? filteredFoods[0] ?? foods[0]

  function openCreateModal() {
    setEditingId(null)
    setDuplicateExistingId(null)
    setDuplicateMessage('')
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEditModal(food: FoodItem) {
    setEditingId(food.id)
    setDuplicateExistingId(null)
    setDuplicateMessage('')
    setForm({
      name: food.name,
      brand: food.brand,
      servingHabitual: food.servingHabitual,
      kcal100g: String(food.kcal100g),
      protein100g: String(food.protein100g),
      carbs100g: String(food.carbs100g),
      fat100g: String(food.fat100g),
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setDuplicateExistingId(null)
    setDuplicateMessage('')
  }

  function saveFoodFromForm(event?: FormEvent) {
    event?.preventDefault()

    const numeric = {
      kcal100g: parseDecimalFromSpanishInput(form.kcal100g),
      protein100g: parseDecimalFromSpanishInput(form.protein100g),
      carbs100g: parseDecimalFromSpanishInput(form.carbs100g),
      fat100g: parseDecimalFromSpanishInput(form.fat100g),
    }

    if (!form.name.trim()) {
      setDuplicateMessage('El nombre es obligatorio.')
      return
    }

    if ([numeric.kcal100g, numeric.protein100g, numeric.carbs100g, numeric.fat100g].some((value) => Number.isNaN(value) || value < 0)) {
      setDuplicateMessage('Los valores nutricionales deben ser números positivos o cero.')
      return
    }

    const normalizedName = normalizeFoodName(form.name)
    const duplicate = foods.find((food) => normalizeFoodName(food.name) === normalizedName && food.id !== editingId)
    if (duplicate) {
      setDuplicateExistingId(duplicate.id)
      setDuplicateMessage('Ya existe un alimento con ese nombre.')
      return
    }

    const existing = foods.find((food) => food.id === editingId)
    const base = baseFoods.find((food) => food.id === editingId)
    const source = existing ?? base

    const payload: FoodItem = {
      id: editingId ?? `custom-${Date.now()}-${Math.round(Math.random() * 10000)}`,
      name: form.name.trim(),
      brand: form.brand.trim(),
      servingHabitual: form.servingHabitual.trim(),
      servingUnit: source?.servingUnit ?? null,
      servingGrams: source?.servingGrams ?? null,
      kcal100g: numeric.kcal100g,
      protein100g: numeric.protein100g,
      carbs100g: numeric.carbs100g,
      fat100g: numeric.fat100g,
    }

    saveFoodToShared(payload)

    const nextFoods = getCombinedFoods()
    setFoods(nextFoods)
    setSelectedFoodId(payload.id)
    setModalOpen(false)
    setDuplicateExistingId(null)
    setDuplicateMessage('')
  }

  function deleteFood(foodId: string) {
    const food = foods.find((item) => item.id === foodId)
    if (!food || baseFoods.some((base) => base.id === food.id)) {
      return
    }

    setDeleteConfirmationStep(1)
    setShowDeleteConfirm(food.id)
  }

  function confirmDelete(foodId: string) {
    if (deleteConfirmationStep !== 2) {
      return
    }

    const food = foods.find((item) => item.id === foodId)
    if (!food || baseFoods.some((base) => base.id === food.id)) {
      return
    }

    deleteSharedFood(food.id)
    const next = getCombinedFoods()
    setFoods(next)
    const nextSelected = next.find((item) => item.id !== food.id) ?? next[0]
    setSelectedFoodId(nextSelected?.id ?? '')
    setShowDeleteConfirm(null)
  }

  function cancelDelete() {
    setShowDeleteConfirm(null)
    setDeleteConfirmationStep(1)
  }

  return (
    <section className="screen screen-alimentos">
      <ScreenHeader title="ALIMENTOS" user={activeUser} onUserClick={onUserClick} />

      <section className="food-panel">
        <section className="food-search">
          <div className="search-box">
            <span className="search-icon">⌕</span>
            <input type="search" value={searchName} onChange={(event) => setSearchName(event.target.value)} placeholder="Buscar por nombre" aria-label="Buscar por nombre" />
          </div>
        </section>

        <section className="food-layout">
          <section className="food-list-panel">
            <div className="food-list-panel__header">
              <span className="food-list-panel__title">Lista</span>
              <span className="food-list-panel__count">{filteredFoods.length}</span>
              <button className="primary-button food-add-button" onClick={openCreateModal}>+ Añadir alimento</button>
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
                <div
                  className={`food-row ${food.id === selectedFood.id ? 'is-selected' : ''}`}
                  key={food.id}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
                >
                  <button
                    className="food-row__button"
                    type="button"
                    onClick={() => setSelectedFoodId(food.id)}
                    style={{ flex: '1 1 auto', minWidth: 0, border: 0, background: 'transparent', color: 'inherit', padding: 0, textAlign: 'left' }}
                  >
                    <span className="food-row__name">{food.name}</span>
                  </button>
                  <span className="food-row__actions" style={{ display: 'flex', flex: '0 0 auto', alignItems: 'center', gap: 4 }}>
                    <button className="food-row__icon" title="Editar" aria-label="Editar" onClick={() => openEditModal(food)}>✎</button>
                    {baseFoods.every((base) => base.id !== food.id) && (
                      <button className="food-row__icon food-row__icon--danger" title="Eliminar" aria-label="Eliminar" onClick={() => deleteFood(food.id)}>🗑</button>
                    )}
                  </span>
                </div>
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

      {modalOpen && (
        <div className="food-modal-backdrop">
          <div className="food-modal">
            <div className="food-modal__top">
              <span className="food-modal__title">{editingId ? 'Editar alimento' : 'Añadir alimento'}</span>
              <button className="food-modal__close" onClick={closeModal}>×</button>
            </div>

            <form className="food-modal__form" onSubmit={saveFoodFromForm}>
              <label className="food-modal__label">Nombre *</label>
              <input className="food-modal__quantity" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nombre" />

              <label className="food-modal__label">Marca</label>
              <input className="food-modal__quantity" value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} placeholder="Marca" />

              <label className="food-modal__label">Ración habitual</label>
              <input className="food-modal__quantity" value={form.servingHabitual} onChange={(event) => setForm({ ...form, servingHabitual: event.target.value })} placeholder="Ración habitual" />

              <label className="food-modal__label">Kcal / 100 g *</label>
              <input className="food-modal__quantity" type="text" inputMode="decimal" value={form.kcal100g} onChange={(event) => setForm({ ...form, kcal100g: event.target.value })} />

              <label className="food-modal__label">Proteínas / 100 g *</label>
              <input className="food-modal__quantity" type="text" inputMode="decimal" value={form.protein100g} onChange={(event) => setForm({ ...form, protein100g: event.target.value })} />

              <label className="food-modal__label">Hidratos / 100 g *</label>
              <input className="food-modal__quantity" type="text" inputMode="decimal" value={form.carbs100g} onChange={(event) => setForm({ ...form, carbs100g: event.target.value })} />

              <label className="food-modal__label">Grasas / 100 g *</label>
              <input className="food-modal__quantity" type="text" inputMode="decimal" value={form.fat100g} onChange={(event) => setForm({ ...form, fat100g: event.target.value })} />

              {duplicateMessage && <span className="error-text">{duplicateMessage}</span>}

              {duplicateExistingId && (
                <div className="food-modal__confirm">
                  <button className="secondary-button" type="button" onClick={closeModal}>Cancelar</button>
                  <button className="primary-button" type="button" onClick={() => {
                    const duplicate = foods.find((food) => food.id === duplicateExistingId)
                    if (duplicate) {
                      openEditModal(duplicate)
                      setDuplicateExistingId(null)
                      setDuplicateMessage('')
                    }
                  }}>Continuar editando</button>
                </div>
              )}

              {!duplicateExistingId && (
                <div className="food-modal__confirm">
                  <button className="secondary-button" type="button" onClick={closeModal}>Cancelar</button>
                  <button className="primary-button" type="submit">Guardar</button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="food-modal-backdrop">
          <div className="food-modal">
            <div className="food-modal__top">
              <span className="food-modal__title">
                {deleteConfirmationStep === 1
                  ? '¿Quieres eliminar este alimento?'
                  : 'Esta acción no se puede deshacer. ¿Eliminar definitivamente?'}
              </span>
              <button className="food-modal__close" onClick={cancelDelete}>×</button>
            </div>
            <div className="food-modal__confirm">
              <button className="secondary-button" onClick={cancelDelete}>Cancelar</button>
              {deleteConfirmationStep === 1 ? (
                <button className="primary-button" onClick={() => setDeleteConfirmationStep(2)}>Eliminar</button>
              ) : (
                <button className="primary-button" onClick={() => confirmDelete(showDeleteConfirm)}>Eliminar definitivamente</button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
