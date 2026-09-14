type ConfirmDialogProps = {
  title: string
  message: string
  error?: string
  onCancel: () => void
  onConfirm: () => void
}

/** Confirmación destructiva reutilizable basada en el modal existente de Six Pack. */
export function ConfirmDialog({ title, message, error, onCancel, onConfirm }: ConfirmDialogProps) {
  return <div className="food-modal-backdrop" role="presentation">
    <div className="food-modal confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="food-modal__top">
        <span className="food-modal__title" id="confirm-dialog-title">{title}</span>
        <button className="food-modal__close" type="button" onClick={onCancel} aria-label="Cerrar">×</button>
      </div>
      <p className="confirm-dialog__message">{message}</p>
      {error && <span className="error-text">{error}</span>}
      <div className="food-modal__confirm">
        <button className="secondary-button" type="button" onClick={onCancel}>Cancelar</button>
        <button className="danger-button" type="button" onClick={onConfirm}>Eliminar</button>
      </div>
    </div>
  </div>
}
