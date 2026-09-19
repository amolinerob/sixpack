import { useEffect, useId, useRef, type ReactNode } from 'react'

/** Informational dialog using the existing modal styles and native focus management. */
export function InfoDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => { element?.close() }
  }, [])

  return <dialog ref={dialog} className="food-modal info-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose() }}>
    <div className="food-modal__top"><span id={titleId} className="food-modal__title">{title}</span></div>
    <div className="info-dialog__content">{children}</div>
    <div className="food-modal__confirm"><button type="button" className="secondary-button" onClick={onClose}>Cerrar</button></div>
  </dialog>
}
