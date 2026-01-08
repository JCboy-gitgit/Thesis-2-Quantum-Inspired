import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

// Helper function to fetch ALL rows (bypass 1000 limit)
async function fetchAllRows(table: string, filters: any = {}) {
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
      .order('id', { ascending: true })

    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value)
    }

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Await params (Next.js 15 requirement)
    const resolvedParams = await params
    const scheduleId = Number(resolvedParams.id)

    console.log(`\n📥 Export schedule ${scheduleId}`)

    // ✅ Fetch ALL assignments (not limited to 1000)
    const assignments = await fetchAllRows('schedule_assignments', {
      schedule_summary_id: scheduleId
    })

    console.log(`Found ${assignments.length} assignments`)

    if (assignments.length === 0) {
      return NextResponse.json({ error: 'No schedule data found' }, { status: 404 })
    }

    // Get unique participant IDs
    const participantIds = [...new Set(assignments.map((a: any) => a.participant_id))]
    
    // ✅ Fetch ALL participants (handle large datasets)
    console.log(`Fetching ${participantIds.length} participants...`)
    let participants: any[] = []
    
    // Fetch in chunks of 1000 IDs at a time (Supabase query limit)
    const CHUNK_SIZE = 1000
    for (let i = 0; i < participantIds.length; i += CHUNK_SIZE) {
      const chunk = participantIds.slice(i, i + CHUNK_SIZE)
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .in('id', chunk)
      
      if (error) throw error
      if (data) participants = [...participants, ...data]
    }

    console.log(`Fetched ${participants.length} participants`)

    // ✅ Fetch ALL batches
    const batches = await fetchAllRows('schedule_batches', {
      schedule_summary_id: scheduleId
    })

    console.log(`Fetched ${batches.length} batches`)

    // Create lookup maps
    const participantMap = new Map(participants.map(p => [p.id, p]))
    const batchMap = new Map(batches.map(b => [b.id, b]))

    // Build export data
    const exportData = assignments.map((assignment: any) => {
      const participant = participantMap.get(assignment.participant_id)
      const batch = batchMap.get(assignment.schedule_batch_id)

      return {
        'Participant #': participant?.participant_number || 'N/A',
        'Name': participant?.name || 'N/A',
        'Email': participant?.email || 'N/A',
        'PWD': assignment.is_pwd ? 'Yes' : 'No',
        'Batch': batch?.batch_name || 'N/A',
        'Room': batch?.room || 'N/A',
        'Time': batch?.time_slot || 'N/A',
        'Campus': batch?.campus || 'N/A',
        'Seat No': assignment.seat_no
      }
    })

    console.log(`✅ Exported ${exportData.length} schedule rows`)

    // Convert to CSV
    const headers = Object.keys(exportData[0])
    const csvRows = [
      headers.join(','),
      ...exportData.map(row => 
        headers.map(header => {
          const value = row[header as keyof typeof row]
          // Escape commas and quotes
          return typeof value === 'string' && (value.includes(',') || value.includes('"'))
            ? `"${value.replace(/"/g, '""')}"`
            : value
        }).join(',')
      )
    ]
    const csv = csvRows.join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="schedule_${scheduleId}.csv"`
      }
    })

  } catch (error: any) {
    console.error('❌ Export error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export schedule' },
      { status: 500 }
    )
  }
}