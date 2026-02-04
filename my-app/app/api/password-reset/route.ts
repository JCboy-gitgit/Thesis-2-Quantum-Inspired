import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/emailService'
import crypto from 'crypto'

// Use service role for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Generate password reset email HTML
function generatePasswordResetEmail(fullName: string, resetLink: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .header .icon { font-size: 50px; margin-bottom: 10px; }
        .content { padding: 30px; }
        .content h2 { color: #1a1a1a; margin-top: 0; }
        .content p { color: #4a5568; line-height: 1.6; }
        .button { display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 10px; font-weight: 600; margin: 20px 0; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 12px; }
        .warning { background: #fef3c7; padding: 15px; border-radius: 10px; border-left: 4px solid #f59e0b; margin: 20px 0; }
        .code-box { background: #f1f5f9; padding: 15px; border-radius: 8px; font-family: monospace; word-break: break-all; margin: 15px 0; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="icon">🔐</div>
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <h2>Hello ${fullName || 'User'},</h2>
          <p>We received a request to reset your password for your Qtime Scheduler faculty account.</p>
          
          <p>Click the button below to reset your password:</p>
          
          <center>
            <a href="${resetLink}" class="button">
              Reset My Password →
            </a>
          </center>
          
          <div class="warning">
            <strong>⚠️ This link expires in 1 hour.</strong><br>
            If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
          </div>
          
          <p style="font-size: 13px; color: #64748b;">If the button doesn't work, copy and paste this link into your browser:</p>
          <div class="code-box">${resetLink}</div>
        </div>
        <div class="footer">
          <p>Qtime Scheduler - Quantum-Inspired Scheduling System</p>
          <p>© ${new Date().getFullYear()} Clarence Thesis Group</p>
          <p style="font-size: 11px; margin-top: 10px;">This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

// POST - Send password reset email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Find user by email
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name')
      .eq('email', email.toLowerCase())
      .single()

    if (userError || !userData) {
      // Don't reveal if email exists or not for security
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      })
    }

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now

    // Delete any existing tokens for this user
    await supabaseAdmin
      .from('password_reset_tokens')
      .delete()
      .eq('email', email.toLowerCase())

    // Insert new token
    const { error: tokenError } = await supabaseAdmin
      .from('password_reset_tokens')
      .insert({
        user_id: userData.id,
        email: email.toLowerCase(),
        token: token,
        expires_at: expiresAt.toISOString()
      })

    if (tokenError) {
      console.error('Token insert error:', tokenError)
      return NextResponse.json(
        { error: 'Failed to generate reset token' },
        { status: 500 }
      )
    }

    // Generate reset link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const resetLink = `${baseUrl}/faculty/reset-password?token=${token}`

    // Send email via Gmail
    try {
      await sendEmail({
        to: email,
        subject: '🔐 Password Reset - Qtime Scheduler',
        html: generatePasswordResetEmail(userData.full_name, resetLink)
      })

      console.log(`✅ Password reset email sent to ${email}`)
    } catch (emailError) {
      console.error('Email send error:', emailError)
      // Clean up the token since email failed
      await supabaseAdmin
        .from('password_reset_tokens')
        .delete()
        .eq('token', token)

      return NextResponse.json(
        { error: 'Failed to send email. Please try again later.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset email sent! Check your inbox.'
    })

  } catch (error: any) {
    console.error('Password reset error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - Verify token is valid (used by reset-password page)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'Token is required' },
        { status: 400 }
      )
    }

    // Check if token exists and is not expired
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (tokenError || !tokenData) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid or expired token. Please request a new password reset.'
      })
    }

    return NextResponse.json({
      valid: true,
      email: tokenData.email
    })

  } catch (error: any) {
    console.error('Token verification error:', error)
    return NextResponse.json(
      { valid: false, error: 'Failed to verify token' },
      { status: 500 }
    )
  }
}

// PUT - Reset password using token
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, newPassword } = body

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: 'Token and new password are required' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    // Verify token
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: 'Invalid or expired token. Please request a new password reset.' },
        { status: 400 }
      )
    }

    // Update user's password using Supabase Admin
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      tokenData.user_id,
      { password: newPassword }
    )

    if (updateError) {
      console.error('Password update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update password. Please try again.' },
        { status: 500 }
      )
    }

    // Mark token as used
    await supabaseAdmin
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token)

    console.log(`✅ Password reset successful for ${tokenData.email}`)

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully! You can now login with your new password.'
    })

  } catch (error: any) {
    console.error('Password reset error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
