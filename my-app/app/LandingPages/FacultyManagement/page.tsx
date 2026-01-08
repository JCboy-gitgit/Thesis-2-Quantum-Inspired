'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import styles from './ParticipantSchedules.module.css'

interface ScheduleRow {
  id: number
  participant_number: string
  name: string
  email: string
  is_pwd: boolean
  batch_name: string
  room: string
  time_slot: string
  campus: string
  building: string
  is_first_floor: boolean
  seat_no: number
  batch_date: string | null
  start_time: string | null
  end_time: string | null
}

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

// ✅ Format full date & time
function formatDateTime(dateString: string | null, timeString: string): string {
  if (!dateString || !timeString) return 'N/A'
  try {
    const date = new Date(dateString)
    const dateFormatted = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    
    // Format time to 12-hour with AM/PM
    const [hours, minutes] = timeString.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const hours12 = hours % 12 || 12
    const timeFormatted = `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`
    
    return `${dateFormatted}, ${timeFormatted}`
  } catch {
    return `${dateString} ${timeString}`
  }
}

// ✅ Parse time slot with fallback
function parseTimeSlot(timeSlot: string, startTime?: string | null, endTime?: string | null): { start: string; end: string } {
  // Prefer individual start/end times from database
  if (startTime && endTime) {
    return { start: startTime, end: endTime }
  }
  
  // Fallback to parsing time_slot string
  try {
    const [start, end] = timeSlot.split(' - ').map(t => t.trim())
    return { start: start || 'N/A', end: end || 'N/A' }
  } catch {
    return { start: timeSlot, end: timeSlot }
  }
}

// ✅ Helper function to determine floor level from room number
function getFloorLevel(room: string): { level: number; label: string } {
  if (!room || room === 'N/A') {
    return { level: 0, label: 'Unknown' }
  }

  const roomLower = String(room).toLowerCase().trim()
  const digits = roomLower.replace(/\D/g, '')

  if (digits.length === 0) {
    return { level: 0, label: 'Unknown' }
  }

  const firstDigit = parseInt(digits[0])
  
  if (firstDigit === 1) return { level: 1, label: '1st Floor' }
  if (firstDigit === 2) return { level: 2, label: '2nd Floor' }
  if (firstDigit === 3) return { level: 3, label: '3rd Floor' }
  if (firstDigit === 4) return { level: 4, label: '4th Floor' }
  if (firstDigit === 5) return { level: 5, label: '5th Floor' }
  if (firstDigit === 6) return { level: 6, label: '6th Floor' }
  
  return { level: firstDigit, label: `${firstDigit}${firstDigit === 1 ? 'st' : firstDigit === 2 ? 'nd' : firstDigit === 3 ? 'rd' : 'th'} Floor` }
}

// ✅ Helper function to get CSS class for floor badge
function getFloorBadgeClass(styles: any, room: string): string {
  const { level } = getFloorLevel(room)
  
  if (level === 1) return styles.firstFloorBadge
  if (level === 2) return styles.secondFloorBadge
  if (level === 3) return styles.thirdFloorBadge
  
  return styles.upperFloorBadge
}

// ✅ SVG Component for Wheelchair Icon (PWD)
function WheelchairIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm3.5-9c.83 0 1.5-.67 1.5-1.5S14.33 4 13.5 4 12 4.67 12 5.5s.67 1.5 1.5 1.5z"/>
      <path d="M10 18c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
    </svg>
  )
}

// ✅ SVG Component for Building Icon (Campus)
function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M19 13h-6V3h6v10zm-6-10h-6v6H7v4H3v6h18v-6h-4v-4h-6V3z"/>
    </svg>
  )
}

// ✅ SVG Component for Floor Icon
function FloorIcon({ level }: { level: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '16px', height: '16px' }}
    >
      {level === 1 && (
        <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
      )}
      {level === 2 && (
        <>
          <path d="M12 4L4 8v6h16V8l-8-4z" opacity="0.3"/>
          <path d="M12 10L4 14v6h16v-6l-8-4z"/>
        </>
      )}
      {level === 3 && (
        <>
          <path d="M12 2L4 5v4h16V5l-8-3z" opacity="0.3"/>
          <path d="M12 8L4 11v4h16v-4l-8-3z" opacity="0.6"/>
          <path d="M12 14L4 17v4h16v-4l-8-3z"/>
        </>
      )}
      {level > 3 && (
        <>
          <path d="M12 2L4 5v3h16V5l-8-3z" opacity="0.2"/>
          <path d="M12 7L4 10v3h16v-3l-8-3z" opacity="0.5"/>
          <path d="M12 12L4 15v3h16v-3l-8-3z" opacity="0.8"/>
          <path d="M12 17L4 20v2h16v-2l-8-3z"/>
        </>
      )}
    </svg>
  )
}

function ParticipantSchedulesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const scheduleId = searchParams.get('scheduleId')

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [scheduleData, setScheduleData] = useState<ScheduleRow[]>([])
  const [filteredData, setFilteredData] = useState<ScheduleRow[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [sendingEmails, setSendingEmails] = useState(false)
  const [emailMessage, setEmailMessage] = useState('')
  const [scheduleSummary, setScheduleSummary] = useState<any>(null)
  const [scheduleSummaries, setScheduleSummaries] = useState<any[]>([]);
  const [selectedSummaryId, setSelectedSummaryId] = useState<string | null>(scheduleId);
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 100

  const topScrollRef = useRef<HTMLDivElement>(null)
  const bottomScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scheduleId) {
      setLoading(false)
      return
    }
    fetchScheduleData()
  }, [scheduleId])

  useEffect(() => {
    // Filter participants by name, participant number, email, batch, room, campus, building
    if (!searchTerm) {
      setFilteredData(scheduleData)
    } else {
      const term = searchTerm.toLowerCase()
      setFilteredData(
        scheduleData.filter(row =>
          row.name.toLowerCase().includes(term) ||
          row.participant_number.toLowerCase().includes(term) ||
          row.email.toLowerCase().includes(term) ||
          row.batch_name.toLowerCase().includes(term) ||
          row.room.toLowerCase().includes(term) ||
          row.campus.toLowerCase().includes(term) ||
          row.building.toLowerCase().includes(term)
        )
      )
    }
  }, [searchTerm, scheduleData])

  useEffect(() => {
    async function fetchSummary() {
      if (!scheduleId) return;
      const { data, error } = await supabase
        .from('schedule_summary')
        .select('*')
        .eq('id', scheduleId)
        .single();
      if (!error && data) {
        console.log('✅ Schedule Summary fetched:', data);
        setScheduleSummary(data);
      } else {
        console.error('❌ Error fetching schedule summary:', error);
      }
    }
    fetchSummary();
  }, [scheduleId])

  useEffect(() => {
    async function fetchSummaries() {
      const { data, error } = await supabase
        .from('schedule_summary')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) setScheduleSummaries(data);
    }
    fetchSummaries();
  }, []);

  const fetchScheduleData = async () => {
    if (!scheduleId) return

    setLoading(true)
    try {
      console.log(`📥 Fetching schedule data for ID: ${scheduleId}`)

      const assignments = await fetchAllRows('schedule_assignments', {
        schedule_summary_id: scheduleId
      })

      console.log(`✅ Loaded ${assignments.length} assignments`)

      if (assignments.length === 0) {
        setScheduleData([])
        setFilteredData([])
        setLoading(false)
        return
      }

      const participantIds = [...new Set(assignments.map((a: any) => a.participant_id))]
      
      console.log(`📥 Fetching ${participantIds.length} participants...`)
      let participants: any[] = []
      
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

      console.log(`✅ Fetched ${participants.length} participants`)

      const batches = await fetchAllRows('schedule_batches', {
        schedule_summary_id: scheduleId
      })

      console.log(`✅ Fetched ${batches.length} batches`)

      const participantMap = new Map(participants.map(p => [p.id, p]))
      const batchMap = new Map(batches.map(b => [b.id, b]))

      const combinedData: ScheduleRow[] = assignments.map((assignment: any) => {
        const participant = participantMap.get(assignment.participant_id)
        const batch = batchMap.get(assignment.schedule_batch_id)

        // Always prefer assignment data over batch data
        return {
          id: assignment.id,
          participant_number: participant?.participant_number || 'N/A',
          name: participant?.name || 'N/A',
          email: participant?.email || 'N/A',
          is_pwd: assignment.is_pwd || false,
          batch_name: batch?.batch_name || 'N/A',
          room: assignment.room || 'N/A', // Prefer assignment room
          time_slot: batch?.time_slot || 'N/A',
          campus: assignment.campus || 'N/A', // Remove Main Campus fallback
          building: assignment.building || 'N/A', // Remove fallback
          is_first_floor: assignment.is_first_floor ?? false,
          seat_no: assignment.seat_no || 0,
          batch_date: assignment.batch_date || batch?.batch_date || null,
          start_time: assignment.start_time || batch?.start_time || null,
          end_time: assignment.end_time || batch?.end_time || null
        }
      })

      // Add after the combinedData mapping
      console.log('Sample assignments data:', assignments.slice(0, 5).map(a => ({
        campus: a.campus,
        building: a.building,
        room: a.room
      })))

      console.log('Sample combined data:', combinedData.slice(0, 5).map(d => ({
        campus: d.campus,
        building: d.building,
        room: d.room
      })))

      console.log(`✅ Combined ${combinedData.length} schedule entries`)

      setScheduleData(combinedData)
      setFilteredData(combinedData)
    } catch (error) {
      console.error('❌ Error fetching schedule data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSendEmails() {
    if (!scheduleId) {
      setEmailMessage('❌ No schedule ID found')
      return
    }

    setSendingEmails(true)
    setEmailMessage('📧 Sending emails to all participants...')

    try {
      console.log(`\n${'='.repeat(80)}`)
      console.log(`🚀 Sending emails for schedule ID: ${scheduleId}`)
      console.log(`${'='.repeat(80)}`)

      const res = await fetch('/api/schedule/send-batch-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule_id: Number(scheduleId) }),
      })

      const data = await res.json()

      console.log(`\n📥 API Response:`, data)

      if (res.ok) {
        setEmailMessage(
          `✅ ${data.message}${
            data.failedList?.length > 0
              ? ` | Failed: ${data.failedList.map((f: any) => f.email).join(', ')}`
              : ''
          }`
        )
      } else {
        setEmailMessage(`❌ ${data.error || 'Unknown error'}`)
      }
    } catch (e: any) {
      console.error('❌ Error:', e)
      setEmailMessage(`❌ ${e.message}`)
    } finally {
      setSendingEmails(false)
    }
  }

  async function handleExportCSV() {
    if (scheduleData.length === 0) {
      alert('No data to export')
      return
    }

    const headers = [
      'Participant #', 
      'Name', 
      'Email', 
      'PWD', 
      'Batch', 
      'Starting Date & Time', 
      'Ending Date & Time',
      'Campus',
      'Building',
      'Floor',
      'Room', 
      'Seat No'
    ]
    
    const rows = scheduleData.map(row => {
      const { start, end } = parseTimeSlot(row.time_slot, row.start_time, row.end_time)
      const floor = getFloorLevel(row.room)
      return [
        row.participant_number,
        row.name,
        row.email,
        row.is_pwd ? 'Yes' : 'No',
        row.batch_name,
        formatDateTime(row.batch_date, start),
        formatDateTime(row.batch_date, end),
        row.campus,
        row.building,
        floor.label,
        row.room,
        row.seat_no.toString()
      ]
    })

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `schedule_${scheduleId}_detailed.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE)
  const paginatedData = filteredData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  if (loading) {
    return (
      <div className={styles.scheduleLayout}>
        <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
        <Sidebar isOpen={sidebarOpen} />
        <main className={`${styles.scheduleMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Loading schedule data...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.scheduleLayout}>
      <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`${styles.scheduleMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
        <div className={styles.scheduleContainer}>
          <div className={styles.scheduleHeaderRow}>
            <div className={styles.headerLeft}>
              <button className={styles.backButton} onClick={() => router.back()}>
                <span className={styles.iconBack}>←</span>
                Back
              </button>
            </div>
            <div className={styles.headerRight}>
              <button
                onClick={handleSendEmails}
                disabled={sendingEmails || scheduleData.length === 0}
                className={styles.btnPrimary}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
                {sendingEmails ? 'Sending...' : 'Send Emails'}
              </button>
              <button
                onClick={handleExportCSV}
                disabled={scheduleData.length === 0}
                className={styles.btnSecondary}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
                Export CSV
              </button>
            </div>
          </div>
          <div className={styles.scheduleHeader}>
            <div className={styles.headerTitleSection}>
              <div className={styles.headerIconWrapper}>
                <svg className={styles.headerLargeIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="currentColor"/>
                </svg>
              </div>
              <div className={styles.headerText}>
                <h1 className={styles.scheduleTitle}>Participant Schedules</h1>
                <p className={styles.scheduleSubtitle}>{filteredData.length} participants scheduled</p>
              </div>
            </div>
            
          </div>
          <div className={styles.selectionPanel}>
  <h2 className={styles.selectionTitle}>
    <svg className={styles.selectionTitleIcon} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="4" fill="#2563eb"/>
      <path d="M7 9h10M7 13h6" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
    </svg>
    Select a Schedule
  </h2>
  <div className={styles.selectionList}>
    {scheduleSummaries.length === 0 ? (
      <div className={styles.selectionEmpty}>No schedules found.</div>
    ) : (
      scheduleSummaries.map(summary => (
        <button
          key={summary.id}
          className={`${styles.selectionItem} ${String(summary.id) === String(scheduleId) ? styles.selected : ''}`}
          onClick={() => {
            setSelectedSummaryId(String(summary.id));
            router.replace(`?scheduleId=${summary.id}`);
          }}
        >
          <div className={styles.selectionCardIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="6" width="16" height="12" rx="3" fill="#2563eb"/>
              <path d="M8 10h8M8 14h5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className={styles.selectionCardContent}>
            <div className={styles.selectionCardHeader}>
              <span className={styles.selectionName}>ID: {summary.id}</span>
              <span className={styles.selectionStatus + ' ' + (summary.status === 'completed' ? styles.statusCompleted : styles.statusPending)}>
                {summary.status === 'completed' ? 'Completed' : 'Pending'}
              </span>
            </div>
            <div className={styles.selectionCardTitle}>{summary.event_name}</div>
            <div className={styles.selectionCardDetails}>
              <span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{verticalAlign: 'middle', marginRight: 4}}>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/>
                  <rect x="3" y="11" width="18" height="8" rx="4" fill="#e0e7ff"/>
                </svg>
                {summary.schedule_date} {summary.start_time} - {summary.end_time}
              </span>
              <span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{verticalAlign: 'middle', marginRight: 4}}>
                  <circle cx="12" cy="12" r="10" fill="#e0e7ff"/>
                  <path d="M12 8v4l3 3" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {summary.scheduled_count} scheduled
              </span>
            </div>
          </div>
        </button>
      ))
    )}
  </div>
</div>
          <div className={styles.searchSection}>
            <div className={styles.searchBox}>
              <input
                type="text"
                placeholder="Search by name, participant #, email, batch, room, campus, building..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>

          {emailMessage && (
            <div className={`${styles.message} ${emailMessage.includes('✅') ? styles.success : styles.error}`}>
              {emailMessage}
            </div>
          )}

          <div className={styles.tableSection}>
            {/* Top scrollbar (syncs with bottom) */}
<div
  className={styles.tableScrollTopBar}
  style={{ width: '100%', overflowX: 'auto' }}
  ref={topScrollRef}
  onScroll={e => {
    if (bottomScrollRef.current) {
      bottomScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }}
>
  <div style={{ width: '1600px', height: '8px' }}></div>
</div>
<div
  className={styles.tableScrollWrapper}
  ref={bottomScrollRef}
  onScroll={e => {
    if (topScrollRef.current) {
      topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }}
>
  <div className={styles.tableContainer}>
    <table className={styles.participantsTable}>
      <thead>
        <tr>
          <th className={styles.stickyCol}>Participant #</th>
          <th className={styles.stickyCol2}>Name</th>
          <th>Email</th>
          <th>PWD</th>
          <th>Batch</th>
          <th>Starting Date & Time</th>
          <th>Ending Date & Time</th>
          <th>Campus</th>
          <th>Building</th>
          <th>Floor</th>
          <th>Room</th>
          <th>Seat</th>
        </tr>
      </thead>
      <tbody>
        {paginatedData.map((row, idx) => {
          const { start, end } = parseTimeSlot(row.time_slot, row.start_time, row.end_time)
          const floor = getFloorLevel(row.room)
          return (
            <tr key={row.id || idx} id={`participant-row-${row.id}`}>
              <td className={`${styles.fontSemibold} ${styles.stickyCol}`}>{row.participant_number}</td>
              <td className={styles.stickyCol2}>{row.name}</td>
              <td className={styles.emailCell}>{row.email}</td>
              <td>
                <span className={`${styles.pwdBadge} ${row.is_pwd ? styles.yes : styles.no}`}>
                  {row.is_pwd && (
                    <WheelchairIcon className={styles.badgeIcon} />
                  )}
                  <span>{row.is_pwd ? 'Yes' : 'No'}</span>
                </span>
              </td>
              <td>
                <span className={styles.batchBadge}>{row.batch_name}</span>
              </td>
              <td className={styles.dateTimeCell}>
                {formatDateTime(row.batch_date, start)}
              </td>
              <td className={styles.dateTimeCell}>
                {formatDateTime(row.batch_date, end)}
              </td>
              <td className={styles.locationCell}>{row.campus}</td>
              <td className={styles.locationCell}>{row.building}</td>
              <td className={styles.floorCell}>
                {(() => {
                  const badgeClass = getFloorBadgeClass(styles, row.room)
                  
                  return (
                    <span className={badgeClass}>
                      <FloorIcon level={floor.level} />
                      {floor.label}
                    </span>
                  )
                })()}
              </td>
              <td className={styles.roomCell}>{row.room}</td>
              <td className={styles.seatCell}>{row.seat_no}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  </div>
</div>
{/* Pagination Controls */}
<div className={styles.paginationWrapper}>
  <button
    className={styles.paginationBtn}
    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
    disabled={currentPage === 1}
  >
    &lt; Prev
  </button>
  {/* Smart pagination: show first, last, current, +/-2, with ellipsis */}
  {totalPages <= 10
    ? Array.from({ length: totalPages }, (_, i) => (
        <button
          key={i + 1}
          className={`${styles.paginationBtn} ${currentPage === i + 1 ? styles.activePage : ''}`}
          onClick={() => setCurrentPage(i + 1)}
        >
          {i + 1}
        </button>
      ))
    : (() => {
        const pages = []
        if (currentPage > 3) {
          pages.push(
            <button
              key={1}
              className={`${styles.paginationBtn} ${currentPage === 1 ? styles.activePage : ''}`}
              onClick={() => setCurrentPage(1)}
            >
              1
            </button>
          )
          if (currentPage > 4) {
            pages.push(<span key="start-ellipsis" className={styles.paginationEllipsis}>...</span>)
          }
        }
        for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
          pages.push(
            <button
              key={i}
              className={`${styles.paginationBtn} ${currentPage === i ? styles.activePage : ''}`}
              onClick={() => setCurrentPage(i)}
            >
              {i}
            </button>
          )
        }
        if (currentPage < totalPages - 2) {
          if (currentPage < totalPages - 3) {
            pages.push(<span key="end-ellipsis" className={styles.paginationEllipsis}>...</span>)
          }
          pages.push(
            <button
              key={totalPages}
              className={`${styles.paginationBtn} ${currentPage === totalPages ? styles.activePage : ''}`}
              onClick={() => setCurrentPage(totalPages)}
            >
              {totalPages}
            </button>
          )
        }
        return pages
      })()
  }
  <button
    className={styles.paginationBtn}
    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
    disabled={currentPage === totalPages}
  >
    Next &gt;
  </button>
</div>
          </div>
        </div>
      </main>
    </div>
  )
}

// Loading fallback
function LoadingFallback() {
  return <div>Loading participant schedules...</div>
}

// Main export wrapped in Suspense
export default function ParticipantSchedulesPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ParticipantSchedulesContent />
    </Suspense>
  )
}