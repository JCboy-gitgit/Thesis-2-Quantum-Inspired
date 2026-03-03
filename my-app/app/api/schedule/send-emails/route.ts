import { NextRequest, NextResponse } from 'next/server'
import { sendScheduleEmails } from '@/lib/emailService'
import { createClient } from '@supabase/supabase-js'

// Force dynamic - disable caching to always get fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Cache-busting wrapper to prevent Next.js from caching Supabase requests
const fetchWithNoCache = (url: RequestInfo | URL, options: RequestInit = {}) =>
  fetch(url, { ...options, cache: 'no-store' })

let _supabase: ReturnType<typeof createClient> | null = null
const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_, prop) {
    if (!_supabase) {
      _supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { fetch: fetchWithNoCache } }
      )
    }
    return (_supabase as any)[prop]
  },
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { schedule_summary_id } = body

    if (!schedule_summary_id) {
      return NextResponse.json(
        { error: 'schedule_summary_id required' },
        { status: 400 }
      )
    }

    // Fetch batches
    const { data: batches, error: batchError } = await supabase
      .from('schedule_batches')
      .select('*')
      .eq('schedule_summary_id', schedule_summary_id)

    if (batchError) {
      console.error(`❌ Batch fetch error: ${batchError.message}`)
      return NextResponse.json(
        { error: `Failed to fetch batches: ${batchError.message}` },
        { status: 500 }
      )
    }

    if (!batches?.length) {
      return NextResponse.json(
        { error: 'No batches found for this schedule' },
        { status: 404 }
      )
    }

    // Collect participant IDs
    const participantIds = batches.flatMap(b => b.participant_ids || [])

    if (!participantIds.length) {
      return NextResponse.json(
        { error: 'No participants found in batches' },
        { status: 404 }
      )
    }

    // Fetch participants
    const { data: participants, error: partError } = await supabase
      .from('participants')
      .select('id, name, email, participant_number, is_pwd')
      .in('id', participantIds)

    if (partError) {
      console.error(`❌ Participant fetch error: ${partError.message}`)
      return NextResponse.json(
        { error: `Failed to fetch participants: ${partError.message}` },
        { status: 500 }
      )
    }

    if (!participants?.length) {
      return NextResponse.json(
        { error: 'No participants found' },
        { status: 404 }
      )
    }

    // Build email recipients
    const emailRecipients = participants
      .filter(p => p.email && p.email.trim())
      .map(p => {
        const batch = batches.find(b => 
          b.participant_ids?.includes(p.id)
        )
        return {
          email: p.email.trim(),
          name: p.name || 'Participant',
          participant_number: p.participant_number,
          batch_name: batch?.batch_name,
          room: batch?.room,
          time_slot: batch?.time_slot,
          campus: 'Cla State University',
        }
      })


    if (!emailRecipients.length) {
      return NextResponse.json(
        { error: 'No valid email addresses found' },
        { status: 400 }
      )
    }

    // Send emails
    const result = await sendScheduleEmails(emailRecipients)

    if (!result.success) {
      console.error(`❌ Email sending failed: ${result.error}`)
      return NextResponse.json(
        { error: result.error || 'Failed to send emails' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      sent: result.sent,
      failed: result.failed,
    })
  } catch (error: any) {
    console.error('Email send error:', error?.message)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}