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

        // Close any open sessions for this user before creating a new one
        try {
          const { data: openSessions } = await supabaseAdmin
            .from('faculty_sessions' as any)
            .select('id, login_at' as any)
            .eq('user_id' as any, user_id)
            .is('logout_at' as any, null)
          if (openSessions && openSessions.length > 0) {
            for (const sess of openSessions as any[]) {
              const loginAt = new Date(sess.login_at).getTime()
              const duration = Math.floor((Date.now() - loginAt) / 60000)
              await supabaseAdmin
                .from('faculty_sessions' as any)
                .update({ logout_at: now, duration_minutes: duration } as any)
                .eq('id' as any, sess.id)
            }
          }
        } catch { /* table may not exist */ }

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

        // Record new session
        try {
          await supabaseAdmin
            .from('faculty_sessions' as any)
            .insert({ user_id, login_at: now, session_token: newSessionToken } as any)
        } catch { /* table may not exist */ }

        return NextResponse.json({ success: true, session_token: newSessionToken })
      }

      case 'logout': {
        // Clear session token and mark user offline
        if (!user_id) {
          return NextResponse.json({ success: false, error: 'Missing user_id' }, { status: 400 })
        }

        // Close any open sessions
        const logoutNow = new Date().toISOString()
        try {
          const { data: openSessions } = await supabaseAdmin
            .from('faculty_sessions' as any)
            .select('id, login_at' as any)
            .eq('user_id' as any, user_id)
            .is('logout_at' as any, null)
          if (openSessions && openSessions.length > 0) {
            for (const sess of openSessions as any[]) {
              const loginAt = new Date(sess.login_at).getTime()
              const duration = Math.floor((Date.now() - loginAt) / 60000)
              await supabaseAdmin
                .from('faculty_sessions' as any)
                .update({ logout_at: logoutNow, duration_minutes: duration } as any)
                .eq('id' as any, sess.id)
            }
          }
        } catch { /* table may not exist */ }

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

      case 'get_all_faculty': {
        // Get ALL faculty users for the Faculty Activity Center modal
        const fiveMinAgoAll = new Date(Date.now() - 5 * 60 * 1000).toISOString()

        const [facultyResult, adminResult] = await Promise.all([
          supabaseAdmin
            .from('users')
            .select('id, full_name, email, department_id, last_login, last_heartbeat, is_online, avatar_url, created_at')
            .eq('role', 'faculty')
            .order('last_heartbeat', { ascending: false, nullsFirst: false })
            .order('last_login', { ascending: false, nullsFirst: false })
            .limit(120),
          supabaseAdmin
            .from('users')
            .select('id, full_name, is_online, last_heartbeat')
            .in('role', ['admin', 'sub_admin'])
            .eq('is_online', true)
            .gte('last_heartbeat', fiveMinAgoAll)
        ])

        if (facultyResult.error) {
          console.error('Get all faculty error:', facultyResult.error)
          return NextResponse.json({ success: false, error: facultyResult.error.message }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          faculty_list: facultyResult.data || [],
          admin_online_count: adminResult.data?.length || 0,
          admin_online_users: (adminResult.data || []).map((u: any) => ({ id: u.id, full_name: u.full_name }))
        })
      }

      case 'get_faculty_activity': {
        if (!user_id) {
          return NextResponse.json({ success: false, error: 'Missing user_id' }, { status: 400 })
        }

        const { data: facultyUser, error: userError } = await supabaseAdmin
          .from('users')
          .select('id, full_name, email, role, department_id, avatar_url, is_online, last_login, last_heartbeat, created_at, updated_at, session_token')
          .eq('id', user_id)
          .single()

        if (userError || !facultyUser) {
          return NextResponse.json({ success: false, error: 'Faculty user not found' }, { status: 404 })
        }

        // Compute session duration metrics
        const now = Date.now()
        let current_session_minutes: number | null = null
        let offline_minutes: number | null = null
        const fiveMinAgo = now - 5 * 60 * 1000
        const hbTime = facultyUser.last_heartbeat ? new Date(facultyUser.last_heartbeat).getTime() : null
        const loginTime = facultyUser.last_login ? new Date(facultyUser.last_login).getTime() : null
        const isReallyOnline = facultyUser.is_online && hbTime && hbTime >= fiveMinAgo

        if (isReallyOnline && loginTime) {
          // Online session duration = now - last_login (login marks session start)
          current_session_minutes = Math.floor((now - loginTime) / 60000)
        }
        if (!isReallyOnline && hbTime) {
          // Offline duration = now - last_heartbeat
          offline_minutes = Math.floor((now - hbTime) / 60000)
        }

        // Fetch session history from faculty_sessions table (if it exists)
        let session_history: any[] = []
        let total_sessions = 0
        let total_online_minutes = 0
        try {
          const { data: sessions, error: sessError } = await supabaseAdmin
            .from('faculty_sessions' as any)
            .select('*' as any)
            .eq('user_id' as any, user_id)
            .order('login_at' as any, { ascending: false })
            .limit(10)
          if (!sessError && sessions) {
            session_history = sessions as any[]
          }

          const { count: sessCount } = await supabaseAdmin
            .from('faculty_sessions' as any)
            .select('id' as any, { count: 'exact', head: true })
            .eq('user_id' as any, user_id)
          total_sessions = sessCount || 0

          // Sum total online minutes from completed sessions (last 30 days)
          const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 1000).toISOString()
          const { data: recentSessions } = await supabaseAdmin
            .from('faculty_sessions' as any)
            .select('duration_minutes' as any)
            .eq('user_id' as any, user_id)
            .gte('login_at' as any, thirtyDaysAgo)
            .not('duration_minutes' as any, 'is', null)
          if (recentSessions) {
            total_online_minutes = (recentSessions as any[]).reduce((acc: number, s: any) => acc + (s.duration_minutes || 0), 0)
          }
        } catch {
          // faculty_sessions table may not exist yet - that's ok
        }

        const safeCountByColumn = async (table: string, column: string, value: string) => {
          try {
            const { count, error } = await supabaseAdmin
              .from(table as any)
              .select('id', { count: 'exact', head: true })
              .eq(column as any, value)

            if (error) return null
            return count || 0
          } catch {
            return null
          }
        }

        const safeCountByColumnAndStatus = async (
          table: string,
          column: string,
          value: string,
          statusColumn: string,
          statusValue: string
        ) => {
          try {
            const { count, error } = await supabaseAdmin
              .from(table as any)
              .select('id', { count: 'exact', head: true })
              .eq(column as any, value)
              .eq(statusColumn as any, statusValue)

            if (error) return null
            return count || 0
          } catch {
            return null
          }
        }

        const safeLatest = async (
          table: string,
          selectColumns: string,
          filterColumn: string,
          filterValue: string,
          orderColumn: string = 'created_at'
        ) => {
          try {
            const { data, error } = await supabaseAdmin
              .from(table as any)
              .select(selectColumns as any)
              .eq(filterColumn as any, filterValue)
              .order(orderColumn as any, { ascending: false })
              .limit(1)

            if (error) return null
            return data?.[0] || null
          } catch {
            return null
          }
        }

        const [
          profileRequestsTotal,
          profileRequestsPending,
          profileRequestsApproved,
          profileRequestsRejected,
          scheduleRequestsTotal,
          facultyAbsencesTotal,
          facultyPreferencesTotal,
          latestProfileRequest,
          latestScheduleRequest,
          latestAbsence,
          latestPreference
        ] = await Promise.all([
          safeCountByColumn('profile_change_requests', 'user_id', user_id),
          safeCountByColumnAndStatus('profile_change_requests', 'user_id', user_id, 'status', 'pending'),
          safeCountByColumnAndStatus('profile_change_requests', 'user_id', user_id, 'status', 'approved'),
          safeCountByColumnAndStatus('profile_change_requests', 'user_id', user_id, 'status', 'rejected'),
          safeCountByColumn('schedule_requests', 'requested_by', user_id),
          safeCountByColumn('faculty_absences', 'faculty_id', user_id),
          safeCountByColumn('faculty_preferences', 'faculty_id', user_id),
          safeLatest('profile_change_requests', 'id, status, created_at, updated_at', 'user_id', user_id, 'updated_at'),
          safeLatest('schedule_requests', 'id, status, created_at, updated_at, request_reason', 'requested_by', user_id, 'updated_at'),
          safeLatest('faculty_absences', 'id, date, reason, created_at', 'faculty_id', user_id, 'created_at'),
          safeLatest('faculty_preferences', 'faculty_id, updated_at, created_at', 'faculty_id', user_id, 'updated_at')
        ])

        return NextResponse.json({
          success: true,
          faculty_activity: {
            user: {
              id: facultyUser.id,
              full_name: facultyUser.full_name,
              email: facultyUser.email,
              role: facultyUser.role,
              department: facultyUser.department_id,
              avatar_url: facultyUser.avatar_url,
              is_online: facultyUser.is_online,
              last_login: facultyUser.last_login,
              last_heartbeat: facultyUser.last_heartbeat,
              created_at: facultyUser.created_at,
              updated_at: facultyUser.updated_at,
            },
            session_info: {
              is_really_online: !!isReallyOnline,
              current_session_minutes,
              offline_minutes,
              total_sessions,
              total_online_minutes_30d: total_online_minutes,
              session_history,
            },
            activity_counts: {
              profile_change_requests_total: profileRequestsTotal,
              profile_change_requests_pending: profileRequestsPending,
              profile_change_requests_approved: profileRequestsApproved,
              profile_change_requests_rejected: profileRequestsRejected,
              schedule_requests_total: scheduleRequestsTotal,
              faculty_absences_total: facultyAbsencesTotal,
              faculty_preferences_total: facultyPreferencesTotal,
            },
            latest_activity: {
              profile_change_request: latestProfileRequest,
              schedule_request: latestScheduleRequest,
              faculty_absence: latestAbsence,
              faculty_preference_update: latestPreference,
            },
            admin_intel: {
              session_token_active: !!facultyUser.session_token,
              session_token_preview: facultyUser.session_token ? `${String(facultyUser.session_token).slice(0, 8)}...` : null,
            }
          }
        })
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
