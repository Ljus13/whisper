import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function isAllowedDuringPreEvent(pathname: string) {
  if (pathname === '/dashboard') return true
  if (pathname.startsWith('/dashboard/players')) return true
  if (pathname.startsWith('/timeline')) return true
  if (pathname.startsWith('/dashboard/character-create')) return true
  if (pathname.startsWith('/dashboard/bio-templates')) return true
  if (pathname.startsWith('/dashboard/rp-template')) return true
  return false
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const code = request.nextUrl.searchParams.get('code')
  const next = request.nextUrl.searchParams.get('next') ?? '/dashboard'

  if (code) {
    response = NextResponse.redirect(new URL(next, request.url))
    const authSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value)
            })
            response = NextResponse.redirect(new URL(next, request.url))
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )
    const { error } = await authSupabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return response
    }
  }

  // Refresh session — getSession() reads from cookie (fast, no network call)
  // getUser() makes a network call to Supabase Auth (~200-400ms) — avoid in middleware
  const { data: { session } } = await supabase.auth.getSession()

  // Standalone pages — accessible without auth
  const standalonePages = ['/dashboard/rp-template', '/dashboard/bio-templates', '/dashboard/character-create']
  const isStandalone = standalonePages.some(p => request.nextUrl.pathname.startsWith(p))

  // Protect /dashboard routes — redirect to login if not authenticated
  if (request.nextUrl.pathname.startsWith('/dashboard') && !session && !isStandalone) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // If user is logged in and visits login page, redirect to dashboard
  if (request.nextUrl.pathname === '/' && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (session?.user) {
    const { data: preEventData } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'pre_event_mode')
      .single()

    const preEventValue = preEventData?.value as { enabled?: boolean } | null | undefined
    const preEventEnabled = preEventValue?.enabled ?? false

    if (preEventEnabled) {
      let role: string | null = null

      try {
        const payload = JSON.parse(atob(session.access_token.split('.')[1])) as { user_role?: string | null }
        if (payload?.user_role) {
          role = payload.user_role
        }
      } catch {}

      if (!role) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
        role = profile?.role ?? 'player'
      }

      const isStaff = role === 'admin' || role === 'dm'
      if (!isStaff && !isAllowedDuringPreEvent(request.nextUrl.pathname)) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
