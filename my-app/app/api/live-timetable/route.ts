import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── GET ─────────────────────────────────────────────────────────────────────
// ?action=current-week   → get live timetable for the current week
// ?action=absences       → get all absences (optionally ?date=YYYY-MM-DD)
// ?action=makeup         → get all makeup class requests
// ?action=overrides      → get admin overrides for current week
export async function GET(request: NextRequest) {
    try {
        const supabaseAdmin = createAdminClient()
        const { searchParams } = new URL(request.url)
        const action = searchParams.get('action') || 'current-week'
        const weekStart = searchParams.get('week_start') // YYYY-MM-DD (Monday)
        const scheduleId = searchParams.get('schedule_id')
        const facultyId = searchParams.get('faculty_id')
        const date = searchParams.get('date')

        if (action === 'current-week') {
            // Get the current week's Monday
            const now = new Date()
            const monday = getMonday(now)
            const mondayStr = weekStart || monday.toISOString().split('T')[0]
            const sundayStr = getSunday(new Date(mondayStr)).toISOString().split('T')[0]

            // 1. Get the locked/current schedule
            let schedQuery = supabaseAdmin
                .from('generated_schedules')
                .select('id, schedule_name, semester, academic_year, is_locked, is_current')
                .order('is_current', { ascending: false })
                .order('created_at', { ascending: false })

            if (scheduleId) {
                schedQuery = schedQuery.eq('id', scheduleId)
            } else {
                schedQuery = schedQuery.eq('is_locked', true)
            }

            const { data: schedules } = await schedQuery.limit(1)
            const schedule = schedules?.[0]

            if (!schedule) {
                return NextResponse.json({ success: true, schedule: null, allocations: [], overrides: [], absences: [], makeupClasses: [] })
            }

            // 2. Get base allocations from room_allocations
            const { data: allocations } = await supabaseAdmin
                .from('room_allocations')
                .select('*')
                .eq('schedule_id', schedule.id)
                .order('schedule_day')
                .order('schedule_time')

            // 3. Get weekly overrides (admin edits for this week)
            const { data: overrides } = await supabaseAdmin
                .from('live_timetable_overrides')
                .select('*')
                .eq('schedule_id', schedule.id)
                .eq('week_start', mondayStr)

            // 4. Get absences for this week
            const { data: absences } = await supabaseAdmin
                .from('live_timetable_absences')
                .select(`*, faculty_profiles(full_name, email)`)
                .gte('absence_date', mondayStr)
                .lte('absence_date', sundayStr)

            // 5. Get makeup class requests for this week
            const { data: makeupClasses } = await supabaseAdmin
                .from('live_makeup_requests')
                .select(`*, faculty_profiles(full_name, email)`)
                .gte('requested_date', mondayStr)
                .lte('requested_date', sundayStr)

            return NextResponse.json({
                success: true,
                schedule,
                allocations: allocations || [],
                overrides: overrides || [],
                absences: absences || [],
                makeupClasses: makeupClasses || [],
                weekStart: mondayStr,
                weekEnd: sundayStr
            })
        }

        if (action === 'absences') {
            let query = supabaseAdmin
                .from('live_timetable_absences')
                .select(`*, faculty_profiles(full_name, email)`)
                .order('absence_date', { ascending: false })

            if (facultyId) query = query.eq('faculty_id', facultyId)
            if (date) query = query.eq('absence_date', date)

            const { data, error } = await query
            if (error) throw error
            return NextResponse.json({ success: true, data: data || [] })
        }

        if (action === 'makeup') {
            let query = supabaseAdmin
                .from('live_makeup_requests')
                .select(`*, faculty_profiles(full_name, email)`)
                .order('created_at', { ascending: false })

            if (facultyId) query = query.eq('faculty_id', facultyId)

            const { data, error } = await query
            if (error) throw error
            return NextResponse.json({ success: true, data: data || [] })
        }

        if (action === 'overrides') {
            const now = new Date()
            const mondayStr = weekStart || getMonday(now).toISOString().split('T')[0]

            let query = supabaseAdmin
                .from('live_timetable_overrides')
                .select('*')
                .eq('week_start', mondayStr)

            if (scheduleId) query = query.eq('schedule_id', scheduleId)

            const { data, error } = await query
            if (error) throw error
            return NextResponse.json({ success: true, data: data || [] })
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    } catch (error: any) {
        console.error('[live-timetable GET]', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

// ─── POST ────────────────────────────────────────────────────────────────────
// action=mark-absence   → faculty marks a class as absent
// action=makeup-request → faculty requests a makeup class
// action=override       → admin overrides a slot for this week
// action=reset-week     → admin manually resets the week (or auto on Sunday)
export async function POST(request: NextRequest) {
    try {
        const supabaseAdmin = createAdminClient()
        const body = await request.json()
        const { action } = body

        if (action === 'mark-absence') {
            const { allocation_id, faculty_id, absence_date, reason } = body

            if (!allocation_id || !faculty_id || !absence_date) {
                return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
            }

            // Check if already marked
            const { data: existing } = await supabaseAdmin
                .from('live_timetable_absences')
                .select('id')
                .eq('allocation_id', allocation_id)
                .eq('absence_date', absence_date)
                .single()

            if (existing) {
                return NextResponse.json({ error: 'Absence already marked for this class on this date' }, { status: 409 })
            }

            // Resolve schedule_id server-side from room_allocations to avoid FK violations
            const { data: allocRow } = await supabaseAdmin
                .from('room_allocations')
                .select('schedule_id')
                .eq('id', allocation_id)
                .single()
            const resolvedScheduleId = allocRow?.schedule_id || null

            const { data, error } = await supabaseAdmin
                .from('live_timetable_absences')
                .insert({
                    allocation_id,
                    faculty_id,
                    absence_date,
                    reason: reason || null,
                    schedule_id: resolvedScheduleId,
                    status: 'confirmed'
                })
                .select()
                .single()

            if (error) throw error

            // Create admin notification
            try {
                const { data: fp } = await supabaseAdmin
                    .from('faculty_profiles')
                    .select('full_name, email')
                    .eq('user_id', faculty_id)
                    .single()

                const { data: alloc } = await supabaseAdmin
                    .from('room_allocations')
                    .select('course_code, section, schedule_day, schedule_time')
                    .eq('id', allocation_id)
                    .single()

                await supabaseAdmin.from('system_alerts').insert({
                    title: 'Faculty Absence Reported',
                    message: `${fp?.full_name || fp?.email || 'A faculty'} marked absence for ${alloc?.course_code} (${alloc?.section}) on ${absence_date}`,
                    audience: 'admin',
                    severity: 'warning',
                    category: 'absence'
                })
            } catch (_) { /* non-critical */ }

            return NextResponse.json({ success: true, data })
        }

        if (action === 'create-absence-admin') {
            const { allocation_id, faculty_id, absence_date, reason } = body

            if (!allocation_id || !faculty_id || !absence_date) {
                return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
            }

            // Resolve schedule_id
            const { data: allocRow } = await supabaseAdmin
                .from('room_allocations')
                .select('schedule_id')
                .eq('id', allocation_id)
                .single()
            const resolvedScheduleId = allocRow?.schedule_id || null

            const { data, error } = await supabaseAdmin
                .from('live_timetable_absences')
                .insert({
                    allocation_id,
                    faculty_id,
                    absence_date,
                    reason: reason || 'Market by Admin',
                    schedule_id: resolvedScheduleId,
                    status: 'confirmed'
                })
                .select()
                .single()

            if (error) throw error
            return NextResponse.json({ success: true, data })
        }

        if (action === 'create-makeup-admin') {
            const { allocation_id, faculty_id, requested_date, requested_time, requested_room, reason, original_absence_date } = body

            if (!allocation_id || !faculty_id || !requested_date || !requested_time) {
                return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
            }

            // Resolve schedule_id
            const { data: allocRow2 } = await supabaseAdmin
                .from('room_allocations')
                .select('schedule_id')
                .eq('id', allocation_id)
                .single()
            const resolvedScheduleId2 = allocRow2?.schedule_id || null

            const { data, error } = await supabaseAdmin
                .from('live_makeup_requests')
                .insert({
                    allocation_id,
                    faculty_id,
                    requested_date,
                    requested_time,
                    requested_room: requested_room || null,
                    reason: reason || 'Scheduled by Admin',
                    schedule_id: resolvedScheduleId2,
                    original_absence_date: original_absence_date || null,
                    status: 'approved',
                    reviewed_at: new Date().toISOString()
                })
                .select()
                .single()

            if (error) throw error
            return NextResponse.json({ success: true, data })
        }
        if (action === 'makeup-request') {
            const { allocation_id, faculty_id, requested_date, requested_time, requested_room, reason, original_absence_date } = body

            if (!allocation_id || !faculty_id || !requested_date || !requested_time) {
                return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
            }

            // Resolve schedule_id server-side from room_allocations to avoid FK violations
            const { data: allocRow2 } = await supabaseAdmin
                .from('room_allocations')
                .select('schedule_id')
                .eq('id', allocation_id)
                .single()
            const resolvedScheduleId2 = allocRow2?.schedule_id || null

            const { data, error } = await supabaseAdmin
                .from('live_makeup_requests')
                .insert({
                    allocation_id,
                    faculty_id,
                    requested_date,
                    requested_time,
                    requested_room: requested_room || null,
                    reason: reason || null,
                    schedule_id: resolvedScheduleId2,
                    original_absence_date: original_absence_date || null,
                    status: 'pending'
                })
                .select()
                .single()

            if (error) throw error

            // Create admin notification
            try {
                const { data: fp } = await supabaseAdmin
                    .from('faculty_profiles')
                    .select('full_name, email')
                    .eq('user_id', faculty_id)
                    .single()

                const { data: alloc } = await supabaseAdmin
                    .from('room_allocations')
                    .select('course_code, section')
                    .eq('id', allocation_id)
                    .single()

                await supabaseAdmin.from('system_alerts').insert({
                    title: 'Makeup Class Requested',
                    message: `${fp?.full_name || fp?.email || 'A faculty'} requested a makeup class for ${alloc?.course_code} (${alloc?.section}) on ${requested_date}`,
                    audience: 'admin',
                    severity: 'info',
                    category: 'makeup_request'
                })
            } catch (_) { /* non-critical */ }

            return NextResponse.json({ success: true, data })
        }
        if (action === 'override') {
            // Admin overrides a slot for the current week
            const { schedule_id, allocation_id, week_start, override_day, override_time, override_room, override_building, note, admin_id } = body

            if (!schedule_id || !allocation_id || !week_start) {
                return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
            }

            // Upsert override
            const { data, error } = await supabaseAdmin
                .from('live_timetable_overrides')
                .upsert({
                    schedule_id,
                    allocation_id,
                    week_start,
                    override_day: override_day || null,
                    override_time: override_time || null,
                    override_room: override_room || null,
                    override_building: override_building || null,
                    note: note || null,
                    created_by: admin_id || null,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'schedule_id,allocation_id,week_start' })
                .select()
                .single()

            if (error) throw error
            return NextResponse.json({ success: true, data })
        }

        if (action === 'reset-week') {
            // Clear all overrides for the given week (resets to locked schedule)
            const { schedule_id, week_start } = body

            if (!schedule_id || !week_start) {
                return NextResponse.json({ error: 'Missing schedule_id or week_start' }, { status: 400 })
            }

            const { error } = await supabaseAdmin
                .from('live_timetable_overrides')
                .delete()
                .eq('schedule_id', schedule_id)
                .eq('week_start', week_start)

            if (error) throw error
            return NextResponse.json({ success: true, message: 'Week reset to original locked schedule' })
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    } catch (error: any) {
        console.error('[live-timetable POST]', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

// ─── PATCH ───────────────────────────────────────────────────────────────────
// Update makeup request or absence status (admin approve/reject)
export async function PATCH(request: NextRequest) {
    try {
        const supabaseAdmin = createAdminClient()
        const body = await request.json()
        const { type, id, status, admin_note } = body

        if (!id || !status || !type) {
            return NextResponse.json({ error: 'Missing id, type, or status' }, { status: 400 })
        }

        if (type === 'makeup') {
            const { error } = await supabaseAdmin
                .from('live_makeup_requests')
                .update({ status, admin_note: admin_note || null, reviewed_at: new Date().toISOString() })
                .eq('id', id)

            if (error) throw error
        } else if (type === 'absence') {
            const { error } = await supabaseAdmin
                .from('live_timetable_absences')
                .update({ status, admin_note: admin_note || null })
                .eq('id', id)

            if (error) throw error
        } else {
            return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('[live-timetable PATCH]', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
    try {
        const supabaseAdmin = createAdminClient()
        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type')
        const id = searchParams.get('id')

        if (!type || !id) {
            return NextResponse.json({ error: 'Missing type or id' }, { status: 400 })
        }

        if (type === 'override') {
            const { error } = await supabaseAdmin.from('live_timetable_overrides').delete().eq('id', id)
            if (error) throw error
        } else if (type === 'absence') {
            const { error } = await supabaseAdmin.from('live_timetable_absences').delete().eq('id', id)
            if (error) throw error
        } else if (type === 'makeup') {
            const { error } = await supabaseAdmin.from('live_makeup_requests').delete().eq('id', id)
            if (error) throw error
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('[live-timetable DELETE]', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getMonday(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
}

function getSunday(monday: Date): Date {
    const d = new Date(monday)
    d.setDate(d.getDate() + 6)
    d.setHours(23, 59, 59, 999)
    return d
}
