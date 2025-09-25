import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => { res.cookies.set({ name, value, ...options }) },
        remove: (name, options) => { res.cookies.set({ name, value: '', ...options }) }
      }
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const isAuthPage = req.nextUrl.pathname.startsWith('/login')

  if (!user && !isAuthPage) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  
  if (user && isAuthPage) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Aggiorna last_seen_at una volta al giorno per utenti autenticati
  if (user && !isAuthPage) {
    try {
      // Controlla quando è stato l'ultimo aggiornamento
      const { data: profile } = await supabase
        .from('profiles')
        .select('last_seen_at')
        .eq('id', user.id)
        .single()

      if (profile) {
        const lastSeen = profile.last_seen_at ? new Date(profile.last_seen_at) : null
        const now = new Date()
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

        // Aggiorna solo se è passato più di un giorno o se non è mai stato aggiornato
        if (!lastSeen || lastSeen < oneDayAgo) {
          await supabase
            .from('profiles')
            .update({ last_seen_at: now.toISOString() })
            .eq('id', user.id)
        }
      }
    } catch (error) {
      // Ignora errori per non bloccare la navigazione
      console.error('Errore aggiornamento last_seen_at:', error)
    }
  }

  return res
}

export const config = { matcher: ['/((?!_next|favicon|public).*)'] }