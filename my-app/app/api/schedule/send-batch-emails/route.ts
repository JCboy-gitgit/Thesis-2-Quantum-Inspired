import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { sendEmail } from '@/lib/emailService'

// ✅ Helper: Format time with AM/PM
function formatTime12Hour(time24: string): string {
  try {
    const [hours, minutes] = time24.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const hours12 = hours % 12 || 12
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`
  } catch {
    return time24
  }
}

// ✅ Helper: Format date range
function formatDateRange(startDate: string, endDate: string): string {
  try {
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    }
    
    const startFormatted = start.toLocaleDateString('en-US', options)
    
    if (startDate === endDate) {
      return startFormatted
    }
    
    const endFormatted = end.toLocaleDateString('en-US', options)
    return `${startFormatted} to ${endFormatted}`
  } catch {
    return startDate
  }
}

// ✅ Helper: Format time slot with AM/PM
function formatTimeSlot(timeSlot: string): string {
  try {
    const [startTime, endTime] = timeSlot.split(' - ')
    const startFormatted = formatTime12Hour(startTime.trim())
    const endFormatted = formatTime12Hour(endTime.trim())
    return `${startFormatted} - ${endFormatted}`
  } catch {
    return timeSlot
  }
}

// ✅ Helper: Fetch all rows (pagination)
async function fetchAllRows(table: string, filters: Record<string, any> = {}, orderColumn: string = 'created_at') {
  const PAGE_SIZE = 1000
  let allData: any[] = []
  let page = 0
  let hasMore = true

  console.log(`🔄 Starting pagination for table: ${table}, filters:`, filters)

  while (hasMore) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    console.log(`   📄 Fetching page ${page + 1}: rows ${from}-${to}`)

    let query = supabase
      .from(table)
      .select('*')
      .range(from, to)
      .order(orderColumn, { ascending: false })

    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value)
    })

    const { data, error } = await query

    if (error) {
      console.error(`❌ Error on page ${page + 1}:`, error)
      throw error
    }
    
    if (!data || data.length === 0) {
      console.log(`   ✅ No more data on page ${page + 1}`)
      hasMore = false
      break
    }

    console.log(`   ✅ Fetched ${data.length} rows on page ${page + 1}`)
    allData = [...allData, ...data]
    
    if (data.length < PAGE_SIZE) {
      console.log(`   ✅ Last page reached (${data.length} < ${PAGE_SIZE})`)
      hasMore = false
    }
    
    page++
  }

  console.log(`✅ Total rows fetched from ${table}: ${allData.length}`)
  return allData
}

// ✅ NEW: Retry logic with exponential backoff
async function sendEmailWithRetry(emailData: any, maxRetries = 3): Promise<void> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sendEmail(emailData)
      return // Success!
    } catch (error: any) {
      lastError = error
      
      // Check if it's a temporary Gmail error (421)
      if (error.message?.includes('421') || error.message?.includes('Temporary System Problem')) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // Exponential backoff: 1s, 2s, 4s (max 10s)
        console.log(`⚠️  Attempt ${attempt}/${maxRetries} failed for ${emailData.to}. Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        // Non-temporary error, don't retry
        throw error
      }
    }
  }
  
  // All retries failed
  throw lastError || new Error('All retry attempts failed')
}

export async function POST(request: NextRequest) {
  try {
    const { schedule_id } = await request.json()

    if (!schedule_id) {
      return NextResponse.json(
        { error: 'schedule_id is required' },
        { status: 400 }
      )
    }

    console.log(`\n${'='.repeat(100)}`)
    console.log(`📧 SENDING BATCH EMAILS FOR SCHEDULE ${schedule_id}`)
    console.log(`${'='.repeat(100)}`)

    // Fetch schedule summary
    console.log('📅 Fetching schedule summary...')
    const { data: summary, error: summaryError } = await supabase
      .from('schedule_summary')
      .select('*')
      .eq('id', schedule_id)
      .single()

    if (summaryError || !summary) {
      console.error('❌ Failed to fetch schedule summary:', summaryError)
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    const scheduleDate = summary.schedule_date
    const endDate = summary.end_date || summary.schedule_date
    const eventName = summary.event_name || 'Your Event'
    const eventType = summary.event_type || 'Event'

    console.log(`✅ Event: ${eventName} (${eventType})`)
    console.log(`📅 Date Range: ${scheduleDate} to ${endDate}`)

    // Fetch ALL batches
    console.log('\n📥 Fetching ALL batches...')
    const batches = await fetchAllRows(
      'schedule_batches',
      { schedule_summary_id: schedule_id },
      'batch_name'
    )
    console.log(`✅ Fetched ${batches.length} batches`)

    if (batches.length === 0) {
      return NextResponse.json(
        { error: 'No batches found for this schedule' },
        { status: 404 }
      )
    }

    // Fetch ALL assignments
    console.log('📥 Fetching ALL assignments...')
    let assigns: any[] = []
    try {
      assigns = await fetchAllRows(
        'schedule_assignments',
        { schedule_summary_id: schedule_id },
        'schedule_batch_id'
      )
      console.log(`✅ Fetched ${assigns.length} assignments`)
    } catch (e: any) {
      console.warn('⚠️  schedule_assignments not available, using participant_ids from batches')
      console.warn('Error:', e.message)
    }

    // Collect participant IDs
    const pids = new Set<number>()
    if (assigns.length > 0) {
      assigns.forEach(a => {
        if (a.participant_id) {
          pids.add(a.participant_id)
        }
      })
    } else {
      batches.forEach(b => {
        if (Array.isArray(b.participant_ids)) {
          b.participant_ids.forEach((id: number) => pids.add(id))
        }
      })
    }

    console.log(`👥 Total unique participants: ${pids.size}`)

    if (pids.size === 0) {
      return NextResponse.json(
        { error: 'No participants found in schedule' },
        { status: 404 }
      )
    }

    // Fetch ALL participants in chunks
    console.log('📥 Fetching ALL participant details...')
    const participants: any[] = []
    const pidArray = Array.from(pids)
    const CHUNK_SIZE = 1000

    for (let i = 0; i < pidArray.length; i += CHUNK_SIZE) {
      const chunk = pidArray.slice(i, i + CHUNK_SIZE)
      console.log(`   Fetching chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(pidArray.length / CHUNK_SIZE)} (${chunk.length} IDs)`)
      
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .in('id', chunk)

      if (error) {
        console.error(`❌ Error fetching participants chunk:`, error)
        throw error
      }
      
      if (data) {
        participants.push(...data)
        console.log(`   ✅ Fetched ${data.length} participants`)
      }
    }

    console.log(`✅ Total participants fetched: ${participants.length}`)

    if (participants.length === 0) {
      return NextResponse.json(
        { error: 'No participant details found' },
        { status: 404 }
      )
    }

    const pmap = new Map(participants.map(p => [p.id, p]))
    const bmap = new Map(batches.map(b => [b.id, b]))

    // ✅ NEW: Prepare email data (without sending yet)
    const emailQueue: Array<{ data: any; participant: any }> = []
    const dateRangeFormatted = formatDateRange(scheduleDate, endDate)

    console.log(`\n📨 Preparing email queue for ${participants.length} participants...`)

    if (assigns.length > 0) {
      console.log('Using schedule_assignments table...')
      for (const a of assigns) {
        const p = pmap.get(a.participant_id)
        const b = bmap.get(a.schedule_batch_id)
        
        if (!p || !b || !p.email) continue

        const timeSlotFormatted = formatTimeSlot(b.time_slot)

        emailQueue.push({
          participant: p,
          data: {
            to: p.email,
            subject: `${eventName} - Your Schedule Confirmation`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 800;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 8px;">
                      <path d="M12 14l9-5-9-5-9 5 9 5z" stroke="currentColor" stroke-width="2"/>
                      <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" stroke="currentColor" stroke-width="2"/>
                      <path d="M12 14v6" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    ${eventName}
                  </h1>
                  <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${eventType}</p>
                </div>
                
                <div style="background-color: white; padding: 35px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                  <h2 style="color: #4f46e5; margin-top: 0; font-size: 22px;">Hello, ${p.name}!</h2>
                  
                  <p style="color: #666; line-height: 1.6; font-size: 15px;">
                    Your appointment has been confirmed. Please review your schedule details below:
                  </p>
                  
                  <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #4f46e5;">
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 12px 0; color: #666; font-weight: 700; font-size: 14px; width: 40%;">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 4px;">
                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                          Participant #:
                        </td>
                        <td style="padding: 12px 0; color: #1f2937; font-weight: 600; font-size: 15px;">${p.participant_number}</td>
                      </tr>
                      <tr style="border-top: 1px solid #d1d5db;">
                        <td style="padding: 12px 0; color: #666; font-weight: 700; font-size: 14px;">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 4px;">
                            <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                          Date:
                        </td>
                        <td style="padding: 12px 0; color: #1f2937; font-weight: 600; font-size: 15px;">${dateRangeFormatted}</td>
                      </tr>
                      <tr style="border-top: 1px solid #d1d5db;">
                        <td style="padding: 12px 0; color: #666; font-weight: 700; font-size: 14px;">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 4px;">
                            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                          Time:
                        </td>
                        <td style="padding: 12px 0; color: #1f2937; font-weight: 600; font-size: 15px;">${timeSlotFormatted}</td>
                      </tr>
                      ${b.campus ? `
                      <tr style="border-top: 1px solid #d1d5db;">
                        <td style="padding: 12px 0; color: #666; font-weight: 700; font-size: 14px;">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 4px;">
                            <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                          Campus:
                        </td>
                        <td style="padding: 12px 0; color: #1f2937; font-weight: 600; font-size: 15px;">${b.campus}</td>
                      </tr>
                      ` : ''}
                      ${b.building ? `
                      <tr style="border-top: 1px solid #d1d5db;">
                        <td style="padding: 12px 0; color: #666; font-weight: 700; font-size: 14px;">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 4px;">
                            <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                          Building:
                        </td>
                        <td style="padding: 12px 0; color: #1f2937; font-weight: 600; font-size: 15px;">${b.building}</td>
                      </tr>
                      ` : ''}
                      ${b.is_first_floor !== undefined ? `
                      <tr style="border-top: 1px solid #d1d5db;">
                        <td style="padding: 12px 0; color: #666; font-weight: 700; font-size: 14px;">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 4px;">
                            <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                          Floor:
                        </td>
                        <td style="padding: 12px 0; color: #1f2937; font-weight: 600; font-size: 15px;">
                          ${b.is_first_floor ? '1st Floor <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : 'Upper Floor'}
                        </td>
                      </tr>
                      ` : ''}
                      <tr style="border-top: 1px solid #d1d5db;">
                        <td style="padding: 12px 0; color: #666; font-weight: 700; font-size: 14px;">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 4px;">
                            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                          Room:
                        </td>
                        <td style="padding: 12px 0; color: #1f2937; font-weight: 600; font-size: 15px;">${b.room}</td>
                      </tr>
                      <tr style="border-top: 1px solid #d1d5db;">
                        <td style="padding: 12px 0; color: #666; font-weight: 700; font-size: 14px;">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 4px;">
                            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                          Seat #:
                        </td>
                        <td style="padding: 12px 0; color: #1f2937; font-weight: 600; font-size: 15px;">${a.seat_no}</td>
                      </tr>
                      <tr style="border-top: 1px solid #d1d5db;">
                        <td style="padding: 12px 0; color: #666; font-weight: 700; font-size: 14px;">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 4px;">
                            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                          Batch:
                        </td>
                        <td style="padding: 12px 0; color: #1f2937; font-weight: 600; font-size: 15px;">${b.batch_name}</td>
                      </tr>
                    </table>
                  </div>
                  
                  ${p.is_pwd ? `
                    <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-left: 5px solid #3b82f6; padding: 18px; margin: 25px 0; border-radius: 8px;">
                      <p style="margin: 0; color: #1e40af; font-weight: 600; font-size: 15px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 8px;">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <strong>PWD Accommodation:</strong> Your room is located on the ${b.is_first_floor ? '1st floor' : 'an accessible floor'} for easy access and comfort.
                      </p>
                    </div>
                  ` : ''}
                  
                  <div style="margin-top: 30px; padding: 25px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 10px; border-left: 5px solid #f59e0b;">
                    <h3 style="margin: 0 0 15px 0; color: #92400e; font-size: 16px; font-weight: 700;">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 6px;">
                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      Important Reminders:
                    </h3>
                    <ul style="margin: 0; padding-left: 20px; color: #78350f; line-height: 1.8;">
                      <li style="margin-bottom: 8px;">Please arrive <strong>15 minutes early</strong></li>
                      <li style="margin-bottom: 8px;">Bring a <strong>valid ID</strong> and this email confirmation</li>
                      ${b.campus ? `<li style="margin-bottom: 8px;">Go to <strong>${b.campus}</strong> campus</li>` : ''}
                      ${b.building ? `<li style="margin-bottom: 8px;">Proceed to <strong>${b.building}</strong></li>` : ''}
                      ${b.is_first_floor !== undefined ? `<li style="margin-bottom: 8px;">Room is on the <strong>${b.is_first_floor ? '1st Floor' : 'Upper Floor'}</strong></li>` : ''}
                      <li style="margin-bottom: 8px;">Follow all health and safety protocols</li>
                      <li>For questions, reply to this email or contact support</li>
                    </ul>
                  </div>
                </div>
                
                <div style="text-align: center; margin-top: 25px; padding: 20px; color: #9ca3af; font-size: 13px; border-top: 2px solid #e5e7eb;">
                  <p style="margin: 0;">
                    <strong style="color: #6b7280;">Qtime Scheduler System</strong><br>
                    Automated scheduling with accessibility in mind
                  </p>
                </div>
              </div>
            `
          }
        })
      }
    }

    console.log(`📧 Email queue prepared: ${emailQueue.length} emails`)

    if (emailQueue.length === 0) {
      return NextResponse.json(
        { error: 'No valid emails to send' },
        { status: 400 }
      )
    }

    // ✅ NEW: Send emails with SLOWER rate limiting + retry logic
    const successList: any[] = []
    const failedList: any[] = []
    const BATCH_SIZE = 10 // ✅ REDUCED from 50 to 10 (safer for Gmail)
    const DELAY_BETWEEN_EMAILS = 200 // ✅ 200ms delay between each email
    const DELAY_BETWEEN_BATCHES = 5000 // ✅ 5 second delay between batches

    console.log(`\n📤 Sending ${emailQueue.length} emails with rate limiting...`)
    console.log(`   📦 Batch size: ${BATCH_SIZE}`)
    console.log(`   ⏱️  Delay between emails: ${DELAY_BETWEEN_EMAILS}ms`)
    console.log(`   ⏱️  Delay between batches: ${DELAY_BETWEEN_BATCHES}ms`)

    for (let i = 0; i < emailQueue.length; i += BATCH_SIZE) {
      const batch = emailQueue.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(emailQueue.length / BATCH_SIZE)
      
      console.log(`\n   📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} emails)...`)
      
      // ✅ Send emails sequentially with delay (not parallel)
      for (const item of batch) {
        try {
          await sendEmailWithRetry(item.data, 3) // 3 retries
          successList.push({ name: item.participant.name, email: item.participant.email })
          console.log(`✅ Sent to: ${item.participant.email}`)
        } catch (err: any) {
          failedList.push({ name: item.participant.name, email: item.participant.email, error: err.message })
          console.error(`❌ Failed (after retries): ${item.participant.email}`)
        }
        
        // ✅ Delay between individual emails
        if (batch.indexOf(item) < batch.length - 1) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_EMAILS))
        }
      }
      
      console.log(`   ✅ Batch ${batchNum} completed`)
      
      // ✅ Delay between batches
      if (i + BATCH_SIZE < emailQueue.length) {
        console.log(`   ⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`)
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
      }
    }

    console.log(`\n${'='.repeat(100)}`)
    console.log(`📊 EMAIL SENDING SUMMARY`)
    console.log(`${'='.repeat(100)}`)
    console.log(`✅ Successful: ${successList.length}`)
    console.log(`❌ Failed: ${failedList.length}`)
    console.log(`📧 Total: ${emailQueue.length}`)
    console.log(`${'='.repeat(100)}\n`)

    return NextResponse.json({
      success: true,
      message: `Successfully sent ${successList.length} emails${failedList.length > 0 ? `, ${failedList.length} failed` : ''}`,
      successCount: successList.length,
      failedCount: failedList.length,
      totalEmails: emailQueue.length,
      successList: successList.map(s => s.email),
      failedList: failedList.map(f => ({ email: f.email, error: f.error }))
    })

  } catch (error: any) {
    console.error('❌ Batch email error:', error)
    console.error('Stack trace:', error.stack)
    return NextResponse.json(
      { error: error.message || 'Failed to send batch emails' },
      { status: 500 }
    )
  }
}