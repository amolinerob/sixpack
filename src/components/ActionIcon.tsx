type ActionIconProps = { name: 'edit' | 'delete'; size?: number }
type IconActionButtonProps = { name: 'edit' | 'delete'; ariaLabel: string; onClick: () => void; title?: string }

/** Iconos de acción vectoriales compartidos para editar y eliminar registros. */
export function ActionIcon({ name, size = 22 }: ActionIconProps) {
  if (name === 'edit') {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20H5a1 1 0 0 1-1-1v-4.5L15.5 3a2.1 2.1 0 0 1 3 3L7 17.5" />
      <path d="m13.5 5 5.5 5.5" />
    </svg>
  }

  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7h16" />
    <path d="M10 11v6M14 11v6" />
    <path d="M6.5 7 7.4 20h9.2l.9-13" />
    <path d="M9 7V4h6v3" />
  </svg>
}

export function IconActionButton({ name, ariaLabel, onClick, title }: IconActionButtonProps) {
  return <button className={`icon-action-button ${name === 'delete' ? 'icon-action-button--danger' : ''}`} type="button" onClick={onClick} aria-label={ariaLabel} title={title ?? ariaLabel}>
    <ActionIcon name={name} />
  </button>
}
