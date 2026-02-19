import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

  // ── Offline / Maintenance Mode ──
  const pathname = request.nextUrl.pathname
  const isMaintenancePage = pathname === '/maintenance'
  const isEmbedPage = pathname.startsWith('/embed/')
  const isAuthCallback = pathname.startsWith('/auth/callback')

  // Check offline status (fast single-row read)
  const { data: settings } = await supabase
    .from('site_settings')
    .select('is_offline')
    .eq('id', 'main')
    .single()

  const isOffline = settings?.is_offline === true

  if (isOffline && !isEmbedPage && !isAuthCallback) {
    if (session) {
      // Logged-in user — check role via profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      const isAdminOrDm = profile?.role === 'admin' || profile?.role === 'dm'

      if (!isAdminOrDm) {
        // Player → force to /maintenance
        if (!isMaintenancePage) {
          return NextResponse.redirect(new URL('/maintenance', request.url))
        }
        return response
      }
      // Admin/DM → allow through (don't redirect to maintenance)
      if (isMaintenancePage) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    } else {
      // Not logged in + offline → show maintenance page (block login)
      if (!isMaintenancePage) {
        return NextResponse.redirect(new URL('/maintenance', request.url))
      }
      return response
    }
  }

  // If site is online, don't allow access to /maintenance
  if (!isOffline && isMaintenancePage) {
    return NextResponse.redirect(new URL(session ? '/dashboard' : '/', request.url))
  }

  // Protect /dashboard routes — redirect to login if not authenticated
  if (pathname.startsWith('/dashboard') && !session) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // If user is logged in and visits login page, redirect to dashboard
  if (pathname === '/' && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
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
