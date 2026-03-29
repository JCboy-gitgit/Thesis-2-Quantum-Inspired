import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const scheduleId = Number(body?.scheduleId)

    if (!Number.isFinite(scheduleId) || scheduleId <= 0) {
      return NextResponse.json({ error: 'Valid scheduleId is required' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    const { data: scheduleRow, error: scheduleError } = await supabaseAdmin
      .from('generated_schedules')
      .select('id')
      .eq('id', scheduleId)
      .single()

    if (scheduleError || !scheduleRow) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    const nowIso = new Date().toISOString()

    const { error: resetError } = await supabaseAdmin
      .from('generated_schedules')
      .update({ is_current: false, activated_at: null, activated_by: null })
      .eq('is_current', true)

    if (resetError) {
      throw resetError
    }

    const { data: setData, error: setError } = await supabaseAdmin
      .from('generated_schedules')
      .update({ is_current: true, activated_at: nowIso })
      .eq('id', scheduleId)
      .select('id, is_current, activated_at')
      .single()

    if (setError || !setData) {
      throw setError || new Error('Failed to set current schedule')
    }

    // Keep faculty-facing assigned schedules aligned with the current schedule.
    // Existing active assignees remain the same; only the schedule target is switched.
    const { data: activeAssignments, error: activeAssignmentsError } = await supabaseAdmin
      .from('faculty_default_schedules')
      .select('faculty_user_id, faculty_email, assigned_by')
      .eq('is_active', true)

    if (activeAssignmentsError) {
      throw activeAssignmentsError
    }

    const uniqueAssignees = new Map<string, { faculty_user_id: string; faculty_email: string; assigned_by: string | null }>()
    for (const assignment of activeAssignments || []) {
      if (!assignment?.faculty_user_id || !assignment?.faculty_email) continue
      uniqueAssignees.set(String(assignment.faculty_user_id), {
        faculty_user_id: String(assignment.faculty_user_id),
        faculty_email: String(assignment.faculty_email),
        assigned_by: assignment.assigned_by ?? null
      })
    }

    if (uniqueAssignees.size > 0) {
      const { error: deactivateAssignmentsError } = await supabaseAdmin
        .from('faculty_default_schedules')
        .update({ is_active: false, updated_at: nowIso })
        .eq('is_active', true)

      if (deactivateAssignmentsError) {
        throw deactivateAssignmentsError
      }

      const reassignedRows = Array.from(uniqueAssignees.values()).map((item) => ({
        faculty_user_id: item.faculty_user_id,
        faculty_email: item.faculty_email,
        schedule_id: scheduleId,
        is_active: true,
        assigned_by: item.assigned_by,
        assigned_at: nowIso,
        updated_at: nowIso
      }))

      const { error: reassignError } = await supabaseAdmin
        .from('faculty_default_schedules')
        .upsert(reassignedRows, {
          onConflict: 'faculty_user_id,schedule_id',
          ignoreDuplicates: false
        })

      if (reassignError) {
        throw reassignError
      }
    }

    return NextResponse.json({
      success: true,
      schedule: setData,
      message: 'Current schedule updated successfully'
    })
  } catch (error: any) {
    console.error('Error setting current schedule:', error)
    return NextResponse.json({ error: error?.message || 'Failed to set current schedule' }, { status: 500 })
  }
}
