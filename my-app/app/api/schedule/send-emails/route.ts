import { NextRequest, NextResponse } from 'next/server'
import { sendScheduleEmails } from '@/lib/emailService'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  console.log('\n' + '='.repeat(80))
  console.log('📧 POST /api/schedule/send-emails')
  console.log('='.repeat(80))

  try {
    const body = await req.json()
    const { schedule_summary_id } = body

    console.log(`Schedule ID: ${schedule_summary_id}`)

    if (!schedule_summary_id) {
      console.warn('❌ Missing schedule_summary_id')
      return NextResponse.json(
        { error: 'schedule_summary_id required' },
        { status: 400 }
      )
    }

    // Fetch batches
    console.log('\n📊 Fetching schedule_batches from Supabase...')
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
      console.warn('❌ No batches found')
      return NextResponse.json(
        { error: 'No batches found for this schedule' },
        { status: 404 }
      )
    }

    console.log(`✅ Found ${batches.length} batches`)

    // Collect participant IDs
    const participantIds = batches.flatMap(b => b.participant_ids || [])
    console.log(`\n👥 Collecting ${participantIds.length} participant IDs from batches...`)

    if (!participantIds.length) {
      console.warn('❌ No participant IDs found')
      return NextResponse.json(
        { error: 'No participants found in batches' },
        { status: 404 }
      )
    }

    // Fetch participants
    console.log('\n👤 Fetching participant details from Supabase...')
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
      console.warn('❌ No participants found')
      return NextResponse.json(
        { error: 'No participants found' },
        { status: 404 }
      )
    }

    console.log(`✅ Found ${participants.length} participants`)

    // Build email recipients
    console.log('\n📧 Building email recipient list...')
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

    console.log(`✅ ${emailRecipients.length} valid email addresses`)
    emailRecipients.forEach(r => console.log(`   - ${r.name} <${r.email}>`))

    if (!emailRecipients.length) {
      console.warn('❌ No valid email addresses')
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

    console.log(`\n✅ SUCCESS: ${result.message}`)
    console.log('='.repeat(80) + '\n')

    return NextResponse.json({
      success: true,
      message: result.message,
      sent: result.sent,
      failed: result.failed,
    })
  } catch (error: any) {
    console.error('❌ CRITICAL ERROR:', error)
    console.log('='.repeat(80) + '\n')
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}