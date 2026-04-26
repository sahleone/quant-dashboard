import { NextResponse } from 'next/server'

export function proxy(request) {
  const response = NextResponse.next()

  // Security headers (replaces helmet)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // CSRF check: state-changing API requests must include X-Requested-With header.
  // Browsers block cross-origin custom headers without CORS preflight, so a
  // cross-site form submission cannot forge this header.
  const method = request.method
  const isApi = request.nextUrl.pathname.startsWith('/api/')
  const isAuthRoute = request.nextUrl.pathname.startsWith('/api/auth/')
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

  if (isApi && isStateChanging && !isAuthRoute) {
    const xRequestedWith = request.headers.get('x-requested-with')
    if (!xRequestedWith) {
      return NextResponse.json(
        { error: { code: 'CSRF_REJECTED', message: 'Missing X-Requested-With header' } },
        { status: 403 }
      )
    }
  }

  return response
}

export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*', '/portfolio/:path*', '/settings/:path*'],
}
