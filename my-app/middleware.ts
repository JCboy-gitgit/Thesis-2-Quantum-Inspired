import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware to add cache-control headers to all API responses
 * This ensures fresh data is always fetched from the database
 */
export function middleware(request: NextRequest) {
  // Clone the request headers so we can modify them
  const requestHeaders = new Headers(request.headers)
  
  // Add a unique request ID for debugging
  requestHeaders.set('x-request-id', crypto.randomUUID())
  
  // Create response with modified headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // Add cache-busting headers to ALL API responses
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    response.headers.set('Surrogate-Control', 'no-store')
    // Prevent CDN caching (Vercel Edge)
    response.headers.set('CDN-Cache-Control', 'no-store')
    response.headers.set('Vercel-CDN-Cache-Control', 'no-store')
  }

  return response
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
  ],
}
