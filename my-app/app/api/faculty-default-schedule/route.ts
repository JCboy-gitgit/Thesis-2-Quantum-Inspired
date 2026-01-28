import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin123@ms.bulsu.edu.ph'

// GET - Fetch approved faculty or default schedules
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'approved-faculty'
    const facultyEmail = searchParams.get('email')
    const scheduleId = searchParams.get('scheduleId')

    if (action === 'approved-faculty') {
      // Fetch all approved faculty from users table
      const { data: approvedFaculty, error } = await supabaseAdmin
        .from('users')
        .select('id, email, full_name, department_id, is_active')
        .eq('is_active', true)
        .neq('email', ADMIN_EMAIL)
        .order('full_name', { ascending: true })

      if (error) throw error

      return NextResponse.json({ 
        success: true, 
        approvedFaculty: approvedFaculty || [] 
      })
    }

    if (action === 'faculty-schedule') {
      // Get the default schedule for a specific faculty
      if (!facultyEmail) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 })
      }

      // First, get the faculty user to get their full name for filtering
      const { data: facultyUser, error: facultyUserError } = await supabaseAdmin
        .from('users')
        .select('id, email, full_name')
        .eq('email', facultyEmail)
        .single()

      if (facultyUserError && facultyUserError.code !== 'PGRST116') {
        console.error('Error fetching faculty user:', facultyUserError)
      }

      // Also check faculty_profiles for the faculty's full name
      const { data: facultyProfile } = await supabaseAdmin
        .from('faculty_profiles')
        .select('full_name, department, college')
        .eq('email', facultyEmail)
        .single()

      const facultyName = facultyProfile?.full_name || facultyUser?.full_name || ''

      const { data: defaultSchedule, error } = await supabaseAdmin
        .from('faculty_default_schedules')
        .select(`
          *,
          generated_schedules!inner(
            id,
            schedule_name,
            semester,
            academic_year,
            total_classes,
            scheduled_classes,
            created_at
          )
        `)
        .eq('faculty_email', facultyEmail)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found, which is okay
        console.error('Error fetching faculty schedule:', error)
      }

      // If we have a default schedule, fetch the allocations for it - FILTERED by teacher_name
      let allocations: any[] = []
      if (defaultSchedule?.schedule_id) {
        // Get allocations that match this faculty's name
        let query = supabaseAdmin
          .from('room_allocations')
          .select('*')
          .eq('schedule_id', defaultSchedule.schedule_id)
          .order('schedule_day', { ascending: true })
          .order('schedule_time', { ascending: true })

        // Filter by teacher name if we have one
        if (facultyName) {
          query = query.ilike('teacher_name', `%${facultyName}%`)
        }

        const { data: allocationData, error: allocError } = await query

        if (!allocError && allocationData) {
          allocations = allocationData
        }
      }

      return NextResponse.json({ 
        success: true, 
        defaultSchedule: defaultSchedule || null,
        schedule: defaultSchedule?.generated_schedules || null,
        assignment: defaultSchedule ? {
          id: defaultSchedule.id,
          assigned_at: defaultSchedule.assigned_at,
          faculty_email: defaultSchedule.faculty_email
        } : null,
        allocations,
        facultyName
      })
    }

    if (action === 'schedule-assignments') {
      // Get all faculty assigned to a specific schedule
      if (!scheduleId) {
        return NextResponse.json({ error: 'scheduleId is required' }, { status: 400 })
      }

      const { data: assignments, error } = await supabaseAdmin
        .from('faculty_default_schedules')
        .select(`
          *,
          users!faculty_default_schedules_faculty_user_id_fkey(
            id,
            email,
            full_name
          )
        `)
        .eq('schedule_id', parseInt(scheduleId))
        .eq('is_active', true)

      if (error) throw error

      return NextResponse.json({ 
        success: true, 
        assignments: assignments || [] 
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error: any) {
    console.error('Error in faculty-default-schedule GET:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch data' },
      { status: 500 }
    )
  }
}

// POST - Assign default schedule to faculty
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { facultyUserIds, scheduleId, assignedBy } = body

    if (!facultyUserIds || !Array.isArray(facultyUserIds) || facultyUserIds.length === 0) {
      return NextResponse.json(
        { error: 'facultyUserIds array is required' },
        { status: 400 }
      )
    }

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'scheduleId is required' },
        { status: 400 }
      )
    }

    // Verify schedule exists
    const { data: schedule, error: scheduleError } = await supabaseAdmin
      .from('generated_schedules')
      .select('id, schedule_name')
      .eq('id', scheduleId)
      .single()

    if (scheduleError || !schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // Get faculty details
    const { data: facultyUsers, error: facultyError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name')
      .in('id', facultyUserIds)
      .eq('is_active', true)

    if (facultyError || !facultyUsers || facultyUsers.length === 0) {
      return NextResponse.json({ error: 'No valid faculty found' }, { status: 404 })
    }

    // Deactivate any existing default schedules for these faculty for this schedule
    await supabaseAdmin
      .from('faculty_default_schedules')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('faculty_user_id', facultyUserIds)
      .eq('schedule_id', scheduleId)

    // Create new default schedule assignments
    const assignments = facultyUsers.map(faculty => ({
      faculty_user_id: faculty.id,
      faculty_email: faculty.email,
      schedule_id: scheduleId,
      is_active: true,
      assigned_by: assignedBy || null,
      assigned_at: new Date().toISOString()
    }))

    const { data: insertedData, error: insertError } = await supabaseAdmin
      .from('faculty_default_schedules')
      .upsert(assignments, { 
        onConflict: 'faculty_user_id,schedule_id',
        ignoreDuplicates: false 
      })
      .select()

    if (insertError) {
      console.error('Insert error:', insertError)
      throw insertError
    }

    return NextResponse.json({
      success: true,
      message: `Schedule "${schedule.schedule_name}" assigned to ${facultyUsers.length} faculty member(s)`,
      assignments: insertedData
    })

  } catch (error: any) {
    console.error('Error in faculty-default-schedule POST:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to assign schedule' },
      { status: 500 }
    )
  }
}

// DELETE - Remove default schedule assignment
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const assignmentId = searchParams.get('id')
    const facultyUserId = searchParams.get('facultyUserId')
    const scheduleId = searchParams.get('scheduleId')

    if (assignmentId) {
      // Delete by assignment ID
      const { error } = await supabaseAdmin
        .from('faculty_default_schedules')
        .delete()
        .eq('id', parseInt(assignmentId))

      if (error) throw error
    } else if (facultyUserId && scheduleId) {
      // Delete by faculty and schedule
      const { error } = await supabaseAdmin
        .from('faculty_default_schedules')
        .delete()
        .eq('faculty_user_id', facultyUserId)
        .eq('schedule_id', parseInt(scheduleId))

      if (error) throw error
    } else {
      return NextResponse.json(
        { error: 'Either id or both facultyUserId and scheduleId are required' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Default schedule assignment removed'
    })

  } catch (error: any) {
    console.error('Error in faculty-default-schedule DELETE:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to remove assignment' },
      { status: 500 }
    )
  }
}
