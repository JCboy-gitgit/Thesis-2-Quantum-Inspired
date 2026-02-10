import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Force dynamic - disable caching to always get fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
    try {
        const supabaseAdmin = createAdminClient()
        const { searchParams } = new URL(request.url)
        const scheduleId = searchParams.get('schedule_id')
        const requestedBy = searchParams.get('requested_by')
        const status = searchParams.get('status')

        if (!scheduleId && !requestedBy) {
            return NextResponse.json({ error: 'Missing schedule_id or requested_by' }, { status: 400 })
        }

        let query = supabaseAdmin
            .from('schedule_change_requests')
            .select(`
                *,
                generated_schedules (schedule_name)
            `)

        if (scheduleId) query = query.eq('schedule_id', scheduleId)
        if (requestedBy) query = query.eq('requested_by', requestedBy)
        if (status && status !== 'all') query = query.eq('status', status)

        const { data, error } = await query.order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching requests:', error)
            return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 })
        }

        // Enrich with requester info
        const enrichedRequests = await Promise.all(data.map(async (req: any) => {
            let requesterName = 'Unknown User'
            if (req.requested_by) {
                const { data: userData } = await supabaseAdmin.auth.admin.getUserById(req.requested_by)
                requesterName = userData?.user?.email || 'Unknown User'
            }

            // Fetch allocation details
            let courseCode = 'N/A'
            let section = 'N/A'
            if (req.allocation_id) {
                const { data: allocData } = await supabaseAdmin
                    .from('room_allocations')
                    .select('*')
                    .eq('id', req.allocation_id)
                    .single()

                if (allocData) {
                    courseCode = allocData.course_code
                    section = allocData.section
                }
            }

            return {
                ...req,
                requester_id: req.requested_by, // Map for frontend compatibility
                requester_name: requesterName,
                course_code: courseCode,
                section: section,
                current_day: req.original_day,
                current_time: req.original_time
            }
        }))

        return NextResponse.json({ success: true, data: enrichedRequests })
    } catch (error: any) {
        console.error('Server error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    console.log('[API] POST /api/schedule-requests received')

    // Debug Env Vars
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    console.log(`[API] Env check: URL=${!!url}, KEY=${!!key ? 'PRESENT' : 'MISSING'}`)

    try {
        if (!url || !key) {
            throw new Error(`Missing Env Vars: URL=${!!url}, KEY=${!!key}`)
        }
        const supabaseAdmin = createAdminClient()

        let body
        try {
            const text = await request.text()
            console.log('[API] Raw body:', text)
            body = text ? JSON.parse(text) : {}
        } catch (e) {
            console.error('[API] Failed to parse body:', e)
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        // Validate required fields
        const requiredFields = ['scheduleId', 'allocationId', 'requestedBy', 'originalDay', 'originalTime', 'newDay', 'newTime', 'reason']
        for (const field of requiredFields) {
            if (!body[field]) {
                return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
            }
        }

        // Check if schedule is locked
        const { data: schedule, error: scheduleError } = await supabaseAdmin
            .from('generated_schedules')
            .select('is_locked, schedule_name')
            .eq('id', body.scheduleId)
            .single()

        if (scheduleError || !schedule) {
            return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
        }

        if (schedule.is_locked) {
            return NextResponse.json({ error: 'Schedule is locked. Cannot submit requests.' }, { status: 403 })
        }

        // Insert request
        const { data: requestData, error: requestError } = await supabaseAdmin
            .from('schedule_change_requests')
            .insert({
                schedule_id: body.scheduleId,
                allocation_id: body.allocationId,
                requested_by: body.requestedBy,
                original_day: body.originalDay,
                original_time: body.originalTime,
                new_day: body.newDay,
                new_time: body.newTime,
                reason: body.reason,
                status: 'pending'
            })
            .select()
            .single()

        if (requestError) {
            console.error('Error creating request:', requestError)
            return NextResponse.json({
                error: 'Failed to submit request',
                details: requestError,
                message: requestError.message || JSON.stringify(requestError)
            }, { status: 500 })
        }

        // --- Notification Logic: Create Alert for Admin ---
        try {
            let requesterName = 'A Faculty Member'
            const { data: userData } = await supabaseAdmin.auth.admin.getUserById(body.requestedBy)
            if (userData?.user?.email) requesterName = userData.user.email

            await supabaseAdmin.from('system_alerts').insert({
                title: 'New Schedule Request',
                message: `${requesterName} requested a change for ${schedule.schedule_name}`,
                audience: 'admin',
                severity: 'info',
                category: 'schedule_request',
                schedule_id: body.scheduleId,
                metadata: { requestId: requestData.id, requesterId: body.requestedBy }
            })
        } catch (notifError) {
            console.error('Failed to create admin notification:', notifError)
        }

        return NextResponse.json({ success: true, data: requestData })

    } catch (error: any) {
        console.error('Server error processing request:', error)
        return NextResponse.json({
            error: error.message || 'Internal server error',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const supabaseAdmin = createAdminClient()
        const body = await request.json()
        const { requestId, status, rejectionReason } = body

        if (!requestId || !status) {
            return NextResponse.json({ error: 'Missing requestId or status' }, { status: 400 })
        }

        if (!['approved', 'rejected'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
        }

        // Fetch request
        const { data: requestData, error: reqError } = await supabaseAdmin
            .from('schedule_change_requests')
            .select('*, generated_schedules(schedule_name)')
            .eq('id', requestId)
            .single()

        if (reqError || !requestData) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 })
        }

        // Prepare update payload
        const updatePayload: any = {
            status: status,
            reviewed_at: new Date().toISOString()
        }
        if (status === 'rejected' && rejectionReason) {
            updatePayload.admin_notes = rejectionReason
        }

        // Update request status
        const { error: updateError } = await supabaseAdmin
            .from('schedule_change_requests')
            .update(updatePayload)
            .eq('id', requestId)

        if (updateError) {
            console.error('Error updating request status:', updateError)
            return NextResponse.json({ error: 'Failed to update request status' }, { status: 500 })
        }

        // If approved, update allocation
        if (status === 'approved') {
            const { allocation_id, new_day, new_time } = requestData

            const { error: allocationError } = await supabaseAdmin
                .from('room_allocations')
                .update({
                    schedule_day: new_day,
                    schedule_time: new_time
                })
                .eq('id', allocation_id)

            if (allocationError) {
                console.error('Error updating allocation:', allocationError)
                return NextResponse.json({ error: 'Failed to update schedule allocation' }, { status: 500 })
            }
        }

        // --- Notification Logic: Create Alert for Requester ---
        try {
            const scheduleName = requestData.generated_schedules?.schedule_name || 'Schedule'
            const alertTitle = status === 'approved' ? 'Request Approved' : 'Request Rejected'
            const alertMessage = status === 'approved'
                ? `Your reschedule request for ${scheduleName} has been approved.`
                : `Your reschedule request for ${scheduleName} has been rejected.${rejectionReason ? ' Reason: ' + rejectionReason : ''}`
            const alertSeverity = status === 'approved' ? 'success' : 'error'

            await supabaseAdmin.from('system_alerts').insert({
                title: alertTitle,
                message: alertMessage,
                audience: 'faculty',
                severity: alertSeverity,
                category: 'schedule_request',
                metadata: { requestId, scheduleId: requestData.schedule_id, targetUserId: requestData.requester_id }
            })
        } catch (notifError) {
            console.error('Failed to create requester notification:', notifError)
        }

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Server error updating request:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
