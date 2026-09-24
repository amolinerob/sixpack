export type SixPackIconName = 'home' | 'today' | 'foods' | 'meals' | 'progress' | 'user' | 'dumbbell' | 'walking' | 'running' | 'bicycle' | 'rest'

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
      {name === 'user' && <><circle {...common} cx="12" cy="8" r="3.5" /><path {...common} d="M4.5 20c.7-4 3.3-6 7.5-6s6.8 2 7.5 6" /></>}
      {name === 'dumbbell' && <><path {...common} d="M8 12h8M2 10v4M22 10v4" /><rect {...common} x="4" y="6" width="4" height="12" rx="1" /><rect {...common} x="16" y="6" width="4" height="12" rx="1" /></>}
      {name === 'walking' && <><circle {...common} cx="13" cy="4" r="2" /><path {...common} d="m7 12 3-4 4 1 3 4h3M11 9l-1 6 4 3 1 4M10 15l-3 7" /></>}
      {name === 'running' && <><circle {...common} cx="16" cy="4" r="2" /><path {...common} d="m6 10 4-3 5 2-3 5M15 9l3 3h3M12 14l4 3-1 5M12 14l-4 4-5-2" /></>}
      {name === 'bicycle' && <><circle {...common} cx="5" cy="17" r="4" /><circle {...common} cx="19" cy="17" r="4" /><path {...common} d="m5 17 5-8 4 8H5m5-8h7l2 8M8 6h4m-2 0v3m7 0-1-5h3" /></>}
      {name === 'rest' && <><path {...common} d="M3 5v16M21 11v10M3 17h18M3 9h5a3 3 0 0 1 3 3v5M11 9h6a4 4 0 0 1 4 4v4" /><path {...common} d="M3 13h8" /></>}
    </svg>
  )
}
