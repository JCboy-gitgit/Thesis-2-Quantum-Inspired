import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const DEFAULT_BUCKET = 'room-images'
const FALLBACK_BUCKET = 'profile-images'

const isBucketMissingError = (message?: string) =>
  Boolean(message && /bucket.*not\s+found|does\s+not\s+exist/i.test(message))

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    // Try cookie-based session first.
    let { data: cookieAuthData, error: cookieAuthError } = await supabase.auth.getUser()
    let user = cookieAuthData?.user || null

    // Fallback: bearer token for local/dev where route cookies can be missing.
    if (!user) {
      const authHeader = request.headers.get('authorization') || ''
      const token = authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : ''

      if (token) {
        const tokenAuth = await supabaseAdmin.auth.getUser(token)
        user = tokenAuth.data?.user || null
      }
    }

    if (cookieAuthError && !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin123@ms.bulsu.edu.ph').toLowerCase()
    const isAdminByEmail = (user.email || '').toLowerCase() === adminEmail

    let isAdminByRole = false
    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = String((userRow as any)?.role || '').toLowerCase()
    if (role === 'admin' || role === 'sub_admin') {
      isAdminByRole = true
    }

    const isAdmin = isAdminByEmail || isAdminByRole

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const filePath = String(formData.get('filePath') || '').trim()
    const requestedBucket = String(formData.get('bucket') || DEFAULT_BUCKET).trim() || DEFAULT_BUCKET

    if (!file || !filePath) {
      return NextResponse.json({ error: 'File and filePath are required' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image must be smaller than 10MB' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let bucketUsed = requestedBucket
    let uploadError: any = null

    const primaryUpload = await supabaseAdmin.storage
      .from(bucketUsed)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      })

    uploadError = primaryUpload.error

    if (uploadError && isBucketMissingError(uploadError.message) && bucketUsed !== FALLBACK_BUCKET) {
      bucketUsed = FALLBACK_BUCKET
      const fallbackUpload = await supabaseAdmin.storage
        .from(bucketUsed)
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: true,
        })
      uploadError = fallbackUpload.error
    }

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(bucketUsed)
      .getPublicUrl(filePath)

    return NextResponse.json({
      success: true,
      publicUrl: publicUrlData.publicUrl,
      bucket: bucketUsed,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
