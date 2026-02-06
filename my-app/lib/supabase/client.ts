import { createBrowserClient } from '@supabase/ssr'

/**
 * 🌐 Client-Side Supabase Client (Browser)
 * Use this in:
 * - "use client" components
 * - Client-side hooks
 * - Browser event handlers
 * 
 * This client automatically handles session management in the browser
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        // Disable Next.js fetch caching for all Supabase requests
        fetch: (url: RequestInfo | URL, options: RequestInit = {}) => {
          return fetch(url, {
            ...options,
            cache: 'no-store',
          })
        },
      },
    }
  )
}
