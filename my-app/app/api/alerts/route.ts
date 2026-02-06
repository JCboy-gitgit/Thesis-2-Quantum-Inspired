import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Force dynamic - disable caching to always get fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient()
    const { searchParams } = new URL(request.url)
    const audience = searchParams.get('audience') || 'faculty'
    const userId = searchParams.get('userId') || ''

    const { data: alerts, error } = await supabaseAdmin
      .from('system_alerts')
      .select('*')
      .is('deleted_at', null)
      .in('audience', [audience, 'all'])
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    let receipts: Record<string, any> = {}
    if (userId) {
      const { data: receiptRows } = await supabaseAdmin
        .from('alert_receipts')
        .select('*')
        .eq('user_id', userId)

      receipts = (receiptRows || []).reduce((acc: Record<string, any>, item: any) => {
        acc[item.alert_id] = item
        return acc
      }, {})
    }

    const formatted = (alerts || []).map(alert => ({
      ...alert,
      receipt: receipts[alert.id] || null
    }))

    return NextResponse.json({ alerts: formatted })
  } catch (error: any) {
    console.error('Alerts GET error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch alerts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient()
    const body = await request.json()
    const title = String(body.title || '').trim()
    const message = String(body.message || '').trim()

    if (!title || !message) {
      return NextResponse.json({ error: 'Missing title or message' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('system_alerts')
      .insert({
        title,
        message,
        audience: body.audience || 'admin',
        severity: body.severity || 'info',
        category: body.category || 'system',
        schedule_id: body.scheduleId || null,
        created_by: body.createdBy || null,
        metadata: body.metadata || {}
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ alert: data })
  } catch (error: any) {
    console.error('Alerts POST error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to create alert' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const alertId = String(body.alertId || '').trim()
    const userId = String(body.userId || '').trim()
    const action = String(body.action || '').trim()

    if (!alertId || !userId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const now = new Date().toISOString()
    let status = 'read'
    const updates: Record<string, any> = { updated_at: now }

    if (action === 'read') {
      status = 'read'
      updates.read_at = now
    } else if (action === 'confirm') {
      status = 'confirmed'
      updates.confirmed_at = now
    } else if (action === 'dismiss') {
      status = 'dismissed'
      updates.dismissed_at = now
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin
      .from('alert_receipts')
      .upsert({
        alert_id: alertId,
        user_id: userId,
        status,
        ...updates
      }, { onConflict: 'alert_id,user_id' })

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Alerts PATCH error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to update alert' }, { status: 500 })
  }
}
