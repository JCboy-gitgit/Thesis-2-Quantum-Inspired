import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Force dynamic - disable caching to always get fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET - Fetch profile change requests
export async function GET(request: Request) {
  try {
    const supabaseAdmin = createAdminClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const userId = searchParams.get('userId')
    const action = searchParams.get('action')

    // Get pending count for notifications
    if (action === 'pending-count') {
      const { count, error } = await supabaseAdmin
        .from('profile_change_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      if (error) {
        return NextResponse.json({ count: 0 })
      }

      return NextResponse.json({ count: count || 0 })
    }

    // Build query
    let query = supabaseAdmin
      .from('profile_change_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching requests:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ requests: data })
  } catch (error) {
    console.error('GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new profile change request
export async function POST(request: Request) {
  try {
    const supabaseAdmin = createAdminClient()
    const body = await request.json()
    const { userId, email, fieldName, currentValue, requestedValue } = body

    if (!userId || !email || !fieldName || !requestedValue) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, email, fieldName, requestedValue' },
        { status: 400 }
      )
    }

    // Check if there's already a pending request for the same field
    const { data: existingRequest } = await supabaseAdmin
      .from('profile_change_requests')
      .select('id')
      .eq('user_id', userId)
      .eq('field_name', fieldName)
      .eq('status', 'pending')
      .single()

    if (existingRequest) {
      // Update the existing request instead of creating a new one
      const { data, error } = await supabaseAdmin
        .from('profile_change_requests')
        .update({
          requested_value: requestedValue,
          current_value: currentValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRequest.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating request:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Your existing request has been updated',
        request: data
      })
    }

    // Create new request
    const { data, error } = await supabaseAdmin
      .from('profile_change_requests')
      .insert({
        user_id: userId,
        email,
        field_name: fieldName,
        current_value: currentValue,
        requested_value: requestedValue
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating request:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Your change request has been submitted for admin approval',
      request: data
    })
  } catch (error) {
    console.error('POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Approve or reject a request (admin only)
export async function PATCH(request: Request) {
  try {
    const supabaseAdmin = createAdminClient()
    const body = await request.json()
    const { requestId, action, adminNotes, adminId } = body

    if (!requestId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Missing required fields: requestId, action (approve/reject)' },
        { status: 400 }
      )
    }

    // Get the request details
    const { data: changeRequest, error: fetchError } = await supabaseAdmin
      .from('profile_change_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (fetchError || !changeRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (changeRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'This request has already been processed' },
        { status: 400 }
      )
    }

    // If approving, update the actual user data
    if (action === 'approve') {
      // Validate role field if being updated - must match CHECK constraint
      const validRoles = ['administrator', 'department_head', 'program_chair', 'coordinator', 'faculty', 'staff']
      if (changeRequest.field_name === 'role' && !validRoles.includes(changeRequest.requested_value)) {
        return NextResponse.json(
          { error: `Invalid role value. Must be one of: ${validRoles.join(', ')}` },
          { status: 400 }
        )
      }

      // Update the users table (only if field exists in users table)
      const usersTableFields = ['full_name', 'department_id', 'phone', 'avatar_url']
      if (usersTableFields.includes(changeRequest.field_name)) {
        const updateData: Record<string, any> = {
          [changeRequest.field_name]: changeRequest.requested_value,
          updated_at: new Date().toISOString()
        }

        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update(updateData)
          .eq('id', changeRequest.user_id)

        if (updateError) {
          console.error('Error updating user:', updateError)
          return NextResponse.json(
            { error: 'Failed to update user profile' },
            { status: 500 }
          )
        }
      }

      // Update faculty_profiles if the email matches
      // faculty_profiles has different fields: full_name, position, role, department, college, email, phone, etc.
      const facultyProfileFields = ['full_name', 'position', 'role', 'department', 'college', 'phone', 'office_location', 'employment_type', 'bio', 'specialization', 'education']
      if (facultyProfileFields.includes(changeRequest.field_name)) {
        const { error: facultyUpdateError } = await supabaseAdmin
          .from('faculty_profiles')
          .update({
            [changeRequest.field_name]: changeRequest.requested_value,
            updated_at: new Date().toISOString()
          })
          .eq('email', changeRequest.email)

        if (facultyUpdateError) {
          console.warn('Faculty profile update skipped:', facultyUpdateError?.message || facultyUpdateError?.code || 'Unknown error', facultyUpdateError?.hint || '')
          // If this is the primary target table for this field, return error
          if (!usersTableFields.includes(changeRequest.field_name)) {
            return NextResponse.json(
              { error: `Failed to update faculty profile: ${facultyUpdateError.message}` },
              { status: 500 }
            )
          }
        }
      }
    }

    // Update the request status
    const { data, error } = await supabaseAdmin
      .from('profile_change_requests')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        admin_notes: adminNotes || null,
        reviewed_by: adminId || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select()
      .single()

    if (error) {
      console.error('Error updating request status:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: action === 'approve'
        ? 'Request approved and profile updated'
        : 'Request rejected',
      request: data
    })
  } catch (error) {
    console.error('PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Cancel a pending request (user can cancel their own)
export async function DELETE(request: Request) {
  try {
    const supabaseAdmin = createAdminClient()
    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('id')
    const userId = searchParams.get('userId')

    if (!requestId) {
      return NextResponse.json(
        { error: 'Request ID is required' },
        { status: 400 }
      )
    }

    // Build delete query - only delete if pending and belongs to user
    let query = supabaseAdmin
      .from('profile_change_requests')
      .delete()
      .eq('id', requestId)
      .eq('status', 'pending')

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { error } = await query

    if (error) {
      console.error('Error deleting request:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Request cancelled successfully'
    })
  } catch (error) {
    console.error('DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
