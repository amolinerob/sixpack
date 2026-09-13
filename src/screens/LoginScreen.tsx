import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'

export function LoginScreen() {
  const { signIn } = useAuth(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState<string | null>(null); const [submitting, setSubmitting] = useState(false)
  async function submit(event: React.FormEvent) { event.preventDefault(); setSubmitting(true); setError(null); const result = await signIn(email, password); setError(result); setSubmitting(false) }
  return <main className="auth-screen"><form className="auth-card" onSubmit={submit}><span className="auth-card__brand">SIX PACK</span><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label><label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label>{error && <span className="error-text">{error}</span>}<button className="primary-button" disabled={submitting}>{submitting ? 'Iniciando sesión…' : 'Iniciar sesión'}</button></form></main>
}
