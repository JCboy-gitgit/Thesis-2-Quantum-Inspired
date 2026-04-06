import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const scheduleLockSecret = process.env.SCHEDULE_LOCK_SECRET
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function assertEnv() {
    if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
}

function assertAnonKey() {
    assertEnv()
    if (!supabaseAnonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

function assertAdminKey() {
    assertEnv()
    if (!supabaseServiceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY for admin operation')
}

let _supabase: SupabaseClient<any> | null = null
const supabase = new Proxy({} as SupabaseClient<any>, {
  get(_, prop) {
    if (!_supabase) {
            assertEnv()
            // For read-only operations, anon key is fine. For writes we create a separate client.
            assertAnonKey()
                        _supabase = createClient<any>(supabaseUrl!, supabaseAnonKey!)
    }
    return (_supabase as any)[prop]
  },
})

let _supabaseAdmin: SupabaseClient<any> | null = null
const supabaseAdmin = new Proxy({} as SupabaseClient<any>, {
    get(_, prop) {
        if (!_supabaseAdmin) {
            assertAdminKey()
                        _supabaseAdmin = createClient<any>(supabaseUrl!, supabaseServiceKey!)
        }
        return (_supabaseAdmin as any)[prop]
    },
})

// GET: Check lock status for a schedule
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const scheduleId = searchParams.get('scheduleId')

        if (!scheduleId) {
            return NextResponse.json({ error: 'scheduleId is required' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('generated_schedules')
            .select('id, is_locked')
            .eq('id', parseInt(scheduleId))
            .single()

        if (error) throw error

        return NextResponse.json({
            success: true,
            scheduleId: data.id,
            isLocked: data.is_locked ?? false
        })
    } catch (error: any) {
        console.error('Error checking lock status:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PATCH: Toggle lock/unlock for a schedule
export async function PATCH(request: NextRequest) {
    try {
        if (scheduleLockSecret) {
            const provided = request.headers.get('x-schedule-lock-secret')
            if (!provided || provided !== scheduleLockSecret) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }
        }

        const body = await request.json()
        const { scheduleId, isLocked } = body

        if (!scheduleId || typeof isLocked !== 'boolean') {
            return NextResponse.json(
                { error: 'scheduleId and isLocked (boolean) are required' },
                { status: 400 }
            )
        }

        // Update the lock status
        const { data, error } = await supabaseAdmin
            .from('generated_schedules')
            .update({ is_locked: isLocked })
            .eq('id', scheduleId)
            .select()

        if (error) throw error

        if (!data || data.length === 0) {
            return NextResponse.json(
                { error: 'Schedule not found or update blocked by RLS' },
                { status: 404 }
            )
        }

        // Send alert to faculty
        const action = isLocked ? 'locked' : 'unlocked'
        await supabaseAdmin.from('system_alerts').insert({
            title: `Schedule ${action}`,
            message: isLocked
                ? 'The current schedule has been locked. Reschedule requests are no longer accepted.'
                : 'The current schedule has been unlocked. You can now submit reschedule requests.',
            audience: 'faculty',
            severity: isLocked ? 'warning' : 'info',
            category: 'schedule',
            schedule_id: scheduleId
        })

        // Broadcast the lock status change to all connected clients
        const channel = supabaseAdmin.channel('schedule_lock_broadcast')
        await channel.send({
            type: 'broadcast',
            event: 'lock_status_changed',
            payload: { scheduleId, isLocked }
        })
        await supabaseAdmin.removeChannel(channel)

        return NextResponse.json({
            success: true,
            scheduleId,
            isLocked,
            message: `Schedule ${action} successfully`
        })
    } catch (error: any) {
        console.error('Error toggling schedule lock:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
