import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic - disable caching to always get fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Cache-busting wrapper to prevent Next.js from caching Supabase requests
const fetchWithNoCache = (url: RequestInfo | URL, options: RequestInit = {}) =>
  fetch(url, { ...options, cache: 'no-store' })

// Use service role for admin operations
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

// POST - Manually confirm a user's email (admin only)
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Get user by email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) {
      console.error('Error listing users:', listError)
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      )
    }

    const user = users.users.find(u => u.email === email)
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if already confirmed
    if (user.email_confirmed_at) {
      return NextResponse.json({
        success: true,
        message: 'Email is already confirmed',
        confirmed_at: user.email_confirmed_at
      })
    }

    // Update user to confirm email
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { 
        email_confirm: true
      }
    )

    if (updateError) {
      console.error('Error confirming email:', updateError)
      return NextResponse.json(
        { error: `Failed to confirm email: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Email confirmed for ${email}`,
      user: {
        id: updatedUser.user.id,
        email: updatedUser.user.email,
        email_confirmed_at: updatedUser.user.email_confirmed_at
      }
    })

  } catch (error: any) {
    console.error('Error in confirm-email:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to confirm email' },
      { status: 500 }
    )
  }
}
