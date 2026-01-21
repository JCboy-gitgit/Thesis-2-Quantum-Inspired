import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// GET - Fetch shared floor plan by token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const floorPlanId = searchParams.get('floorPlanId')

    // Get all shares for a floor plan
    if (floorPlanId) {
      const { data, error } = await supabase
        .from('shared_floor_plans')
        .select('*')
        .eq('floor_plan_id', floorPlanId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return NextResponse.json({
        success: true,
        data
      })
    }

    // Get shared plan by token
    if (token) {
      const password = searchParams.get('password')
      
      const { data: share, error: shareError } = await supabase
        .from('shared_floor_plans')
        .select('*')
        .eq('share_token', token)
        .eq('is_active', true)
        .single()

      if (shareError || !share) {
        return NextResponse.json(
          { success: false, error: 'Share link not found or expired' },
          { status: 404 }
        )
      }

      // Check expiration
      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        return NextResponse.json(
          { success: false, error: 'Share link has expired' },
          { status: 410 }
        )
      }

      // Check password if protected
      if (share.password_protected && share.password_hash) {
        if (!password) {
          return NextResponse.json({
            success: false,
            error: 'Password required',
            needsPassword: true
          }, { status: 401 })
        }
        
        const providedHash = crypto.createHash('sha256').update(password).digest('hex')
        if (providedHash !== share.password_hash) {
          return NextResponse.json({
            success: false,
            error: 'Incorrect password',
            needsPassword: true
          }, { status: 401 })
        }
      }

      // Increment view count
      await supabase
        .from('shared_floor_plans')
        .update({ view_count: (share.view_count || 0) + 1 })
        .eq('id', share.id)

      // Fetch the floor plan with building info
      const { data: floorPlan, error: planError } = await supabase
        .from('floor_plans')
        .select(`
          *,
          buildings (*)
        `)
        .eq('id', share.floor_plan_id)
        .single()

      if (planError) throw planError

      // Fetch elements
      const { data: elements, error: elemError } = await supabase
        .from('floor_plan_elements')
        .select('*')
        .eq('floor_plan_id', share.floor_plan_id)
        .order('z_index', { ascending: true })

      if (elemError) throw elemError

      return NextResponse.json({
        success: true,
        data: {
          share,
          floorPlan: {
            ...floorPlan,
            elements: elements || []
          }
        }
      })
    }

    return NextResponse.json(
      { success: false, error: 'Token or floorPlanId is required' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error fetching shared floor plan:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch shared floor plan' },
      { status: 500 }
    )
  }
}

// POST - Create share link
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      floor_plan_id,
      share_name,
      password,
      expires_in_days,
      allowed_emails
    } = body

    // Generate unique token
    const shareToken = crypto.randomBytes(32).toString('hex')

    // Calculate expiration date if provided
    let expiresAt = null
    if (expires_in_days) {
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + expires_in_days)
    }

    // Hash password if provided
    let passwordHash = null
    if (password) {
      passwordHash = crypto.createHash('sha256').update(password).digest('hex')
    }

    const { data: share, error } = await supabase
      .from('shared_floor_plans')
      .insert([{
        floor_plan_id,
        share_token: shareToken,
        share_name: share_name || 'Shared Floor Plan',
        is_active: true,
        password_protected: !!password,
        password_hash: passwordHash,
        expires_at: expiresAt,
        allowed_emails: allowed_emails || [],
        view_count: 0
      }])
      .select()
      .single()

    if (error) throw error

    // Generate the share URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const shareUrl = `${baseUrl}/view/floor-plan/${shareToken}`

    return NextResponse.json({
      success: true,
      data: {
        ...share,
        share_url: shareUrl
      },
      message: 'Share link created successfully'
    })

  } catch (error) {
    console.error('Error creating share link:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create share link' },
      { status: 500 }
    )
  }
}

// PUT - Update share settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, is_active, share_name, expires_in_days, allowed_emails } = body

    const updates: any = {}

    if (typeof is_active === 'boolean') {
      updates.is_active = is_active
    }

    if (share_name) {
      updates.share_name = share_name
    }

    if (expires_in_days !== undefined) {
      if (expires_in_days === null) {
        updates.expires_at = null
      } else {
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + expires_in_days)
        updates.expires_at = expiresAt
      }
    }

    if (allowed_emails) {
      updates.allowed_emails = allowed_emails
    }

    const { data, error } = await supabase
      .from('shared_floor_plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data,
      message: 'Share settings updated'
    })

  } catch (error) {
    console.error('Error updating share:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update share' },
      { status: 500 }
    )
  }
}

// DELETE - Delete share link
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Share ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('shared_floor_plans')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Share link deleted'
    })

  } catch (error) {
    console.error('Error deleting share:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete share' },
      { status: 500 }
    )
  }
}
