import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const missingVariables = [
  !url && 'VITE_SUPABASE_URL',
  !anonKey && 'VITE_SUPABASE_ANON_KEY',
].filter(Boolean) as string[]

/** Comprueba la configuración sin exponer valores sensibles ni hacer peticiones. */
export function checkSupabaseConfig() {
  return {
    configured: missingVariables.length === 0,
    missingVariables,
  }
}

if (import.meta.env.DEV && missingVariables.length > 0) {
  throw new Error(`Falta la configuración de Supabase: ${missingVariables.join(', ')}`)
}

// Los valores de reserva solo evitan un fallo opaco en producción si falta configuración.
// No se usan para realizar consultas y nunca sustituyen las variables reales.
export const supabase = createClient(
  url ?? 'https://supabase-config-required.invalid',
  anonKey ?? 'supabase-config-required',
)
