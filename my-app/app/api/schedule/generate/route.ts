import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const dynamic = 'force-dynamic'

// Helper to fetch schedule_batches from Supabase, selecting all columns as per SQL schema
async function fetchScheduleBatches(scheduleSummaryId: number) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase environment variables not set')
  }
  // Select all columns explicitly for clarity and future-proofing
  const columns = [
    'id',
    'schedule_summary_id',
    'batch_name',
    'room',
    'time_slot',
    'participant_count',
    'has_pwd',
    'created_at',
    'participant_ids',
    'batch_date',
    'campus',
    'building',
    'is_first_floor',
    'start_time',
    'end_time',
    'batch_number'
  ].join(',')

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/schedule_batches?select=${columns}&schedule_summary_id=eq.${scheduleSummaryId}&order=batch_number.asc`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }
    }
  )
  if (!res.ok) {
    throw new Error(`Failed to fetch schedule_batches: ${await res.text()}`)
  }
  return await res.json()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[REQUEST] Forwarding to backend:', BACKEND_URL)
    console.log('[REQUEST] Body:', JSON.stringify(body, null, 2))

    // Validate request body
    if (!body.campusGroupId || !body.participantGroupId) {
      console.error('❌ Invalid request body - missing required fields')
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: campusGroupId and participantGroupId',
        },
        { status: 400 }
      )
    }

    // Convert camelCase to snake_case for FastAPI
    const backendPayload = {
      campus_group_id: body.campusGroupId,
      participant_group_id: body.participantGroupId,
      event_name: body.eventName,
      event_type: body.eventType,
      schedule_date: body.scheduleDate,
      start_date: body.startDate || body.scheduleDate,
      end_date: body.endDate || body.scheduleDate,
      start_time: body.startTime,
      end_time: body.endTime,
      duration_per_batch: body.durationPerBatch,
      prioritize_pwd: body.prioritizePWD,
      email_notification: body.emailNotification
    }

    let response
    try {
      response = await fetch(`${BACKEND_URL}/api/schedule/schedule`, { // <-- FIXED ENDPOINT
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(backendPayload),
      })
    } catch (error: any) {
      console.error('❌ Fetch error:', error)
      if (error.message?.includes('fetch failed') || error.code === 'ECONNREFUSED') {
        return NextResponse.json(
          { 
            error: 'Cannot connect to backend server. Please ensure the backend is running at ' + BACKEND_URL,
            success: false,
            backend_url: BACKEND_URL
          },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { 
          error: error.message || 'Internal server error',
          success: false
        },
        { status: 500 }
      )
    }

    console.log('📡 Backend response status:', response.status)

    const responseText = await response.text()
    if (!response.ok) {
      console.error('❌ Backend error:', responseText)
      let errorData
      try {
        errorData = JSON.parse(responseText)
      } catch {
        errorData = { error: responseText || 'Backend request failed' }
      }
      return NextResponse.json(
        { 
          error: errorData.error || errorData.detail || 'Failed to generate schedule',
          success: false
        },
        { status: response.status }
      )
    }

    let data
    try {
      data = JSON.parse(responseText)
      console.log('✅ Backend response:', data)
    } catch (parseError) {
      console.error('❌ Failed to parse response as JSON:', parseError)
      return NextResponse.json(
        { 
          error: 'Invalid response format from backend',
          success: false,
          details: responseText.substring(0, 200)
        },
        { status: 500 }
      )
    }

    // Fetch schedule_batches from Supabase using schedule_summary_id
    let batches = []
    if (data.schedule_summary_id) {
      try {
        batches = await fetchScheduleBatches(data.schedule_summary_id)
        console.log('✅ Fetched schedule_batches:', batches.length)
      } catch (err) {
        console.error('❌ Error fetching schedule_batches:', err)
        // Still return the original data, but include error info
        return NextResponse.json({
          ...data,
          batches: [],
          fetch_batches_error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    // Return the schedule result and batches
    return NextResponse.json({
      ...data,
      batches,
      success: true,
    })

  } catch (error: any) {
    console.error('❌ API Route Error:', error)
    if (error.message?.includes('fetch failed') || error.code === 'ECONNREFUSED') {
      return NextResponse.json(
        { 
          error: 'Cannot connect to backend server. Please ensure the backend is running at ' + BACKEND_URL,
          success: false,
          backend_url: BACKEND_URL
        },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        success: false
      },
      { status: 500 }
    )
  }
}

// CORS preflight handler
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

