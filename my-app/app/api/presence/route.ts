import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic - disable caching to always get fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Use service role for admin operations - only create if we have the key
const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }),
      },
    })
  : null

export async function POST(request: NextRequest) {
  try {
    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      console.warn('SUPABASE_SERVICE_ROLE_KEY not configured, presence tracking disabled')
      return NextResponse.json({ 
        success: true, 
        message: 'Presence tracking not configured',
        session_token: crypto.randomUUID() // Return a dummy token
      })
    }

    const body = await request.json()
    const { action, user_id, session_token } = body

    switch (action) {
      case 'heartbeat': {
        // Update last_heartbeat and is_online status
        if (!user_id || !session_token) {
          return NextResponse.json({ success: false, error: 'Missing user_id or session_token' }, { status: 400 })
        }

        // Verify session token matches (prevent stale sessions)
        const { data: user, error: fetchError } = await supabaseAdmin
          .from('users')
          .select('session_token')
          .eq('id', user_id)
          .single()

        if (fetchError || !user) {
          return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
        }

        // If session token doesn't match, this session is invalid (logged in elsewhere)
        if (user.session_token && user.session_token !== session_token) {
          return NextResponse.json({ 
            success: false, 
            error: 'SESSION_INVALID', 
            message: 'Your session has expired. You may have logged in from another device.' 
          }, { status: 401 })
        }

        // Update heartbeat
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({ 
            last_heartbeat: new Date().toISOString(),
            is_online: true,
            last_login: new Date().toISOString() // Also update last_login for backward compatibility
          })
          .eq('id', user_id)

        if (updateError) {
          console.error('Heartbeat update error:', updateError)
          return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Heartbeat recorded' })
      }

      case 'login': {
        // Generate new session token and mark user online
        if (!user_id) {
          return NextResponse.json({ success: false, error: 'Missing user_id' }, { status: 400 })
        }

        const newSessionToken = crypto.randomUUID()
        const now = new Date().toISOString()

        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({ 
            session_token: newSessionToken,
            is_online: true,
            last_login: now,
            last_heartbeat: now
          })
          .eq('id', user_id)

        if (updateError) {
          console.error('Login session update error:', updateError)
          return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, session_token: newSessionToken })
      }

      case 'logout': {
        // Clear session token and mark user offline
        if (!user_id) {
          return NextResponse.json({ success: false, error: 'Missing user_id' }, { status: 400 })
        }

        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({ 
            session_token: null,
            is_online: false
          })
          .eq('id', user_id)

        if (updateError) {
          console.error('Logout session update error:', updateError)
          return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Logged out successfully' })
      }

      case 'check_session': {
        // Check if current session is still valid
        if (!user_id || !session_token) {
          return NextResponse.json({ success: false, error: 'Missing user_id or session_token' }, { status: 400 })
        }

        const { data: user, error: fetchError } = await supabaseAdmin
          .from('users')
          .select('session_token, is_online')
          .eq('id', user_id)
          .single()

        if (fetchError || !user) {
          return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
        }

        const isValid = user.session_token === session_token

        return NextResponse.json({ 
          success: true, 
          valid: isValid,
          is_online: user.is_online 
        })
      }

      case 'get_online_faculty': {
        // Get all online faculty (for admin dashboard)
        // Consider online if heartbeat within last 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

        const { data: onlineFaculty, error: fetchError } = await supabaseAdmin
          .from('users')
          .select('id, full_name, email, department_id, avatar_url, last_heartbeat, last_login')
          .eq('is_online', true)
          .gte('last_heartbeat', fiveMinutesAgo)
          .order('last_heartbeat', { ascending: false })

        if (fetchError) {
          console.error('Get online faculty error:', fetchError)
          return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
        }

        // Also mark users as offline if their heartbeat is stale
        await supabaseAdmin
          .from('users')
          .update({ is_online: false })
          .eq('is_online', true)
          .lt('last_heartbeat', fiveMinutesAgo)

        return NextResponse.json({ success: true, online_faculty: onlineFaculty || [] })
      }

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Presence API error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  // GET endpoint for fetching online faculty count
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        success: true, 
        online_faculty: [],
        count: 0,
        message: 'Presence tracking not configured'
      })
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const { data: onlineFaculty, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, department_id, avatar_url, last_heartbeat')
      .eq('is_online', true)
      .gte('last_heartbeat', fiveMinutesAgo)
      .order('last_heartbeat', { ascending: false })

    if (fetchError) {
      console.error('Get online faculty error:', fetchError)
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      online_faculty: onlineFaculty || [],
      count: onlineFaculty?.length || 0
    })
  } catch (error: any) {
    console.error('Presence API GET error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
