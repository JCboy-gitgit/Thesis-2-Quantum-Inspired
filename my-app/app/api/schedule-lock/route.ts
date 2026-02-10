import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
        const body = await request.json()
        const { scheduleId, isLocked } = body

        if (!scheduleId || typeof isLocked !== 'boolean') {
            return NextResponse.json(
                { error: 'scheduleId and isLocked (boolean) are required' },
                { status: 400 }
            )
        }

        // Update the lock status
        const { data, error } = await supabase
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
        await supabase.from('system_alerts').insert({
            title: `Schedule ${action}`,
            message: isLocked
                ? 'The current schedule has been locked. Reschedule requests are no longer accepted.'
                : 'The current schedule has been unlocked. You can now submit reschedule requests.',
            audience: 'faculty',
            severity: isLocked ? 'warning' : 'info',
            category: 'schedule',
            schedule_id: scheduleId
        })

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
