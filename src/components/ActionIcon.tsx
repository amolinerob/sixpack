type ActionIconProps = { name: 'edit' | 'delete'; size?: number }
type IconActionButtonProps = { name: 'edit' | 'delete'; ariaLabel: string; onClick: () => void; title?: string }

/** Iconos de acción vectoriales compartidos para editar y eliminar registros. */
export function ActionIcon({ name, size = 22 }: ActionIconProps) {
  if (name === 'edit') {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m14.5 4.5-10 10-1 6 6-1 10-10a3.54 3.54 0 0 0-5-5Z" />
      <path d="m13 6 5 5" />
    </svg>
  }

  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 6.5h16M9 6.5v-2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="m6 6.5.9 12.1a2 2 0 0 0 2 1.9h6.2a2 2 0 0 0 2-1.9L18 6.5" />
    <path d="M10 10.5v6M14 10.5v6" />
  </svg>
}

export function IconActionButton({ name, ariaLabel, onClick, title }: IconActionButtonProps) {
  return <button className={`icon-action-button ${name === 'delete' ? 'icon-action-button--danger' : ''}`} type="button" onClick={onClick} aria-label={ariaLabel} title={title ?? ariaLabel}>
    <ActionIcon name={name} />
  </button>
}
