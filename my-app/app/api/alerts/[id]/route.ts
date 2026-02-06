import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Force dynamic - disable caching to always get fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const alertId = params.id

    if (!alertId) {
      return NextResponse.json({ error: 'Missing alert id' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('system_alerts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', alertId)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Alerts DELETE error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete alert' }, { status: 500 })
  }
}
