import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type Profile = { id: string; display_name: string | null; legacy_user_key: string | null }
type AuthState = { session: Session | null; user: User | null; profile: Profile | null; legacyUserKey: string | null; loading: boolean; error: string | null; signIn: (email: string, password: string) => Promise<string | null>; signOut: () => Promise<void> }
const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  async function loadProfile(nextSession: Session | null) {
    setSession(nextSession); setProfile(null)
    if (!nextSession) { setLoading(false); return }
    setLoading(true)
    const { data, error: profileError } = await supabase.from('profiles').select('id, display_name, legacy_user_key').eq('id', nextSession.user.id).single()
    if (profileError || !data) { setError('No se pudo cargar el perfil autenticado.'); setLoading(false); return }
    setError(null); setProfile(data); setLoading(false)
  }
  useEffect(() => {
    supabase.auth.getSession().then(({ data, error: sessionError }) => { if (sessionError) { setError('No se pudo comprobar la sesión.'); setLoading(false); return }; void loadProfile(data.session) })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => { void loadProfile(nextSession) })
    return () => subscription.subscription.unsubscribe()
  }, [])
  const value = useMemo<AuthState>(() => ({ session, user: session?.user ?? null, profile, legacyUserKey: profile?.legacy_user_key ?? null, loading, error, async signIn(email, password) { const { error: signInError } = await supabase.auth.signInWithPassword({ email, password }); return signInError ? 'Email o contraseña incorrectos, o no se pudo conectar.' : null }, async signOut() { await supabase.auth.signOut() } }), [error, loading, profile, session])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider'); return context }
