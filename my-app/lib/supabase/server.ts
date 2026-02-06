import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/lib/database.types'

// Custom fetch wrapper to disable Next.js caching
const fetchWithNoCache = (url: RequestInfo | URL, options: RequestInit = {}) => {
  return fetch(url, {
    ...options,
    cache: 'no-store',
  })
}

/**
 * 🔐 Server-Side Supabase Client (Next.js 15+ App Router)
 * Use this in:
 * - Server Components
 * - Server Actions
 * - API Route Handlers
 * 
 * This client respects user sessions and RLS policies
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
      global: {
        fetch: fetchWithNoCache,
      },
    }
  )
}

/**
 * 🔑 Admin Supabase Client (Bypasses RLS)
 * Use this ONLY for admin operations that require service role access
 * 
 * ⚠️ WARNING: This client has FULL database access - use with caution!
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase URL or Service Role Key')
  }

  return createServerClient<Database>(
    supabaseUrl,
    supabaseServiceKey,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // Admin client doesn't need cookies
        },
      },
      global: {
        fetch: fetchWithNoCache,
      },
    }
  )
}
