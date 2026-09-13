export type SixPackIconName = 'home' | 'today' | 'foods' | 'meals' | 'progress'

type Props = {
  name: SixPackIconName
  className?: string
}

/** Iconos de trazo uniforme para la interfaz de Six Pack. */
export function SixPackIcon({ name, className }: Props) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
  }

  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" focusable="false" xmlns="http://www.w3.org/2000/svg">
      {name === 'home' && <><path {...common} d="m3.5 10 8.5-7 8.5 7" /><path {...common} d="M5.5 9.2V20h13V9.2" /><path {...common} d="M9.5 20v-5.5h5V20" /></>}
      {name === 'today' && <><rect {...common} x="3.5" y="4.5" width="17" height="16" rx="3" /><path {...common} d="M8 3v3M16 3v3M3.5 9.5h17" /><circle cx="8" cy="13" r="1.1" fill="currentColor" /><circle cx="12" cy="13" r="1.1" fill="currentColor" /><circle cx="16" cy="13" r="1.1" fill="currentColor" /><circle cx="8" cy="17" r="1.1" fill="currentColor" /><circle cx="12" cy="17" r="1.1" fill="currentColor" /><circle cx="16" cy="17" r="1.1" fill="currentColor" /></>}
      {name === 'foods' && <><path {...common} d="M12 6.2c1.5-1 2.6-1.4 4.2-1.1 3.1.6 3.8 3.7 3.3 6.6-.7 5.1-3.6 8.3-7.5 8.3s-6.8-3.2-7.5-8.3c-.5-2.9.2-6 3.3-6.6 1.6-.3 2.7.1 4.2 1.1Z" /><path {...common} d="M12.2 5.7c.1-2 1.5-3.3 3.7-3.3.1 1.9-1.4 3.2-3.7 3.3Z" /><path {...common} d="m11.7 6.1-2.1-1.5" /></>}
      {name === 'meals' && <><circle {...common} cx="12" cy="12.5" r="6" /><circle {...common} cx="12" cy="12.5" r="3.9" /><path {...common} d="M4.5 3.5v6M2.5 3.5v3a2 2 0 0 0 4 0v-3M4.5 9.5v11M19.5 3.5c1.3 1.8 1.3 5.7 0 7.5v9.5" /></>}
      {name === 'progress' && <><rect {...common} x="4" y="13" width="3.4" height="7" rx="1.2" /><rect {...common} x="10.3" y="9" width="3.4" height="11" rx="1.2" /><rect {...common} x="16.6" y="4" width="3.4" height="16" rx="1.2" /></>}
    </svg>
  )
}
