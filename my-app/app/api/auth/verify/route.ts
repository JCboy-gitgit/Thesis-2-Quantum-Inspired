import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic - disable caching to always get fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Cache-busting wrapper to prevent Next.js from caching Supabase requests
const fetchWithNoCache = (url: RequestInfo | URL, options: RequestInit = {}) =>
  fetch(url, { ...options, cache: 'no-store' })

let _supabaseAdmin: ReturnType<typeof createClient> | null = null
const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient>, {
  get(_, prop) {
    if (!_supabaseAdmin) {
      _supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { fetch: fetchWithNoCache } }
      )
    }
    return (_supabaseAdmin as any)[prop]
  },
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const token = String(body.token || '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from('email_verification_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .single()

    if (tokenError || !tokenRow) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
    }

    const now = new Date()
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < now) {
      return NextResponse.json({ error: 'Token expired' }, { status: 400 })
    }

    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      tokenRow.user_id,
      {
        email_confirm: true
      }
    )

    if (updateAuthError) {
      return NextResponse.json({ error: updateAuthError.message || 'Failed to verify email' }, { status: 500 })
    }

    await supabaseAdmin
      .from('email_verification_tokens')
      .update({ used_at: now.toISOString() })
      .eq('id', tokenRow.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Verification error:', error)
    return NextResponse.json(
      { error: error?.message || 'Verification failed' },
      { status: 500 }
    )
  }
}
