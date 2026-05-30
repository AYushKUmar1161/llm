import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Public paths that do not require authentication
  const isPublicPath =
    path === '/' ||
    path === '/login' ||
    path === '/register' ||
    path.startsWith('/api/auth')

  // Retrieve token from cookie or local state mockup
  // Note: Next.js middleware runs on edge, so localStorage is not directly readable.
  // We check for a session token cookie which is standard for Next.js production.
  const token = request.cookies.get('cf_access_token')?.value || ''

  if (isPublicPath && token) {
    // If authenticated, redirect login/register to dashboard
    if (path === '/login' || path === '/register') {
      return NextResponse.redirect(new URL('/dashboard', request.nextUrl))
    }
  }

  if (!isPublicPath && !token) {
    // If not authenticated, redirect private routes to login
    // For demo/development fallback: if we are in local dev sandbox we can allow fallback bypass if no cookies set yet
    // but in strict production redirects are enforced.
    // Let's implement redirection to login
    const loginUrl = new URL('/login', request.nextUrl)
    // Add redirect param
    loginUrl.searchParams.set('redirect', path)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

// Protected path matcher config
export const config = {
  matcher: [
    '/',
    '/login',
    '/register',
    '/dashboard/:path*',
    '/repositories/:path*',
    '/repo/:path*',
    '/settings/:path*',
  ],
}
