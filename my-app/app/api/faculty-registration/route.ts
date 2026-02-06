import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/emailService'

// Force dynamic - disable caching to always get fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Email templates
function generateApprovalEmail(email: string, fullName: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .header .icon { font-size: 50px; margin-bottom: 10px; }
        .content { padding: 30px; }
        .content h2 { color: #1a1a1a; margin-top: 0; }
        .content p { color: #4a5568; line-height: 1.6; }
        .button { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 10px; font-weight: 600; margin: 20px 0; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 12px; }
        .highlight { background: #d1fae5; padding: 15px; border-radius: 10px; border-left: 4px solid #10b981; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="icon">✅</div>
          <h1>Registration Approved!</h1>
        </div>
        <div class="content">
          <h2>Welcome to Qtime Scheduler, ${fullName}!</h2>
          <p>Great news! Your faculty registration has been <strong>approved</strong> by the administrator.</p>
          
          <div class="highlight">
            <strong>🎉 You can now login to your faculty account!</strong><br>
            Use your registered email and password to access the faculty portal.
          </div>
          
          <p>As a faculty member, you can now:</p>
          <ul style="color: #4a5568; line-height: 1.8;">
            <li>View your class schedules</li>
            <li>Update your profile information</li>
            <li>Access room assignments</li>
            <li>Receive schedule notifications</li>
          </ul>
          
          <center>
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/faculty/login" class="button">
              Login to Faculty Portal →
            </a>
          </center>
        </div>
        <div class="footer">
          <p>Qtime Scheduler - Quantum-Inspired Scheduling System</p>
          <p>© ${new Date().getFullYear()} Clarence Thesis Group</p>
        </div>
      </div>
    </body>
    </html>
  `
}

function generateRejectionEmail(email: string, fullName: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .header .icon { font-size: 50px; margin-bottom: 10px; }
        .content { padding: 30px; }
        .content h2 { color: #1a1a1a; margin-top: 0; }
        .content p { color: #4a5568; line-height: 1.6; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 12px; }
        .notice { background: #fee2e2; padding: 15px; border-radius: 10px; border-left: 4px solid #ef4444; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="icon">❌</div>
          <h1>Registration Not Approved</h1>
        </div>
        <div class="content">
          <h2>Hello ${fullName || 'User'},</h2>
          <p>We regret to inform you that your faculty registration request has been <strong>declined</strong> by the administrator.</p>
          
          <div class="notice">
            <strong>What does this mean?</strong><br>
            Your account will not be activated for the faculty portal at this time.
          </div>
          
          <p>This could be due to:</p>
          <ul style="color: #4a5568; line-height: 1.8;">
            <li>Incomplete or incorrect information provided</li>
            <li>Email domain not recognized as institutional</li>
            <li>Duplicate registration attempt</li>
            <li>Other administrative reasons</li>
          </ul>
          
          <p>If you believe this is an error, please contact the administrator directly or try registering again with the correct information.</p>
        </div>
        <div class="footer">
          <p>Qtime Scheduler - Quantum-Inspired Scheduling System</p>
          <p>© ${new Date().getFullYear()} Clarence Thesis Group</p>
        </div>
      </div>
    </body>
    </html>
  `
}

// GET - Fetch all pending faculty registrations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending' // pending, approved, rejected, all

    const supabaseAdmin = createAdminClient()
    
    // Get users from Supabase Auth
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()

    if (authError) {
      console.error('Auth error:', authError)
      // Fallback: try to get from users table
      let query = supabaseAdmin.from('users').select('*')

      if (status !== 'all') {
        query = query.eq('status', status)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      return NextResponse.json({ registrations: data || [] })
    }

    // Filter by email confirmation status and role
    // Status determination using database:
    // - users.is_active = true → approved
    // - users.is_active = false AND user_profiles.position = 'REJECTED' → rejected
    // - Otherwise → pending or unconfirmed
    const ADMIN_EMAIL = 'admin123@ms.bulsu.edu.ph'

    // Get user data from our users table
    const { data: usersData, error: usersError } = await supabaseAdmin
      .from('users')
      .select('*')

    if (usersError) {
      console.error('Error fetching users:', usersError)
    }
    console.log(`Found ${usersData?.length || 0} users in database`)

    // Get user_profiles to check rejection status
    const { data: profilesData, error: profilesError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, position')

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
    }
    console.log(`Found ${profilesData?.length || 0} user profiles in database`)

    const usersMap = new Map(usersData?.map(u => [u.email, u]) || [])
    const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || [])

    const registrations = authUsers.users
      .filter(user => user.email !== ADMIN_EMAIL)
      .map(user => {
        const userRecord = usersMap.get(user.email || '')
        const userProfile = userRecord ? profilesMap.get(userRecord.id) : null

        // Determine status from database - FIXED LOGIC
        let userStatus: 'pending' | 'approved' | 'rejected' | 'unconfirmed'

        // First check if email is confirmed
        if (!user.email_confirmed_at) {
          userStatus = 'unconfirmed'
        }
        // Then check database status - prioritize profile position for rejection status
        else if (userProfile?.position === 'REJECTED') {
          userStatus = 'rejected'
        }
        // Check if user is explicitly approved (is_active = true)
        else if (userRecord?.is_active === true) {
          userStatus = 'approved'
        }
        // Check profile for APPROVED status
        else if (userProfile?.position === 'APPROVED') {
          userStatus = 'approved'
        }
        // Default to pending for confirmed but not yet processed users
        else {
          userStatus = 'pending'
        }

        // Debug log for each user
        if (userRecord) {
          console.log(`User ${user.email}: is_active=${userRecord.is_active}, profile_position=${userProfile?.position}, determined_status=${userStatus}`)
        }

        return {
          id: user.id,
          email: user.email,
          full_name: userRecord?.full_name || user.user_metadata?.full_name || 'Not provided',
          created_at: user.created_at,
          email_confirmed_at: user.email_confirmed_at,
          status: userStatus,
          role: userRecord?.role || 'faculty',
          department: user.user_metadata?.department || null,
          is_active: userRecord?.is_active ?? false
        }
      })
      .filter(user => {
        if (status === 'all') return true
        if (status === 'pending') return user.status === 'pending' || user.status === 'unconfirmed'
        return user.status === status
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({ registrations })

  } catch (error: any) {
    console.error('Error fetching registrations:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch registrations' },
      { status: 500 }
    )
  }
}

// POST - Approve or reject a faculty registration
export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient()
    const body = await request.json()
    const { userId, action, full_name, department } = body

    if (!userId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and action' },
        { status: 400 }
      )
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      )
    }

    // Get user info from auth
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const userEmail = userData.user.email

    if (action === 'approve') {
      console.log(`\n========== APPROVING USER ==========`)
      console.log(`User ID: ${userId}`)
      console.log(`Email: ${userEmail}`)

      // STEP 1: Check if user has confirmed their email via Supabase email link
      // Admin cannot approve until user confirms their email first
      if (!userData.user.email_confirmed_at) {
        console.log('Email not confirmed - user must confirm via email link first')
        return NextResponse.json({
          error: 'Cannot approve: User has not confirmed their email yet. They must click the confirmation link sent to their email before you can approve their account.',
          details: 'Waiting for email confirmation'
        }, { status: 400 })
      }

      console.log('✅ Email already confirmed by user')

      // STEP 2: Check if user exists in users table
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      const finalName = full_name || existingUser?.full_name || userData.user.user_metadata?.full_name || 'Faculty Member'

      if (existingUser) {
        // User exists - UPDATE the record
        console.log('User exists, updating is_active to true...')
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({
            is_active: true,
            full_name: finalName,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)

        if (updateError) {
          console.error('Update error:', updateError)
          return NextResponse.json({
            error: `Failed to approve: ${updateError.message}`
          }, { status: 500 })
        }
      } else {
        // User doesn't exist - INSERT new record
        console.log('User not found, inserting new record...')
        const { error: insertError } = await supabaseAdmin
          .from('users')
          .insert({
            id: userId,
            email: userEmail,
            full_name: finalName,
            role: 'faculty',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

        if (insertError) {
          console.error('Insert error:', insertError)
          return NextResponse.json({
            error: `Failed to approve: ${insertError.message}`
          }, { status: 500 })
        }
      }

      // Verify the approval worked
      const { data: verifyUser } = await supabaseAdmin
        .from('users')
        .select('id, email, is_active, full_name')
        .eq('id', userId)
        .single()

      console.log('Verification:', verifyUser)

      if (!verifyUser?.is_active) {
        console.error('ERROR: is_active is still false after approval!')
        return NextResponse.json({
          error: 'Approval failed - database did not update. Please check RLS policies or contact support.',
        }, { status: 500 })
      }

      console.log(`✅ User ${userEmail} successfully approved!`)

      // Clear rejection marker in user_profiles if previously rejected
      const { data: profileResult, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .upsert({
          user_id: userId,
          position: 'APPROVED',
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id', ignoreDuplicates: false })

      if (profileError) {
        console.error('Profile update error:', profileError)
        // Continue - main approval is done
      } else {
        console.log('Profile updated successfully for approval:', userId)
      }

      console.log(`========== APPROVAL COMPLETE ==========\n`)

      // Send approval email
      try {
        await sendEmail({
          to: userEmail!,
          subject: '✅ Your Faculty Registration has been Approved - Qtime Scheduler',
          html: generateApprovalEmail(userEmail!, full_name || 'Faculty Member')
        })
        console.log(`📧 Approval email sent to ${userEmail}`)
      } catch (emailError) {
        console.error('Failed to send approval email:', emailError)
        // Don't fail the request if email fails
      }

      return NextResponse.json({
        success: true,
        message: `Faculty ${userEmail} has been approved`,
        action: 'approved',
        emailSent: true
      })

    } else {
      // Reject - mark as rejected in database
      // First, get existing user data to preserve fields
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      // Update users table - set is_active to false
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .upsert({
          id: userId,
          email: userEmail,
          full_name: full_name || existingUser?.full_name || userData.user.user_metadata?.full_name || 'User',
          is_active: false,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })

      if (updateError) {
        console.error('Reject update error:', updateError)
        throw updateError
      }

      // Mark as rejected in user_profiles table (using position field)
      const { data: profileResult, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .upsert({
          user_id: userId,
          position: 'REJECTED',
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id', ignoreDuplicates: false })

      if (profileError) {
        console.error('Profile update error for rejection:', profileError)
        console.error('Failed to mark user as REJECTED in user_profiles:', userId)
      } else {
        console.log('Successfully marked user as REJECTED:', userId, profileResult)
      }

      // Send rejection email
      try {
        await sendEmail({
          to: userEmail!,
          subject: '❌ Your Faculty Registration Status - Qtime Scheduler',
          html: generateRejectionEmail(userEmail!, full_name || existingUser?.full_name || 'User')
        })
        console.log(`📧 Rejection email sent to ${userEmail}`)
      } catch (emailError) {
        console.error('Failed to send rejection email:', emailError)
      }

      return NextResponse.json({
        success: true,
        message: `Faculty ${userEmail} has been rejected`,
        action: 'rejected',
        emailSent: true
      })
    }

  } catch (error: any) {
    console.error('Error processing registration:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process registration' },
      { status: 500 }
    )
  }
}

// DELETE - Remove a faculty registration
export async function DELETE(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      )
    }

    // Delete from users table
    await supabaseAdmin.from('users').delete().eq('id', userId)

    // Delete from auth
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (error) {
      console.error('Delete auth user error:', error)
    }

    return NextResponse.json({
      success: true,
      message: 'Faculty registration deleted'
    })

  } catch (error: any) {
    console.error('Error deleting registration:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete registration' },
      { status: 500 }
    )
  }
}
