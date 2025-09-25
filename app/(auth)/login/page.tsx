'use client'
import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const sb = supabaseBrowser()
  const router = useRouter()
  const [mode, setMode] = useState<'signin'|'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string|null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await sb.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } }
        })
        if (error) throw error
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message ?? 'Errore sconosciuto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 border rounded-2xl p-6 shadow">
        <h1 className="text-xl font-semibold">{mode === 'signin' ? 'Accedi' : 'Crea account'}</h1>
        {mode === 'signup' && (
          <input className="w-full border rounded-xl p-2" placeholder="Nome e cognome"
                 value={fullName} onChange={e=>setFullName(e.target.value)} required />
        )}
        <input className="w-full border rounded-xl p-2" placeholder="Email" type="email"
               value={email} onChange={e=>setEmail(e.target.value)} required />
        <input className="w-full border rounded-xl p-2" placeholder="Password" type="password"
               value={password} onChange={e=>setPassword(e.target.value)} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="w-full rounded-xl border p-2">
          {loading ? 'Attendere…' : (mode==='signin' ? 'Entra' : 'Registrati')}
        </button>
        <p className="text-sm">
          {mode === 'signin' ? 'Non hai un account?' : 'Hai già un account?'}{' '}
          <button type="button" className="underline"
                  onClick={()=>setMode(mode==='signin'?'signup':'signin')}>
            {mode === 'signin' ? 'Registrati' : 'Accedi'}
          </button>
        </p>
      </form>
    </div>
  )
}
