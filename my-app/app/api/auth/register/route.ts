import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/emailService'
import crypto from 'crypto'

// Force dynamic - disable caching to always get fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Cache-busting wrapper to prevent Next.js from caching Supabase requests
const fetchWithNoCache = (url: RequestInfo | URL, options: RequestInit = {}) =>
  fetch(url, { ...options, cache: 'no-store' })

let _supabaseAdmin: ReturnType<typeof createClient> | null = null
const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient>, {
  get(_, prop) {
    if (!_supabaseAdmin) {
      _supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { fetch: fetchWithNoCache } }
      )
    }
    return (_supabaseAdmin as any)[prop]
  },
})

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000'

const TOKEN_TTL_HOURS = 24

const buildVerificationEmail = (fullName: string, verifyUrl: string) => {
  const safeName = fullName || 'Faculty Member'
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { font-family: Arial, sans-serif; background: #f8fafc; margin: 0; padding: 24px; }
          .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 14px; padding: 24px; box-shadow: 0 12px 32px rgba(2, 6, 23, 0.12); }
          .title { font-size: 20px; color: #0f172a; margin-bottom: 8px; }
          .text { font-size: 14px; color: #475569; line-height: 1.6; }
          .button { display: inline-block; margin-top: 16px; padding: 12px 18px; background: #10b981; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; }
          .hint { margin-top: 12px; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="title">Verify your email</div>
          <p class="text">Hi ${safeName}, please confirm your email to activate your faculty registration.</p>
          <a class="button" href="${verifyUrl}">Confirm Email</a>
          <p class="hint">This link expires in ${TOKEN_TTL_HOURS} hours.</p>
        </div>
      </body>
    </html>
  `
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const fullName = String(body.fullName || '').trim()
    const college = String(body.college || '').trim()

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        full_name: fullName,
        college
      }
    })

    if (createError || !createData.user) {
      return NextResponse.json({ error: createError?.message || 'Failed to create user' }, { status: 400 })
    }

    const userId = createData.user.id

    await supabaseAdmin.from('users').upsert({
      id: userId,
      email,
      full_name: fullName,
      college,
      role: 'faculty',
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString()

    const { error: tokenError } = await supabaseAdmin
      .from('email_verification_tokens')
      .insert({
        user_id: userId,
        email,
        token,
        expires_at: expiresAt
      })

    if (tokenError) {
      return NextResponse.json({ error: tokenError.message || 'Failed to create verification token' }, { status: 500 })
    }

    const verifyUrl = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`

    await sendEmail({
      to: email,
      subject: 'Confirm your Qtime Scheduler email',
      html: buildVerificationEmail(fullName, verifyUrl)
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: error?.message || 'Registration failed' },
      { status: 500 }
    )
  }
}
